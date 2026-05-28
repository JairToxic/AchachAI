"""
load_xlsx_dataset.py - Ingesta del dataset oficial del reto.

Reemplaza a clean_dataset.py + normalize_tables.py para el nuevo dataset
multi-ramo de 500 casos entregado por la organizacion del reto.

Lee:
  data/Data set documentos evento/Evento Datasets_Sinteticos_Fraude_500_v2.xlsx
  data/Data set documentos evento/{FACTURAS,PARTE POLICIAL,DECLARACION DE ACCIDENTE}/*.pdf

Escribe los mismos 7 parquets que el resto del pipeline consume:
  data/processed/siniestros.parquet
  data/processed/polizas.parquet
  data/processed/asegurados.parquet
  data/processed/vehiculos.parquet          (sintetizado desde placas distintas)
  data/processed/proveedores.parquet
  data/processed/conductores.parquet        (sintetizado 1-a-1 con vehiculos)
  data/processed/documentos.parquet         (REAL desde 5_Documentos + ruta_pdf)
  data/processed/similitudes.parquet        (desde 'Similitud Narrativa Max.')

Decisiones de diseno:
  - Se preservan los nombres snake_case del esquema anterior para no romper
    src/rules/, src/api/main.py, src/ai_agent/tools.py, src/features/.
  - El nuevo dataset NO trae etiqueta_fraude_simulada. Derivamos una etiqueta
    heuristica desde reglas criticas y senales basicas (ver _label_heuristico).
    Queda documentado como proxy en docs/limitaciones.md.
  - Columnas que el codigo asume y no existen en el xlsx se rellenan con
    defaults razonables (deducible = 2% SA, valor_comercial = SA, etc.).
  - Para siniestros de Hogar/Salud (~150) no hay vehiculo: id_vehiculo queda
    NULL. Las reglas que dependen de vehiculo usan .get() y simplemente no
    disparan, lo cual es correcto.

Uso:
    python scripts/load_xlsx_dataset.py
"""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
XLSX_DIR = ROOT / "data" / "Data set documentos evento"
XLSX = XLSX_DIR / "Evento Datasets_Sinteticos_Fraude_500_v2.xlsx"
DIR_FACTURAS = XLSX_DIR / "FACTURAS"
DIR_PARTES = XLSX_DIR / "PARTE POLICIAL"
DIR_DECLARACIONES = XLSX_DIR / "DECLARACIÓN DE ACCIDENTE"

OUT_DIR = ROOT / "data" / "processed"
RNG = np.random.default_rng(2026)


# ----------- helpers -----------
def log(msg: str) -> None:
    print(f"[load_xlsx] {msg}")


def _si_no_to_bool(value) -> Optional[bool]:
    if pd.isna(value):
        return None
    s = str(value).strip().lower()
    if s in {"si", "sí", "s", "true", "1", "yes"}:
        return True
    if s in {"no", "n", "false", "0"}:
        return False
    return None


def _parse_date(value) -> Optional[str]:
    if pd.isna(value) or str(value).strip() in {"", "—", "-"}:
        return None
    try:
        return pd.to_datetime(value, errors="raise").strftime("%Y-%m-%d")
    except Exception:
        return None


def _num(value, default: float = 0.0) -> float:
    if pd.isna(value) or str(value).strip() in {"", "—", "-"}:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def _norm_basename(name: str) -> str:
    """Normaliza un nombre de archivo para matching tolerante:
    NFD + lower + elimina TODO whitespace (cubre 'Foo- Bar' vs 'Foo-Bar')."""
    if not isinstance(name, str):
        return ""
    n = unicodedata.normalize("NFKD", name)
    n = "".join(c for c in n if not unicodedata.combining(c))
    n = n.lower().strip()
    n = re.sub(r"\s+", "", n)
    return n


