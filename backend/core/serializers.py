from rest_framework import serializers
from .models import (
    PerfilUsuario, Cultivo, Sector, Cuadrilla, Trabajador, 
    SolicitudTraslado, ActividadCampo, RegistroCosecha, SolicitudInsumo, Incidencia,
    TareaCuadrilla
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

def format_time_12h(dt):
    if not dt:
        return ""
    from django.utils import timezone
    dt_local = timezone.localtime(dt)
    h = dt_local.hour % 12
    if h == 0:
        h = 12
    m = f"{dt_local.minute:02d}"
    p = "AM" if dt_local.hour < 12 else "PM"
    return f"{h}:{m} {p}"

class TareaCuadrillaSerializer(serializers.ModelSerializer):
    cuadrilla_nombre = serializers.CharField(source='cuadrilla.nombre', read_only=True)
    sector_nombre = serializers.CharField(source='sector.nombre', read_only=True)
    cultivo_nombre = serializers.CharField(source='sector.cultivo.nombre', read_only=True)
    supervisor_nombre = serializers.SerializerMethodField()
    tipo_labor_display = serializers.CharField(source='get_tipo_labor_display', read_only=True)
    prioridad_display = serializers.CharField(source='get_prioridad_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    estado_detalle = serializers.SerializerMethodField()
    hora_inicio_12h = serializers.SerializerMethodField()
    hora_fin_12h = serializers.SerializerMethodField()
    duracion_formateada = serializers.SerializerMethodField()
    duracion_horas = serializers.SerializerMethodField()

    class Meta:
        model = TareaCuadrilla
        fields = '__all__'

    def get_supervisor_nombre(self, obj):
        if obj.supervisor:
            return f"{obj.supervisor.nombres} {obj.supervisor.apellidos}"
        return None

    def get_hora_inicio_12h(self, obj):
        return format_time_12h(obj.hora_inicio) if obj.hora_inicio else ""

    def get_hora_fin_12h(self, obj):
        return format_time_12h(obj.hora_fin) if obj.hora_fin else ""

    def get_estado_detalle(self, obj):
        if obj.estado == 'COMPLETADA':
            h_ini = format_time_12h(obj.hora_inicio)
            h_fin = format_time_12h(obj.hora_fin)
            if h_ini and h_fin:
                return f"(Terminado) {h_ini} - {h_fin}"
            elif h_fin:
                return f"(Terminado) {h_fin}"
            return "(Terminado)"
        elif obj.estado == 'EN_PROCESO':
            h_ini = format_time_12h(obj.hora_inicio)
            return f"(En proceso) {h_ini}" if h_ini else "(En proceso)"
        return "(Falta)"

    def get_duracion_formateada(self, obj):
        minutos = obj.duracion_minutos
        if minutos is None or (minutos <= 0 and obj.estado != 'COMPLETADA'):
            if obj.estado == 'EN_PROCESO' and obj.hora_inicio:
                from django.utils import timezone
                delta = timezone.now() - obj.hora_inicio
                mins = max(1, int(delta.total_seconds() / 60))
                horas = mins // 60
                rem_mins = mins % 60
                return f"{horas}h {rem_mins}m (en curso)" if horas > 0 else f"{mins}m (en curso)"
            return "-"
        if minutos <= 0 and obj.estado == 'COMPLETADA':
            return "1m"
        horas = minutos // 60
        rem_mins = minutos % 60
        if horas > 0:
            return f"{horas}h {rem_mins}m" if rem_mins > 0 else f"{horas}h"
        return f"{minutos}m"

    def get_duracion_horas(self, obj):
        if obj.duracion_minutos and obj.duracion_minutos > 0:
            return round(obj.duracion_minutos / 60.0, 2)
        if obj.estado == 'EN_PROCESO' and obj.hora_inicio:
            from django.utils import timezone
            delta = timezone.now() - obj.hora_inicio
            return max(0.1, round(delta.total_seconds() / 3600.0, 1))
        return 0.0

