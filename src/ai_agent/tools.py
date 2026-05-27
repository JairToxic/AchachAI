"""Tools que el agente usa para consultar las 7 tablas parquet.

Cada tool es una funcion pura que recibe argumentos JSON-serializables y
devuelve dict JSON-serializable. El agente las invoca via function calling.

Usa DuckDB para queries rapidas sobre los parquet, sin cargarlos a memoria.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"


def _con() -> duckdb.DuckDBPyConnection:
    """Conexion DuckDB con las 7 tablas expuestas como VIEWS desde parquet."""
    con = duckdb.connect(":memory:")
    for name in ["siniestros", "polizas", "asegurados", "vehiculos",
                 "proveedores", "conductores", "documentos"]:
        path = PROC / f"{name}.parquet"
        if path.exists():
            con.execute(f"CREATE VIEW {name} AS SELECT * FROM '{path.as_posix()}'")
    return con


def _df_to_records(df: pd.DataFrame, limit: int = 50) -> list[dict]:
    """Convierte DataFrame a lista de dicts, limitando filas y convirtiendo tipos."""
    if len(df) > limit:
        df = df.head(limit)
    out = []
    for _, row in df.iterrows():
        d = {}
        for k, v in row.items():
            if pd.isna(v):
                d[k] = None
            elif hasattr(v, "item"):
                d[k] = v.item()
            else:
                d[k] = v
        out.append(d)
    return out


# ===================== TOOL 1: top_riesgo =====================
def top_riesgo(
    limit: int = 10,
    nivel: str | None = None,
    ramo: str | None = None,
    ciudad: str | None = None,
) -> dict:
    """Devuelve los siniestros con mayor score combinado, ordenados desc.

    Usa el motor de reglas en vivo si los scores no estan precomputados,
    o lee de una tabla cache si existe.
    """
    from src.rules import build_contexto, evaluate_siniestro

    con = _con()
    proveedores = con.execute("SELECT * FROM proveedores").df()
    siniestros = con.execute("SELECT * FROM siniestros").df()

    # Cargar similitudes si existen (top-K)
    sim_path = PROC / "similitudes.parquet"
    sim_df = None
    if sim_path.exists():
        sim_df = pd.read_parquet(sim_path)

    ctx = build_contexto(siniestros, proveedores, similitudes_df=sim_df)

    # Cargar todas las tablas a memoria para joins rapidos
    pol = con.execute("SELECT * FROM polizas").df().set_index("id_poliza")
    ase = con.execute("SELECT * FROM asegurados").df().set_index("id_asegurado")
    veh = con.execute("SELECT * FROM vehiculos").df().set_index("id_vehiculo")
    prov = proveedores.set_index("id_proveedor")
    cond = con.execute("SELECT * FROM conductores").df().set_index("id_conductor")
    docs = con.execute("SELECT * FROM documentos").df()
    docs_por_sin = docs.groupby("id_siniestro").apply(
        lambda d: d.to_dict("records"), include_groups=False
    ).to_dict()

    # Filtrado preliminar
    f = siniestros
    if ramo:
        f = f[f["ramo"].str.contains(ramo, case=False, na=False)]
    if ciudad:
        f = f[f["ciudad_evento"].str.contains(ciudad, case=False, na=False)]

    # Sample si hay muchos (para no evaluar 15K)
    if len(f) > 2000:
        f = f.sample(2000, random_state=42)

    resultados = []
    for _, sin in f.iterrows():
        try:
            r = evaluate_siniestro(
                siniestro=sin.to_dict(),
                poliza=pol.loc[sin["id_poliza"]].to_dict() | {"id_poliza": sin["id_poliza"]},
                asegurado=ase.loc[sin["id_asegurado"]].to_dict() | {"id_asegurado": sin["id_asegurado"]},
                vehiculo=veh.loc[sin["id_vehiculo"]].to_dict() | {"id_vehiculo": sin["id_vehiculo"]},
                proveedor=prov.loc[sin["id_proveedor"]].to_dict() | {"id_proveedor": sin["id_proveedor"]},
                conductor=cond.loc[sin["id_conductor"]].to_dict() | {"id_conductor": sin["id_conductor"]},
                documentos=docs_por_sin.get(sin["id_siniestro"], []),
                ctx=ctx,
            )
            if nivel and r["nivel"] != nivel.upper():
                continue
            resultados.append({
                "id_siniestro": sin["id_siniestro"],
                "score": r["score"],
                "nivel": r["nivel"],
                "cobertura": sin["cobertura"],
                "monto_reclamado_usd": float(sin["monto_reclamado_usd"]),
                "ciudad": sin["ciudad_evento"],
                "reglas_disparadas": [reg["codigo"] for reg in r["reglas_criticas"]],
                "n_senales": len(r["senales_activadas"]),
            })
        except Exception:
            continue

    resultados.sort(key=lambda x: -x["score"])
    return {"total_evaluados": len(f), "top": resultados[:limit]}


# ===================== TOOL 2: detalle_siniestro =====================
def detalle_siniestro(id_siniestro: str) -> dict:
    """Devuelve el detalle COMPLETO de un siniestro con score y explicacion."""
    from src.rules import build_contexto, evaluate_siniestro

    con = _con()
    sin_df = con.execute(
        f"SELECT * FROM siniestros WHERE id_siniestro = '{id_siniestro}'"
    ).df()
    if sin_df.empty:
        return {"error": f"No encontre el siniestro {id_siniestro}"}

    sin = sin_df.iloc[0].to_dict()
    pol = con.execute(f"SELECT * FROM polizas WHERE id_poliza = '{sin['id_poliza']}'").df().iloc[0].to_dict()
    ase = con.execute(f"SELECT * FROM asegurados WHERE id_asegurado = '{sin['id_asegurado']}'").df().iloc[0].to_dict()
    veh = con.execute(f"SELECT * FROM vehiculos WHERE id_vehiculo = '{sin['id_vehiculo']}'").df().iloc[0].to_dict()
    prov = con.execute(f"SELECT * FROM proveedores WHERE id_proveedor = '{sin['id_proveedor']}'").df().iloc[0].to_dict()
    cond = con.execute(f"SELECT * FROM conductores WHERE id_conductor = '{sin['id_conductor']}'").df().iloc[0].to_dict()
    docs = con.execute(f"SELECT * FROM documentos WHERE id_siniestro = '{id_siniestro}'").df().to_dict("records")

    all_sin = con.execute("SELECT * FROM siniestros").df()
    all_prov = con.execute("SELECT * FROM proveedores").df()
    sim_path = PROC / "similitudes.parquet"
    sim_df = None
    if sim_path.exists():
        _tmp = pd.read_parquet(sim_path)
        if "sim_topk" in _tmp.columns and "en_top_k" in _tmp.columns:
            sim_df = _tmp
    ctx = build_contexto(all_sin, all_prov, similitudes_df=sim_df)

    r = evaluate_siniestro(
        siniestro=sin, poliza=pol, asegurado=ase, vehiculo=veh,
        proveedor=prov, conductor=cond, documentos=docs, ctx=ctx,
    )
    return {
        "siniestro": {k: (v if not pd.isna(v) else None) for k, v in sin.items()
                      if k not in ("descripcion",)},
        "descripcion": sin.get("descripcion"),
        "asegurado": {"id": ase["id_asegurado"], "segmento": ase.get("segmento"),
                      "score": ase.get("score_cliente_simulado"),
                      "reclamos_12m": ase.get("reclamos_ultimos_12_meses")},
        "vehiculo": {"marca": veh.get("marca"), "modelo": veh.get("modelo"),
                     "anio": int(veh.get("anio_vehiculo", 0))},
        "proveedor": {"nombre": prov.get("nombre"), "tipo": prov.get("tipo"),
                      "lista_restrictiva": bool(prov.get("lista_restrictiva"))},
        "n_documentos": len(docs),
        "score": r["score"], "nivel": r["nivel"],
        "reglas_criticas": r["reglas_criticas"],
        "senales_activadas": r["senales_activadas"],
        "explicacion": r["explicacion_corta"],
    }


# ===================== TOOL 3: ranking_proveedores =====================
def ranking_proveedores(top_n: int = 10, solo_lista_restrictiva: bool = False) -> dict:
    """Top proveedores por # de siniestros asociados, con % en lista restrictiva."""
    con = _con()
    q = """
    SELECT p.id_proveedor, p.nombre, p.tipo, p.ciudad, p.lista_restrictiva,
           COUNT(s.id_siniestro) AS n_siniestros,
           ROUND(AVG(s.monto_reclamado_usd), 0) AS monto_promedio,
           SUM(CASE WHEN s.etiqueta_fraude_simulada = 1 THEN 1 ELSE 0 END) AS n_fraudes_simulados
    FROM proveedores p
    LEFT JOIN siniestros s ON s.id_proveedor = p.id_proveedor
    GROUP BY ALL
    ORDER BY n_siniestros DESC
    """
    df = con.execute(q).df()
    if solo_lista_restrictiva:
        df = df[df["lista_restrictiva"]]
    return {"top": _df_to_records(df, limit=top_n)}


