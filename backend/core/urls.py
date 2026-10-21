from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    api_login, api_supervisores, api_cambiar_password_trabajador, api_mi_perfil_obrero,
    api_actualizar_ubicacion_supervisor, api_ubicaciones_supervisores,
    api_ia_diagnostico, api_ia_sugerir_resolucion, api_ia_chat,
    PerfilUsuarioViewSet, CultivoViewSet, SectorViewSet, CuadrillaViewSet, 
    TrabajadorViewSet, SolicitudTrasladoViewSet, 
    ActividadCampoViewSet, RegistroCosechaViewSet, SolicitudInsumoViewSet,
    IncidenciaViewSet
)

router = DefaultRouter()
router.register(r'perfiles', PerfilUsuarioViewSet)
router.register(r'cultivos', CultivoViewSet)
router.register(r'sectores', SectorViewSet)
router.register(r'cuadrillas', CuadrillaViewSet)
router.register(r'trabajadores', TrabajadorViewSet)
router.register(r'traslados', SolicitudTrasladoViewSet)
router.register(r'actividades', ActividadCampoViewSet)
router.register(r'cosechas', RegistroCosechaViewSet)
router.register(r'insumos', SolicitudInsumoViewSet)
router.register(r'incidencias', IncidenciaViewSet)

urlpatterns = [
    path('login/', api_login, name='api_login'),
    path('supervisores/', api_supervisores, name='api_supervisores'),
    path('supervisores/actualizar-ubicacion/', api_actualizar_ubicacion_supervisor, name='api_actualizar_ubicacion_supervisor'),
    path('supervisores/ubicaciones/', api_ubicaciones_supervisores, name='api_ubicaciones_supervisores'),
    path('cambiar-password/', api_cambiar_password_trabajador, name='api_cambiar_password_trabajador'),
    path('obrero-perfil/<int:trabajador_id>/', api_mi_perfil_obrero, name='api_mi_perfil_obrero'),
    path('ia/diagnostico/', api_ia_diagnostico, name='api_ia_diagnostico'),
    path('ia/sugerir-resolucion/', api_ia_sugerir_resolucion, name='api_ia_sugerir_resolucion'),
    path('ia/chat/', api_ia_chat, name='api_ia_chat'),
    path('', include(router.urls)),
]
