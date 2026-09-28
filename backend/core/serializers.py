from rest_framework import serializers
from .models import (
    Cultivo, Sector, Cuadrilla, Trabajador, 
    SolicitudTraslado, ActividadCampo, RegistroCosecha
)

class CultivoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cultivo
        fields = '__all__'

class SectorSerializer(serializers.ModelSerializer):
    cultivo_nombre = serializers.CharField(source='cultivo.nombre', read_only=True)

    class Meta:
        model = Sector
        fields = '__all__'

class CuadrillaSerializer(serializers.ModelSerializer):
    sector_nombre = serializers.CharField(source='sector_asignado.nombre', read_only=True)
    supervisor_nombre = serializers.CharField(source='supervisor.username', read_only=True)

    class Meta:
        model = Cuadrilla
        fields = '__all__'

class TrabajadorSerializer(serializers.ModelSerializer):
    cuadrilla_nombre = serializers.CharField(source='cuadrilla.nombre', read_only=True)

    class Meta:
        model = Trabajador
        fields = '__all__'

class SolicitudTrasladoSerializer(serializers.ModelSerializer):
    trabajador_nombre = serializers.CharField(source='trabajador.nombres', read_only=True)
    cuadrilla_origen_nombre = serializers.CharField(source='cuadrilla_origen.nombre', read_only=True)
    cuadrilla_destino_nombre = serializers.CharField(source='cuadrilla_destino.nombre', read_only=True)

    class Meta:
        model = SolicitudTraslado
        fields = '__all__'

class ActividadCampoSerializer(serializers.ModelSerializer):
    sector_nombre = serializers.CharField(source='sector.nombre', read_only=True)
    cuadrilla_nombre = serializers.CharField(source='cuadrilla.nombre', read_only=True)

    class Meta:
        model = ActividadCampo
        fields = '__all__'

class RegistroCosechaSerializer(serializers.ModelSerializer):
    sector_nombre = serializers.CharField(source='sector.nombre', read_only=True)

    class Meta:
        model = RegistroCosecha
        fields = '__all__'