def _build_pdf_index() -> dict[str, str]:
    """Indexa los PDFs reales por nombre normalizado (y por nombre sin extension).

    Returns {nombre_normalizado: ruta_relativa_desde_ROOT}.
    """
    idx: dict[str, str] = {}
    for d in (DIR_FACTURAS, DIR_PARTES, DIR_DECLARACIONES):
        if not d.exists():
            continue
        for p in d.glob("*.pdf"):
            rel = p.relative_to(ROOT).as_posix()
            key1 = _norm_basename(p.name)
            key2 = _norm_basename(p.stem)
            idx[key1] = rel
            idx[key2] = rel
    return idx


def _resolve_pdf(nombre: Optional[str], pdf_idx: dict[str, str]) -> Optional[str]:
    """Busca un PDF en el indice. Tolera variaciones (.pdf si/no, espacios)."""
    if not isinstance(nombre, str) or not nombre.strip():
        return None
    candidates = [nombre, f"{nombre}.pdf" if not nombre.lower().endswith(".pdf") else nombre]
    for c in candidates:
        hit = pdf_idx.get(_norm_basename(c))
        if hit:
            return hit
    return None


# ----------- mapeos por tabla -----------
COBERTURA_A_TIPO = {
    "Choque": "Collision",
    "Pérdida Total": "Comprehensive",
    "Robo": "Comprehensive",
    "Robo de Accesorios": "Comprehensive",
    "Cristales": "Comprehensive",
    "Rotura de Cristales": "Comprehensive",
    "Responsabilidad Civil": "Liability",
    # Hogar
    "Daño por Agua": "Hogar",
    "Incendio": "Hogar",
    "Daño Estructural": "Hogar",
    # Salud
    "Hospitalización": "Salud",
    "Cirugía": "Salud",
    "Consulta Externa": "Salud",
    "Maternidad": "Salud",
    "Urgencias": "Salud",
}

PERFIL_A_SCORE = {"Bajo": 780, "Medio": 620, "Alto": 460}


def _placa_a_id_vehiculo(placa: Optional[str]) -> Optional[str]:
    if not isinstance(placa, str) or not placa.strip():
        return None
    return f"VEH-{placa.replace('-', '').upper()}"


def _id_conductor_para_vehiculo(id_veh) -> Optional[str]:
    if id_veh is None or (isinstance(id_veh, float) and pd.isna(id_veh)) or not str(id_veh).strip():
        return None
    return f"CON-{str(id_veh)[4:]}"


# ----------- transformaciones por hoja -----------
def transform_asegurados(df_raw: pd.DataFrame) -> pd.DataFrame:
    df = df_raw.rename(columns={
        "ID Asegurado": "id_asegurado",
        "Nombres Asegurado": "nombre",
        "Segmento": "segmento",
        "Ciudad": "ciudad",
        "Antigüedad (años)": "antiguedad_anios",
        "N° Pólizas Activas": "num_polizas",
        "N° Reclamos Últimos 12 Meses": "reclamos_ultimos_12_meses",
        "N° Reclamos Histórico Total": "reclamos_historico_total",
        "Reclamos RC sin Tercero": "reclamos_rc_sin_tercero",
        "Perfil Riesgo Histórico": "perfil_riesgo",
    })
    df["mora_actual"] = False
    df["score_cliente_simulado"] = (
        df["perfil_riesgo"].map(PERFIL_A_SCORE).fillna(600).astype(int)
    )
    cols = [
        "id_asegurado", "nombre", "segmento", "antiguedad_anios", "ciudad",
        "num_polizas", "reclamos_ultimos_12_meses", "mora_actual",
        "score_cliente_simulado", "reclamos_historico_total",
        "reclamos_rc_sin_tercero", "perfil_riesgo",
    ]
    return df[cols].drop_duplicates(subset=["id_asegurado"]).reset_index(drop=True)


