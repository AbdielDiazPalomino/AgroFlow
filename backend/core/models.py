from django.db import models
from django.contrib.auth.models import User

# ==========================================
# 0. GESTIÓN DE ROLES ADMINISTRATIVOS
# ==========================================

class PerfilUsuario(models.Model):
    ROLES = [
        ('GERENTE', 'Gerente General / Admin'),
        ('SUPERVISOR', 'Supervisor de Campo'),
    ]
    
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    rol = models.CharField(max_length=20, choices=ROLES, default='SUPERVISOR')
    telefono = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return f"{self.usuario.username} - {self.get_rol_display()}"

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
    coordenadas_poligono = models.TextField(help_text="JSON array de coordenadas [[lat,lng], [lat,lng]...]", blank=True, null=True)
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
    encargado = models.ForeignKey('Trabajador', on_delete=models.SET_NULL, null=True, blank=True, related_name='cuadrillas_a_cargo')
    
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
    es_supervisor = models.BooleanField(default=False, help_text="¿Tiene rol de supervisor de campo?")
    es_jefe_almacen = models.BooleanField(default=False, help_text="¿Tiene rol de Jefe de Almacén?")
    password = models.CharField(max_length=128, blank=True, null=True, help_text="Contraseña personal (por defecto es su DNI)")
    
    # Geolocalización en tiempo real (Supervisores de Campo)
    latitud_actual = models.FloatField(null=True, blank=True, help_text="Última latitud GPS registrada")
    longitud_actual = models.FloatField(null=True, blank=True, help_text="Última longitud GPS registrada")
    ultima_conexion_gps = models.DateTimeField(null=True, blank=True, help_text="Fecha y hora de última señal GPS")
    
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

# ==========================================
# 4. OPERACIONES Y PRODUCCIÓN (DASHBOARD & REPORTES)
# ==========================================

class ActividadCampo(models.Model):
    TIPO_ACTIVIDAD = [
        ('RIEGO', 'Riego'),
        ('FERTIRRIEGO', 'Fertirriego'),
        ('PODA', 'Poda'),
        ('FUMIGACION', 'Fumigación / Control de Plagas'),
        ('COSECHA', 'Cosecha'),
    ]
    ESTADO_ACTIVIDAD = [
        ('PENDIENTE', 'Pendiente'),
        ('EN_CURSO', 'En Curso'),
        ('COMPLETADO', 'Completado'),
        ('CANCELADO', 'Cancelado'),
    ]

    sector = models.ForeignKey(Sector, on_delete=models.CASCADE, related_name='actividades')
    cuadrilla = models.ForeignKey(Cuadrilla, on_delete=models.SET_NULL, null=True, blank=True, related_name='actividades')
    tipo_actividad = models.CharField(max_length=50, choices=TIPO_ACTIVIDAD)
    estado = models.CharField(max_length=20, choices=ESTADO_ACTIVIDAD, default='PENDIENTE')
    fecha_programada = models.DateField()
    fecha_ejecucion = models.DateTimeField(null=True, blank=True)
    observaciones = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.tipo_actividad} en {self.sector} ({self.estado})"

class RegistroCosecha(models.Model):
    CALIDAD_CHOICES = [
        ('A1', 'Exportación (A1)'),
        ('A2', 'Exportación (A2)'),
        ('B1', 'Mercado Local (B1)'),
        ('B2', 'Mercado Local (B2)'),
        ('RECHAZO', 'Rechazo / Merma'),
    ]

    sector = models.ForeignKey(Sector, on_delete=models.CASCADE, related_name='cosechas')
    fecha = models.DateField()
    volumen_cajas = models.IntegerField(help_text="Cantidad de cajas cosechadas")
    calidad = models.CharField(max_length=20, choices=CALIDAD_CHOICES)
    registrado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.volumen_cajas} cajas de {self.sector.cultivo} ({self.fecha})"

# ==========================================
# 5. GESTIÓN DE ALMACÉN E INSUMOS PARA CUADRILLAS
# ==========================================

class SolicitudInsumo(models.Model):
    ESTADO_CHOICES = [
        ('PENDIENTE', 'Pendiente'),
        ('APROBADO', 'Aprobado (SÍ)'),
        ('RECHAZADO', 'Rechazado (NO)'),
    ]
    PRIORIDAD_CHOICES = [
        ('NORMAL', 'Normal'),
        ('URGENTE', 'Urgente'),
    ]

    cuadrilla = models.ForeignKey(Cuadrilla, on_delete=models.CASCADE, related_name='solicitudes_insumos')
    solicitado_por = models.ForeignKey(Trabajador, on_delete=models.SET_NULL, null=True, blank=True, related_name='insumos_solicitados')
    insumo_nombre = models.CharField(max_length=150)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    unidad_medida = models.CharField(max_length=50, default='unidades') # unidades, litros, kg, cajas, rollos
    prioridad = models.CharField(max_length=20, choices=PRIORIDAD_CHOICES, default='NORMAL')
    motivo = models.TextField(blank=True, null=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='PENDIENTE')
    respuesta_almacen = models.TextField(blank=True, null=True)
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_respuesta = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.insumo_nombre} ({self.cantidad} {self.unidad_medida}) - {self.cuadrilla.nombre} [{self.estado}]"

# ==========================================
# 6. INCIDENCIAS DE CAMPO Y REPORTES OPERATIVOS
# ==========================================

class Incidencia(models.Model):
    TIPO_CHOICES = [
        ('FITOSANITARIA', 'Plagas / Fitosanitaria'),
        ('RIEGO', 'Falla de Riego / Hídrico'),
        ('CLIMA', 'Factor Climático / Viento / Radiación'),
        ('HERRAMIENTAS', 'Maquinaria y Herramientas'),
        ('SEGURIDAD', 'Seguridad y Salud Ocupacional'),
        ('OPERATIVA', 'Operativa / Cuadrilla / Logística'),
    ]
    GRAVEDAD_CHOICES = [
        ('BAJA', 'Baja'),
        ('MEDIA', 'Media'),
        ('ALTA', 'Alta'),
        ('CRITICA', 'Crítica'),
    ]
    ESTADO_CHOICES = [
        ('ABIERTA', 'Abierta'),
        ('EN_PROCESO', 'En Proceso'),
        ('RESUELTA', 'Resuelta'),
    ]

    titulo = models.CharField(max_length=200)
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES, default='OPERATIVA')
    gravedad = models.CharField(max_length=20, choices=GRAVEDAD_CHOICES, default='MEDIA')
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='ABIERTA')
    
    descripcion = models.TextField()
    accion_tomada = models.TextField(blank=True, null=True, help_text="Acción inmediata tomada por el supervisor")
    resolucion_gerencia = models.TextField(blank=True, null=True, help_text="Decisión o instrucción dada por Gerencia General")
    
    sector = models.ForeignKey(Sector, on_delete=models.SET_NULL, null=True, blank=True, related_name='incidencias')
    cuadrilla = models.ForeignKey(Cuadrilla, on_delete=models.SET_NULL, null=True, blank=True, related_name='incidencias')
    reportado_por = models.ForeignKey(Trabajador, on_delete=models.SET_NULL, null=True, blank=True, related_name='incidencias_reportadas')
    
    fecha_reporte = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[{self.gravedad}] {self.titulo} - {self.sector} ({self.estado})"
