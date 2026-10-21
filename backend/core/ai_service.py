"""
backend/core/ai_service.py
Módulo de Inteligencia Artificial para AgroFlow utilizando Groq Cloud API
"""

import urllib.request
import json
import logging
import os
from django.conf import settings
from .models import Sector, Cuadrilla, Trabajador, SolicitudTraslado, SolicitudInsumo, Incidencia

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = getattr(settings, 'GROQ_API_KEY', os.environ.get('GROQ_API_KEY', ''))
DEFAULT_GROQ_MODEL = getattr(settings, 'GROQ_MODEL', 'openai/gpt-oss-120b')

def call_groq(messages, model=DEFAULT_GROQ_MODEL, temperature=0.3, max_tokens=1200, json_mode=False):
    """
    Envía mensajes a Groq API con manejo de encabezados, json_mode y fallback de modelos.
    """
    headers = {
        'Authorization': f'Bearer {GROQ_API_KEY}',
        'Content-Type': 'application/json',
        'User-Agent': 'AgroFlow-ERP/2.0 (Roots SAC)'
    }

    # Modelos de fallback en caso de saturación o límite de tasa
    models_to_try = [model, 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']

    for current_model in models_to_try:
        payload = {
            'model': current_model,
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens
        }
        if json_mode:
            payload['response_format'] = {'type': 'json_object'}

        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(GROQ_API_URL, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                result = json.loads(response.read().decode('utf-8'))
                return result['choices'][0]['message']['content'].strip()
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='ignore')
            logger.warning(f"Groq API HTTPError {e.code} con modelo {current_model}: {err_body}")
            # Si el modelo rechaza json_object, reintentar sin ese parámetro
            if e.code in [400, 422] and json_mode and 'response_format' in payload:
                try:
                    del payload['response_format']
                    data_retry = json.dumps(payload).encode('utf-8')
                    req_retry = urllib.request.Request(GROQ_API_URL, data=data_retry, headers=headers)
                    with urllib.request.urlopen(req_retry, timeout=15) as retry_res:
                        res_obj = json.loads(retry_res.read().decode('utf-8'))
                        return res_obj['choices'][0]['message']['content'].strip()
                except Exception:
                    pass
            if e.code in [429, 404]: # Rate limit o modelo no disponible, probar siguiente
                continue
            raise Exception(f"Error de Groq API ({e.code}): {err_body}")
        except Exception as e:
            logger.error(f"Error al conectar con Groq API ({current_model}): {e}")
            raise e

    raise Exception("No se pudo completar la llamada con ningún modelo de Groq disponible.")

def obtener_contexto_fundo():
    """
    Extrae un resumen cuantitativo y cualitativo en tiempo real de la base de datos de AgroFlow.
    """
    sectores = list(Sector.objects.all())
    cuadrillas = list(Cuadrilla.objects.all())
    trabajadores = list(Trabajador.objects.all())
    supervisores = [t for t in trabajadores if t.es_supervisor]
    obreros = [t for t in trabajadores if not t.es_supervisor and not t.es_jefe_almacen]
    asignados = [t for t in obreros if t.cuadrilla is not None]
    disponibles = [t for t in obreros if t.cuadrilla is None]

    incidencias_abiertas = list(Incidencia.objects.filter(estado__in=['ABIERTA', 'EN_PROCESO']).order_by('-fecha_reporte')[:5])
    insumos_pendientes = list(SolicitudInsumo.objects.filter(estado='PENDIENTE').order_by('-fecha_solicitud')[:5])
    traslados_pendientes = list(SolicitudTraslado.objects.filter(estado='PENDIENTE'))

    contexto = {
        'total_obreros': len(obreros),
        'obreros_asignados': len(asignados),
        'obreros_disponibles_sin_cuadrilla': len(disponibles),
        'total_cuadrillas': len(cuadrillas),
        'total_supervisores': len(supervisores),
        'supervisores_con_gps_reciente': sum(1 for s in supervisores if s.ultima_conexion_gps is not None),
        'sectores': [
            {
                'nombre': s.nombre,
                'cultivo': s.cultivo.nombre if s.cultivo else 'Sin Cultivo',
                'estado': s.estado,
                'hectareas': float(s.area_hectareas)
            } for s in sectores
        ],
        'incidencias_activas': [
            {
                'id': i.id,
                'titulo': i.titulo,
                'tipo': i.get_tipo_display(),
                'gravedad': i.get_gravedad_display(),
                'estado': i.get_estado_display(),
                'sector': i.sector.nombre if i.sector else 'General',
                'cultivo': i.sector.cultivo.nombre if (i.sector and i.sector.cultivo) else 'Sin Cultivo',
                'descripcion': i.descripcion,
                'accion_tomada': i.accion_tomada
            } for i in incidencias_abiertas
        ],
        'insumos_urgentes_pendientes': [
            {
                'insumo': ins.insumo_nombre,
                'cantidad': f"{ins.cantidad} {ins.unidad_medida}",
                'cuadrilla': ins.cuadrilla.nombre if ins.cuadrilla else 'General',
                'prioridad': ins.prioridad
            } for ins in insumos_pendientes if ins.prioridad == 'URGENTE'
        ],
        'traslados_webauthn_pendientes': len(traslados_pendientes)
    }
    return contexto

def generar_diagnostico_ia():
    """
    Genera un diagnóstico estratégico automatizado para el Gerente General
    basado en los datos reales de la base de datos.
    """
    contexto = obtener_contexto_fundo()
    contexto_str = json.dumps(contexto, ensure_ascii=False, indent=2)

    system_prompt = (
        "Eres 'Agro-IA Copilot', el sistema de inteligencia artificial especializado de Corporación Roots SAC, "
        "empresa agroexportadora de flores de corte (Gypsophila, Girasol, Achilea, Waxflower). "
        "Tu objetivo es asistir al Gerente General con recomendaciones operativas, preventivas y de trazabilidad.\n\n"
        "Debes responder EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura:\n"
        "{\n"
        '  "titulo": "Título corto y directo de la situación más relevante (máx 8 palabras)",\n'
        '  "diagnostico": "Explicación clara de la situación operativa actual basada en los datos (máx 2 frases)",\n'
        '  "accion_sugerida": "Recomendación técnica y operativa concreta para el Gerente General (máx 2 frases)",\n'
        '  "accion_tipo": "EVALUAR_INCIDENCIA | GESTIONAR_CUADRILLAS | REVISAR_SECTOR | OPTIMIZAR_INSUMOS | OPERACION_NORMAL",\n'
        '  "accion_label": "Texto para el botón de acción (ej: \'Evaluar Incidencias\', \'Gestionar Personal\')",\n'
        '  "accion_url": "Ruta relativa sugerida (ej: \'../reportes/index.html\', \'../cuadrillas/index.html\', \'../mapa/index.html\')"\n'
        "}\n"
        "No agregues texto fuera del JSON."
    )

    user_prompt = f"Aquí están los datos operativos en tiempo real del fundo Roots SAC:\n{contexto_str}\nGenera el diagnóstico ejecutivo."

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        raw_output = call_groq(messages, temperature=0.2, max_tokens=1200, json_mode=True)
        # Limpiar posibles delimitadores de código markdown
        clean_json = raw_output.strip()
        if "```json" in clean_json:
            clean_json = clean_json.split("```json")[1].split("```")[0]
        elif "```" in clean_json:
            clean_json = clean_json.split("```")[1].split("```")[0]
        clean_json = clean_json.strip()

        try:
            data = json.loads(clean_json)
            return data
        except Exception as json_err:
            # Fallback inteligente con expresiones regulares si el JSON vino con strings incompletos
            import re
            titulo_m = re.search(r'"titulo"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?', clean_json)
            diag_m = re.search(r'"diagnostico"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?', clean_json)
            accion_m = re.search(r'"accion_sugerida"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?', clean_json)
            label_m = re.search(r'"accion_label"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?', clean_json)
            url_m = re.search(r'"accion_url"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?', clean_json)

            if titulo_m and (diag_m or accion_m):
                return {
                    "titulo": titulo_m.group(1).strip(),
                    "diagnostico": diag_m.group(1).strip() if diag_m else f"Se mantienen {contexto['total_cuadrillas']} cuadrillas y {contexto['total_obreros']} operarios en campo.",
                    "accion_sugerida": accion_m.group(1).strip() if accion_m else "Revisar panel de reportes e incidencias.",
                    "accion_tipo": "EVALUAR_INCIDENCIA",
                    "accion_label": label_m.group(1).strip() if label_m else "Ver Reportes",
                    "accion_url": url_m.group(1).strip() if url_m else "../reportes/index.html"
                }
            raise json_err

    except Exception as e:
        logger.warning(f"Aviso en parsing de IA diagnóstico: {e}")
        # Fallback estructurado en caso de error de parsing o timeout
        incidencias_pend = len(contexto.get('incidencias_activas', []))
        return {
            "titulo": "Monitoreo Operativo en Tiempo Real",
            "diagnostico": f"Se monitorean {contexto['total_cuadrillas']} cuadrillas y {contexto['total_obreros']} operarios. {incidencias_pend} incidencias requieren seguimiento.",
            "accion_sugerida": "Verifica las incidencias pendientes en el panel de Reportes para asegurar la continuidad de cosecha.",
            "accion_tipo": "EVALUAR_INCIDENCIA",
            "accion_label": "Ver Reportes",
            "accion_url": "../reportes/index.html"
        }

def sugerir_resolucion_incidencia(incidencia_id):
    """
    Toma una incidencia reportada por un supervisor de campo y genera una propuesta
    de resolución técnica/gerencial utilizando Groq LLM para que el Gerente General decida.
    """
    incidencia = Incidencia.objects.filter(id=incidencia_id).first()
    if not incidencia:
        return {"error": "Incidencia no encontrada"}

    sector_str = incidencia.sector.nombre if incidencia.sector else "Sector no especificado"
    cultivo_str = incidencia.sector.cultivo.nombre if (incidencia.sector and incidencia.sector.cultivo) else "Flores de exportación"
    cuadrilla_str = incidencia.cuadrilla.nombre if incidencia.cuadrilla else "Cuadrilla de campo"
    supervisor_str = f"{incidencia.reportado_por.nombres} {incidencia.reportado_por.apellidos}" if incidencia.reportado_por else "Supervisor"

    system_prompt = (
        "Eres el Asesor Agronómico y Director de Operaciones de IA para Roots SAC. "
        "Tu labor es redactar una resolución gerencial técnica, precisa y autorizada "
        "para atender una contingencia reportada por un supervisor en el campo.\n"
        "La respuesta debe ser una directiva formal de 2 a 3 líneas con instrucciones operativas concretas "
        "(ej: productos recomendados, ajuste de riego, movilización de cuadrilla, inspección técnica)."
    )

    user_prompt = (
        f"Incidencia #{incidencia.id}:\n"
        f"- Título: {incidencia.titulo}\n"
        f"- Tipo: {incidencia.get_tipo_display()}\n"
        f"- Gravedad: {incidencia.get_gravedad_display()}\n"
        f"- Ubicación: {sector_str} (Cultivo: {cultivo_str})\n"
        f"- Reportado por: {supervisor_str} (Cuadrilla: {cuadrilla_str})\n"
        f"- Descripción: {incidencia.descripcion}\n"
        f"- Medida preventiva tomada en campo: {incidencia.accion_tomada or 'Ninguna aún'}\n\n"
        "Redacta la directiva o resolución recomendada que el Gerente General emitirá para resolver esta incidencia."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        resolucion = call_groq(messages, temperature=0.3, max_tokens=600)
        return {
            "resolucion_sugerida": resolucion,
            "estado_recomendado": "EN_PROCESO" if incidencia.gravedad in ['CRITICA', 'ALTA'] else "RESUELTA"
        }
    except Exception as e:
        return {
            "error": str(e),
            "resolucion_sugerida": f"Autorizada inspección técnica inmediata en {sector_str} y coordinación de insumos para mitigar la contingencia."
        }

def chat_asistente_agroflow(pregunta_usuario):
    """
    Chatbot interactivo con contexto completo del fundo Roots SAC.
    """
    contexto = obtener_contexto_fundo()
    contexto_str = json.dumps(contexto, ensure_ascii=False)

    system_prompt = (
        "Eres 'Agro-IA Copilot', el asistente inteligente de gestión agrícola y trazabilidad de Corporación Roots SAC. "
        "Tienes acceso completo en tiempo real a los datos de cuadrillas, supervisores, sectores e incidencias del fundo.\n"
        f"DATOS DEL SISTEMA: {contexto_str}\n\n"
        "INSTRUCCIONES:\n"
        "- Responde en español de forma concisa, profesional y directa al grano (máximo 1 o 2 párrafos).\n"
        "- Basa tus respuestas en los datos reales del fundo Roots SAC.\n"
        "- Si te preguntan qué hacer, ofrece sugerencias de acción viables y priorizadas."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": pregunta_usuario}
    ]

    try:
        respuesta = call_groq(messages, temperature=0.4, max_tokens=800)
        return {"respuesta": respuesta}
    except Exception as e:
        return {"error": str(e), "respuesta": "No se pudo conectar con el motor de IA en este momento. Por favor verifica tu conexión."}


