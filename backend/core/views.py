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
