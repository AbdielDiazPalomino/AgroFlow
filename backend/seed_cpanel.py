import os
import sys
from datetime import timedelta, datetime

# Inicializar Django automáticamente si se ejecuta como script directo
if not os.environ.get('DJANGO_SETTINGS_MODULE'):
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'roots.settings')
    import django
    django.setup()

from django.utils import timezone
from core.models import Cuadrilla, Trabajador, Sector, TareaCuadrilla, Cultivo

print("--- INICIANDO CARGA DE DATOS PARA CPANEL ---")

# 1. IDENTIFICAR Y CONFIGURAR SUPERVISORES (ID 1: Alejandro Asurza, ID 2: Armando Mazzei)
# Intentamos obtener por ID (1 y 2 según cPanel del usuario), o por DNI o nombres
sup_alejandro = Trabajador.objects.filter(id=1).first()
if not sup_alejandro:
    sup_alejandro = Trabajador.objects.filter(dni="60125824").first()
if not sup_alejandro:
    sup_alejandro = Trabajador.objects.filter(nombres__icontains='Alejandro', es_supervisor=True).first()

if not sup_alejandro:
    sup_alejandro = Trabajador.objects.create(
        id=1,
        dni="60125824",
        nombres="Alejandro",
        apellidos="Asurza",
        es_supervisor=True,
        activo=True,
        password="password123"
    )
else:
    sup_alejandro.nombres = "Alejandro"
    sup_alejandro.apellidos = "Asurza"
    sup_alejandro.es_supervisor = True
    sup_alejandro.activo = True
    sup_alejandro.save()

sup_armando = Trabajador.objects.filter(id=2).first()
if not sup_armando:
    sup_armando = Trabajador.objects.filter(dni="86126398").first()
if not sup_armando:
    sup_armando = Trabajador.objects.filter(nombres__icontains='Armando', es_supervisor=True).first()

if not sup_armando:
    sup_armando = Trabajador.objects.create(
        id=2,
        dni="86126398",
        nombres="Armando",
        apellidos="Mazzei",
        es_supervisor=True,
        activo=True,
        password="password123"
    )
else:
    sup_armando.nombres = "Armando"
    sup_armando.apellidos = "Mazzei"
    sup_armando.es_supervisor = True
    sup_armando.activo = True
    sup_armando.save()

print(f"✓ Supervisor 1: {sup_alejandro.nombres} {sup_alejandro.apellidos} (ID: {sup_alejandro.id}, DNI: {sup_alejandro.dni})")
print(f"✓ Supervisor 2: {sup_armando.nombres} {sup_armando.apellidos} (ID: {sup_armando.id}, DNI: {sup_armando.dni})")

# 2. SECTORES DE REFERENCIA
sector_norte = Sector.objects.filter(nombre__icontains='Norte').first()
if not sector_norte:
    cultivo, _ = Cultivo.objects.get_or_create(nombre='Girasol de Exportación', defaults={'variedad': 'Sunrich Orange'})
    sector_norte, _ = Sector.objects.get_or_create(
        nombre='Sector Norte 1',
        defaults={'cultivo': cultivo, 'area_hectareas': 8.5, 'estado': 'OPTIMO'}
    )

sector_sur = Sector.objects.filter(nombre__icontains='Sur').first()
if not sector_sur:
    cultivo2, _ = Cultivo.objects.get_or_create(nombre='Achillea Exportación', defaults={'variedad': 'Cloth of Gold'})
    sector_sur, _ = Sector.objects.get_or_create(
        nombre='Sector Sur 1',
        defaults={'cultivo': cultivo2, 'area_hectareas': 10.2, 'estado': 'OPTIMO'}
    )

# 3. CUADRILLAS A-1 Y B-1
cuadrilla_a = Cuadrilla.objects.filter(nombre__icontains='A-1').first()
if not cuadrilla_a:
    cuadrilla_a, _ = Cuadrilla.objects.get_or_create(
        nombre='Cuadrilla A-1',
        defaults={'tipo': 'COSECHA', 'sector_asignado': sector_norte, 'encargado': sup_alejandro}
    )
cuadrilla_a.encargado = sup_alejandro
cuadrilla_a.sector_asignado = sector_norte
cuadrilla_a.save()

cuadrilla_b = Cuadrilla.objects.filter(nombre__icontains='B-1').first()
if not cuadrilla_b:
    cuadrilla_b, _ = Cuadrilla.objects.get_or_create(
        nombre='Cuadrilla B-1',
        defaults={'tipo': 'RIEGO', 'sector_asignado': sector_sur, 'encargado': sup_armando}
    )
cuadrilla_b.encargado = sup_armando
cuadrilla_b.sector_asignado = sector_sur
cuadrilla_b.save()

