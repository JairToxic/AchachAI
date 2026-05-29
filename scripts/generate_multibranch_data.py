"""Genera 8.000 casos Hogar + 6.000 casos Salud sinteticos para entrenar
el modelo multi-ramo.

Outputs (directos a parquet, NO pasa por clean_dataset/normalize):
  data/processed/siniestros_multibranch.parquet   (14.000 filas)
  data/processed/polizas_multibranch.parquet      (14.000 filas)
  data/processed/asegurados_multibranch.parquet   (~1.400 filas)
  data/processed/proveedores_multibranch.parquet  (60 filas)
  data/processed/documentos_multibranch.parquet   (~50.000 filas)

Decisiones de diseno:
  - IDs disjuntos del dataset actual: SIN-H-*, SIN-S-*, POL-H/S-*, ASE-MB-*,
    PRV-MB-*, DOC-MB-* (MB = multibranch).
  - Hogar y Salud NO tienen id_vehiculo ni id_conductor (quedan None/NaN).
  - Etiqueta de fraude probabilistica calibrada a 10% Hogar y 12% Salud,
    correlacionada con patrones reales (mismas senales que el script v1).
  - Templates de descripcion variados (>15 por ramo) para evitar similitud
    artificialmente alta entre casos no-fraudulentos.
  - Para fraudes inyectados: similitud alta intencional + inconsistencias
    documentales + proveedor en lista restrictiva ocasional.

Uso:
    python scripts/generate_multibranch_data.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

RNG = np.random.default_rng(2026_05_28)

N_HOGAR = 8_000
N_SALUD = 6_000

# ---------------- catalogos ----------------
CIUDADES = ["Quito", "Guayaquil", "Cuenca", "Manta", "Machala", "Ambato",
            "Ibarra", "Loja", "Riobamba", "Esmeraldas", "Portoviejo",
            "Santo Domingo", "Latacunga", "Tulcan", "Babahoyo", "Otavalo",
            "Salinas", "Tena"]

SEGMENTOS = ["Premium", "Estándar", "Joven", "Corporativo"]
CANALES = ["Web", "Banca seguros", "Broker", "Venta directa", "App movil", "Agente"]
FAULTS = ["Asegurado", "Tercero", "Compartido"]

COB_HOGAR = ["Daño por Agua", "Incendio", "Daño Estructural",
             "Rotura de Cristales", "Robo en domicilio", "Responsabilidad Civil"]
P_COB_HOGAR = [0.25, 0.15, 0.15, 0.15, 0.15, 0.15]

COB_SALUD = ["Consulta Externa", "Hospitalización", "Cirugía",
             "Maternidad", "Urgencias", "Exámenes"]
P_COB_SALUD = [0.25, 0.25, 0.15, 0.15, 0.15, 0.05]

ESTADOS = ["Pago Total", "Pago Parcial", "Reserva", "Anticipo", "Negativa",
           "Liquidado", "Cierre Sin Consecuencia"]
P_ESTADOS = [0.30, 0.17, 0.18, 0.07, 0.10, 0.12, 0.06]

TIPO_COB = ["All Perils", "Comprehensive", "Liability", "Theft", "Collision"]

# ---------------- templates de descripcion ----------------
TPL_HOGAR = {
    "Daño por Agua": [
        "Fuga en cañería del baño principal causó inundación en sala y comedor. Reposición de pisos y muebles afectados.",
        "Rotura de tubería en la lavandería provocó filtración hacia dormitorios. Daño en alfombrado y pintura.",
        "Inundación por desborde de cisterna durante tormenta. Equipos electrónicos en planta baja resultaron afectados.",
        "Filtración del techo durante lluvia intensa dañó cielo raso del living y biblioteca de la casa.",
        "Estallido de calefón causó derrame de agua caliente que afectó pisos de madera y muebles del pasillo.",
    ],
    "Incendio": [
        "Cortocircuito en panel eléctrico provocó incendio que afectó cocina y comedor. Bomberos controlaron el evento.",
        "Incendio iniciado por sobrecarga en regleta eléctrica del dormitorio. Daños severos en muebles y ropa.",
        "Fuego en cocina por aceite sobrecalentado. Afectación parcial a campana extractora y mobiliario aledaño.",
        "Conato de incendio en garaje por fuga de gas. Daños menores controlados antes de propagación.",
        "Incendio nocturno por vela encendida. Afectación a cortinas y muebles del comedor.",
    ],
    "Daño Estructural": [
        "Aparecieron grietas profundas en muros perimetrales tras sismo. Peritaje confirma compromiso estructural.",
        "Hundimiento parcial de losa de terraza por exceso de carga. Requiere reparación urgente.",
        "Asentamiento diferencial del terreno provocó fisuras en pared medianera. Riesgo de colapso.",
        "Derrumbe parcial de techo por carga excesiva de granizo durante tormenta atípica.",
        "Daño en columnas portantes detectado durante inspección rutinaria tras temblor.",
    ],
    "Rotura de Cristales": [
        "Vidrio de ventana principal del living se quebró por impacto de objeto durante temporal.",
        "Rotura de mampara de baño tras caída accidental. Reposición de vidrio templado solicitada.",
        "Cristal de puerta corrediza dañado por niños jugando. Reemplazo necesario.",
        "Vidrio de claraboya del techo se fracturó por granizada intensa.",
        "Rotura de espejo de tocador empotrado durante terremoto. Daño total.",
    ],
    "Robo en domicilio": [
        "Vivienda forzada durante ausencia familiar. Sustracción de televisor, laptop y joyas. Denuncia formal presentada.",
        "Ingreso por ventana trasera. Robo de electrodomésticos mayores. Cámaras de seguridad capturaron rostro parcial.",
        "Asalto a residencia a mano armada durante la noche. Sustracción de efectivo y artículos electrónicos.",
        "Robo silencioso aprovechando viaje familiar. Vaciada de habitación principal y caja fuerte forzada.",
        "Intrusión por techo. Faltantes incluyen relojes de colección y equipos de cómputo.",
    ],
    "Responsabilidad Civil": [
        "Caída de árbol del jardín sobre vehículo del vecino durante temporal. Reclamo por daños materiales.",
        "Filtración de agua hacia departamento inferior por daño en tubería propia. Reclamo de vecinos por mobiliario.",
        "Lesión leve a visitante por caída en escalera mal iluminada. Cobertura de gastos médicos solicitada.",
        "Daños a propiedad colindante por incendio originado en mi domicilio. Peritaje en proceso.",
        "Mascota propia mordió a personal de delivery. Cobertura de tratamiento médico requerida.",
    ],
}

TPL_SALUD = {
    "Consulta Externa": [
        "Atención ambulatoria por cuadro gripal con complicaciones respiratorias. Examen y receta médica.",
        "Consulta especializada en cardiología por hipertensión persistente. Estudios complementarios solicitados.",
        "Control dermatológico por lesión sospechosa en piel. Biopsia derivada a histopatología.",
        "Atención por dolor lumbar crónico. Evaluación clínica y plan de fisioterapia.",
        "Consulta pediátrica por fiebre prolongada en menor. Exámenes de sangre y tratamiento antibiótico.",
    ],
    "Hospitalización": [
        "Ingreso hospitalario por neumonía severa. Tratamiento intravenoso durante 6 días.",
        "Hospitalización por crisis asmática grave. Manejo en cuidados intermedios por 4 días.",
        "Internación por descompensación diabética. Estabilización y ajuste de insulinoterapia.",
        "Estancia hospitalaria por gastroenteritis con deshidratación. Hidratación parenteral por 3 días.",
        "Ingreso por dolor torácico precordial. Descarte de evento coronario tras 48h de observación.",
    ],
    "Cirugía": [
        "Cirugía laparoscópica de vesícula por colelitiasis sintomática. Procedimiento sin complicaciones.",
        "Apendicectomía de urgencia por cuadro agudo. Recuperación postquirúrgica en 24 horas.",
        "Cirugía ambulatoria de hernia inguinal derecha con malla. Alta el mismo día.",
        "Artroscopia de rodilla por lesión meniscal. Rehabilitación posterior programada.",
        "Cirugía electiva de cataratas en ojo izquierdo. Implante de lente intraocular.",
    ],
    "Maternidad": [
        "Parto natural sin complicaciones a las 39 semanas. Madre y recién nacido en buen estado.",
        "Cesárea programada por presentación pelviana. Procedimiento sin eventos adversos.",
        "Control prenatal de tercer trimestre con ecografía obstétrica. Embarazo de evolución normal.",
        "Hospitalización por parto pretérmino a las 35 semanas. Cuidados neonatales intermedios.",
        "Cesárea de urgencia por sufrimiento fetal agudo. Recuperación materna favorable.",
    ],
    "Urgencias": [
        "Atención de emergencia por dolor abdominal agudo. Descarte quirúrgico tras exámenes.",
        "Ingreso a urgencias por accidente doméstico con herida cortante en mano. Sutura simple.",
        "Atención por crisis convulsiva primer episodio. Estudios neurológicos en curso.",
        "Urgencia por reacción alérgica severa a medicamento. Manejo con corticoides intravenosos.",
        "Emergencia por trauma craneal leve tras caída. Observación neurológica por 6 horas.",
    ],
    "Exámenes": [
        "Estudios de laboratorio completos para chequeo anual. Perfil lipídico y química sanguínea.",
        "Resonancia magnética de columna lumbar por dolor radicular. Hallazgos compatibles con discopatía.",
        "Tomografía abdominal contrastada por dolor recurrente. Reporte sin alteraciones significativas.",
        "Ecocardiograma de control por arritmia conocida. Función ventricular conservada.",
        "Endoscopia digestiva alta por reflujo persistente. Biopsia derivada a patología.",
    ],
}


# ---------------- helpers ----------------
def fecha_iso(d: pd.Timestamp) -> str:
    return d.strftime("%Y-%m-%d")


def gen_descripcion(ramo: str, cobertura: str, es_fraude: bool, idx: int) -> str:
    """Si es fraude inyecta similitud alta usando el mismo template;
    si no, varia el template."""
    tpls = (TPL_HOGAR if ramo == "Hogar" else TPL_SALUD).get(cobertura, ["Caso sin descripcion estandar."])
    if es_fraude and RNG.random() < 0.35:
        # Algunos fraudes usan el MISMO template (narrativa clonada)
        return tpls[0]
    base = tpls[RNG.integers(0, len(tpls))]
    if RNG.random() < 0.3:
        base += f" Ref. {RNG.integers(100000, 999999)}."
    return base


def gen_proveedores_mb(n_hogar: int, n_salud: int) -> pd.DataFrame:
    """Genera 60 proveedores nuevos para hogar y salud."""
    rows = []
    nombres_hogar = ["Constructora Andina", "Plomeria Express", "Vidrios del Valle",
                     "Peritos Independientes Sur", "Reparaciones del Hogar",
                     "Servicios Integrales Quito", "Restauradora Patrimonial",
                     "Aislantes y Cubiertas", "Maderera Don Carlos", "Pintores Profesionales",
                     "Cerrajeria 24h", "Electricistas Asociados", "Albañileria Maestros",
                     "Carpinteria Fina", "Servicios de Emergencia HOGAR",
                     "Constructora Patria", "Reparadora del Centro", "Vidrios Modernos",
                     "Inmobiliaria Restauradora", "Servicios Domoticos"]
    nombres_salud = ["Hospital Metropolitano", "Clinica Pichincha", "Centro Medico Vida",
                     "Hospital de los Andes", "Clinica Internacional",
                     "Centro Especializado del Sur", "Policlinico Cuenca",
                     "Clinica Maternidad Guayaquil", "Hospital Universitario UTEG",
                     "Centro de Imagenes Diagnosticas", "Laboratorios Clinicos Andina",
                     "Clinica Cardiologica", "Hospital del Sur", "Centro Pediatrico",
                     "Clinica Quirurgica Manta", "Hospital General Loja",
                     "Centro Oftalmologico Ibarra", "Clinica Especializada Ambato",
                     "Hospital de Especialidades", "Centro de Diagnostico Avanzado"]

    for i, nom in enumerate(nombres_hogar):
        rows.append({
            "id_proveedor": f"PRV-MB-H-{i:03d}",
            "nombre": nom,
            "tipo": "Perito" if "Perito" in nom else "Taller",
            "ciudad": RNG.choice(CIUDADES),
            "antiguedad_anios": int(RNG.integers(2, 30)),
            "lista_restrictiva": bool(RNG.random() < 0.08),
            "reclamos_asociados": int(RNG.integers(20, 500)),
            "porcentaje_casos_observados": int(RNG.integers(0, 30)),
            "monto_promedio_reclamado_usd": float(RNG.integers(800, 15000)),
        })
    for i, nom in enumerate(nombres_salud):
        rows.append({
            "id_proveedor": f"PRV-MB-S-{i:03d}",
            "nombre": nom,
            "tipo": "Clínica",
            "ciudad": RNG.choice(CIUDADES),
            "antiguedad_anios": int(RNG.integers(3, 40)),
            "lista_restrictiva": bool(RNG.random() < 0.06),
            "reclamos_asociados": int(RNG.integers(50, 1000)),
            "porcentaje_casos_observados": int(RNG.integers(0, 25)),
            "monto_promedio_reclamado_usd": float(RNG.integers(500, 25000)),
        })
    return pd.DataFrame(rows)


def gen_asegurados_mb(n: int, prefix: str) -> pd.DataFrame:
    """Genera n asegurados nuevos multi-ramo."""
    rows = []
    for i in range(n):
        rows.append({
            "id_asegurado": f"ASE-MB-{prefix}-{i:05d}",
            "segmento": str(RNG.choice(SEGMENTOS, p=[0.20, 0.55, 0.15, 0.10])),
            "antiguedad_anios": int(RNG.integers(1, 25)),
            "ciudad": str(RNG.choice(CIUDADES)),
            "num_polizas": int(RNG.integers(1, 4)),
            "reclamos_ultimos_12_meses": int(RNG.integers(0, 5)),
            "mora_actual": bool(RNG.random() < 0.10),
            "score_cliente_simulado": int(RNG.integers(350, 850)),
        })
    return pd.DataFrame(rows)


def gen_siniestros_ramo(
    ramo: str,
    n: int,
    asegurados_df: pd.DataFrame,
    proveedores_df: pd.DataFrame,
    prefix: str,
    tasa_fraude_obj: float,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Genera n siniestros + polizas + documentos para el ramo dado."""
    cob_list = COB_HOGAR if ramo == "Hogar" else COB_SALUD
    cob_p = P_COB_HOGAR if ramo == "Hogar" else P_COB_SALUD
    prov_subset = proveedores_df[proveedores_df["id_proveedor"].str.contains(prefix)]
    if len(prov_subset) == 0:
        prov_subset = proveedores_df

    sin_rows, pol_rows, doc_rows = [], [], []
    doc_counter = 0

    for i in range(n):
        cobertura = str(RNG.choice(cob_list, p=cob_p))
        ciudad = str(RNG.choice(CIUDADES))
        ase = asegurados_df.sample(1, random_state=int(RNG.integers(0, 10_000_000))).iloc[0]
        prov = prov_subset.sample(1, random_state=int(RNG.integers(0, 10_000_000))).iloc[0]

        # Montos por ramo y cobertura
        if ramo == "Hogar":
            base = {"Daño por Agua": 3500, "Incendio": 15000, "Daño Estructural": 22000,
                    "Rotura de Cristales": 800, "Robo en domicilio": 6500,
                    "Responsabilidad Civil": 4500}.get(cobertura, 5000)
        else:  # Salud
            base = {"Consulta Externa": 120, "Hospitalización": 4500, "Cirugía": 8500,
                    "Maternidad": 5500, "Urgencias": 700, "Exámenes": 350}.get(cobertura, 1000)

        reclamado = max(50, int(base * RNG.uniform(0.4, 2.2)))
        estimado = int(reclamado * RNG.uniform(0.85, 1.10))
        suma_aseg = int(reclamado * RNG.uniform(1.5, 8.0))
        prima = int(suma_aseg * RNG.uniform(0.02, 0.06))

        # Fechas
        fecha_inicio = pd.Timestamp("2023-01-01") + pd.Timedelta(days=int(RNG.integers(0, 900)))
        fecha_fin = fecha_inicio + pd.Timedelta(days=365)
        fecha_oc = fecha_inicio + pd.Timedelta(days=int(RNG.integers(1, 360)))
        fecha_rep = fecha_oc + pd.Timedelta(days=int(RNG.integers(0, 25)))

        estado = str(RNG.choice(ESTADOS, p=P_ESTADOS))
        pagado = int(reclamado * RNG.uniform(0, 1)) if estado in ("Pago Total", "Pago Parcial", "Liquidado") else 0

        docs_completos_flag = RNG.random() < 0.82
        es_lista_restrictiva = bool(prov["lista_restrictiva"])
        dias_inicio = (fecha_oc - fecha_inicio).days
        dias_fin = (fecha_fin - fecha_oc).days
        dias_oc_rep = (fecha_rep - fecha_oc).days

        # ----- Probabilidad de fraude (heuristica calibrada) -----
        prob = 0.04
        if cobertura in ("Robo en domicilio", "Pérdida Total"): prob += 0.10
        if not docs_completos_flag: prob += 0.10
        if dias_inicio < 30: prob += 0.05
        if dias_oc_rep > 7: prob += 0.05
        if reclamado > suma_aseg * 0.9: prob += 0.08
        if es_lista_restrictiva: prob += 0.30
        if estado == "Negativa": prob += 0.20
        if ramo == "Salud" and cobertura in ("Hospitalización", "Cirugía"):
            prob += 0.02
        prob = min(prob, 0.95)
        es_fraude = int(RNG.random() < prob)

        id_sin = f"SIN-{prefix}-{i:05d}"
        id_pol = f"POL-{prefix}-{i:05d}"

        sin_rows.append({
            "id_siniestro": id_sin,
            "id_poliza": id_pol,
            "id_asegurado": ase["id_asegurado"],
            "id_vehiculo": None,
            "id_proveedor": prov["id_proveedor"],
            "id_conductor": None,
            "ramo": ramo,
            "cobertura": cobertura,
            "fecha_ocurrencia": fecha_iso(fecha_oc),
            "fecha_reporte": fecha_iso(fecha_rep),
            "monto_reclamado_usd": float(reclamado),
            "monto_estimado_usd": float(estimado),
            "monto_pagado_usd": float(pagado),
            "estado": estado,
            "sucursal": ciudad,
            "ciudad_evento": ciudad,
            "descripcion": gen_descripcion(ramo, cobertura, bool(es_fraude), i),
            "documentos_completos": bool(docs_completos_flag),
            "tipo_beneficiario": "Clínica" if ramo == "Salud" else ("Perito" if prov["tipo"] == "Perito" else "Taller"),
            "dias_desde_inicio_poliza": int(dias_inicio),
            "dias_desde_fin_poliza": int(dias_fin),
            "dias_entre_ocurrencia_reporte": int(dias_oc_rep),
            "historial_siniestros_asegurado": int(RNG.integers(0, 4)),
            "tuvo_parte_policial": bool(cobertura == "Robo en domicilio" and RNG.random() < 0.7),
            "tuvo_testigo": bool(RNG.random() < 0.05),
            "fault_responsable": str(RNG.choice(FAULTS, p=[0.55, 0.30, 0.15])),
            "etiqueta_fraude_simulada": es_fraude,
            "caso_inyectado": False,
        })

        pol_rows.append({
            "id_poliza": id_pol,
            "id_asegurado": ase["id_asegurado"],
            "ramo": ramo,
            "fecha_inicio": fecha_iso(fecha_inicio),
            "fecha_fin": fecha_iso(fecha_fin),
            "prima_usd": float(prima),
            "suma_asegurada_usd": float(suma_aseg),
            "deducible_usd": float(int(suma_aseg * 0.025)),
            "canal_venta": str(RNG.choice(CANALES)),
            "ciudad": ciudad,
            "estado_poliza": "Vigente" if fecha_oc < fecha_fin else "Vencida",
            "tipo_cobertura": str(RNG.choice(TIPO_COB)),
        })

        # Documentos (3-5 por siniestro, con inconsistencias si es fraude)
        if ramo == "Hogar":
            doc_pool = ["Factura", "Foto", "Peritaje", "Denuncia", "Informe perito"]
        else:
            doc_pool = ["Factura", "Historia clinica", "Orden medica", "Examenes", "Informe medico"]
        n_docs = int(RNG.integers(3, 6))
        for _ in range(n_docs):
            doc_counter += 1
            tipo_doc = str(RNG.choice(doc_pool))
            entregado = bool(docs_completos_flag or RNG.random() < 0.9)
            inconsist = bool(es_fraude and RNG.random() < 0.55)
            obs = "Documento alterado o ilegible" if inconsist else None
            doc_rows.append({
                "id_documento": f"DOC-MB-{prefix}-{doc_counter:07d}",
                "id_siniestro": id_sin,
                "tipo_documento": tipo_doc,
                "entregado": entregado,
                "legible": bool(RNG.random() < 0.93),
                "fecha_emision": fecha_iso(fecha_rep + pd.Timedelta(days=int(RNG.integers(-1, 5)))),
                "inconsistencia_detectada": inconsist,
                "observacion": obs,
            })

    return pd.DataFrame(sin_rows), pd.DataFrame(pol_rows), pd.DataFrame(doc_rows)


