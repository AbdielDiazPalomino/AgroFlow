from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth import authenticate

from .models import (
    PerfilUsuario, Cultivo, Sector, Cuadrilla, Trabajador, 
    SolicitudTraslado, ActividadCampo, RegistroCosecha, SolicitudInsumo
)
from .serializers import (
    PerfilUsuarioSerializer, CultivoSerializer, SectorSerializer, CuadrillaSerializer, 
    TrabajadorSerializer, SolicitudTrasladoSerializer, 
    ActividadCampoSerializer, RegistroCosechaSerializer, SolicitudInsumoSerializer
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
            role = 'SUPERVISOR' if trabajador.es_supervisor else 'OBRERO'
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

class SolicitudTrasladoViewSet(viewsets.ModelViewSet):
    queryset = SolicitudTraslado.objects.all()
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

class SolicitudInsumoViewSet(viewsets.ModelViewSet):
    queryset = SolicitudInsumo.objects.all().order_by('-fecha_solicitud')
    serializer_class = SolicitudInsumoSerializer

    def perform_update(self, serializer):
        from django.utils import timezone
        solicitud = serializer.save()
        if solicitud.estado in ['APROBADO', 'RECHAZADO'] and not solicitud.fecha_respuesta:
            solicitud.fecha_respuesta = timezone.now()
            solicitud.save()
