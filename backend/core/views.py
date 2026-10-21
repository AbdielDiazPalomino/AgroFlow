from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth import authenticate

from .models import (
    PerfilUsuario, Cultivo, Sector, Cuadrilla, Trabajador, 
    SolicitudTraslado, ActividadCampo, RegistroCosecha, SolicitudInsumo, Incidencia
)
from .serializers import (
    PerfilUsuarioSerializer, CultivoSerializer, SectorSerializer, CuadrillaSerializer, 
    TrabajadorSerializer, SolicitudTrasladoSerializer, 
    ActividadCampoSerializer, RegistroCosechaSerializer, SolicitudInsumoSerializer,
    IncidenciaSerializer
)

@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    """
    Login unificado:
    1. Si es superuser/admin o perfil User -> Ingreso como GERENTE
    2. Si es Trabajador (por DNI):
       - Contraseña por defecto: su propio DNI (o la que haya cambiado)
       - Retorna role: 'SUPERVISOR' o 'OBRERO'
    """
    username = str(request.data.get('username', '')).strip()
    password = str(request.data.get('password', '')).strip()
    
    # 1. Probar autenticación Django User tradicional (Admin / Gerente)
    user = authenticate(username=username, password=password)
    if user is not None:
        is_gerente = user.is_superuser or (hasattr(user, 'perfil') and user.perfil.rol == 'GERENTE')
        if is_gerente:
            return Response({
                'message': 'Login exitoso', 
                'role': 'GERENTE', 
                'username': user.username,
                'nombre': user.get_full_name() or user.username
            })
    
    # 2. Probar autenticación por DNI en el modelo Trabajador
    trabajador = Trabajador.objects.filter(dni=username).first()
    if trabajador:
        # Clave esperada: la personalizada o por defecto su propio DNI
        expected_password = trabajador.password if trabajador.password else trabajador.dni
        if password == expected_password:
            if trabajador.es_jefe_almacen:
                role = 'JEFE_ALMACEN'
            elif trabajador.es_supervisor:
                role = 'SUPERVISOR'
            else:
                role = 'OBRERO'
            return Response({
                'message': 'Login exitoso',
                'role': role,
                'id': trabajador.id,
                'dni': trabajador.dni,
                'nombre': f"{trabajador.nombres} {trabajador.apellidos}",
                'username': trabajador.dni
            })
    
    return Response(
        {'error': 'Credenciales incorrectas. Para trabajadores, ingresa tu DNI como usuario y como contraseña.'}, 
        status=status.HTTP_401_UNAUTHORIZED
    )

