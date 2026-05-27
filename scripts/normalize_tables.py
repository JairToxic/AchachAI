"""
normalize_tables.py - Divide el CSV limpio en 7 tablas parquet relacionales.

Lee:   data/processed/siniestros_clean.csv
Escribe:
  data/processed/siniestros.parquet
  data/processed/polizas.parquet
  data/processed/asegurados.parquet
  data/processed/vehiculos.parquet
  data/processed/proveedores.parquet
  data/processed/conductores.parquet      <- generado sinteticamente
  data/processed/documentos.parquet       <- generado sinteticamente

Genera las tablas que faltaban en el dataset original (conductores y documentos)
para poder calcular TODAS las senales que pide el reto.

Uso:
    python scripts/normalize_tables.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "processed" / "siniestros_clean.csv"
OUT_DIR = ROOT / "data" / "processed"

RNG = np.random.default_rng(42)  # determinismo

# --------- Mapeos columna -> tabla ----------
COLS_POLIZAS = {
    "id_poliza": "id_poliza",
    "id_asegurado": "id_asegurado",
    "ramo_pol": "ramo",
    "fecha_inicio": "fecha_inicio",
    "fecha_fin": "fecha_fin",
    "prima_usd": "prima_usd",
    "suma_asegurada_usd": "suma_asegurada_usd",
    "deducible_usd": "deducible_usd",
    "canal_venta": "canal_venta",
    "ciudad": "ciudad",
    "estado_poliza": "estado_poliza",
    "tipo_cobertura": "tipo_cobertura",
}

COLS_ASEGURADOS = {
    "id_asegurado": "id_asegurado",
    "segmento": "segmento",
    "antiguedad_anios": "antiguedad_anios",
    "ciudad_ase": "ciudad",
    "num_polizas": "num_polizas",
    "reclamos_ultimos_12_meses": "reclamos_ultimos_12_meses",
    "mora_actual": "mora_actual",
    "score_cliente_simulado": "score_cliente_simulado",
}

COLS_VEHICULOS = {
    "id_vehiculo": "id_vehiculo",
    "placa": "placa",
    "chasis": "chasis",
    "motor": "motor",
    "marca": "marca",
    "modelo": "modelo",
    "anio_vehiculo": "anio_vehiculo",
    "categoria": "categoria",
    "valor_comercial_usd": "valor_comercial_usd",
}

COLS_PROVEEDORES = {
    "id_proveedor": "id_proveedor",
    "nombre": "nombre",
    "tipo": "tipo",
    "ciudad_prov": "ciudad",
    "antiguedad_anios_prov": "antiguedad_anios",
    "lista_restrictiva": "lista_restrictiva",
    "reclamos_asociados": "reclamos_asociados",
    "porcentaje_casos_observados": "porcentaje_casos_observados",
    "monto_promedio_reclamado_usd": "monto_promedio_reclamado_usd",
}

COLS_SINIESTROS = [
    "id_siniestro", "id_poliza", "id_asegurado", "id_vehiculo", "id_proveedor",
    "ramo", "cobertura",
    "fecha_ocurrencia", "fecha_reporte",
    "monto_reclamado_usd", "monto_estimado_usd", "monto_pagado_usd",
    "estado", "sucursal", "ciudad_evento", "descripcion",
    "documentos_completos", "tipo_beneficiario",
    "dias_desde_inicio_poliza", "dias_desde_fin_poliza", "dias_entre_ocurrencia_reporte",
    "historial_siniestros_asegurado",
    "tuvo_parte_policial", "tuvo_testigo", "fault_responsable",
    "etiqueta_fraude_simulada",
]


# --------- Generadores sinteticos ----------
def generate_conductores(vehiculos: pd.DataFrame, siniestros: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """1 conductor habitual por vehiculo. Devuelve (df_conductores, serie id_conductor por siniestro).

    El conductor habitual de un vehiculo es estable: se asigna 1:1 con el id_vehiculo.
    Esto permite calcular la senal "Alta frecuencia de conductor" sumando siniestros
    por id_vehiculo (que es equivalente a sumar por id_conductor cuando es 1:1).
    """
    n = len(vehiculos)
    edades = RNG.integers(18, 75, size=n)
    conductores = pd.DataFrame({
        "id_conductor": [f"CON-{i+1:07d}" for i in range(n)],
        "id_vehiculo": vehiculos["id_vehiculo"].values,
        "nombre_seudonimo": [f"Conductor #{i+1:05d}" for i in range(n)],
        "edad": edades,
        "genero": RNG.choice(["M", "F"], size=n, p=[0.62, 0.38]),
        "anios_licencia": np.clip(edades - RNG.integers(18, 22, size=n), 0, None).astype(int),
        "infracciones_previas": RNG.poisson(0.4, size=n),
    })

    # Asignar id_conductor a cada siniestro segun el vehiculo
    veh_to_cond = dict(zip(conductores["id_vehiculo"], conductores["id_conductor"]))
    id_cond_por_siniestro = siniestros["id_vehiculo"].map(veh_to_cond)

    # Contar siniestros 18m por conductor (basicamente igual a por vehiculo aqui)
    counts = siniestros.groupby("id_vehiculo").size().rename("siniestros_18m")
    conductores = conductores.merge(counts, on="id_vehiculo", how="left").fillna({"siniestros_18m": 0})
    conductores["siniestros_18m"] = conductores["siniestros_18m"].astype(int)

    return conductores, id_cond_por_siniestro


def generate_documentos(siniestros: pd.DataFrame) -> pd.DataFrame:
    """Por cada siniestro genera 3-6 documentos. Ajusta probabilidades segun:
      - documentos_completos = False -> mas faltantes
      - cobertura = Robo -> debe haber denuncia policial
      - etiqueta_fraude_simulada = 1 -> mas inconsistencias
    """
    tipos_estandar = ["Denuncia", "Factura", "Foto", "Informe perito", "Parte policial"]
    rows = []
    doc_counter = 0

    for _, sin in siniestros.iterrows():
        es_robo = sin["cobertura"] == "Robo"
        docs_completos = bool(sin["documentos_completos"]) if pd.notna(sin["documentos_completos"]) else True
        es_fraude = int(sin["etiqueta_fraude_simulada"]) == 1
        tuvo_parte = bool(sin["tuvo_parte_policial"]) if pd.notna(sin["tuvo_parte_policial"]) else False

        # Para robos siempre intentamos generar Denuncia y Parte policial
        if es_robo:
            tipos_sin = ["Denuncia", "Parte policial", "Factura", "Foto"]
        else:
            n_extra = RNG.integers(0, 3)
            tipos_sin = ["Factura", "Foto"] + list(RNG.choice(
                ["Informe perito", "Parte policial", "Denuncia"], size=n_extra, replace=False
            ))

        # Probabilidad base de entregado/legible/inconsistencia
        p_entregado = 0.55 if not docs_completos else 0.95
        p_legible = 0.95 if not es_fraude else 0.78
        p_incons = 0.04 if not es_fraude else 0.30

        # Parte policial: si tuvo_parte_policial es True, mucho mas probable entregado
        for tipo in tipos_sin:
            doc_counter += 1
            entregado = RNG.random() < (
                0.97 if (tipo == "Parte policial" and tuvo_parte) else p_entregado
            )
            legible = entregado and (RNG.random() < p_legible)
            incons = entregado and legible and (RNG.random() < p_incons)
            try:
                fecha_oc = pd.to_datetime(sin["fecha_ocurrencia"])
                # BUGFIX: rango normal SOLO posterior al evento (1 a 10 dias).
                # Antes era (-2, 10) lo que disparaba RF-02 (factura previa) en ~20% de casos NO fraude.
                offset = int(RNG.integers(1, 10)) if not incons else int(RNG.integers(-30, -3))
                fecha_emision = (fecha_oc + pd.Timedelta(days=offset)).strftime("%Y-%m-%d")
            except Exception:
                fecha_emision = None

            rows.append({
                "id_documento": f"DOC-{doc_counter:08d}",
                "id_siniestro": sin["id_siniestro"],
                "tipo_documento": tipo,
                "entregado": entregado,
                "legible": legible,
                "fecha_emision": fecha_emision,
                "inconsistencia_detectada": bool(incons),
                "observacion": (
                    "Factura con fecha anterior al evento" if (incons and tipo == "Factura")
                    else "Documento ilegible" if (entregado and not legible)
                    else "Documento no entregado" if not entregado
                    else None
                ),
            })

    return pd.DataFrame(rows)


# --------- Pipeline ----------
def log(msg: str) -> None:
    print(f"[normalize] {msg}")


def split_dim_table(df: pd.DataFrame, mapping: dict, pk: str) -> pd.DataFrame:
    """Extrae una tabla dimensional usando un mapeo {col_src: col_dst} y deduplica por PK."""
    cols_src = [c for c in mapping.keys() if c in df.columns]
    out = df[cols_src].rename(columns=mapping).drop_duplicates(subset=[pk]).reset_index(drop=True)
    return out


def check_referential_integrity(siniestros: pd.DataFrame, dim_dfs: dict[str, pd.DataFrame]) -> None:
    """Verifica que todas las FKs apunten a un PK existente."""
    fks = {
        "id_poliza": "polizas",
        "id_asegurado": "asegurados",
        "id_vehiculo": "vehiculos",
        "id_proveedor": "proveedores",
    }
    print("\n--- Integridad referencial ---")
    for fk, tabla in fks.items():
        pks = set(dim_dfs[tabla][fk])
        usados = set(siniestros[fk].dropna())
        huerfanos = usados - pks
        status = "OK" if not huerfanos else f"FALLO ({len(huerfanos)} huerfanos)"
        print(f"  siniestros.{fk:<15} -> {tabla:<12} : {status}")


def main() -> int:
    if not SRC.exists():
        log(f"ERROR: no encontre {SRC}. Corre primero clean_dataset.py")
        return 1

    log(f"Leyendo {SRC.name}...")
    df = pd.read_csv(SRC)
    log(f"Filas: {len(df):,}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Dimensiones
    log("Extrayendo polizas...")
    polizas = split_dim_table(df, COLS_POLIZAS, pk="id_poliza")
    log(f"  -> {len(polizas):,} polizas unicas")

    log("Extrayendo asegurados...")
    asegurados = split_dim_table(df, COLS_ASEGURADOS, pk="id_asegurado")
    log(f"  -> {len(asegurados):,} asegurados unicos")

    log("Extrayendo vehiculos...")
    vehiculos = split_dim_table(df, COLS_VEHICULOS, pk="id_vehiculo")
    log(f"  -> {len(vehiculos):,} vehiculos unicos")

    log("Extrayendo proveedores...")
    proveedores = split_dim_table(df, COLS_PROVEEDORES, pk="id_proveedor")
    log(f"  -> {len(proveedores):,} proveedores unicos")

    # 2. Conductores sinteticos (1 por vehiculo)
    log("Generando conductores sinteticos (1 por vehiculo)...")
    siniestros_tmp = df[COLS_SINIESTROS].copy()
    conductores, id_cond_por_sin = generate_conductores(vehiculos, siniestros_tmp)
    log(f"  -> {len(conductores):,} conductores generados")

    # 3. Siniestros con FK a conductor agregada
    siniestros = siniestros_tmp.copy()
    siniestros.insert(
        siniestros.columns.get_loc("id_proveedor") + 1,
        "id_conductor",
        id_cond_por_sin.values,
    )

    # 4. Documentos sinteticos (3-6 por siniestro)
    log("Generando documentos sinteticos (3-6 por siniestro)...")
    documentos = generate_documentos(siniestros)
    log(f"  -> {len(documentos):,} documentos generados ({len(documentos)/len(siniestros):.1f} promedio/siniestro)")

    # 5. Integridad referencial
    dim_dfs = {
        "polizas": polizas,
        "asegurados": asegurados,
        "vehiculos": vehiculos,
        "proveedores": proveedores,
    }
    check_referential_integrity(siniestros, dim_dfs)

    # 6. Guardar parquet
    log("\nGuardando parquet...")
    siniestros.to_parquet(OUT_DIR / "siniestros.parquet", index=False)
    polizas.to_parquet(OUT_DIR / "polizas.parquet", index=False)
    asegurados.to_parquet(OUT_DIR / "asegurados.parquet", index=False)
    vehiculos.to_parquet(OUT_DIR / "vehiculos.parquet", index=False)
    proveedores.to_parquet(OUT_DIR / "proveedores.parquet", index=False)
    conductores.to_parquet(OUT_DIR / "conductores.parquet", index=False)
    documentos.to_parquet(OUT_DIR / "documentos.parquet", index=False)

    # 7. Resumen final
    print("\n" + "=" * 60)
    print("TABLAS GENERADAS")
    print("=" * 60)
    for tabla, dframe in [
        ("siniestros", siniestros), ("polizas", polizas), ("asegurados", asegurados),
        ("vehiculos", vehiculos), ("proveedores", proveedores),
        ("conductores", conductores), ("documentos", documentos),
    ]:
        size_kb = (OUT_DIR / f"{tabla}.parquet").stat().st_size / 1024
        print(f"  {tabla:<15} {len(dframe):>7,} filas x {len(dframe.columns):>2} cols   ({size_kb:>7,.1f} KB)")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