def transform_proveedores(df_raw: pd.DataFrame) -> pd.DataFrame:
    df = df_raw.rename(columns={
        "ID Proveedor": "id_proveedor",
        "Nombre Proveedor": "nombre",
        "Tipo": "tipo",
        "Ciudad": "ciudad",
        "N° Siniestros Asociados": "reclamos_asociados",
        "En Lista Restrictiva": "lista_restrictiva_raw",
        "Motivo Restricción": "motivo_restriccion",
        "Promedio Monto ($)": "monto_promedio_reclamado_usd_raw",
    })
    df = df.drop(columns=[c for c in df.columns if str(c).startswith("Unnamed")],
                 errors="ignore")
    df["lista_restrictiva"] = df["lista_restrictiva_raw"].apply(_si_no_to_bool).fillna(False)
    df["monto_promedio_reclamado_usd"] = df["monto_promedio_reclamado_usd_raw"].apply(_num)
    df["antiguedad_anios"] = 5
    df["porcentaje_casos_observados"] = 0.0
    cols = [
        "id_proveedor", "nombre", "tipo", "ciudad", "antiguedad_anios",
        "lista_restrictiva", "reclamos_asociados", "porcentaje_casos_observados",
        "monto_promedio_reclamado_usd", "motivo_restriccion",
    ]
    return df[cols].drop_duplicates(subset=["id_proveedor"]).reset_index(drop=True)


def transform_polizas(df_raw: pd.DataFrame, asegurados: pd.DataFrame) -> pd.DataFrame:
    df = df_raw.rename(columns={
        "ID Póliza": "id_poliza",
        "ID Asegurado": "id_asegurado",
        "Ramo": "ramo",
        "Fecha Inicio": "fecha_inicio_raw",
        "Fecha Fin": "fecha_fin_raw",
        "Suma Asegurada ($)": "suma_asegurada_usd",
        "Prima Anual ($)": "prima_usd",
        "Canal Venta": "canal_venta",
        "Estado Póliza": "estado_poliza",
    })
    df["fecha_inicio"] = df["fecha_inicio_raw"].apply(_parse_date)
    df["fecha_fin"] = df["fecha_fin_raw"].apply(_parse_date)
    df["deducible_usd"] = (df["suma_asegurada_usd"].astype(float) * 0.02).round(2)
    df["tipo_cobertura"] = df["ramo"].map({
        "Vehículos": "Multiriesgo", "Hogar": "Hogar", "Salud": "Salud",
    }).fillna("Multiriesgo")
    # ciudad: derivar del asegurado
    df = df.merge(
        asegurados[["id_asegurado", "ciudad"]].rename(columns={"ciudad": "ciudad_ase"}),
        on="id_asegurado", how="left",
    )
    df["ciudad"] = df["ciudad_ase"]
    cols = [
        "id_poliza", "id_asegurado", "ramo", "fecha_inicio", "fecha_fin",
        "prima_usd", "suma_asegurada_usd", "deducible_usd", "canal_venta",
        "ciudad", "estado_poliza", "tipo_cobertura",
    ]
    return df[cols].drop_duplicates(subset=["id_poliza"]).reset_index(drop=True)