# ===================== TOOL 4: ranking_ciudades =====================
def ranking_ciudades(top_n: int = 10) -> dict:
    """Ciudades con mayor # de siniestros y tasa de fraude simulada."""
    con = _con()
    df = con.execute("""
    SELECT ciudad_evento AS ciudad,
           COUNT(*) AS n_siniestros,
           SUM(CASE WHEN etiqueta_fraude_simulada = 1 THEN 1 ELSE 0 END) AS n_fraudes_simulados,
           ROUND(AVG(monto_reclamado_usd), 0) AS monto_promedio
    FROM siniestros
    GROUP BY ciudad_evento
    ORDER BY n_siniestros DESC
    """).df()
    df["tasa_fraude"] = (df["n_fraudes_simulados"] / df["n_siniestros"]).round(3)
    return {"top": _df_to_records(df, limit=top_n)}


# ===================== TOOL 5: asegurados_recurrentes =====================
def asegurados_recurrentes(min_siniestros: int = 3, top_n: int = 10) -> dict:
    """Asegurados con mas siniestros (posibles patrones de uso atipico)."""
    con = _con()
    df = con.execute(f"""
    SELECT a.id_asegurado, a.segmento, a.ciudad, a.reclamos_ultimos_12_meses,
           COUNT(s.id_siniestro) AS n_siniestros_total,
           SUM(s.monto_reclamado_usd) AS monto_total_reclamado,
           AVG(s.monto_reclamado_usd) AS monto_promedio
    FROM asegurados a
    LEFT JOIN siniestros s ON s.id_asegurado = a.id_asegurado
    GROUP BY ALL
    HAVING COUNT(s.id_siniestro) >= {min_siniestros}
    ORDER BY n_siniestros_total DESC
    LIMIT {top_n}
    """).df()
    return {"top": _df_to_records(df, limit=top_n)}