# Asegurar vinculación del supervisor con su cuadrilla
sup_alejandro.cuadrilla = cuadrilla_a
sup_alejandro.save()

sup_armando.cuadrilla = cuadrilla_b
sup_armando.save()

print(f"✓ Cuadrilla A-1 asignada a {sup_alejandro.nombres} en {sector_norte.nombre}")
print(f"✓ Cuadrilla B-1 asignada a {sup_armando.nombres} en {sector_sur.nombre}")

# 4. PERSONAL OPERARIO PARA CUADRILLA A-1 (Alejandro)
# 4 Activos + 2 Inactivos (Receso estacional)
obreros_a = [
    # Activos
    {"dni": "44201981", "nombres": "Mateo", "apellidos": "Vilca Ramos", "activo": True},
    {"dni": "45891023", "nombres": "Rosa", "apellidos": "Flores Quispe", "activo": True},
    {"dni": "46912384", "nombres": "Luis", "apellidos": "Mamani Choque", "activo": True},
    {"dni": "47109283", "nombres": "Carlos", "apellidos": "Condori Apaza", "activo": True},
    # Inactivos (En receso de temporada estacional - Conservan Cuadrilla A-1)
    {"dni": "50382616", "nombres": "Juan", "apellidos": "Quispe Ticona", "activo": False},
    {"dni": "48920194", "nombres": "Mario", "apellidos": "Alanya Gomez", "activo": False},
]

for item in obreros_a:
    trab, created = Trabajador.objects.update_or_create(
        dni=item["dni"],
        defaults={
            "nombres": item["nombres"],
            "apellidos": item["apellidos"],
            "cuadrilla": cuadrilla_a,
            "es_supervisor": False,
            "es_jefe_almacen": False,
            "activo": item["activo"],
            "password": item["dni"]
        }
    )
    status_str = "Activo" if trab.activo else "Inactivo (Receso temporada)"
    print(f"  - [Cuadrilla A-1] {trab.nombres} {trab.apellidos} ({status_str})")

# 5. PERSONAL OPERARIO PARA CUADRILLA B-1 (Armando)
# 4 Activos + 2 Inactivos (Receso estacional)
obreros_b = [
    # Activos
    {"dni": "43901289", "nombres": "Jorge", "apellidos": "Ramos Palomino", "activo": True},
    {"dni": "44510928", "nombres": "Silvia", "apellidos": "Cárdenas Rivas", "activo": True},
    {"dni": "45129038", "nombres": "Raúl", "apellidos": "Mendoza Huanca", "activo": True},
    {"dni": "46290192", "nombres": "Carmen", "apellidos": "Yupanqui Soto", "activo": True},
    # Inactivos (En receso de temporada estacional - Conservan Cuadrilla B-1)
    {"dni": "47819201", "nombres": "Andrés", "apellidos": "Huarcaya Peña", "activo": False},
    {"dni": "48102938", "nombres": "Elena", "apellidos": "Vilca Barrientos", "activo": False},
]

for item in obreros_b:
    trab, created = Trabajador.objects.update_or_create(
        dni=item["dni"],
        defaults={
            "nombres": item["nombres"],
            "apellidos": item["apellidos"],
            "cuadrilla": cuadrilla_b,
            "es_supervisor": False,
            "es_jefe_almacen": False,
            "activo": item["activo"],
            "password": item["dni"]
        }
    )
    status_str = "Activo" if trab.activo else "Inactivo (Receso temporada)"
    print(f"  - [Cuadrilla B-1] {trab.nombres} {trab.apellidos} ({status_str})")

# 6. PLANES DIARIOS DE TAREAS (Trazabilidad y Mapa de Calor)
# Limpiar tareas previas de prueba de estas cuadrillas para consistencia limpia
TareaCuadrilla.objects.filter(cuadrilla__in=[cuadrilla_a, cuadrilla_b]).delete()

hoy = timezone.now().date()
tz = timezone.get_current_timezone()

def make_dt(date_obj, hour, minute):
    naive = datetime(date_obj.year, date_obj.month, date_obj.day, hour, minute)
    return timezone.make_aware(naive, tz)

# === TAREAS PARA HOY - CUADRILLA A-1 (Alejandro Asurza) ===
# 2 Completadas, 1 En Proceso, 2 Pendientes
TareaCuadrilla.objects.create(
    titulo="Cosecha de Flor de Exportación - Lote 1",
    tipo_labor="COSECHA",
    cuadrilla=cuadrilla_a,
    supervisor=sup_alejandro,
    sector=sector_norte,
    fecha_programada=hoy,
    prioridad="ALTA",
    estado="COMPLETADA",
    hora_inicio=make_dt(hoy, 6, 30),
    hora_fin=make_dt(hoy, 9, 45),
    duracion_minutos=195,  # 3.25 hrs
    descripcion="Corte a 65cm de flor abierta, selección de primera calidad para exportación.",
    observaciones="Cosecha concluida con éxito. 320 mallas enviadas a postcosecha en cámara fría."
)