def transform_siniestros(
    df_raw: pd.DataFrame,
    proveedores: pd.DataFrame,
    asegurados: pd.DataFrame,
) -> pd.DataFrame:
    df = df_raw.rename(columns={
        "ID Siniestro": "id_siniestro",
        "ID Póliza": "id_poliza",
        "ID Asegurado": "id_asegurado",
        "Ramo": "ramo",
        "Placa Vehículo Asegurado": "placa",
        "Cobertura": "cobertura",
        "Fecha Ocurrencia": "fecha_ocurrencia_raw",
        "Fecha Reporte": "fecha_reporte_raw",
        "Días Ocurr→Reporte": "dias_entre_ocurrencia_reporte",
        "Monto Reclamado ($)": "monto_reclamado_usd",
        "Monto Estimado ($)": "monto_estimado_usd",
        "Monto Pagado ($)": "monto_pagado_usd",
        "Estado": "estado",
        "Sucursal": "sucursal",
        "ID Proveedor": "id_proveedor",
        "Descripción del Evento": "descripcion",
        "Docs Completos": "docs_completos_raw",
        "Prov. Lista Restrictiva": "_prov_lista_raw",  # info redundante, se cruza con proveedores
        "Días desde Inicio Póliza": "dias_desde_inicio_poliza",
        "Días hasta Fin Póliza": "dias_desde_fin_poliza",
        "N° Reclamos Previos Asegurado": "historial_siniestros_asegurado",
        "Suma Asegurada ($)": "_suma_aseg_raw",  # ya esta en polizas
        "Similitud Narrativa Máx.": "similitud_narrativa_max",
        "Número Parte Policial": "numero_parte_policial",
    })
    df["fecha_ocurrencia"] = df["fecha_ocurrencia_raw"].apply(_parse_date)
    df["fecha_reporte"] = df["fecha_reporte_raw"].apply(_parse_date)
    df["documentos_completos"] = df["docs_completos_raw"].apply(_si_no_to_bool).fillna(True)
    df["tuvo_parte_policial"] = df["numero_parte_policial"].notna()
    df["tuvo_testigo"] = False
    df["fault_responsable"] = "Asegurado"
    df["ciudad_evento"] = df["sucursal"]

    # IDs derivados
    df["id_vehiculo"] = df["placa"].apply(_placa_a_id_vehiculo)
    df["id_conductor"] = df["id_vehiculo"].apply(_id_conductor_para_vehiculo)

    # tipo_beneficiario: usar tipo del proveedor (Taller, Salud, Perito, ...)
    df = df.merge(
        proveedores[["id_proveedor", "tipo"]].rename(columns={"tipo": "_prov_tipo"}),
        on="id_proveedor", how="left",
    )
    df["tipo_beneficiario"] = df["_prov_tipo"].fillna("Taller")

    cols = [
        "id_siniestro", "id_poliza", "id_asegurado", "id_vehiculo", "placa",
        "id_proveedor", "id_conductor",
        "ramo", "cobertura", "fecha_ocurrencia", "fecha_reporte",
        "monto_reclamado_usd", "monto_estimado_usd", "monto_pagado_usd",
        "estado", "sucursal", "ciudad_evento", "descripcion",
        "documentos_completos", "tipo_beneficiario",
        "dias_desde_inicio_poliza", "dias_desde_fin_poliza",
        "dias_entre_ocurrencia_reporte",
        "historial_siniestros_asegurado",
        "tuvo_parte_policial", "tuvo_testigo", "fault_responsable",
        "similitud_narrativa_max", "numero_parte_policial",
    ]
    return df[cols].reset_index(drop=True)


def transform_documentos(
    df_raw: pd.DataFrame,
    siniestros: pd.DataFrame,
    pdf_idx: dict[str, str],
) -> pd.DataFrame:
    df = df_raw.rename(columns={
        "ID Documento": "id_documento",
        "ID Siniestro": "id_siniestro",
        "Tipo Documento": "tipo_documento",
        "Nombre Archivo PDF": "_pdf_name",
    })
    df["ruta_pdf"] = df["_pdf_name"].apply(lambda n: _resolve_pdf(n, pdf_idx))
    df["entregado"] = True
    df["legible"] = True
    df["inconsistencia_detectada"] = False
    df["observacion"] = None

    fechas = dict(zip(siniestros["id_siniestro"], siniestros["fecha_ocurrencia"]))
    def _fecha_doc(sid: str) -> Optional[str]:
        f = fechas.get(sid)
        if not f:
            return None
        return (pd.to_datetime(f) + pd.Timedelta(days=int(RNG.integers(1, 8)))).strftime("%Y-%m-%d")
    df["fecha_emision"] = df["id_siniestro"].apply(_fecha_doc)

    cols = [
        "id_documento", "id_siniestro", "tipo_documento",
        "entregado", "legible", "fecha_emision",
        "inconsistencia_detectada", "observacion", "ruta_pdf",
    ]
    return df[cols].reset_index(drop=True)


