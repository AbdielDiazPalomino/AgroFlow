from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CultivoViewSet, SectorViewSet, CuadrillaViewSet, 
    TrabajadorViewSet, SolicitudTrasladoViewSet, 
    ActividadCampoViewSet, RegistroCosechaViewSet
)

router = DefaultRouter()
router.register(r'cultivos', CultivoViewSet)
router.register(r'sectores', SectorViewSet)
router.register(r'cuadrillas', CuadrillaViewSet)
router.register(r'trabajadores', TrabajadorViewSet)
router.register(r'traslados', SolicitudTrasladoViewSet)
router.register(r'actividades', ActividadCampoViewSet)
router.register(r'cosechas', RegistroCosechaViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