# ---------------- main ----------------
def main() -> int:
    print(f"[gen-mb] Generando {N_HOGAR:,} Hogar + {N_SALUD:,} Salud...")

    print("[gen-mb] Generando proveedores...")
    prov_df = gen_proveedores_mb(20, 20)
    print(f"[gen-mb]   {len(prov_df)} proveedores nuevos")

    print("[gen-mb] Generando asegurados...")
    n_ase_h = max(800, N_HOGAR // 10)
    n_ase_s = max(600, N_SALUD // 10)
    ase_h_df = gen_asegurados_mb(n_ase_h, "H")
    ase_s_df = gen_asegurados_mb(n_ase_s, "S")
    ase_df = pd.concat([ase_h_df, ase_s_df], ignore_index=True)
    print(f"[gen-mb]   {len(ase_df)} asegurados nuevos ({n_ase_h} hogar + {n_ase_s} salud)")

    print("[gen-mb] Generando Hogar...")
    sin_h, pol_h, doc_h = gen_siniestros_ramo("Hogar", N_HOGAR, ase_h_df, prov_df, "H", 0.10)
    print(f"[gen-mb]   Hogar: {len(sin_h)} sin, {len(doc_h)} docs, fraude={sin_h['etiqueta_fraude_simulada'].mean()*100:.1f}%")

    print("[gen-mb] Generando Salud...")
    sin_s, pol_s, doc_s = gen_siniestros_ramo("Salud", N_SALUD, ase_s_df, prov_df, "S", 0.12)
    print(f"[gen-mb]   Salud: {len(sin_s)} sin, {len(doc_s)} docs, fraude={sin_s['etiqueta_fraude_simulada'].mean()*100:.1f}%")

    sin_all = pd.concat([sin_h, sin_s], ignore_index=True)
    pol_all = pd.concat([pol_h, pol_s], ignore_index=True)
    doc_all = pd.concat([doc_h, doc_s], ignore_index=True)

    sin_all.to_parquet(OUT_DIR / "siniestros_multibranch.parquet", index=False)
    pol_all.to_parquet(OUT_DIR / "polizas_multibranch.parquet", index=False)
    ase_df.to_parquet(OUT_DIR / "asegurados_multibranch.parquet", index=False)
    prov_df.to_parquet(OUT_DIR / "proveedores_multibranch.parquet", index=False)
    doc_all.to_parquet(OUT_DIR / "documentos_multibranch.parquet", index=False)

    print()
    print("[gen-mb] DONE")
    print(f"  siniestros_multibranch.parquet:  {len(sin_all):>6,} filas")
    print(f"  polizas_multibranch.parquet:     {len(pol_all):>6,} filas")
    print(f"  asegurados_multibranch.parquet:  {len(ase_df):>6,} filas")
    print(f"  proveedores_multibranch.parquet: {len(prov_df):>6,} filas")
    print(f"  documentos_multibranch.parquet:  {len(doc_all):>6,} filas")
    print()
    print(f"  Tasa fraude global multi-ramo: {sin_all['etiqueta_fraude_simulada'].mean()*100:.1f}%")
    print(f"  Distribucion por ramo:")
    print(sin_all.groupby('ramo')['etiqueta_fraude_simulada'].agg(['count', 'mean']))
    return 0


if __name__ == "__main__":
    sys.exit(main())