def build_vehiculos(siniestros: pd.DataFrame, polizas: pd.DataFrame) -> pd.DataFrame:
    veh_rows = (
        siniestros[siniestros["id_vehiculo"].notna()]
        [["id_vehiculo", "placa", "id_poliza"]]
        .drop_duplicates(subset=["id_vehiculo"])
        .merge(polizas[["id_poliza", "suma_asegurada_usd"]], on="id_poliza", how="left")
    )
    n = len(veh_rows)
    vehiculos = pd.DataFrame({
        "id_vehiculo": veh_rows["id_vehiculo"].values,
        "placa": veh_rows["placa"].values,
        "chasis": [f"NDC{i:014d}"[:17] for i in range(n)],
        "motor": [f"NDM{i:010d}" for i in range(n)],
        "marca": "N/D",
        "modelo": "N/D",
        "anio_vehiculo": 2020,
        "categoria": "Sedan",
        "valor_comercial_usd": veh_rows["suma_asegurada_usd"].fillna(15000.0).astype(float).values,
    })
    return vehiculos.reset_index(drop=True)


def build_conductores(vehiculos: pd.DataFrame, siniestros: pd.DataFrame) -> pd.DataFrame:
    n = len(vehiculos)
    if n == 0:
        return pd.DataFrame(columns=[
            "id_conductor", "id_vehiculo", "nombre_seudonimo", "edad",
            "genero", "anios_licencia", "infracciones_previas", "siniestros_18m",
        ])
    edades = RNG.integers(22, 65, size=n)
    conductores = pd.DataFrame({
        "id_conductor": [_id_conductor_para_vehiculo(v) for v in vehiculos["id_vehiculo"]],
        "id_vehiculo": vehiculos["id_vehiculo"].values,
        "nombre_seudonimo": [f"Conductor #{i+1:05d}" for i in range(n)],
        "edad": edades,
        "genero": RNG.choice(["M", "F"], size=n, p=[0.62, 0.38]),
        "anios_licencia": np.clip(edades - RNG.integers(18, 22, size=n), 0, None).astype(int),
        "infracciones_previas": RNG.poisson(0.4, size=n),
    })
    counts = siniestros.groupby("id_vehiculo").size().rename("siniestros_18m")
    conductores = conductores.merge(counts, on="id_vehiculo", how="left").fillna({"siniestros_18m": 0})
    conductores["siniestros_18m"] = conductores["siniestros_18m"].astype(int)
    return conductores.reset_index(drop=True)


def build_similitudes(siniestros: pd.DataFrame) -> pd.DataFrame:
    """Reconstruye la tabla de similitudes a partir de 'Similitud Narrativa Max.'.

    El xlsx ya trae la similitud maxima precalculada por siniestro. Usamos eso como
    proxy para sim_topk. en_top_k=True para los del top-10% por sim.
    id_match: vacio (no tenemos el par real).
    """
    s = siniestros[["id_siniestro", "similitud_narrativa_max"]].copy()
    s["max_sim"] = s["similitud_narrativa_max"].fillna(0.0).astype(float)
    s["id_match"] = None
    p90 = s["max_sim"].quantile(0.90) if len(s) else 1.0
    s["en_top_k"] = s["max_sim"] >= p90
    s["sim_topk"] = s["max_sim"].where(s["en_top_k"], 0.0)
    return s[["id_siniestro", "max_sim", "id_match", "en_top_k", "sim_topk"]].reset_index(drop=True)