@api_view(['POST'])
@permission_classes([AllowAny])
def api_cambiar_password_trabajador(request):
    """Permite al obrero/supervisor cambiar su contraseña desde su perfil."""
    trabajador_id = request.data.get('trabajador_id')
    current_password = str(request.data.get('current_password', '')).strip()
    new_password = str(request.data.get('new_password', '')).strip()

    if not trabajador_id or not new_password:
        return Response({'error': 'Faltan campos obligatorios.'}, status=status.HTTP_400_BAD_REQUEST)

    trabajador = Trabajador.objects.filter(id=trabajador_id).first()
    if not trabajador:
        return Response({'error': 'Trabajador no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    expected = trabajador.password if trabajador.password else trabajador.dni
    if current_password != expected:
        return Response({'error': 'La contraseña actual no es correcta.'}, status=status.HTTP_400_BAD_REQUEST)

    trabajador.password = new_password
    trabajador.save()
    return Response({'message': 'Contraseña actualizada correctamente.'})

@api_view(['GET'])
@permission_classes([AllowAny])
def api_mi_perfil_obrero(request, trabajador_id):
    """Retorna información detallada de la cuadrilla, sector y supervisor del obrero."""
    trabajador = Trabajador.objects.filter(id=trabajador_id).first()
    if not trabajador:
        return Response({'error': 'Trabajador no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    cuadrilla = trabajador.cuadrilla
    sector = cuadrilla.sector_asignado if cuadrilla else None
    
    # Nombre del supervisor
    supervisor_nombre = "Sin Supervisor asignado"
    if cuadrilla:
        if cuadrilla.encargado:
            supervisor_nombre = f"{cuadrilla.encargado.nombres} {cuadrilla.encargado.apellidos}"
        elif cuadrilla.supervisor:
            supervisor_nombre = cuadrilla.supervisor.get_full_name() or cuadrilla.supervisor.username

    # Solicitud de traslado pendiente si existe
    traslado_pendiente = SolicitudTraslado.objects.filter(trabajador=trabajador, estado='PENDIENTE').order_by('-fecha_solicitud').first()
    traslado_data = None
    if traslado_pendiente:
        traslado_data = {
            'id': traslado_pendiente.id,
            'cuadrilla_origen': traslado_pendiente.cuadrilla_origen.nombre if traslado_pendiente.cuadrilla_origen else 'Sin Cuadrilla',
            'cuadrilla_destino_id': traslado_pendiente.cuadrilla_destino.id,
            'cuadrilla_destino_nombre': traslado_pendiente.cuadrilla_destino.nombre,
            'sector_destino_nombre': traslado_pendiente.cuadrilla_destino.sector_asignado.nombre if traslado_pendiente.cuadrilla_destino.sector_asignado else 'Sin Sector',
            'cultivo_destino_nombre': traslado_pendiente.cuadrilla_destino.sector_asignado.cultivo.nombre if traslado_pendiente.cuadrilla_destino.sector_asignado and traslado_pendiente.cuadrilla_destino.sector_asignado.cultivo else 'Sin cultivo',
            'supervisor_destino_nombre': (
                f"{traslado_pendiente.cuadrilla_destino.encargado.nombres} {traslado_pendiente.cuadrilla_destino.encargado.apellidos}" 
                if traslado_pendiente.cuadrilla_destino.encargado 
                else "Supervisor de campo"
            ),
            'motivo': traslado_pendiente.motivo
        }

    return Response({
        'trabajador': {
            'id': trabajador.id,
            'nombres': trabajador.nombres,
            'apellidos': trabajador.apellidos,
            'dni': trabajador.dni,
            'es_supervisor': trabajador.es_supervisor,
            'foto_url': trabajador.foto_url
        },
        'cuadrilla': {
            'id': cuadrilla.id if cuadrilla else None,
            'nombre': cuadrilla.nombre if cuadrilla else 'Sin Cuadrilla asignada',
            'tipo': cuadrilla.tipo if cuadrilla else '-',
            'supervisor': supervisor_nombre
        },
        'sector': {
            'id': sector.id if sector else None,
            'nombre': sector.nombre if sector else 'Sin Sector asignado',
            'cultivo': (sector.cultivo.nombre if sector.cultivo else 'Sin Cultivo') if sector else '-'
        },
        'traslado_pendiente': traslado_data
    })

class PerfilUsuarioViewSet(viewsets.ModelViewSet):
    queryset = PerfilUsuario.objects.all()
    serializer_class = PerfilUsuarioSerializer

class CultivoViewSet(viewsets.ModelViewSet):
    queryset = Cultivo.objects.all()
    serializer_class = CultivoSerializer

class SectorViewSet(viewsets.ModelViewSet):
    queryset = Sector.objects.all()
    serializer_class = SectorSerializer

class CuadrillaViewSet(viewsets.ModelViewSet):
    queryset = Cuadrilla.objects.all()
    serializer_class = CuadrillaSerializer

    def perform_create(self, serializer):
        cuadrilla = serializer.save()
        if cuadrilla.encargado:
            # Asignar automáticamente el trabajador a esta cuadrilla
            cuadrilla.encargado.cuadrilla = cuadrilla
            cuadrilla.encargado.save()

    def perform_update(self, serializer):
        cuadrilla_anterior = self.get_object()
        encargado_anterior = cuadrilla_anterior.encargado
        cuadrilla = serializer.save()

        # Si cambió de encargado o se quitó, y el anterior estaba en esta cuadrilla
        if encargado_anterior and encargado_anterior != cuadrilla.encargado:
            if encargado_anterior.cuadrilla == cuadrilla:
                encargado_anterior.cuadrilla = None
                encargado_anterior.save()

        # Si hay un nuevo encargado asignado, vincularlo a esta cuadrilla
        if cuadrilla.encargado:
            cuadrilla.encargado.cuadrilla = cuadrilla
            cuadrilla.encargado.save()

    def perform_destroy(self, instance):
        # Desvincular cuadrilla a los trabajadores asignados antes de eliminar
        Trabajador.objects.filter(cuadrilla=instance).update(cuadrilla=None)
        instance.delete()

class TrabajadorViewSet(viewsets.ModelViewSet):
    queryset = Trabajador.objects.all()
    serializer_class = TrabajadorSerializer

    def perform_create(self, serializer):
        es_jefe = serializer.validated_data.get('es_jefe_almacen', False)
        if es_jefe and Trabajador.objects.filter(es_jefe_almacen=True).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": "Ya existe un Jefe de Almacén registrado en el sistema. Solo se permite uno."})
        serializer.save()

    def perform_update(self, serializer):
        es_jefe = serializer.validated_data.get('es_jefe_almacen', False)
        instance = self.get_object()
        if es_jefe and Trabajador.objects.filter(es_jefe_almacen=True).exclude(id=instance.id).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": "Ya existe un Jefe de Almacén registrado en el sistema. Solo se permite uno."})
        serializer.save()

class SolicitudTrasladoViewSet(viewsets.ModelViewSet):
    queryset = SolicitudTraslado.objects.all().order_by('-fecha_solicitud')
    serializer_class = SolicitudTrasladoSerializer

    def perform_update(self, serializer):
        from django.utils import timezone
        solicitud = serializer.save()
        if solicitud.estado == 'ACEPTADO':
            solicitud.fecha_respuesta = timezone.now()
            solicitud.save()
            # Actualizar la cuadrilla del trabajador
            trabajador = solicitud.trabajador
            trabajador.cuadrilla = solicitud.cuadrilla_destino
            trabajador.save()
        elif solicitud.estado == 'RECHAZADO':
            solicitud.fecha_respuesta = timezone.now()
            solicitud.save()

class ActividadCampoViewSet(viewsets.ModelViewSet):
    queryset = ActividadCampo.objects.all()
    serializer_class = ActividadCampoSerializer

class RegistroCosechaViewSet(viewsets.ModelViewSet):
    queryset = RegistroCosecha.objects.all()
    serializer_class = RegistroCosechaSerializer

@api_view(['GET'])
@permission_classes([AllowAny])
def api_supervisores(request):
    """
    Retorna los trabajadores que tienen rol de supervisor (es_supervisor=True).
    El encargado de cuadrilla debe ser un trabajador con rol de supervisor, no el admin.
    """
    supervisores = Trabajador.objects.filter(es_supervisor=True)
    result = []
    for s in supervisores:
        result.append({
            'id': s.id,
            'dni': s.dni,
            'nombre_display': f"{s.nombres} {s.apellidos} (DNI: {s.dni})"
        })
    return Response(result)

@api_view(['POST'])
@permission_classes([AllowAny])
def api_actualizar_ubicacion_supervisor(request):
    """
    Permite a un supervisor reportar su latitud y longitud GPS periódicamente (cada 30-60 seg).
    Ideal para cPanel / arquitecturas sin WebSockets mediante HTTP Heartbeat.
    """
    from django.utils import timezone
    trabajador_id = request.data.get('trabajador_id')
    latitud = request.data.get('latitud')
    longitud = request.data.get('longitud')

    if not trabajador_id or latitud is None or longitud is None:
        return Response({'error': 'trabajador_id, latitud y longitud son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        trabajador = Trabajador.objects.get(id=trabajador_id, es_supervisor=True)
    except Trabajador.DoesNotExist:
        return Response({'error': 'Supervisor no encontrado o no tiene rol de supervisor'}, status=status.HTTP_404_NOT_FOUND)

    try:
        trabajador.latitud_actual = float(latitud)
        trabajador.longitud_actual = float(longitud)
        trabajador.ultima_conexion_gps = timezone.now()
        trabajador.save(update_fields=['latitud_actual', 'longitud_actual', 'ultima_conexion_gps'])
    except (ValueError, TypeError):
        return Response({'error': 'Coordenadas inválidas'}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'status': 'success',
        'supervisor': f"{trabajador.nombres} {trabajador.apellidos}",
        'latitud': trabajador.latitud_actual,
        'longitud': trabajador.longitud_actual,
        'ultima_conexion_gps': trabajador.ultima_conexion_gps.isoformat()
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def api_ubicaciones_supervisores(request):
    """
    Retorna la lista de todos los supervisores con su ubicación GPS más reciente,
    el sector asignado a su cuadrilla, su cultivo y estado de actividad.
    Permite polling cada minuto desde la vista del Gerente General.
    """
    from django.utils import timezone
    import json
    
    supervisores = Trabajador.objects.filter(es_supervisor=True)
    ahora = timezone.now()
    result = []

    for s in supervisores:
        # Determinar su cuadrilla (sea como encargado o como miembro asignado)
        cuadrilla = Cuadrilla.objects.filter(encargado=s).first()
        if not cuadrilla and s.cuadrilla:
            cuadrilla = s.cuadrilla

        sector = cuadrilla.sector_asignado if cuadrilla else None
        cultivo = sector.cultivo if sector else None

        # Coordenadas: si tiene GPS real/simulado guardado, se usa.
        # Si aún no tiene señal GPS pero tiene sector asignado, podemos estimar el centro de su sector.
        lat = s.latitud_actual
        lng = s.longitud_actual
        es_estimado = False

        if (lat is None or lng is None) and sector and sector.coordenadas_poligono:
            try:
                parsed = json.loads(sector.coordenadas_poligono)
                if isinstance(parsed, list) and len(parsed) > 0:
                    lat = parsed[0][0]
                    lng = parsed[0][1]
                    es_estimado = True
            except Exception:
                pass

        # Calcular si está activo recientemente (últimos 5 minutos)
        esta_activo = False
        tiempo_texto = "Sin reporte GPS"
        if s.ultima_conexion_gps:
            diff_segundos = int((ahora - s.ultima_conexion_gps).total_seconds())
            if diff_segundos < 300: # 5 minutos
                esta_activo = True
            
            if diff_segundos < 60:
                tiempo_texto = f"Hace {diff_segundos} s"
            elif diff_segundos < 3600:
                minutos = diff_segundos // 60
                tiempo_texto = f"Hace {minutos} min"
            elif diff_segundos < 86400:
                horas = diff_segundos // 3600
                tiempo_texto = f"Hace {horas} h"
            else:
                tiempo_texto = s.ultima_conexion_gps.strftime("%d/%m %H:%M")
        elif es_estimado:
            tiempo_texto = "Ubicación estimada en Sector"

        result.append({
            'id': s.id,
            'dni': s.dni,
            'nombres': s.nombres,
            'apellidos': s.apellidos,
            'nombre_completo': f"{s.nombres} {s.apellidos}",
            'foto_url': s.foto_url,
            'latitud': lat,
            'longitud': lng,
            'es_estimado': es_estimado,
            'esta_activo': esta_activo,
            'tiempo_texto': tiempo_texto,
            'ultima_conexion_gps': s.ultima_conexion_gps.isoformat() if s.ultima_conexion_gps else None,
            'cuadrilla_id': cuadrilla.id if cuadrilla else None,
            'cuadrilla_nombre': cuadrilla.nombre if cuadrilla else 'Sin Cuadrilla Asignada',
            'cuadrilla_tipo': cuadrilla.get_tipo_display() if cuadrilla else None,
            'sector_id': sector.id if sector else None,
            'sector_nombre': sector.nombre if sector else 'Sin Sector Asignado',
            'cultivo_nombre': cultivo.nombre if cultivo else ('Sin Cultivo' if sector else '-')
        })

    return Response(result)

class SolicitudInsumoViewSet(viewsets.ModelViewSet):
    queryset = SolicitudInsumo.objects.all().order_by('-fecha_solicitud')
    serializer_class = SolicitudInsumoSerializer

    def perform_update(self, serializer):
        from django.utils import timezone
        solicitud = serializer.save()
        if solicitud.estado in ['APROBADO', 'RECHAZADO'] and not solicitud.fecha_respuesta:
            solicitud.fecha_respuesta = timezone.now()
            solicitud.save()

class IncidenciaViewSet(viewsets.ModelViewSet):
    queryset = Incidencia.objects.all().order_by('-fecha_reporte')
    serializer_class = IncidenciaSerializer

    def perform_create(self, serializer):
        incidencia = serializer.save()
        # Si la incidencia es crítica o fitosanitaria alta, podemos automáticamente marcar el sector en ALERTA
        if incidencia.sector and (incidencia.gravedad == 'CRITICA' or incidencia.tipo == 'FITOSANITARIA'):
            sector = incidencia.sector
            if sector.estado != 'ALERTA':
                sector.estado = 'ALERTA'
                sector.save()

# ==========================================
# 7. ENDPOINTS DE INTELIGENCIA ARTIFICIAL (GROQ)
# ==========================================

from .ai_service import generar_diagnostico_ia, sugerir_resolucion_incidencia, chat_asistente_agroflow

@api_view(['GET'])
@permission_classes([AllowAny])
def api_ia_diagnostico(request):
    """
    Retorna un diagnóstico operativo integral generado por el modelo Groq LLM
    con base en el estado real de la base de datos (sectores, cuadrillas, obreros, incidencias).
    """
    try:
        diagnostico = generar_diagnostico_ia()
        return Response(diagnostico)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def api_ia_sugerir_resolucion(request):
    """
    Genera una recomendación de resolución técnica y directiva gerencial
    para una incidencia específica reportada por un supervisor.
    """
    incidencia_id = request.data.get('incidencia_id')
    if not incidencia_id:
        return Response({"error": "Falta el ID de la incidencia"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        resultado = sugerir_resolucion_incidencia(incidencia_id)
        return Response(resultado)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def api_ia_chat(request):
    """
    Permite al Gerente General hacer preguntas operativas en lenguaje natural
    y recibir respuestas contextualizadas con los datos de AgroFlow.
    """
    pregunta = request.data.get('pregunta', '').strip()
    if not pregunta:
        return Response({"error": "La pregunta no puede estar vacía"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        respuesta = chat_asistente_agroflow(pregunta)
        return Response(respuesta)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


