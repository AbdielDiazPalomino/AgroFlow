from rest_framework import viewsets
from .models import (
    PerfilUsuario, Cultivo, Sector, Cuadrilla, Trabajador, 
    SolicitudTraslado, ActividadCampo, RegistroCosecha
)
from .serializers import (
    PerfilUsuarioSerializer, CultivoSerializer, SectorSerializer, CuadrillaSerializer, 
    TrabajadorSerializer, SolicitudTrasladoSerializer, 
    ActividadCampoSerializer, RegistroCosechaSerializer
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