# ----------- etiqueta heuristica -----------
def _label_heuristico(
    siniestros: pd.DataFrame,
    polizas: pd.DataFrame,
    proveedores: pd.DataFrame,
) -> pd.Series:
    """Etiqueta binaria proxy de fraude para mantener compatible el pipeline.

    Marca 1 si se cumple cualquiera de:
      - cobertura=Robo, estado=Pago Total, pagado >= 95% suma_asegurada       (RF-01)
      - proveedor en lista_restrictiva                                         (RF-03)
      - dias_desde_inicio_poliza <= 2                                          (RF-05)
      - monto_reclamado > suma_asegurada                                       (RF-06 proxy)
      - documentos_completos=False + similitud_narrativa_max > 0.85 (RF-07 proxy)
      - similitud_narrativa_max > 0.95                                         (clonado claro)

    NB: es solo un proxy. Documentado como tal en docs/limitaciones.md.
    """
    df = siniestros.merge(
        polizas[["id_poliza", "suma_asegurada_usd"]],
        on="id_poliza", how="left", suffixes=("", "_pol"),
    )
    df["suma_asegurada_usd"] = df["suma_asegurada_usd"].fillna(
        df.get("suma_asegurada_usd_pol", 0)
    )
    prov_rest = set(proveedores.loc[proveedores["lista_restrictiva"], "id_proveedor"])

    cob = df["cobertura"].fillna("")
    est = df["estado"].fillna("")
    pagado = df["monto_pagado_usd"].astype(float)
    recl = df["monto_reclamado_usd"].astype(float)
    sa = df["suma_asegurada_usd"].astype(float).replace(0, np.nan)
    dias_inicio = df["dias_desde_inicio_poliza"].astype(float)
    docs_completos = df["documentos_completos"].astype(bool)
    sim = df["similitud_narrativa_max"].astype(float).fillna(0.0)

    rf01 = (cob == "Robo") & (est == "Pago Total") & ((pagado / sa) >= 0.95)
    rf03 = df["id_proveedor"].isin(prov_rest)
    rf05 = dias_inicio <= 2
    rf06 = recl > sa.fillna(np.inf)
    rf07 = (~docs_completos) & (sim > 0.85)
    clon = sim > 0.95

    label = (rf01 | rf03 | rf05 | rf06 | rf07 | clon).astype(int)
    return label


# ----------- pipeline -----------
def check_integrity(siniestros, polizas, asegurados, vehiculos, proveedores, conductores) -> None:
    print("\n--- Integridad referencial ---")
    pairs = [
        ("id_poliza", "polizas", polizas),
        ("id_asegurado", "asegurados", asegurados),
        ("id_vehiculo", "vehiculos", vehiculos),
        ("id_proveedor", "proveedores", proveedores),
        ("id_conductor", "conductores", conductores),
    ]
    for fk, name, dim in pairs:
        pks = set(dim[fk])
        used = set(siniestros[fk].dropna())
        miss = used - pks
        status = "OK" if not miss else f"FALLO ({len(miss)} huerfanos)"
        print(f"  siniestros.{fk:<15} -> {name:<12}: {status}")


