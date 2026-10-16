from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth import authenticate

from .models import (
    PerfilUsuario, Cultivo, Sector, Cuadrilla, Trabajador, 
    SolicitudTraslado, ActividadCampo, RegistroCosecha
)
from .serializers import (
    PerfilUsuarioSerializer, CultivoSerializer, SectorSerializer, CuadrillaSerializer, 
    TrabajadorSerializer, SolicitudTrasladoSerializer, 
    ActividadCampoSerializer, RegistroCosechaSerializer
)

@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    user = authenticate(username=username, password=password)
    
    if user is not None:
        # Validar que sea Superuser (Admin) o tenga perfil de GERENTE
        is_gerente = user.is_superuser or (hasattr(user, 'perfil') and user.perfil.rol == 'GERENTE')
        
        if is_gerente:
            return Response({
                'message': 'Login exitoso', 
                'role': 'GERENTE', 
                'username': user.username
            })
        else:
            return Response(
                {'error': 'Acceso denegado. Solo el Gerente General tiene acceso a este portal web.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
    else:
        return Response(
            {'error': 'Credenciales incorrectas.'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )

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
