from django.db import models
from django.contrib.auth.models import User

# ==========================================
# 1. GESTIÓN DE CULTIVOS Y SECTORES (MAPA)
# ==========================================

class Cultivo(models.Model):
    nombre = models.CharField(max_length=100, help_text="Ej: Sunflower, Gypsophila Tango")
    variedad = models.CharField(max_length=100, blank=True, null=True)
    
    def __str__(self):
        return f"{self.nombre} ({self.variedad})" if self.variedad else self.nombre

class Sector(models.Model):
    ESTADO_CHOICES = [
        ('ACTIVO', 'Activo - Operando'),
        ('RIEGO', 'En Riego'),
        ('ALERTA', 'Alerta Fitosanitaria'),
        ('MANTENIMIENTO', 'En Mantenimiento'),
    ]

    nombre = models.CharField(max_length=100, help_text="Ej: Sector Norte 1")
    coordenadas_centro = models.CharField(max_length=100, help_text="Lat,Lng para centrar el mapa")
    area_hectareas = models.DecimalField(max_digits=6, decimal_places=2)
    cultivo = models.ForeignKey(Cultivo, on_delete=models.SET_NULL, null=True, blank=True, related_name='sectores')
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='ACTIVO')
    
    def __str__(self):
        return self.nombre

# ==========================================
# 2. GESTIÓN DE PERSONAL Y CUADRILLAS
# ==========================================

class Cuadrilla(models.Model):
    TIPO_CHOICES = [
        ('COSECHA', 'Cosecha'),
        ('PODADO', 'Podado'),
        ('RIEGO', 'Riego y Fertirriego'),
        ('MANTENIMIENTO', 'Mantenimiento'),
    ]

    nombre = models.CharField(max_length=100, help_text="Ej: Cuadrilla Cosecha Alfa")
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    sector_asignado = models.ForeignKey(Sector, on_delete=models.SET_NULL, null=True, blank=True, related_name='cuadrillas')
    supervisor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'is_staff': True})
    
    def __str__(self):
        return self.nombre

class Trabajador(models.Model):
    """
    Representa al Obrero. Separado del modelo User de Django porque el Obrero 
    solo necesita autenticación biométrica y no acceso al admin de Django.
    """
    dni = models.CharField(max_length=20, unique=True)
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    foto_url = models.URLField(blank=True, null=True, help_text="URL del avatar")
    
    # Si es null, es personal nuevo sin asignar (Tal como lo diseñamos en el frontend)
    cuadrilla = models.ForeignKey(Cuadrilla, on_delete=models.SET_NULL, null=True, blank=True, related_name='trabajadores')
    
    fecha_contratacion = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombres} {self.apellidos} - {self.dni}"

# ==========================================
# 3. TRASLADOS Y COMPLIANCE LEGAL (WEBAUTHN)
# ==========================================

class SolicitudTraslado(models.Model):
    ESTADO_CHOICES = [
        ('PENDIENTE', 'Pendiente de Firma'),
        ('ACEPTADO', 'Aceptado por Biometría'),
        ('RECHAZADO', 'Rechazado por el Trabajador'),
    ]

    trabajador = models.ForeignKey(Trabajador, on_delete=models.CASCADE, related_name='traslados')
    cuadrilla_origen = models.ForeignKey(Cuadrilla, on_delete=models.SET_NULL, null=True, blank=True, related_name='traslados_salientes')
    cuadrilla_destino = models.ForeignKey(Cuadrilla, on_delete=models.CASCADE, related_name='traslados_entrantes')
    
    motivo = models.TextField(help_text="Motivo operativo de la reasignación")
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='PENDIENTE')
    
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_respuesta = models.DateTimeField(null=True, blank=True)
    
    # Aquí se guardaría el ID del credencial WebAuthn generado por el celular del obrero
    firma_biometrica_hash = models.CharField(max_length=255, blank=True, null=True, help_text="Hash criptográfico de WebAuthn")

    def __str__(self):
        return f"Traslado de {self.trabajador} a {self.cuadrilla_destino} ({self.estado})"