TareaCuadrilla.objects.create(
    titulo="Inspección y control técnico de humedad de suelo",
    tipo_labor="RIEGO",
    cuadrilla=cuadrilla_a,
    supervisor=sup_alejandro,
    sector=sector_norte,
    fecha_programada=hoy,
    prioridad="MEDIA",
    estado="COMPLETADA",
    hora_inicio=make_dt(hoy, 10, 0),
    hora_fin=make_dt(hoy, 11, 45),
    duracion_minutos=105,  # 1.75 hrs
    descripcion="Lectura de tensiómetros en bancales 1 al 12 y calibración de goteros.",
    observaciones="Humedad promedio al 81%. Se desobstruyeron 6 goteros en bancal 4."
)

TareaCuadrilla.objects.create(
    titulo="Poda y desbrote manual de botones laterales",
    tipo_labor="PODA",
    cuadrilla=cuadrilla_a,
    supervisor=sup_alejandro,
    sector=sector_norte,
    fecha_programada=hoy,
    prioridad="MEDIA",
    estado="EN_PROCESO",
    hora_inicio=make_dt(hoy, 12, 15),
    hora_fin=None,
    duracion_minutos=0,
    descripcion="Raleo fitosanitario para concentrar vigor en el botón principal apical.",
    observaciones=""
)

TareaCuadrilla.objects.create(
    titulo="Limpieza de cabezal de fertirriego y filtros de anillas",
    tipo_labor="MANTENIMIENTO",
    cuadrilla=cuadrilla_a,
    supervisor=sup_alejandro,
    sector=sector_norte,
    fecha_programada=hoy,
    prioridad="BAJA",
    estado="PENDIENTE",
    hora_inicio=None,
    hora_fin=None,
    duracion_minutos=0,
    descripcion="Lavado a contracorriente de filtros de grava y limpieza de venturis.",
    observaciones=""
)

TareaCuadrilla.objects.create(
    titulo="Encanastado y acondicionamiento con malla soporte",
    tipo_labor="ENCANASTADO",
    cuadrilla=cuadrilla_a,
    supervisor=sup_alejandro,
    sector=sector_norte,
    fecha_programada=hoy,
    prioridad="ALTA",
    estado="PENDIENTE",
    hora_inicio=None,
    hora_fin=None,
    duracion_minutos=0,
    descripcion="Elevación de malla soporte a nivel 3 para evitar curvatura de tallos.",
    observaciones=""
)

# === TAREAS PARA HOY - CUADRILLA B-1 (Armando Mazzei) ===
# 2 Completadas, 1 En Proceso, 2 Pendientes
TareaCuadrilla.objects.create(
    titulo="Deshierbe manual y limpieza de zanjas laterales",
    tipo_labor="DESHIERBE",
    cuadrilla=cuadrilla_b,
    supervisor=sup_armando,
    sector=sector_sur,
    fecha_programada=hoy,
    prioridad="MEDIA",
    estado="COMPLETADA",
    hora_inicio=make_dt(hoy, 6, 45),
    hora_fin=make_dt(hoy, 9, 30),
    duracion_minutos=165,  # 2.75 hrs
    descripcion="Eliminación de malezas hospederas en bordes y zanjas de drenaje.",
    observaciones="Canal despejado en su totalidad sin daño a las raíces del cultivo."
)

TareaCuadrilla.objects.create(
    titulo="Aplicación fitosanitaria preventiva Bacillus",
    tipo_labor="FITOSANITARIA",
    cuadrilla=cuadrilla_b,
    supervisor=sup_armando,
    sector=sector_sur,
    fecha_programada=hoy,
    prioridad="URGENTE",
    estado="COMPLETADA",
    hora_inicio=make_dt(hoy, 9, 45),
    hora_fin=make_dt(hoy, 12, 15),
    duracion_minutos=150,  # 2.5 hrs
    descripcion="Aspersión foliar preventiva contra mosca blanca y trips según receta técnica.",
    observaciones="Aplicación uniforme con EPP completo. Viento favorable menor a 5 km/h."
)

TareaCuadrilla.objects.create(
    titulo="Cosecha matutina Girasol grado exportación",
    tipo_labor="COSECHA",
    cuadrilla=cuadrilla_b,
    supervisor=sup_armando,
    sector=sector_sur,
    fecha_programada=hoy,
    prioridad="ALTA",
    estado="EN_PROCESO",
    hora_inicio=make_dt(hoy, 12, 45),
    hora_fin=None,
    duracion_minutos=0,
    descripcion="Corte de capítulos florales en punto óptimo de apertura (fase 2).",
    observaciones=""
)

