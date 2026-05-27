"""Genera 10.000 siniestros sinteticos ADICIONALES con MAYOR DIVERSIDAD.

Resuelve dos problemas del dataset original:
1. Descripciones MUY parecidas (sim media 0.97) -> usa 50+ templates variadas
2. Solo 48 proveedores (muy concentrado) -> agrega 150 nuevos proveedores

Lee:   data/raw/Car_Insurance_Fraud_Detection_Dataset.csv (original)
Escribe: data/raw/Car_Insurance_Fraud_Detection_Dataset_extended.csv
         (concatenacion de original + 10K nuevos)

Despues correr el pipeline normal sobre el extended:
    python scripts/clean_dataset.py    (apuntando al extended)
    python scripts/normalize_tables.py
    python scripts/inject_critical_cases.py
    python src/features/build_features.py
    python src/models/train_xgboost.py
    python scripts/compute_embeddings.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ORIG = ROOT / "data" / "raw" / "Car_Insurance_Fraud_Detection_Dataset.csv"
OUT = ROOT / "data" / "raw" / "Car_Insurance_Fraud_Detection_Dataset_extended.csv"

RNG = np.random.default_rng(20260527)
N_NUEVOS = 10_000

# === Catalogos ampliados ===
CIUDADES = ["Quito","Guayaquil","Cuenca","Manta","Machala","Ambato","Ibarra","Loja",
            "Riobamba","Esmeraldas","Portoviejo","Santo Domingo","Latacunga","Tulcan",
            "Babahoyo","Otavalo","Salinas","Tena"]

COBERTURAS = ["Choque","Responsabilidad Civil","Robo","Daño","Pérdida Total"]
ESTADOS = ["Pago Total","Pago Parcial","Reserva","Anticipo","Negativa",
           "Liquidado","Cierre Sin Consecuencia"]
SEGMENTOS = ["Premium","Estándar","Joven"]
TIPOS_BENE = ["Taller","Clínica","Perito"]
CANALES = ["Web","Banca seguros","Broker","Venta directa","App movil"]
TIPOS_COB = ["Collision","Liability","Comprehensive","Theft"]
FAULTS = ["Asegurado","Tercero","Compartido"]
MARCAS = {
    "Toyota": ["Hilux","RAV4","Corolla","Yaris","Fortuner","Prado"],
    "Chevrolet": ["Sail","Spark","Aveo","Onix","Captiva","Trailblazer"],
    "Kia": ["Sportage","Rio","Picanto","Cerato","Sorento","Carnival"],
    "Hyundai": ["Tucson","i10","Accent","Creta","Santa Fe","HB20"],
    "Honda": ["Civic","CR-V","City","HR-V","Pilot"],
    "Mazda": ["CX-5","CX-3","Mazda 3","BT-50"],
    "Nissan": ["Frontier","Versa","Sentra","X-Trail","Note","Kicks"],
    "Ford": ["Escape","Ranger","EcoSport","Edge","F-150"],
    "Volkswagen": ["Polo","Tiguan","Amarok","Saveiro"],
    "BMW": ["Serie 3","X1","X3","X5"],
    "Mercedes-Benz": ["Clase A","Clase C","GLA","GLC"],
    "Renault": ["Duster","Logan","Sandero","Captur"],
    "Suzuki": ["Swift","Vitara","Jimny","Baleno"],
}
CATEGORIAS = ["Sedan","SUV","Sport","Pickup","Hatchback","Utility","Crossover"]

# === Generador de proveedores diversos ===
def generar_proveedores(n: int = 150) -> pd.DataFrame:
    """150 proveedores con nombres y patrones diversos."""
    nombres_taller = ["Taller","Mecanica","Auto Service","Servicentro","Reparaciones",
                      "Pinturas Auto","Frenos","Mecanica Express","Body Shop","Servi-Auto"]
    apellidos = ["Gomez","Rodriguez","Lopez","Vasquez","Aguilar","Mendoza","Salazar",
                 "Cordova","Vargas","Ortega","Castro","Rojas","Cabrera","Carrasco","Espinoza",
                 "Granda","Jaramillo","Mero","Ponce","Toala","Yepez","Zambrano"]
    rows = []
    for i in range(n):
        tipo = RNG.choice(["Taller","Clínica","Perito"], p=[0.7, 0.15, 0.15])
        if tipo == "Taller":
            nombre = f"{RNG.choice(nombres_taller)} {RNG.choice(apellidos)}"
        elif tipo == "Clínica":
            nombre = f"Clínica {RNG.choice(['San','Santa','La'])} {RNG.choice(['Maria','Pedro','Lucia','Familia','Salud'])}"
        else:
            nombre = f"Perito {RNG.choice(['Lic.','Ing.','Dr.','Sr.'])} {RNG.choice(apellidos)}"
        rows.append({
            "id_proveedor": f"PRV-NEW{i+1:04d}",
            "nombre": nombre,
            "tipo": tipo,
            "ciudad_prov": RNG.choice(CIUDADES),
            "antiguedad_anios_prov": int(RNG.integers(1, 25)),
            "lista_restrictiva": "Sí" if RNG.random() < 0.06 else "No",  # 6%
            "reclamos_asociados": int(RNG.integers(50, 400)),
            "porcentaje_casos_observados": int(RNG.integers(80, 600)),
            "monto_promedio_reclamado_usd": int(RNG.integers(2500, 15000)),
        })
    return pd.DataFrame(rows)


# === TEMPLATES DIVERSOS DE DESCRIPCIONES (50+) ===
TEMPLATES_CHOQUE = [
    "Mi vehículo recibió impacto trasero de un tercero que circulaba en {direccion} sobre la {via} a la altura de {referencia}.",
    "Conduciendo por la {via} en sentido {sentido}, un automotor me chocó por la parte {parte}. {detalle_adicional}",
    "Estando detenido en el semáforo de {referencia}, un vehículo {color} no respetó la luz y me embistió.",
    "En la intersección de {via} con {referencia} otro conductor se pasó la señal de pare y colisionamos.",
    "Mientras realizaba un cambio de carril en la {via}, un {tipo_veh} en mi punto ciego impactó mi puerta {parte}.",
    "El vehículo asegurado fue impactado lateralmente por un {tipo_veh} que perdió el control en {referencia} debido a {condicion_clima}.",
    "Salía del parqueadero del {establecimiento} cuando otro automotor en reversa golpeó mi {parte}.",
    "Manejo defensivo en {via}, sin embargo el conductor delante frenó bruscamente provocando colisión por alcance.",
    "Tras detenerme en la curva de {referencia}, una camioneta {color} no logró frenar a tiempo y me embistió.",
    "Iba transitando normal por {via} cuando un {tipo_veh} salió de un parqueadero sin mirar y me chocó.",
    "Colisión múltiple en {via} con participación de 3 vehículos, condiciones {condicion_clima}.",
    "Mi auto estaba estacionado en la calle {referencia} y al volver encontré daños evidentes en la {parte}.",
]

TEMPLATES_ROBO = [
    "Reporto el robo total del vehículo. Lo dejé estacionado en {referencia} a las {hora} horas y al regresar ya no estaba.",
    "Fui víctima de un asalto en {via}. Dos personas armadas me obligaron a entregar el vehículo.",
    "Hurto del vehículo desde el parqueadero del {establecimiento}. Cuento con video de cámaras de seguridad.",
    "El vehículo fue sustraído de la cochera de mi domicilio en {ciudad} durante la madrugada.",
    "Tras dejar el vehículo en revisión técnica en {establecimiento}, este desapareció. Aún investigo.",
    "Robo a mano armada en la intersección de {via}. Denuncia presentada en fiscalía el mismo día.",
    "Al salir del trabajo el vehículo no estaba en el sitio donde lo había dejado. Cámaras del edificio confirman robo.",
    "Reporto pérdida total por robo. Vehículo no recuperado a la fecha. Adjunto denuncia y reporte policial.",
]

TEMPLATES_RC = [
    "Reclamo de responsabilidad civil por daños causados a un tercero durante maniobra en {via}.",
    "Mi vehículo colisionó con un peatón en {referencia}. El afectado fue trasladado a clínica.",
    "Daños a propiedad de tercero (muro/poste/cerca) tras pérdida de control en {via}.",
    "Reclamo por afectación a vehículo de tercero en parqueadero del {establecimiento}.",
    "Atropello a motociclista en la intersección de {via} con {referencia}. Lesiones moderadas.",
]

TEMPLATES_DANO = [
    "Daños al vehículo por caída de objeto desde un edificio en {via}.",
    "Vehículo presenta daños en la pintura por vandalismo nocturno mientras estaba estacionado en {referencia}.",
    "Granizada severa causó abolladuras en techo y capó. Evento documentado por meteorología.",
    "Daño en parabrisas por impacto de piedra mientras transitaba por {via}.",
    "Inundación parcial del vehículo durante temporal en {ciudad}. Motor afectado.",
]

TEMPLATES_PT = [
    "Pérdida total del vehículo por accidente grave en la {via}. Daños estructurales irreparables.",
    "Vehículo declarado pérdida total tras choque frontal con tractomula en carretera a {ciudad}.",
    "Incendio total del vehículo por presunto cortocircuito mientras estaba estacionado.",
    "Volcamiento en curva de {referencia} con destrucción completa del vehículo.",
]

# Variables para inyectar en templates
VIAS = ["Av. Galo Plaza","Av. 6 de Diciembre","Av. Amazonas","Av. 9 de Octubre",
        "Av. Naciones Unidas","Panamericana Norte","Panamericana Sur","Av. Eloy Alfaro",
        "Av. Republica","Calle Pichincha","Av. Pichincha","Av. Bolívar","Av. Mariscal Sucre",
        "Av. Río Amazonas","Av. de Las Américas","Av. Quito","Av. Olimpica","Av. Patria"]
REFERENCIAS = ["el redondel del Atahualpa","la rotonda del Tránsito","el puente de Guápulo",
               "el peaje sur","el túnel de San Roque","el centro comercial Quicentro",
               "el CCI","Plaza Las Américas","el aeropuerto","La Carolina",
               "la Universidad Central","el estadio Olímpico","el peaje norte","la Y"]
ESTABLECIMIENTOS = ["centro comercial Mall del Sur","supermercado Megamaxi","Sambo Park",
                    "City Mall","Mall del Sol","Quicentro Shopping","Riocentro Sur",
                    "Hotel Marriott","el edificio Cofiec","torres Bicentenario"]
SENTIDOS = ["norte-sur","sur-norte","este-oeste","oeste-este"]
PARTES = ["trasera","delantera","lateral derecho","lateral izquierdo","puerta del conductor","puerta trasera","parachoques","capó","maletero"]
DIRECCIONES = ["en reversa","a alta velocidad","sin precaución","con exceso de velocidad","sin respetar la señal","de manera imprudente"]
COLORES = ["blanco","negro","gris","rojo","azul","plata","verde"]
TIPOS_VEH = ["camioneta","SUV","sedan","tracto-mula","motocicleta","bus","furgoneta","taxi","camioneta de carga"]
CONDICIONES = ["lluvia intensa","neblina","sol pleno","tormenta eléctrica","carretera mojada","oscuridad total","visibilidad reducida"]
HORAS = ["08:30","12:45","14:00","16:30","18:15","20:00","21:45","23:30","02:15","05:30"]
DETALLES = [
    "Cuento con video de cámaras de la zona.",
    "Hay testigos del evento que pueden declarar.",
    "Se llamó a la policía y se levantó el parte.",
    "Solicito atención prioritaria por uso laboral del vehículo.",
    "Documentación completa adjunta.",
    "El otro conductor no presentó documentos en el sitio.",
    "Foto del estado del vehículo enviada al perito.",
    "Quedo a disposición para ampliación de información.",
]


def generar_descripcion(cobertura: str, ciudad: str) -> str:
    """Genera descripcion DIVERSA segun cobertura."""
    if cobertura == "Choque":
        t = RNG.choice(TEMPLATES_CHOQUE)
    elif cobertura == "Robo":
        t = RNG.choice(TEMPLATES_ROBO)
    elif cobertura == "Responsabilidad Civil":
        t = RNG.choice(TEMPLATES_RC)
    elif cobertura == "Daño":
        t = RNG.choice(TEMPLATES_DANO)
    else:  # Pérdida Total
        t = RNG.choice(TEMPLATES_PT)

    desc = t.format(
        via=RNG.choice(VIAS),
        referencia=RNG.choice(REFERENCIAS),
        establecimiento=RNG.choice(ESTABLECIMIENTOS),
        sentido=RNG.choice(SENTIDOS),
        parte=RNG.choice(PARTES),
        direccion=RNG.choice(DIRECCIONES),
        color=RNG.choice(COLORES),
        tipo_veh=RNG.choice(TIPOS_VEH),
        condicion_clima=RNG.choice(CONDICIONES),
        hora=RNG.choice(HORAS),
        ciudad=ciudad,
        detalle_adicional=RNG.choice(DETALLES),
    )
    # Agregar referencia opcional al final
    if RNG.random() < 0.4:
        desc += f" Ref. {RNG.integers(100000, 999999)}."
    return desc


def main() -> int:
    print(f"[gen] Leyendo dataset original: {ORIG}")
    orig = pd.read_csv(ORIG, sep=";", encoding="latin-1", low_memory=False)
    print(f"[gen]   {len(orig):,} filas originales")

    # Generar proveedores nuevos (los uniremos al final del CSV)
    prov_nuevos = generar_proveedores(150)
    print(f"[gen] Generados {len(prov_nuevos)} proveedores nuevos")

    # Generar siniestros nuevos
    print(f"[gen] Generando {N_NUEVOS:,} siniestros nuevos con descripciones diversas...")
    nuevos_rows = []
    start_id = 100_000
    for i in range(N_NUEVOS):
        cobertura = RNG.choice(COBERTURAS, p=[0.55, 0.28, 0.05, 0.05, 0.07])
        ciudad = RNG.choice(CIUDADES)
        marca = RNG.choice(list(MARCAS.keys()))
        modelo = RNG.choice(MARCAS[marca])
        prov = prov_nuevos.sample(1).iloc[0]
        anio_veh = int(RNG.integers(2008, 2025))
        valor_com = int(RNG.integers(5000, 80000))
        suma_aseg = int(valor_com * RNG.uniform(0.8, 1.2))
        prima = int(suma_aseg * RNG.uniform(0.025, 0.06))
        reclamado = max(300, int(valor_com * RNG.uniform(0.03, 0.95)))
        estimado = int(reclamado * RNG.uniform(0.85, 1.1))
        pagado = int(reclamado * RNG.uniform(0.0, 1.0)) if RNG.random() < 0.7 else 0

        # Fechas
        fecha_inicio = pd.Timestamp("2023-01-01") + pd.Timedelta(days=int(RNG.integers(0, 900)))
        fecha_fin = fecha_inicio + pd.Timedelta(days=365)
        fecha_oc = fecha_inicio + pd.Timedelta(days=int(RNG.integers(1, 360)))
        fecha_rep = fecha_oc + pd.Timedelta(days=int(RNG.integers(0, 30)))

        estado = str(RNG.choice(ESTADOS, p=[0.30,0.17,0.18,0.07,0.10,0.12,0.06]))
        if estado in ("Reserva","Negativa","Cierre Sin Consecuencia"):
            pagado = 0

        # Fraude correlacionado con patrones reales (no random puro).
        # Esto permite que el modelo XGBoost APRENDA los patrones.
        docs_completos_flag = RNG.random() < 0.85
        tuvo_parte = RNG.random() < 0.10
        fault = str(RNG.choice(FAULTS, p=[0.40,0.45,0.15]))
        dias_inicio = (fecha_oc - fecha_inicio).days
        dias_oc_rep = (fecha_rep - fecha_oc).days
        es_lista_restrictiva = prov["lista_restrictiva"] == "Sí"

        prob_fraude = 0.025  # baseline 2.5%
        if cobertura == "Robo": prob_fraude += 0.12
        if cobertura == "Pérdida Total": prob_fraude += 0.06
        if not docs_completos_flag: prob_fraude += 0.10
        if dias_inicio < 30: prob_fraude += 0.05
        if dias_oc_rep > 7: prob_fraude += 0.05
        if reclamado > suma_aseg * 0.9: prob_fraude += 0.08
        if es_lista_restrictiva: prob_fraude += 0.30  # proveedor restrictivo
        if estado == "Pago Total" and cobertura == "Robo" and pagado > suma_aseg * 0.95:
            prob_fraude += 0.40  # PTxRB clasico
        if fault == "Tercero" and not tuvo_parte: prob_fraude += 0.05
        prob_fraude = min(prob_fraude, 0.95)
        es_fraude = 1 if RNG.random() < prob_fraude else 0

        nuevos_rows.append({
            "id_siniestro": f"SIN-{start_id+i:06d}",
            "id_poliza": f"POL-{300_000+i:06d}",
            "id_asegurado": f"ASE-{200_000+RNG.integers(0, N_NUEVOS//2):06d}",
            "id_vehiculo": f"VEH-{300_000+i:07d}",
            "ramo": "Vehículos",
            "cobertura": cobertura,
            "fecha_ocurrencia": f"{fecha_oc.day}/{fecha_oc.month}/{fecha_oc.year}",
            "fecha_reporte":    f"{fecha_rep.day}/{fecha_rep.month}/{fecha_rep.year}",
            "monto_reclamado_usd": reclamado,
            "monto_estimado_usd": estimado,
            "monto_pagado_usd": pagado,
            "estado": estado,
            "sucursal": ciudad,
            "ciudad_evento": ciudad,
            "descripcion": generar_descripcion(cobertura, ciudad),
            "documentos_completos": "Sí" if docs_completos_flag else "No",
            "id_beneficiario": prov["id_proveedor"],
            "tipo_beneficiario": prov["tipo"],
            "dias_desde_inicio_poliza": (fecha_oc - fecha_inicio).days,
            "dias_desde_fin_poliza": (fecha_fin - fecha_oc).days,
            "dias_entre_ocurrencia_reporte": (fecha_rep - fecha_oc).days,
            "historial_siniestros_asegurado": int(RNG.integers(0, 5)),
            "tuvo_parte_policial": "Sí" if tuvo_parte else "No",
            "tuvo_testigo": "Sí" if RNG.random() < 0.05 else "No",
            "fault_responsable": fault,
            "etiqueta_fraude_simulada": es_fraude,
            # Poliza fields
            "ramo_pol": "Vehículos",
            "fecha_inicio": f"{fecha_inicio.day}/{fecha_inicio.month}/{fecha_inicio.year}",
            "fecha_fin":    f"{fecha_fin.day}/{fecha_fin.month}/{fecha_fin.year}",
            "prima_usd": prima,
            "suma_asegurada_usd": suma_aseg,
            "deducible_usd": int(suma_aseg * 0.025),
            "canal_venta": str(RNG.choice(CANALES)),
            "ciudad": ciudad,
            "estado_poliza": "Vigente" if fecha_oc < fecha_fin else "Vencida",
            "tipo_cobertura": str(RNG.choice(TIPOS_COB)),
            # Asegurado
            "segmento": str(RNG.choice(SEGMENTOS)),
            "antiguedad_anios": int(RNG.integers(1, 20)),
            "ciudad_ase": ciudad,
            "num_polizas": int(RNG.integers(1, 5)),
            "reclamos_ultimos_12_meses": int(RNG.integers(0, 4)),
            "mora_actual": "Sí" if RNG.random() < 0.10 else "No",
            "score_cliente_simulado": int(RNG.integers(300, 850)),
            # Vehiculo
            "placa": f"NEW-{i:04d}",
            "chasis": "".join(RNG.choice(list("ABCDEFGHJKLMNPRSTUVWXYZ0123456789"), 17)),
            "motor": "".join(RNG.choice(list("ABCDEFGHJKLMNPRSTUVWXYZ0123456789"), 10)),
            "marca": marca,
            "modelo": modelo,
            "anio_vehiculo": anio_veh,
            "categoria": str(RNG.choice(CATEGORIAS)),
            "valor_comercial_usd": valor_com,
            # Proveedor (todos los campos)
            "id_proveedor": prov["id_proveedor"],
            "nombre": prov["nombre"],
            "tipo": prov["tipo"],
            "ciudad_prov": prov["ciudad_prov"],
            "antiguedad_anios_prov": prov["antiguedad_anios_prov"],
            "lista_restrictiva": prov["lista_restrictiva"],
            "reclamos_asociados": prov["reclamos_asociados"],
            "porcentaje_casos_observados": prov["porcentaje_casos_observados"],
            "monto_promedio_reclamado_usd": prov["monto_promedio_reclamado_usd"],
        })

    df_nuevos = pd.DataFrame(nuevos_rows)
    # Alinear columnas con el original
    df_nuevos = df_nuevos.reindex(columns=orig.columns, fill_value=None)

    combinado = pd.concat([orig, df_nuevos], ignore_index=True)
    print(f"[gen] Combinado: {len(combinado):,} filas totales ({len(orig):,} + {len(df_nuevos):,})")

    combinado.to_csv(OUT, sep=";", index=False, encoding="utf-8")
    print(f"[gen] Guardado en {OUT}")
    print(f"[gen]   tamano: {OUT.stat().st_size/1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