# ===================== TOOL 6: docs_faltantes =====================
def docs_faltantes(min_score: int = 76) -> dict:
    """Siniestros de alto score con documentos faltantes o incompletos."""
    con = _con()
    # Resumen de docs por siniestro
    df = con.execute("""
    SELECT s.id_siniestro, s.cobertura, s.estado, s.monto_reclamado_usd,
           s.documentos_completos,
           COUNT(d.id_documento) AS n_docs,
           SUM(CASE WHEN d.entregado = false THEN 1 ELSE 0 END) AS n_no_entregados,
           SUM(CASE WHEN d.inconsistencia_detectada = true THEN 1 ELSE 0 END) AS n_inconsistentes
    FROM siniestros s
    LEFT JOIN documentos d ON d.id_siniestro = s.id_siniestro
    GROUP BY ALL
    HAVING n_no_entregados > 0 OR n_inconsistentes > 0 OR documentos_completos = false
    ORDER BY n_inconsistentes DESC, n_no_entregados DESC
    LIMIT 30
    """).df()
    return {"casos_con_problemas_docs": _df_to_records(df, limit=30)}


# ===================== TOOL 7: montos_atipicos =====================
def montos_atipicos(top_n: int = 20, ratio_min: float = 0.80) -> dict:
    """Siniestros donde monto_reclamado / suma_asegurada >= ratio_min (default 80%)."""
    con = _con()
    df = con.execute(f"""
    SELECT s.id_siniestro, s.cobertura, s.estado, s.ciudad_evento,
           s.monto_reclamado_usd, p.suma_asegurada_usd,
           ROUND(s.monto_reclamado_usd * 1.0 / p.suma_asegurada_usd, 3) AS ratio,
           s.etiqueta_fraude_simulada, s.caso_inyectado
    FROM siniestros s
    JOIN polizas p ON s.id_poliza = p.id_poliza
    WHERE p.suma_asegurada_usd > 0
      AND (s.monto_reclamado_usd * 1.0 / p.suma_asegurada_usd) >= {ratio_min}
    ORDER BY ratio DESC
    LIMIT {top_n}
    """).df()
    return {
        "umbral_aplicado": ratio_min,
        "n_casos": len(df),
        "casos": _df_to_records(df, limit=top_n),
    }


