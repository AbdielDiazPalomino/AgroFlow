from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    api_login, api_supervisores, api_cambiar_password_trabajador, api_mi_perfil_obrero,
    PerfilUsuarioViewSet, CultivoViewSet, SectorViewSet, CuadrillaViewSet, 
    TrabajadorViewSet, SolicitudTrasladoViewSet, 
    ActividadCampoViewSet, RegistroCosechaViewSet
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

urlpatterns = [
    path('login/', api_login, name='api_login'),
    path('supervisores/', api_supervisores, name='api_supervisores'),
    path('cambiar-password/', api_cambiar_password_trabajador, name='api_cambiar_password_trabajador'),
    path('obrero-perfil/<int:trabajador_id>/', api_mi_perfil_obrero, name='api_mi_perfil_obrero'),
    path('', include(router.urls)),
]
