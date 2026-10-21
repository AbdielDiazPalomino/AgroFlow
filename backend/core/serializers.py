from rest_framework import serializers
from .models import (
    PerfilUsuario, Cultivo, Sector, Cuadrilla, Trabajador, 
    SolicitudTraslado, ActividadCampo, RegistroCosecha, SolicitudInsumo, Incidencia
)

class PerfilUsuarioSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='usuario.username', read_only=True)
    email = serializers.CharField(source='usuario.email', read_only=True)

    class Meta:
        model = PerfilUsuario
        fields = '__all__'

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
    encargado_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Cuadrilla
        fields = '__all__'

    def get_encargado_nombre(self, obj):
        if obj.encargado:
            return f"{obj.encargado.nombres} {obj.encargado.apellidos}"
        return None

class TrabajadorSerializer(serializers.ModelSerializer):
    cuadrilla_nombre = serializers.CharField(source='cuadrilla.nombre', read_only=True)

    class Meta:
        model = Trabajador
        fields = '__all__'

class SolicitudTrasladoSerializer(serializers.ModelSerializer):
    trabajador_nombre = serializers.SerializerMethodField()
    cuadrilla_origen_nombre = serializers.CharField(source='cuadrilla_origen.nombre', read_only=True)
    cuadrilla_destino_nombre = serializers.CharField(source='cuadrilla_destino.nombre', read_only=True)

    class Meta:
        model = SolicitudTraslado
        fields = '__all__'

    def get_trabajador_nombre(self, obj):
        if obj.trabajador:
            return f"{obj.trabajador.nombres} {obj.trabajador.apellidos}"
        return None

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

class SolicitudInsumoSerializer(serializers.ModelSerializer):
    cuadrilla_nombre = serializers.CharField(source='cuadrilla.nombre', read_only=True)
    solicitado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudInsumo
        fields = '__all__'

    def get_solicitado_por_nombre(self, obj):
        if obj.solicitado_por:
            return f"{obj.solicitado_por.nombres} {obj.solicitado_por.apellidos}"
        return None

class IncidenciaSerializer(serializers.ModelSerializer):
    cuadrilla_nombre = serializers.CharField(source='cuadrilla.nombre', read_only=True)
    sector_nombre = serializers.CharField(source='sector.nombre', read_only=True)
    cultivo_nombre = serializers.CharField(source='sector.cultivo.nombre', read_only=True)
    reportado_por_nombre = serializers.SerializerMethodField()
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    gravedad_display = serializers.CharField(source='get_gravedad_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Incidencia
        fields = '__all__'

    def get_reportado_por_nombre(self, obj):
        if obj.reportado_por:
            return f"{obj.reportado_por.nombres} {obj.reportado_por.apellidos}"
        return None