# ===================== TOOL 8: estadisticas_por_cobertura =====================
def estadisticas_por_cobertura() -> dict:
    """% de fraude simulado, monto promedio y N siniestros por cobertura.
    Responde 'que ramos / coberturas tienen mayor porcentaje sospechoso'."""
    con = _con()
    df = con.execute("""
    SELECT cobertura,
           COUNT(*) AS n_siniestros,
           SUM(etiqueta_fraude_simulada) AS n_fraudes_simulados,
           ROUND(AVG(etiqueta_fraude_simulada) * 100, 2) AS pct_fraude,
           ROUND(AVG(monto_reclamado_usd), 0) AS monto_promedio,
           ROUND(SUM(monto_reclamado_usd), 0) AS monto_total
    FROM siniestros
    GROUP BY cobertura
    ORDER BY pct_fraude DESC
    """).df()
    return {"por_cobertura": _df_to_records(df, limit=20)}


TOOLS_REGISTRY: dict[str, Any] = {
    "top_riesgo": top_riesgo,
    "detalle_siniestro": detalle_siniestro,
    "ranking_proveedores": ranking_proveedores,
    "ranking_ciudades": ranking_ciudades,
    "asegurados_recurrentes": asegurados_recurrentes,
    "docs_faltantes": docs_faltantes,
    "montos_atipicos": montos_atipicos,
    "estadisticas_por_cobertura": estadisticas_por_cobertura,
}


# ===================== Schemas para function calling =====================
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "top_riesgo",
            "description": "Devuelve los siniestros con mayor score de posible fraude. Util para 'top N casos sospechosos'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Cuantos casos devolver (default 10)", "default": 10},
                    "nivel": {"type": "string", "enum": ["VERDE", "AMARILLO", "ROJO"], "description": "Filtrar por nivel del semaforo"},
                    "ramo": {"type": "string", "description": "Filtrar por ramo (ej. Vehiculos)"},
                    "ciudad": {"type": "string", "description": "Filtrar por ciudad del evento"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "detalle_siniestro",
            "description": "Devuelve el detalle completo de un siniestro especifico con su score, reglas activadas, senales y explicacion. Usar cuando el usuario pregunta por un id_siniestro.",
            "parameters": {
                "type": "object",
                "properties": {
                    "id_siniestro": {"type": "string", "description": "Id del siniestro (ej. SIN-000123 o SIN-0900001)"},
                },
                "required": ["id_siniestro"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ranking_proveedores",
            "description": "Top proveedores por # de siniestros asociados. Incluye si estan en lista restrictiva y tasa de fraude.",
            "parameters": {
                "type": "object",
                "properties": {
                    "top_n": {"type": "integer", "default": 10},
                    "solo_lista_restrictiva": {"type": "boolean", "default": False},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ranking_ciudades",
            "description": "Ciudades con mayor concentracion de siniestros y tasa de fraude.",
            "parameters": {
                "type": "object",
                "properties": {"top_n": {"type": "integer", "default": 10}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "asegurados_recurrentes",
            "description": "Asegurados con mas reclamos. Usa para detectar uso atipico del seguro.",
            "parameters": {
                "type": "object",
                "properties": {
                    "min_siniestros": {"type": "integer", "default": 3},
                    "top_n": {"type": "integer", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "docs_faltantes",
            "description": "Siniestros con documentos faltantes, no entregados o inconsistentes.",
            "parameters": {
                "type": "object",
                "properties": {"min_score": {"type": "integer", "default": 76}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "montos_atipicos",
            "description": "Siniestros con monto reclamado muy proximo o superior al limite de la poliza (ratio reclamado/suma_asegurada). Usar cuando preguntan por 'montos atipicos', 'reclamos cerca del limite', 'monto excesivo'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "top_n": {"type": "integer", "default": 20},
                    "ratio_min": {"type": "number", "description": "Umbral del ratio reclamado/suma (default 0.80 = 80%)", "default": 0.80},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "estadisticas_por_cobertura",
            "description": "% de fraude simulado, monto promedio y N siniestros agrupados por COBERTURA. Usar cuando preguntan 'que ramos / coberturas tienen mayor porcentaje sospechoso' o 'distribucion de fraude por tipo'.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]