TareaCuadrilla.objects.create(
    titulo="Mantenimiento preventivo de cercos y mallas cortaviento",
    tipo_labor="MANTENIMIENTO",
    cuadrilla=cuadrilla_b,
    supervisor=sup_armando,
    sector=sector_sur,
    fecha_programada=hoy,
    prioridad="BAJA",
    estado="PENDIENTE",
    hora_inicio=None,
    hora_fin=None,
    duracion_minutos=0,
    descripcion="Tensado de alambre galvanizado y remiendo de paños de polisombra.",
    observaciones=""
)

TareaCuadrilla.objects.create(
    titulo="Calibración de caudalímetros y nutrición por fertirriego",
    tipo_labor="RIEGO",
    cuadrilla=cuadrilla_b,
    supervisor=sup_armando,
    sector=sector_sur,
    fecha_programada=hoy,
    prioridad="MEDIA",
    estado="PENDIENTE",
    hora_inicio=None,
    hora_fin=None,
    duracion_minutos=0,
    descripcion="Inyección de solución nutritiva N-P-K según curva de floración.",
    observaciones=""
)

# === HISTORIAL DE DÍAS ANTERIORES PARA EL MAPA DE CALOR (HEATMAP) ===
# Día de ayer (1 día atrás)
ayer = hoy - timedelta(days=1)

TareaCuadrilla.objects.create(
    titulo="Cosecha matutina y selección en campo",
    tipo_labor="COSECHA",
    cuadrilla=cuadrilla_a,
    supervisor=sup_alejandro,
    sector=sector_norte,
    fecha_programada=ayer,
    prioridad="ALTA",
    estado="COMPLETADA",
    hora_inicio=make_dt(ayer, 7, 0),
    hora_fin=make_dt(ayer, 11, 0),
    duracion_minutos=240,  # 4.0 hrs
    descripcion="Cosecha intensiva bloque A",
    observaciones="Cumplimiento del 100% de la cuota programada."
)
TareaCuadrilla.objects.create(
    tipo_labor="RIEGO",
    titulo="Fertirriego programado ciclo vespertino",
    cuadrilla=cuadrilla_a,
    supervisor=sup_alejandro,
    sector=sector_norte,
    fecha_programada=ayer,
    prioridad="MEDIA",
    estado="COMPLETADA",
    hora_inicio=make_dt(ayer, 13, 0),
    hora_fin=make_dt(ayer, 16, 0),
    duracion_minutos=180,  # 3.0 hrs
    descripcion="Inyección de micronutrientes",
    observaciones="Presión estable a 1.8 bar en todo el sector."
)

TareaCuadrilla.objects.create(
    titulo="Poda de formación y deshoje sanitario",
    tipo_labor="PODA",
    cuadrilla=cuadrilla_b,
    supervisor=sup_armando,
    sector=sector_sur,
    fecha_programada=ayer,
    prioridad="MEDIA",
    estado="COMPLETADA",
    hora_inicio=make_dt(ayer, 7, 30),
    hora_fin=make_dt(ayer, 11, 30),
    duracion_minutos=240,  # 4.0 hrs
    descripcion="Retiro de hojas basales secas",
    observaciones="Excelente avance en 1.5 hectáreas."
)
TareaCuadrilla.objects.create(
    titulo="Aplicación de biocontrolador Trichoderma",
    tipo_labor="FITOSANITARIA",
    cuadrilla=cuadrilla_b,
    supervisor=sup_armando,
    sector=sector_sur,
    fecha_programada=ayer,
    prioridad="ALTA",
    estado="COMPLETADA",
    hora_inicio=make_dt(ayer, 13, 30),
    hora_fin=make_dt(ayer, 16, 30),
    duracion_minutos=180,  # 3.0 hrs
    descripcion="Inoculación de microorganismos al suelo",
    observaciones="Suelo húmedo ideal para fijación de cepas."
)

print("\n✅ ¡TODOS LOS DATOS HAN SIDO GENERADOS CON ÉXITO!")
print(f"Total Tareas en BD: {TareaCuadrilla.objects.count()}")
print(f"Total Trabajadores Cuadrilla A-1: {Trabajador.objects.filter(cuadrilla=cuadrilla_a).count()} ({Trabajador.objects.filter(cuadrilla=cuadrilla_a, activo=True).count()} activos, {Trabajador.objects.filter(cuadrilla=cuadrilla_a, activo=False).count()} en receso)")
print(f"Total Trabajadores Cuadrilla B-1: {Trabajador.objects.filter(cuadrilla=cuadrilla_b).count()} ({Trabajador.objects.filter(cuadrilla=cuadrilla_b, activo=True).count()} activos, {Trabajador.objects.filter(cuadrilla=cuadrilla_b, activo=False).count()} en receso)")