def main() -> int:
    if not XLSX.exists():
        log(f"ERROR: no encontre el dataset en {XLSX}")
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    log(f"Leyendo {XLSX.name}...")
    raw = {
        "siniestros": pd.read_excel(XLSX, sheet_name="1_Siniestros"),
        "polizas": pd.read_excel(XLSX, sheet_name="2_Polizas"),
        "asegurados": pd.read_excel(XLSX, sheet_name="3_Asegurados"),
        "proveedores": pd.read_excel(XLSX, sheet_name="4_Proveedores"),
        "documentos": pd.read_excel(XLSX, sheet_name="5_Documentos"),
    }
    for k, v in raw.items():
        log(f"  {k}: {len(v):,} filas x {len(v.columns)} cols")

    log("Indexando PDFs reales...")
    pdf_idx = _build_pdf_index()
    log(f"  {len(pdf_idx) // 2} PDFs indexados (facturas + partes + declaraciones)")

    log("Transformando asegurados...")
    asegurados = transform_asegurados(raw["asegurados"])
    log(f"  -> {len(asegurados):,} asegurados unicos")

    log("Transformando proveedores...")
    proveedores = transform_proveedores(raw["proveedores"])
    log(f"  -> {len(proveedores):,} proveedores ({proveedores['lista_restrictiva'].sum()} en lista restrictiva)")

    log("Transformando polizas...")
    polizas = transform_polizas(raw["polizas"], asegurados)
    log(f"  -> {len(polizas):,} polizas")

    log("Transformando siniestros...")
    siniestros = transform_siniestros(raw["siniestros"], proveedores, asegurados)
    log(f"  -> {len(siniestros):,} siniestros (vehiculos={(siniestros['ramo']=='Vehículos').sum()}, "
        f"hogar={(siniestros['ramo']=='Hogar').sum()}, salud={(siniestros['ramo']=='Salud').sum()})")

    log("Construyendo vehiculos desde distinct placa...")
    vehiculos = build_vehiculos(siniestros, polizas)
    log(f"  -> {len(vehiculos):,} vehiculos")

    log("Generando conductores sinteticos (1 por vehiculo)...")
    conductores = build_conductores(vehiculos, siniestros)
    log(f"  -> {len(conductores):,} conductores")

    log("Transformando documentos (vinculando PDFs reales)...")
    documentos = transform_documentos(raw["documentos"], siniestros, pdf_idx)
    n_con_pdf = documentos["ruta_pdf"].notna().sum()
    log(f"  -> {len(documentos):,} documentos ({n_con_pdf} con PDF real adjunto)")

    log("Construyendo similitudes desde 'Similitud Narrativa Max.'...")
    similitudes = build_similitudes(siniestros)
    log(f"  -> {len(similitudes):,} filas (top_k: {similitudes['en_top_k'].sum()})")

    log("Calculando etiqueta heuristica de fraude (proxy)...")
    siniestros["etiqueta_fraude_simulada"] = _label_heuristico(
        siniestros, polizas, proveedores
    )
    siniestros["caso_inyectado"] = False
    pct_fraude = 100 * siniestros["etiqueta_fraude_simulada"].mean()
    log(f"  -> {siniestros['etiqueta_fraude_simulada'].sum()} marcados como fraude ({pct_fraude:.1f}%)")

    # Limpiar columnas auxiliares antes de persistir siniestros
    siniestros = siniestros.drop(columns=["similitud_narrativa_max", "numero_parte_policial"],
                                  errors="ignore")

    check_integrity(siniestros, polizas, asegurados, vehiculos, proveedores, conductores)

    log("\nGuardando parquets...")
    siniestros.to_parquet(OUT_DIR / "siniestros.parquet", index=False)
    polizas.to_parquet(OUT_DIR / "polizas.parquet", index=False)
    asegurados.to_parquet(OUT_DIR / "asegurados.parquet", index=False)
    vehiculos.to_parquet(OUT_DIR / "vehiculos.parquet", index=False)
    proveedores.to_parquet(OUT_DIR / "proveedores.parquet", index=False)
    conductores.to_parquet(OUT_DIR / "conductores.parquet", index=False)
    documentos.to_parquet(OUT_DIR / "documentos.parquet", index=False)
    similitudes.to_parquet(OUT_DIR / "similitudes.parquet", index=False)

    print("\n" + "=" * 64)
    print("TABLAS GENERADAS")
    print("=" * 64)
    for name, dframe in [
        ("siniestros", siniestros), ("polizas", polizas), ("asegurados", asegurados),
        ("vehiculos", vehiculos), ("proveedores", proveedores),
        ("conductores", conductores), ("documentos", documentos),
        ("similitudes", similitudes),
    ]:
        size_kb = (OUT_DIR / f"{name}.parquet").stat().st_size / 1024
        print(f"  {name:<13} {len(dframe):>6,} filas x {len(dframe.columns):>2} cols   ({size_kb:>7,.1f} KB)")
    print("=" * 64)
    print("\nFuente: data/Data set documentos evento/Evento Datasets_Sinteticos_Fraude_500_v2.xlsx")
    return 0


if __name__ == "__main__":
    sys.exit(main())
