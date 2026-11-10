from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth import authenticate
from django.utils import timezone

from .models import (
    PerfilUsuario, Cultivo, Sector, Cuadrilla, Trabajador, 
    SolicitudTraslado, ActividadCampo, RegistroCosecha, SolicitudInsumo, Incidencia,
    TareaCuadrilla
)
from .serializers import (
    PerfilUsuarioSerializer, CultivoSerializer, SectorSerializer, CuadrillaSerializer, 
    TrabajadorSerializer, SolicitudTrasladoSerializer, 
    ActividadCampoSerializer, RegistroCosechaSerializer, SolicitudInsumoSerializer,
    IncidenciaSerializer, TareaCuadrillaSerializer
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
            if not trabajador.activo:
                return Response({
                    'error': 'Tu cuenta de trabajador se encuentra actualmente INACTIVA por receso de temporada. Consulta con el Administrador / Gerente.'
                }, status=status.HTTP_403_FORBIDDEN)
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

    def get_queryset(self):
        qs = super().get_queryset()
        activo_param = self.request.query_params.get('activo')
        if activo_param is not None:
            if activo_param.lower() in ['true', '1']:
                qs = qs.filter(activo=True)
            elif activo_param.lower() in ['false', '0']:
                qs = qs.filter(activo=False)
        return qs

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

    @action(detail=True, methods=['post'])
    def toggle_activo(self, request, pk=None):
        """
        Alterna el estado del trabajador entre Activo (en temporada) e Inactivo (en receso).
        No desvincula su cuadrilla para que al reactivarlo vuelva automáticamente a ella.
        """
        trabajador = self.get_object()
        nuevo_estado = request.data.get('activo')
        if nuevo_estado is not None:
            trabajador.activo = bool(nuevo_estado)
        else:
            trabajador.activo = not trabajador.activo
        trabajador.save()
        return Response(self.get_serializer(trabajador).data)

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
    supervisores = Trabajador.objects.filter(es_supervisor=True, activo=True)
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
    
    supervisores = Trabajador.objects.filter(es_supervisor=True, activo=True)
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
# 6.5. PLAN DE TRABAJO, TAREAS Y MAPA DE CALOR
# ==========================================

class TareaCuadrillaViewSet(viewsets.ModelViewSet):
    queryset = TareaCuadrilla.objects.all().order_by('-fecha_programada', '-id')
    serializer_class = TareaCuadrillaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        supervisor_id = self.request.query_params.get('supervisor')
        cuadrilla_id = self.request.query_params.get('cuadrilla')
        fecha = self.request.query_params.get('fecha')
        estado = self.request.query_params.get('estado')
        tipo_labor = self.request.query_params.get('tipo_labor')

        if supervisor_id:
            qs = qs.filter(supervisor_id=supervisor_id)
        if cuadrilla_id:
            qs = qs.filter(cuadrilla_id=cuadrilla_id)
        if fecha:
            qs = qs.filter(fecha_programada=fecha)
        if estado and estado != 'TODOS':
            qs = qs.filter(estado=estado)
        if tipo_labor and tipo_labor != 'TODOS':
            qs = qs.filter(tipo_labor=tipo_labor)
        return qs

    def perform_create(self, serializer):
        # Si no viene supervisor pero sí cuadrilla, auto-asociar al supervisor de la cuadrilla
        cuadrilla = serializer.validated_data.get('cuadrilla')
        supervisor = serializer.validated_data.get('supervisor')
        if not supervisor and cuadrilla and cuadrilla.encargado:
            serializer.save(supervisor=cuadrilla.encargado)
        else:
            serializer.save()

    def _parse_custom_dt(self, val_str, base_date=None):
        """
        Parsea un string de fecha/hora ISO o solo 'HH:MM' o 'HH:MM:SS' combinándolo con base_date.
        Retorna datetime timezone-aware o None.
        """
        if not val_str:
            return None
        import datetime
        from django.utils.dateparse import parse_datetime, parse_time
        from django.utils import timezone

        # 1. Intentar como datetime completo (ISO)
        dt = parse_datetime(str(val_str))
        if dt:
            if timezone.is_naive(dt):
                return timezone.make_aware(dt)
            return dt

        # 2. Intentar como solo hora 'HH:MM' o 'HH:MM:SS'
        t = parse_time(str(val_str))
        if t:
            date_part = base_date or timezone.localdate()
            combined = datetime.datetime.combine(date_part, t)
            return timezone.make_aware(combined)

        return None

    @action(detail=True, methods=['post'])
    def iniciar(self, request, pk=None):
        """
        Marca la tarea como 'EN_PROCESO' y estampa la hora de inicio (actual o personalizada).
        """
        tarea = self.get_object()
        tarea.estado = 'EN_PROCESO'
        
        hora_inicio_str = request.data.get('hora_inicio')
        base_date = tarea.fecha_programada or timezone.localdate()
        dt_inicio = self._parse_custom_dt(hora_inicio_str, base_date) if hora_inicio_str else None

        tarea.hora_inicio = dt_inicio if dt_inicio else timezone.now()
        tarea.save()
        return Response(self.get_serializer(tarea).data)

    @action(detail=True, methods=['post'])
    def completar(self, request, pk=None):
        """
        Marca la tarea como 'COMPLETADA', estampa la hora de fin (actual o personalizada) y calcula la duración.
        """
        tarea = self.get_object()
        tarea.estado = 'COMPLETADA'
        
        base_date = tarea.fecha_programada or timezone.localdate()

        # Opcionalmente si se envía una hora_inicio personalizada también al completar (para corregir inicio):
        hora_inicio_str = request.data.get('hora_inicio')
        if hora_inicio_str:
            dt_inicio = self._parse_custom_dt(hora_inicio_str, base_date)
            if dt_inicio:
                tarea.hora_inicio = dt_inicio

        # Hora de fin (personalizada o ahora)
        hora_fin_str = request.data.get('hora_fin')
        dt_fin = self._parse_custom_dt(hora_fin_str, base_date) if hora_fin_str else None
        tarea.hora_fin = dt_fin if dt_fin else timezone.now()

        if not tarea.hora_inicio:
            # Si no se inició previamente, asumir inicio 1 hora antes como fallback
            tarea.hora_inicio = tarea.hora_fin - timezone.timedelta(hours=1)
        
        observaciones = request.data.get('observaciones')
        if observaciones is not None:
            tarea.observaciones = observaciones
            
        tarea.save()
        return Response(self.get_serializer(tarea).data)

    @action(detail=False, methods=['get'])
    def mapa_calor(self, request):
        """
        Calcula las matrices de horas y tareas para el Mapa de Calor de Rendimiento.
        1. mapa_dias: Horas trabajadas por día de la semana actual (Lunes a Sábado) para cada cuadrilla.
        2. mapa_franjas: Horas trabajadas en cada franja horaria (06:00 a 18:00) del DÍA SELECCIONADO (por defecto hoy).
           Calcula el solapamiento exacto de cada labor en su franja horaria (máximo 2.0h por bloque de 2 horas).
        """
        import datetime
        from django.utils import timezone
        
        # Fecha de análisis para franjas horarias (por defecto la fecha local de hoy)
        fecha_str = request.query_params.get('fecha')
        if fecha_str:
            try:
                fecha_target = datetime.datetime.strptime(fecha_str, '%Y-%m-%d').date()
            except ValueError:
                fecha_target = timezone.localdate()
        else:
            fecha_target = timezone.localdate()

        cuadrillas = list(Cuadrilla.objects.all().order_by('nombre'))
        tareas = list(TareaCuadrilla.objects.all().order_by('fecha_programada', 'hora_inicio'))

        # Días de la semana estándar (Lunes = 0, Sábado = 5)
        dias_nombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        
        # Determinar el lunes de la semana de fecha_target
        lunes_semana = fecha_target - datetime.timedelta(days=fecha_target.weekday())
        fechas_semana = [lunes_semana + datetime.timedelta(days=i) for i in range(6)]
        
        # Franjas horarias estándar de jornada agrícola (bloques de 2 horas)
        franjas_labels = [
            '06:00 - 08:00',
            '08:00 - 10:00',
            '10:00 - 12:00',
            '12:00 - 14:00',
            '14:00 - 16:00',
            '16:00 - 18:00'
        ]

        cuadrillas_dias = []
        cuadrillas_franjas = []

        total_horas_semana = 0.0
        total_tareas_completadas_semana = 0

        # Función para calcular solapamiento exacto en horas
        def calcular_solapamiento_horas(dt_ini, dt_fin, slot_h_ini, slot_h_fin, d_target, estado='COMPLETADA'):
            if not dt_ini:
                return 0.0
            
            local_ini = timezone.localtime(dt_ini)
            
            # Si la tarea está en proceso, la hora fin para el cálculo es la hora actual
            if estado == 'EN_PROCESO':
                now_local = timezone.localtime(timezone.now())
                if now_local.date() == d_target:
                    local_fin = max(now_local, local_ini + datetime.timedelta(minutes=30))
                else:
                    local_fin = local_ini + datetime.timedelta(hours=2)
            else:
                if not dt_fin:
                    return 0.0
                local_fin = timezone.localtime(dt_fin)
            
            # Solo consideramos tareas que ocurrieron o están ocurriendo en la fecha objetivo
            if local_ini.date() != d_target and local_fin.date() != d_target:
                return 0.0
            
            tz = local_ini.tzinfo
            s_start = datetime.datetime.combine(d_target, datetime.time(slot_h_ini, 0), tzinfo=tz)
            s_end = datetime.datetime.combine(d_target, datetime.time(slot_h_fin, 0), tzinfo=tz)
            
            overlap_start = max(local_ini, s_start)
            overlap_end = min(local_fin, s_end)
            
            delta_sec = (overlap_end - overlap_start).total_seconds()
            if delta_sec > 0:
                # Máximo 2.0 horas en una franja de 2 horas
                return min(2.0, round(delta_sec / 3600.0, 1))
            return 0.0

        from .serializers import format_time_12h

        for c in cuadrillas:
            encargado_str = f"{c.encargado.nombres} {c.encargado.apellidos}" if c.encargado else (c.supervisor.username if c.supervisor else "Sin Supervisor")
            sector_str = c.sector_asignado.nombre if c.sector_asignado else "General"
            
            c_tareas = [t for t in tareas if t.cuadrilla_id == c.id]
            c_completadas = [t for t in c_tareas if t.estado == 'COMPLETADA']
            
            # 1. Matriz por Días de la Semana (Lunes a Sábado de la semana en curso)
            dias_data = []
            horas_semana_c = 0.0
            completadas_semana_c = 0
            
            for idx, dia_nombre in enumerate(dias_nombres):
                dia_f = fechas_semana[idx]
                tareas_dia = [t for t in c_completadas if t.fecha_programada == dia_f]
                horas_dia = round(sum(t.duracion_minutos / 60.0 for t in tareas_dia), 1)
                horas_semana_c += horas_dia
                completadas_semana_c += len(tareas_dia)
                
                dias_data.append({
                    'dia': dia_nombre,
                    'fecha': dia_f.strftime('%Y-%m-%d'),
                    'horas': horas_dia,
                    'tareas_count': len(tareas_dia),
                    'tareas': [
                        {
                            'titulo': t.titulo,
                            'tipo': t.get_tipo_labor_display(),
                            'estado_detalle': f"(Terminado) {format_time_12h(t.hora_inicio)} - {format_time_12h(t.hora_fin)}",
                            'duracion': f"{t.duracion_minutos // 60}h {t.duracion_minutos % 60}m" if t.duracion_minutos >= 60 else f"{t.duracion_minutos}m",
                            'sector': t.sector.nombre if t.sector else 'General'
                        } for t in tareas_dia
                    ]
                })

            total_horas_semana += horas_semana_c
            total_tareas_completadas_semana += completadas_semana_c

            cuadrillas_dias.append({
                'cuadrilla_id': c.id,
                'cuadrilla_nombre': c.nombre,
                'supervisor_nombre': encargado_str,
                'sector_nombre': sector_str,
                'total_horas': round(horas_semana_c, 1),
                'tareas_completadas': completadas_semana_c,
                'dias': dias_data
            })

            # 2. Matriz por Franjas Horarias del DÍA OBJETIVO (Hoy)
            tareas_hoy_c = [t for t in c_tareas if t.fecha_programada == fecha_target]
            franjas_data = []
            horas_hoy_c = 0.0

            for slot_idx, slot_label in enumerate(franjas_labels):
                hora_ini_slot = 6 + (slot_idx * 2)
                hora_fin_slot = hora_ini_slot + 2
                
                tareas_slot = []
                horas_slot = 0.0

                for t in tareas_hoy_c:
                    if t.estado == 'COMPLETADA' and t.hora_inicio and t.hora_fin:
                        overlap = calcular_solapamiento_horas(t.hora_inicio, t.hora_fin, hora_ini_slot, hora_fin_slot, fecha_target, estado='COMPLETADA')
                        local_ini = timezone.localtime(t.hora_inicio)
                        inicia_aqui = (hora_ini_slot <= local_ini.hour < hora_fin_slot)
                        # Solo se incluye si inició en el bloque o si trabajó al menos 15 minutos (0.25h) en él
                        if overlap >= 0.25 or (inicia_aqui and overlap > 0):
                            horas_slot += overlap
                            tareas_slot.append(t)
                    elif t.estado == 'EN_PROCESO' and t.hora_inicio:
                        overlap = calcular_solapamiento_horas(t.hora_inicio, None, hora_ini_slot, hora_fin_slot, fecha_target, estado='EN_PROCESO')
                        local_ini = timezone.localtime(t.hora_inicio)
                        inicia_aqui = (hora_ini_slot <= local_ini.hour < hora_fin_slot)
                        if overlap > 0 or inicia_aqui:
                            if overlap <= 0:
                                overlap = 0.5 # estimación mínima de avance si recién inicia
                            horas_slot += overlap
                            if t not in tareas_slot:
                                tareas_slot.append(t)

                # Cap máximo: una cuadrilla en una franja de 2 horas puede trabajar como máximo 2.0 horas
                horas_slot = min(2.0, round(horas_slot, 1))
                horas_hoy_c += horas_slot
                
                franjas_data.append({
                    'franja': slot_label,
                    'horas': horas_slot,
                    'tareas_count': len(tareas_slot),
                    'tareas': [
                        {
                            'titulo': t.titulo,
                            'tipo': t.get_tipo_labor_display(),
                            'estado': t.estado,
                            'estado_detalle': (
                                f"(Terminado) {format_time_12h(t.hora_inicio)} - {format_time_12h(t.hora_fin)}" if t.estado == 'COMPLETADA'
                                else f"(En proceso) {format_time_12h(t.hora_inicio)}"
                            ),
                            'duracion': (
                                (f"{t.duracion_minutos // 60}h {t.duracion_minutos % 60}m" if t.duracion_minutos >= 60 else f"{t.duracion_minutos}m")
                                if t.estado == 'COMPLETADA'
                                else (
                                    f"{max(1, int((timezone.now() - t.hora_inicio).total_seconds() // 60)) // 60}h {max(1, int((timezone.now() - t.hora_inicio).total_seconds() // 60)) % 60}m (en curso)"
                                    if (t.estado == 'EN_PROCESO' and t.hora_inicio)
                                    else "En curso"
                                )
                            ),
                            'sector': t.sector.nombre if t.sector else 'General'
                        } for t in tareas_slot
                    ]
                })

            completadas_hoy_c = sum(1 for t in tareas_hoy_c if t.estado == 'COMPLETADA')
            en_proceso_hoy_c = sum(1 for t in tareas_hoy_c if t.estado == 'EN_PROCESO')
            pendientes_hoy_c = sum(1 for t in tareas_hoy_c if t.estado == 'PENDIENTE')

            cuadrillas_franjas.append({
                'cuadrilla_id': c.id,
                'cuadrilla_nombre': c.nombre,
                'supervisor_nombre': encargado_str,
                'sector_nombre': sector_str,
                'total_horas': round(horas_hoy_c, 1),
                'tareas_completadas': completadas_hoy_c,
                'tareas_en_proceso': en_proceso_hoy_c,
                'tareas_pendientes': pendientes_hoy_c,
                'franjas': franjas_data
            })

        # Cuadrilla líder de la semana o del día
        cuadrilla_lider = None
        if cuadrillas_dias:
            sorted_c = sorted(cuadrillas_dias, key=lambda x: x['total_horas'], reverse=True)
            if sorted_c and sorted_c[0]['total_horas'] > 0:
                cuadrilla_lider = {
                    'nombre': sorted_c[0]['cuadrilla_nombre'],
                    'supervisor': sorted_c[0]['supervisor_nombre'],
                    'horas': sorted_c[0]['total_horas'],
                    'tareas': sorted_c[0]['tareas_completadas']
                }

        tareas_hoy_totales = [t for t in tareas if t.fecha_programada == fecha_target]
        tareas_hoy_completadas = [t for t in tareas_hoy_totales if t.estado == 'COMPLETADA']
        horas_hoy_totales = sum(round(t.duracion_minutos / 60.0, 1) for t in tareas_hoy_completadas)

        return Response({
            'fecha_consulta': fecha_target.strftime('%Y-%m-%d'),
            'resumen': {
                'total_tareas': len(tareas_hoy_totales),
                'tareas_completadas': len(tareas_hoy_completadas),
                'tareas_en_proceso': sum(1 for t in tareas_hoy_totales if t.estado == 'EN_PROCESO'),
                'tareas_pendientes': sum(1 for t in tareas_hoy_totales if t.estado == 'PENDIENTE'),
                'total_horas_hoy': round(horas_hoy_totales, 1),
                'total_horas_semana': round(total_horas_semana, 1),
                'total_tareas_semana': total_tareas_completadas_semana,
                'porcentaje_cumplimiento': round((len(tareas_hoy_completadas) / max(1, len(tareas_hoy_totales))) * 100, 1) if tareas_hoy_totales else 0.0,
                'cuadrilla_lider': cuadrilla_lider
            },
            'dias_semana_labels': dias_nombres,
            'franjas_labels': franjas_labels,
            'mapa_dias': cuadrillas_dias,
            'mapa_franjas': cuadrillas_franjas
        })

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


