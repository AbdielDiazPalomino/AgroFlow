from django.contrib import admin
from .models import (
    PerfilUsuario, Cultivo, Sector, Cuadrilla, Trabajador, 
    SolicitudTraslado, ActividadCampo, RegistroCosecha
)

@admin.register(PerfilUsuario)
class PerfilUsuarioAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'rol', 'telefono')
    list_filter = ('rol',)

@admin.register(Cultivo)
class CultivoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'variedad')

@admin.register(Sector)
class SectorAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'cultivo', 'area_hectareas', 'estado')
    list_filter = ('estado', 'cultivo')

@admin.register(Cuadrilla)
class CuadrillaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tipo', 'sector_asignado', 'supervisor')
    list_filter = ('tipo',)

@admin.register(Trabajador)
class TrabajadorAdmin(admin.ModelAdmin):
    list_display = ('nombres', 'apellidos', 'dni', 'cuadrilla')
    search_fields = ('nombres', 'apellidos', 'dni')
    list_filter = ('cuadrilla',)

@admin.register(SolicitudTraslado)
class SolicitudTrasladoAdmin(admin.ModelAdmin):
    list_display = ('trabajador', 'cuadrilla_origen', 'cuadrilla_destino', 'estado', 'fecha_solicitud')
    list_filter = ('estado', 'fecha_solicitud')

@admin.register(ActividadCampo)
class ActividadCampoAdmin(admin.ModelAdmin):
    list_display = ('tipo_actividad', 'sector', 'cuadrilla', 'estado', 'fecha_programada')
    list_filter = ('estado', 'tipo_actividad', 'fecha_programada')

@admin.register(RegistroCosecha)
class RegistroCosechaAdmin(admin.ModelAdmin):
    list_display = ('sector', 'fecha', 'volumen_cajas', 'calidad')
    list_filter = ('calidad', 'fecha')
