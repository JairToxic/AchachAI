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


# ===================== TOOL 1: top_riesgo (con cache en memoria) =====================
_TOP_RIESGO_CACHE: dict = {"ts": 0.0, "mtime": 0.0, "evaluated": []}
_TOP_RIESGO_TTL_SEC = 300  # 5 min


def _compute_top_riesgo_all() -> list[dict]:
    """Ejecuta la evaluacion costosa (sample 2000 + reglas) UNA vez.

    Devuelve la lista completa de evaluados (sin filtros ni limites).
    Se cachea por _TOP_RIESGO_TTL_SEC; si los parquets de siniestros cambian,
    se invalida automaticamente via mtime check.
    """
    import time
    from src.rules import build_contexto, evaluate_siniestro

    sin_path = PROC / "siniestros.parquet"
    mtime = sin_path.stat().st_mtime if sin_path.exists() else 0.0
    now = time.time()
    if (_TOP_RIESGO_CACHE["evaluated"]
        and (now - _TOP_RIESGO_CACHE["ts"]) < _TOP_RIESGO_TTL_SEC
        and _TOP_RIESGO_CACHE["mtime"] == mtime):
        return _TOP_RIESGO_CACHE["evaluated"]

    con = _con()
    proveedores = con.execute("SELECT * FROM proveedores").df()
    siniestros = con.execute("SELECT * FROM siniestros").df()

    sim_path = PROC / "similitudes.parquet"
    sim_df = pd.read_parquet(sim_path) if sim_path.exists() else None
    ctx = build_contexto(siniestros, proveedores, similitudes_df=sim_df)

    pol = con.execute("SELECT * FROM polizas").df().set_index("id_poliza")
    ase = con.execute("SELECT * FROM asegurados").df().set_index("id_asegurado")
    veh = con.execute("SELECT * FROM vehiculos").df().set_index("id_vehiculo")
    prov = proveedores.set_index("id_proveedor")
    cond = con.execute("SELECT * FROM conductores").df().set_index("id_conductor")
    docs = con.execute("SELECT * FROM documentos").df()
    docs_por_sin = docs.groupby("id_siniestro").apply(
        lambda d: d.to_dict("records"), include_groups=False
    ).to_dict()

    # Sample estratificado por ramo para que el cache sirva a todos los ramos
    sample_rows = []
    for ramo_val, grp in siniestros.groupby("ramo"):
        n_sample = min(len(grp), max(1500, int(len(grp) * 0.5)))
        sample_rows.append(grp.sample(min(n_sample, 1500), random_state=42))
    f = pd.concat(sample_rows, ignore_index=True)

    def _ok(v) -> bool:
        return v is not None and not (isinstance(v, float) and pd.isna(v)) and str(v).strip() != ""

    evaluated = []
    for _, sin in f.iterrows():
        try:
            id_veh = sin.get("id_vehiculo")
            id_cond = sin.get("id_conductor")
            veh_dict = (veh.loc[id_veh].to_dict() | {"id_vehiculo": id_veh}) if (_ok(id_veh) and id_veh in veh.index) else None
            cond_dict = (cond.loc[id_cond].to_dict() | {"id_conductor": id_cond}) if (_ok(id_cond) and id_cond in cond.index) else None

            r = evaluate_siniestro(
                siniestro=sin.to_dict(),
                poliza=pol.loc[sin["id_poliza"]].to_dict() | {"id_poliza": sin["id_poliza"]},
                asegurado=ase.loc[sin["id_asegurado"]].to_dict() | {"id_asegurado": sin["id_asegurado"]},
                vehiculo=veh_dict,
                proveedor=prov.loc[sin["id_proveedor"]].to_dict() | {"id_proveedor": sin["id_proveedor"]},
                conductor=cond_dict,
                documentos=docs_por_sin.get(sin["id_siniestro"], []),
                ctx=ctx,
            )
            evaluated.append({
                "id_siniestro": sin["id_siniestro"],
                "score": r["score"],
                "nivel": r["nivel"],
                "ramo": sin.get("ramo"),
                "cobertura": sin["cobertura"],
                "monto_reclamado_usd": float(sin["monto_reclamado_usd"]),
                "ciudad": sin["ciudad_evento"],
                "id_proveedor": sin.get("id_proveedor"),
                "reglas_disparadas": [reg["codigo"] for reg in r["reglas_criticas"]],
                "n_senales": len(r["senales_activadas"]),
            })
        except Exception:
            continue

    evaluated.sort(key=lambda x: -x["score"])
    _TOP_RIESGO_CACHE["evaluated"] = evaluated
    _TOP_RIESGO_CACHE["ts"] = now
    _TOP_RIESGO_CACHE["mtime"] = mtime
    return evaluated


def top_riesgo(
    limit: int = 10,
    nivel: str | None = None,
    ramo: str | None = None,
    ciudad: str | None = None,
) -> dict:
    """Devuelve los siniestros con mayor score combinado, ordenados desc.

    Cacheado en memoria por 5 min: la primera llamada toma ~15-20s evaluando
    2000+ siniestros; las siguientes (con cualquier filtro) son instantaneas.
    """
    evaluated = _compute_top_riesgo_all()

    # Niveles aceptados: "ROJO", "AMARILLO", "VERDE", o lista "ROJO,AMARILLO"
    # Default: si el usuario no pasa nivel, devolvemos ROJO + AMARILLO (lo que merece revision)
    if nivel:
        niveles_filtro = {n.strip().upper() for n in nivel.split(",") if n.strip()}
    else:
        niveles_filtro = {"ROJO", "AMARILLO"}

    # Filtrar del cache (rapido: solo iteracion sobre lista en memoria)
    resultados = []
    for c in evaluated:
        if c["nivel"] not in niveles_filtro:
            continue
        if ramo and not (c.get("ramo") or "").lower().startswith(ramo.lower()):
            continue
        if ciudad and ciudad.lower() not in (c.get("ciudad") or "").lower():
            continue
        resultados.append(c)

    return {
        "total_evaluados": len(evaluated),
        "niveles_filtrados": sorted(niveles_filtro),
        "top": resultados[:limit],
    }


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

    def _first_or_empty(query: str) -> dict:
        d = con.execute(query).df()
        return d.iloc[0].to_dict() if not d.empty else {}

    def _ok(v) -> bool:
        return v is not None and not (isinstance(v, float) and pd.isna(v)) and str(v).strip() != ""

    pol = _first_or_empty(f"SELECT * FROM polizas WHERE id_poliza = '{sin['id_poliza']}'")
    ase = _first_or_empty(f"SELECT * FROM asegurados WHERE id_asegurado = '{sin['id_asegurado']}'")
    # Hogar y Salud no tienen vehiculo ni conductor
    veh = _first_or_empty(f"SELECT * FROM vehiculos WHERE id_vehiculo = '{sin['id_vehiculo']}'") if _ok(sin.get("id_vehiculo")) else {}
    prov = _first_or_empty(f"SELECT * FROM proveedores WHERE id_proveedor = '{sin['id_proveedor']}'")
    cond = _first_or_empty(f"SELECT * FROM conductores WHERE id_conductor = '{sin['id_conductor']}'") if _ok(sin.get("id_conductor")) else {}
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
        "vehiculo": ({"marca": veh.get("marca"), "modelo": veh.get("modelo"),
                      "anio": int(veh.get("anio_vehiculo") or 0)} if veh else None),
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
def docs_faltantes(min_score: int = 0) -> dict:
    """Siniestros con documentos faltantes, no entregados o inconsistentes.

    Si min_score > 0, filtra ademas casos sospechosos (por # de senales de docs
    o por etiqueta_fraude_simulada como proxy). Para casos REALMENTE criticos,
    el agente puede luego cruzar con top_riesgo.
    """
    con = _con()
    df = con.execute("""
    SELECT s.id_siniestro, s.cobertura, s.estado, s.monto_reclamado_usd,
           s.documentos_completos, s.etiqueta_fraude_simulada,
           COUNT(d.id_documento) AS n_docs,
           SUM(CASE WHEN d.entregado = false THEN 1 ELSE 0 END) AS n_no_entregados,
           SUM(CASE WHEN d.inconsistencia_detectada = true THEN 1 ELSE 0 END) AS n_inconsistentes,
           LIST(DISTINCT d.tipo_documento) FILTER (WHERE d.entregado = false) AS tipos_faltantes
    FROM siniestros s
    LEFT JOIN documentos d ON d.id_siniestro = s.id_siniestro
    GROUP BY ALL
    HAVING n_no_entregados > 0 OR n_inconsistentes > 0 OR documentos_completos = false
    ORDER BY n_inconsistentes DESC, n_no_entregados DESC
    LIMIT 60
    """).df()
    # Si pidieron min_score, priorizar los inyectados/etiquetados como fraude
    if min_score and min_score > 0:
        # Proxy: si tiene etiqueta_fraude_simulada=1, lo tratamos como "score alto"
        df_high = df[df["etiqueta_fraude_simulada"] == 1]
        if len(df_high) >= 5:
            df = df_high
    return {
        "filtro_min_score": min_score,
        "n_casos": len(df),
        "casos_con_problemas_docs": _df_to_records(df, limit=30),
    }


# ===================== TOOL 6b: siniestros_borde_vigencia =====================
def siniestros_borde_vigencia(
    dias_max_desde_inicio: int = 30,
    dias_max_hasta_fin: int = 30,
    top_n: int = 20,
    modo: str = "ambos",
) -> dict:
    """Siniestros que ocurrieron MUY cerca del inicio o del fin de la poliza.

    Patron clasico de fraude: contratar poliza y siniestrar a los pocos dias
    ('seguro de conveniencia'), o siniestrar justo antes de vencer la cobertura.

    Args:
      dias_max_desde_inicio: si dias_desde_inicio_poliza <= esto, marca 'borde_inicio'
      dias_max_hasta_fin: si dias_desde_fin_poliza <= esto, marca 'borde_fin'
      top_n: cuantos casos devolver
      modo: 'inicio' | 'fin' | 'ambos' (default ambos)
    """
    con = _con()
    where = []
    if modo in ("inicio", "ambos"):
        where.append(f"s.dias_desde_inicio_poliza <= {dias_max_desde_inicio}")
    if modo in ("fin", "ambos"):
        where.append(f"s.dias_desde_fin_poliza <= {dias_max_hasta_fin}")
    where_clause = " OR ".join(where) if where else "1=1"

    df = con.execute(f"""
    SELECT s.id_siniestro, s.id_poliza, s.id_asegurado, s.cobertura,
           s.fecha_ocurrencia, s.monto_reclamado_usd, s.ciudad_evento,
           s.dias_desde_inicio_poliza, s.dias_desde_fin_poliza,
           s.etiqueta_fraude_simulada, s.caso_inyectado,
           CASE
             WHEN s.dias_desde_inicio_poliza <= {dias_max_desde_inicio}
               AND s.dias_desde_fin_poliza  <= {dias_max_hasta_fin} THEN 'borde_inicio_y_fin'
             WHEN s.dias_desde_inicio_poliza <= {dias_max_desde_inicio} THEN 'borde_inicio'
             WHEN s.dias_desde_fin_poliza  <= {dias_max_hasta_fin}      THEN 'borde_fin'
             ELSE 'normal'
           END AS posicion
    FROM siniestros s
    WHERE {where_clause}
    ORDER BY LEAST(s.dias_desde_inicio_poliza, s.dias_desde_fin_poliza) ASC,
             s.monto_reclamado_usd DESC
    LIMIT {top_n}
    """).df()

    # Estadistica agregada
    total = con.execute(f"""
    SELECT
      SUM(CASE WHEN dias_desde_inicio_poliza <= {dias_max_desde_inicio} THEN 1 ELSE 0 END) AS n_borde_inicio,
      SUM(CASE WHEN dias_desde_fin_poliza   <= {dias_max_hasta_fin}     THEN 1 ELSE 0 END) AS n_borde_fin,
      COUNT(*) AS n_total
    FROM siniestros
    """).df().iloc[0].to_dict()

    return {
        "umbrales": {
            "dias_max_desde_inicio": dias_max_desde_inicio,
            "dias_max_hasta_fin": dias_max_hasta_fin,
            "modo": modo,
        },
        "totales_cartera": {
            "n_borde_inicio": int(total["n_borde_inicio"]),
            "n_borde_fin": int(total["n_borde_fin"]),
            "n_total_cartera": int(total["n_total"]),
            "pct_borde_inicio": round(total["n_borde_inicio"] / max(total["n_total"], 1) * 100, 2),
        },
        "casos": _df_to_records(df, limit=top_n),
        "nota": (
            "Borde_inicio = siniestro reportado pocos dias despues de iniciar la poliza "
            "(posible seguro de conveniencia). Borde_fin = siniestrar antes de vencer."
        ),
    }


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


# ===================== TOOL 9: simulacion_ahorro =====================
def simulacion_ahorro(
    tasa_deteccion_actual: float = 0.30,
    tasa_deteccion_achachai: float = 0.70,
    costo_falso_positivo_usd: float = 80,
    costo_revision_humana_usd: float = 40,
) -> dict:
    """Calcula ahorro potencial anual usando AchachAI vs deteccion manual.

    Asume:
    - Tasa deteccion actual (sin AI): 30% (industria)
    - Tasa con AchachAI: 70% (modelo + reglas)
    - Cada caso revisado por humano: $40 (1 hora analista)
    - Cada falso positivo: $80 (revision profunda)

    Devuelve: monto recuperado, costo del sistema, ROI.
    """
    con = _con()
    siniestros = con.execute("SELECT * FROM siniestros").df()
    n_total = len(siniestros)
    n_fraudes = int(siniestros["etiqueta_fraude_simulada"].sum())
    monto_total_fraudes = float(
        siniestros[siniestros["etiqueta_fraude_simulada"] == 1]["monto_reclamado_usd"].sum()
    )

    # Calculos
    recuperacion_actual = monto_total_fraudes * tasa_deteccion_actual
    recuperacion_achachai = monto_total_fraudes * tasa_deteccion_achachai
    delta_recuperacion = recuperacion_achachai - recuperacion_actual

    # Costo operativo (Azure ML endpoint + Foundry + Doc Intelligence)
    costo_azure_anual = 12 * 200  # ~$200/mes en produccion

    # Costos de revision: si revisamos top 30% como rojos, son n_total*0.30 casos a $40 c/u
    casos_a_revisar = int(n_total * 0.20)  # 20% top score
    costo_revisiones = casos_a_revisar * costo_revision_humana_usd
    # De esos, los falsos positivos cuestan extra
    falsos_pos = int(casos_a_revisar * 0.40)  # 40% de los flageados pueden ser FP
    costo_fps = falsos_pos * costo_falso_positivo_usd

    costo_total_achachai = costo_azure_anual + costo_revisiones + costo_fps
    beneficio_neto = delta_recuperacion - costo_total_achachai
    roi = (beneficio_neto / costo_total_achachai * 100) if costo_total_achachai > 0 else 0

    return {
        "supuestos": {
            "tasa_deteccion_manual": f"{tasa_deteccion_actual*100:.0f}%",
            "tasa_deteccion_achachai": f"{tasa_deteccion_achachai*100:.0f}%",
            "costo_revision_caso_usd": costo_revision_humana_usd,
            "costo_falso_positivo_usd": costo_falso_positivo_usd,
        },
        "cartera": {
            "n_siniestros_anuales": n_total,
            "n_fraudes_estimados": n_fraudes,
            "monto_total_fraudes_usd": round(monto_total_fraudes, 0),
        },
        "escenario_actual": {
            "deteccion": "30% (manual)",
            "recuperado_anual_usd": round(recuperacion_actual, 0),
            "perdido_usd": round(monto_total_fraudes - recuperacion_actual, 0),
        },
        "escenario_achachai": {
            "deteccion": "70% (modelo + reglas + analistas)",
            "recuperado_anual_usd": round(recuperacion_achachai, 0),
            "perdido_usd": round(monto_total_fraudes - recuperacion_achachai, 0),
        },
        "ahorro": {
            "delta_recuperacion_usd": round(delta_recuperacion, 0),
            "costo_total_sistema_usd": round(costo_total_achachai, 0),
            "beneficio_neto_anual_usd": round(beneficio_neto, 0),
            "roi_pct": round(roi, 0),
            "payback_meses": round(costo_total_achachai / max(delta_recuperacion/12, 1), 1),
        },
        "mensaje_ejecutivo": (
            f"AchachAI puede recuperar {round(delta_recuperacion):,} USD adicionales/año "
            f"vs detección manual, con un ROI de {round(roi)}% y payback de "
            f"{round(costo_total_achachai / max(delta_recuperacion/12, 1), 1)} meses."
        ),
    }


# ===================== TOOL 10: exportar_reporte =====================
def exportar_reporte(nivel: str = "ROJO", limit: int = 50) -> dict:
    """Genera reporte de auditoria con casos del nivel especificado.

    Devuelve datos listos para exportar a CSV/PDF.
    """
    from src.rules import build_contexto, evaluate_siniestro
    con = _con()
    siniestros = con.execute("SELECT * FROM siniestros").df()
    proveedores = con.execute("SELECT * FROM proveedores").df()
    pol = con.execute("SELECT * FROM polizas").df().set_index("id_poliza")
    ase = con.execute("SELECT * FROM asegurados").df().set_index("id_asegurado")
    veh = con.execute("SELECT * FROM vehiculos").df().set_index("id_vehiculo")
    prov_idx = proveedores.set_index("id_proveedor")
    cond = con.execute("SELECT * FROM conductores").df().set_index("id_conductor")
    docs = con.execute("SELECT * FROM documentos").df()
    docs_por = docs.groupby("id_siniestro").apply(lambda d: d.to_dict("records"),
                                                    include_groups=False).to_dict()

    sim_path = PROC / "similitudes.parquet"
    sim_df = None
    if sim_path.exists():
        _tmp = pd.read_parquet(sim_path)
        if "sim_topk" in _tmp.columns:
            sim_df = _tmp
    ctx = build_contexto(siniestros, proveedores, similitudes_df=sim_df)

    # Sample para no evaluar 25K
    sample = siniestros.sample(min(3000, len(siniestros)), random_state=42)
    resultados = []
    for _, sin in sample.iterrows():
        try:
            r = evaluate_siniestro(
                siniestro=sin.to_dict(),
                poliza=pol.loc[sin["id_poliza"]].to_dict() | {"id_poliza": sin["id_poliza"]},
                asegurado=ase.loc[sin["id_asegurado"]].to_dict() | {"id_asegurado": sin["id_asegurado"]},
                vehiculo=veh.loc[sin["id_vehiculo"]].to_dict() | {"id_vehiculo": sin["id_vehiculo"]},
                proveedor=prov_idx.loc[sin["id_proveedor"]].to_dict() | {"id_proveedor": sin["id_proveedor"]},
                conductor=cond.loc[sin["id_conductor"]].to_dict() | {"id_conductor": sin["id_conductor"]},
                documentos=docs_por.get(sin["id_siniestro"], []),
                ctx=ctx,
            )
            if r["nivel"] == nivel.upper():
                resultados.append({
                    "id_siniestro": sin["id_siniestro"],
                    "fecha_ocurrencia": str(sin["fecha_ocurrencia"]),
                    "cobertura": sin["cobertura"],
                    "monto_reclamado_usd": float(sin["monto_reclamado_usd"]),
                    "ciudad": sin["ciudad_evento"],
                    "score": r["score"],
                    "nivel": r["nivel"],
                    "reglas_disparadas": ", ".join(reg["codigo"] for reg in r["reglas_criticas"]),
                    "n_senales": len(r["senales_activadas"]),
                    "explicacion": r["explicacion_corta"],
                })
        except Exception:
            continue
        if len(resultados) >= limit:
            break

    return {
        "filtro_nivel": nivel,
        "n_casos": len(resultados),
        "fecha_generacion": pd.Timestamp.now().isoformat(),
        "casos": resultados,
    }


# ===================== TOOL 11: anomalias_novedosas (IsolationForest) =====================
_ANOM_TOOL_CACHE: dict = {"items": None, "ts": 0.0, "contamination": None}


def anomalias_novedosas(top_n: int = 10, contamination: float = 0.02,
                          solo_novedosos: bool = True) -> dict:
    """Detecta siniestros estadisticamente raros con IsolationForest no supervisado.

    DIFERENCIA con top_riesgo: top_riesgo usa reglas + XGBoost (lo que SI sabemos
    que es fraude). Esto detecta PATRONES NUEVOS que el supervisado no vio.
    Util cuando el analista pregunta '¿que casos raros aparecieron que aun no marcamos?'.

    Args:
      top_n: cuantos casos devolver
      contamination: fraccion esperada de outliers (0.005-0.10, default 0.02)
      solo_novedosos: si True, filtra los que NO tienen etiqueta_fraude ni son inyectados
    """
    import time
    now = time.time()
    TTL = 600  # 10 min

    if (_ANOM_TOOL_CACHE["items"] is not None
            and _ANOM_TOOL_CACHE["contamination"] == contamination
            and now - _ANOM_TOOL_CACHE["ts"] < TTL):
        items = _ANOM_TOOL_CACHE["items"]
    else:
        try:
            from sklearn.ensemble import IsolationForest
            from sklearn.preprocessing import StandardScaler
        except ImportError:
            return {"error": "scikit-learn no esta instalado"}

        # Intentar cargar modelo persistido
        import joblib
        runs = PROC.parent.parent / "runs" / "local"
        model_path = runs / "iforest.pkl"
        use_persisted = (
            model_path.exists()
            and (runs / "iforest_scaler.pkl").exists()
            and (runs / "iforest_columns.json").exists()
        )

        con = _con()
        df = con.execute("""
            SELECT id_siniestro, monto_reclamado_usd, monto_pagado_usd,
                   dias_desde_inicio_poliza, dias_desde_fin_poliza,
                   dias_entre_ocurrencia_reporte, historial_siniestros_asegurado,
                   cobertura, ciudad_evento, sucursal, id_proveedor,
                   documentos_completos, tuvo_parte_policial, tuvo_testigo,
                   fault_responsable, etiqueta_fraude_simulada, caso_inyectado
            FROM siniestros
        """).df()

        num_vars = ["monto_reclamado_usd", "monto_pagado_usd",
                    "dias_desde_inicio_poliza", "dias_desde_fin_poliza",
                    "dias_entre_ocurrencia_reporte", "historial_siniestros_asegurado"]
        bool_cols = ["documentos_completos", "tuvo_parte_policial", "tuvo_testigo"]
        Xnum = df[num_vars].fillna(df[num_vars].median())
        Xbool = pd.DataFrame({f"b_{b}": df[b].astype(int) for b in bool_cols})
        Xstr = pd.get_dummies(df["fault_responsable"], prefix="fault_responsable").astype(int)
        Xcob = pd.get_dummies(df["cobertura"], prefix="cob").astype(int)
        X = pd.concat([Xnum, Xbool, Xstr, Xcob], axis=1)

        if use_persisted:
            import json as _json
            cols_ref = _json.loads((runs / "iforest_columns.json").read_text(encoding="utf-8"))
            X = X.reindex(columns=cols_ref, fill_value=0)
            scaler = joblib.load(runs / "iforest_scaler.pkl")
            mdl = joblib.load(model_path)
            Xs = scaler.transform(X)
        else:
            scaler = StandardScaler()
            Xs = scaler.fit_transform(X)
            mdl = IsolationForest(
                n_estimators=200, contamination=float(contamination),
                random_state=42, n_jobs=-1,
            ).fit(Xs)

        scores = -mdl.score_samples(Xs)
        outliers = mdl.predict(Xs) == -1
        df["anomaly_score"] = scores
        df["outlier"] = outliers
        df_out = df[outliers].sort_values("anomaly_score", ascending=False).head(60)

        medianas = X.median()
        iqr = (X.quantile(0.75) - X.quantile(0.25)).replace(0, 1)
        num_set = set(num_vars)
        items = []
        for _, r in df_out.iterrows():
            x_row = X.loc[r.name]
            z = ((x_row - medianas).abs() / iqr).sort_values(ascending=False)
            razones = []
            for f in z.head(3).index:
                if f in num_set:
                    razones.append(f"{f}={r[f]:.0f} (mediana={medianas[f]:.0f})")
                else:
                    razones.append(f"{f}={int(x_row[f])}")
            items.append({
                "id_siniestro": r["id_siniestro"],
                "anomaly_score": round(float(r["anomaly_score"]), 3),
                "cobertura": r["cobertura"],
                "ciudad": r["ciudad_evento"],
                "sucursal": r["sucursal"],
                "id_proveedor": r["id_proveedor"],
                "monto_reclamado_usd": float(r["monto_reclamado_usd"]),
                "razones": razones,
                "etiqueta_fraude_simulada": int(r["etiqueta_fraude_simulada"]),
                "caso_inyectado": bool(r["caso_inyectado"]),
                "novedoso": (not bool(r["caso_inyectado"]) and int(r["etiqueta_fraude_simulada"]) == 0),
            })
        _ANOM_TOOL_CACHE["items"] = items
        _ANOM_TOOL_CACHE["contamination"] = contamination
        _ANOM_TOOL_CACHE["ts"] = now

    if solo_novedosos:
        filtrados = [it for it in items if it["novedoso"]]
    else:
        filtrados = items

    return {
        "modelo": "IsolationForest (no supervisado)",
        "total_outliers": len(items),
        "novedosos": sum(1 for it in items if it["novedoso"]),
        "casos_devueltos": filtrados[:top_n],
        "contamination": contamination,
        "nota": "Los casos NOVEDOSOS son outliers sin etiqueta de fraude y no inyectados — patrones que el supervisado no ve.",
    }


# ===================== TOOL 12: evaluar_caso_hipotetico =====================
def evaluar_caso_hipotetico(
    cobertura: str = "Choque",
    monto_reclamado_usd: float = 5000,
    monto_pagado_usd: float = 0,
    suma_asegurada_usd: float = 15000,
    dias_desde_inicio_poliza: int = 60,
    dias_desde_fin_poliza: int = 305,
    dias_entre_ocurrencia_reporte: int = 1,
    historial_siniestros_asegurado: int = 0,
    documentos_completos: bool = True,
    tuvo_parte_policial: bool = True,
    tuvo_testigo: bool = False,
    fault_responsable: bool = True,
    estado: str = "Reserva",
    ciudad_evento: str = "Quito",
    sucursal: str = "Quito",
    proveedor_en_lista_restrictiva: bool = False,
    proveedor_tipo: str = "Taller",
    descripcion: str = "Caso hipotetico evaluado desde el chat",
) -> dict:
    """Evalua un siniestro HIPOTETICO (sin persistir) y devuelve score + nivel + reglas + senales.

    Para preguntas tipo: 'evalua un caso de Robo de $15K con 6 dias de reporte tardio'.
    """
    from src.rules import build_contexto, evaluate_siniestro

    sin = {
        "id_siniestro": "SIN-HIPOTETICO",
        "id_poliza": "POL-HIP", "id_asegurado": "ASE-HIP",
        "id_vehiculo": "VEH-HIP", "id_proveedor": "PRV-HIP", "id_conductor": "CON-HIP",
        "ramo": "Vehiculos", "cobertura": cobertura,
        "fecha_ocurrencia": pd.Timestamp.now().strftime("%Y-%m-%d"),
        "fecha_reporte": pd.Timestamp.now().strftime("%Y-%m-%d"),
        "monto_reclamado_usd": monto_reclamado_usd,
        "monto_estimado_usd": monto_reclamado_usd,
        "monto_pagado_usd": monto_pagado_usd,
        "estado": estado, "sucursal": sucursal, "ciudad_evento": ciudad_evento,
        "descripcion": descripcion,
        "documentos_completos": documentos_completos,
        "tipo_beneficiario": proveedor_tipo,
        "dias_desde_inicio_poliza": dias_desde_inicio_poliza,
        "dias_desde_fin_poliza": dias_desde_fin_poliza,
        "dias_entre_ocurrencia_reporte": dias_entre_ocurrencia_reporte,
        "historial_siniestros_asegurado": historial_siniestros_asegurado,
        "tuvo_parte_policial": tuvo_parte_policial,
        "tuvo_testigo": tuvo_testigo,
        "fault_responsable": fault_responsable,
        "etiqueta_fraude_simulada": 0, "caso_inyectado": False,
    }
    pol = {"id_poliza": "POL-HIP", "suma_asegurada_usd": suma_asegurada_usd,
           "prima_usd": suma_asegurada_usd * 0.04,
           "deducible_usd": suma_asegurada_usd * 0.02}
    ase = {"id_asegurado": "ASE-HIP", "segmento": "Personas",
           "reclamos_ultimos_12_meses": historial_siniestros_asegurado,
           "score_cliente_simulado": 700}
    veh = {"id_vehiculo": "VEH-HIP", "marca": "—", "modelo": "—", "anio_vehiculo": 2020}
    prov = {"id_proveedor": "PRV-HIP", "nombre": "Proveedor hipotetico",
            "tipo": proveedor_tipo, "ciudad": sucursal,
            "lista_restrictiva": proveedor_en_lista_restrictiva}
    cond = {"id_conductor": "CON-HIP", "edad": 35, "anios_licencia": 10}

    ctx = build_contexto(pd.DataFrame([sin]), pd.DataFrame([prov]))
    r = evaluate_siniestro(
        siniestro=sin, poliza=pol, asegurado=ase, vehiculo=veh,
        proveedor=prov, conductor=cond, documentos=[], ctx=ctx,
    )
    return {
        "modelo": "Evaluacion en vivo (reglas + 14 senales)",
        "input_resumido": (
            f"{cobertura} · USD {monto_reclamado_usd:,.0f} · "
            f"{dias_entre_ocurrencia_reporte}d para reportar · "
            f"{historial_siniestros_asegurado} siniestros previos del asegurado"
        ),
        "score": r["score"],
        "nivel": r["nivel"],
        "reglas_criticas_activadas": r["reglas_criticas"],
        "senales_activadas": r["senales_activadas"],
        "puntos_totales_senales": r["puntos_totales_senales"],
        "explicacion": r["explicacion_corta"],
        "accion_sugerida": (
            "Bloquear pago + comite antifraude" if r["nivel"] == "ROJO"
            else "Retener pago + pedir docs adicionales" if r["nivel"] == "AMARILLO"
            else "Continuar flujo normal"
        ),
    }


# ===================== TOOL 13: generar_reporte_pdf =====================
def generar_reporte_pdf(
    tipo: str = "ejecutivo",
    nivel: str = "ROJO",
    limit: int = 20,
) -> dict:
    """Genera un reporte PDF descargable. Devuelve la URL al endpoint que renderiza el HTML
    imprimible (Ctrl+P -> Guardar como PDF).

    Tipos soportados: ejecutivo, antifraude, auditoria, directorio.
    Cuando el usuario pide cosas como 'generame el reporte del comite antifraude' o
    'descargame el resumen ejecutivo', llama a esta tool con el tipo apropiado.
    """
    tipos_validos = ["ejecutivo", "antifraude", "auditoria", "directorio"]
    if tipo not in tipos_validos:
        tipo = "ejecutivo"
    niveles_validos = ["VERDE", "AMARILLO", "ROJO"]
    if nivel not in niveles_validos:
        nivel = "ROJO"

    titulos = {
        "ejecutivo":  "Resumen Ejecutivo",
        "antifraude": "Reporte Comité Antifraude",
        "auditoria":  "Reporte Auditoría Interna",
        "directorio": "Briefing al Directorio",
    }
    audiencias = {
        "ejecutivo":  "Gerencia · Directorio",
        "antifraude": "Comité Antifraude · Investigadores",
        "auditoria":  "Auditoría · SBS · Compliance",
        "directorio": "Junta Directiva",
    }

    # URL relativa al backend — el frontend la convierte en URL completa
    url_pdf = f"/reportes/pdf?tipo={tipo}&nivel={nivel}&limit={limit}&autoprint=1"

    return {
        "tipo": tipo,
        "titulo": titulos[tipo],
        "nivel_casos": nivel,
        "audiencia": audiencias[tipo],
        "url_descarga": url_pdf,
        "instrucciones": (
            f"Reporte '{titulos[tipo]}' (nivel {nivel}) generado. "
            f"Click en el link de descarga abre el HTML listo para imprimir. "
            f"En el dialogo de impresion elegi 'Guardar como PDF' como destino."
        ),
        "nota_ui": "REPORTE_PDF_LINK",  # flag para que el frontend renderice un boton
    }


TOOLS_REGISTRY: dict[str, Any] = {
    "top_riesgo": top_riesgo,
    "detalle_siniestro": detalle_siniestro,
    "ranking_proveedores": ranking_proveedores,
    "ranking_ciudades": ranking_ciudades,
    "asegurados_recurrentes": asegurados_recurrentes,
    "docs_faltantes": docs_faltantes,
    "siniestros_borde_vigencia": siniestros_borde_vigencia,
    "montos_atipicos": montos_atipicos,
    "estadisticas_por_cobertura": estadisticas_por_cobertura,
    "simulacion_ahorro": simulacion_ahorro,
    "exportar_reporte": exportar_reporte,
    "anomalias_novedosas": anomalias_novedosas,
    "evaluar_caso_hipotetico": evaluar_caso_hipotetico,
    "generar_reporte_pdf": generar_reporte_pdf,
}


# ===================== Schemas para function calling =====================
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "top_riesgo",
            "description": "Devuelve los siniestros con mayor score de posible fraude. Cuando NO se pasa nivel, devuelve ROJO + AMARILLO por default (los que requieren revision). Usar 'nivel=ROJO' solo si el usuario pide explicitamente 'solo rojos'. Soporta 3 ramos: Vehiculos, Hogar, Salud.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Cuantos casos devolver (default 10)", "default": 10},
                    "nivel": {"type": "string", "description": "Filtrar por nivel del semaforo. Acepta 'ROJO', 'AMARILLO', 'VERDE' o lista separada por coma 'ROJO,AMARILLO'. Si se omite, default = ROJO + AMARILLO."},
                    "ramo": {"type": "string", "enum": ["Vehiculos", "Vehículos", "Hogar", "Salud"], "description": "Filtrar por ramo de seguro. Para preguntas sobre hospitalizacion/clinicas/cirugia usar 'Salud'. Para incendios/daño por agua/robo en domicilio usar 'Hogar'."},
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
            "description": (
                "Siniestros con documentos faltantes, no entregados o inconsistentes. "
                "Devuelve tipos_faltantes (lista de tipos de documento no entregados) por caso. "
                "Si min_score > 0, prioriza casos sospechosos (etiqueta_fraude=1). "
                "Usar cuando preguntan: 'que documentos faltan en los casos criticos', "
                "'casos con expediente incompleto', 'documentacion pendiente'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "min_score": {
                        "type": "integer",
                        "default": 0,
                        "description": "Si >0, prioriza casos con etiqueta_fraude_simulada=1 (proxy de criticos)",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "siniestros_borde_vigencia",
            "description": (
                "Siniestros que ocurrieron MUY cerca del INICIO o del FIN de la poliza. "
                "Patron clasico de fraude: contratar seguro y siniestrar a los pocos dias "
                "(seguro de conveniencia) o siniestrar justo antes de vencer la cobertura. "
                "Usar cuando preguntan: 'que siniestros ocurrieron cerca del inicio de la poliza', "
                "'casos con poliza recien contratada', 'poliza nueva y reclamo inmediato', "
                "'reclamos antes de vencer la poliza', 'siniestros sospechosos por timing'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "dias_max_desde_inicio": {"type": "integer", "default": 30, "description": "Umbral en dias para 'borde de inicio'"},
                    "dias_max_hasta_fin": {"type": "integer", "default": 30, "description": "Umbral en dias para 'borde de fin'"},
                    "top_n": {"type": "integer", "default": 20},
                    "modo": {"type": "string", "enum": ["inicio", "fin", "ambos"], "default": "ambos"},
                },
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
    {
        "type": "function",
        "function": {
            "name": "simulacion_ahorro",
            "description": "Calcula ahorro potencial anual usando AchachAI vs deteccion manual. Devuelve ROI, payback, beneficio neto. Usar cuando preguntan por 'ahorro', 'ROI', 'impacto financiero', 'cuanto ahorrariamos', 'cuanto recuperariamos'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tasa_deteccion_actual": {"type": "number", "default": 0.30},
                    "tasa_deteccion_achachai": {"type": "number", "default": 0.70},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "exportar_reporte",
            "description": "Genera reporte de auditoria con casos del nivel especificado (VERDE/AMARILLO/ROJO). Devuelve datos listos para CSV/PDF para presentar al comite antifraude o auditoria interna.",
            "parameters": {
                "type": "object",
                "properties": {
                    "nivel": {"type": "string", "enum": ["VERDE", "AMARILLO", "ROJO"], "default": "ROJO"},
                    "limit": {"type": "integer", "default": 50},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "anomalias_novedosas",
            "description": (
                "Detecta siniestros estadisticamente RAROS via IsolationForest no supervisado. "
                "A diferencia de top_riesgo (que usa reglas + XGBoost supervisado sobre fraude conocido), "
                "esta tool encuentra PATRONES NUEVOS que aun no estan etiquetados como fraude. "
                "Usar cuando preguntan: '¿que casos raros aparecieron esta semana que aun no marcamos?', "
                "'¿hay patrones nuevos de fraude?', '¿que casos atipicos no detecta el modelo?', "
                "'descubri esquemas emergentes', 'detecta anomalias no entrenadas'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "top_n": {"type": "integer", "default": 10, "description": "Cuantos casos devolver"},
                    "contamination": {"type": "number", "default": 0.02, "description": "Fraccion esperada de outliers (0.005-0.10)"},
                    "solo_novedosos": {"type": "boolean", "default": True, "description": "Si true, filtra los outliers que NO tienen etiqueta de fraude ni son inyectados (los mas interesantes)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "evaluar_caso_hipotetico",
            "description": (
                "Evalua un siniestro HIPOTETICO en vivo sin persistirlo. Devuelve score 0-100, "
                "nivel (VERDE/AMARILLO/ROJO), reglas criticas activadas, señales activadas y accion sugerida. "
                "Usar cuando el usuario describe un caso para evaluar o pregunta 'cuanto da este caso', "
                "'evalua un siniestro de X', 'que pasa si tengo un robo de N dolares con M dias de reporte tardio', "
                "'simulame un caso con estas caracteristicas'. NO persiste al dataset — es solo simulacion."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "cobertura": {"type": "string", "enum": ["Choque","Robo","RC","Daño","Pérdida Total","Incendio"], "default": "Choque"},
                    "monto_reclamado_usd": {"type": "number", "default": 5000},
                    "monto_pagado_usd": {"type": "number", "default": 0},
                    "suma_asegurada_usd": {"type": "number", "default": 15000},
                    "dias_desde_inicio_poliza": {"type": "integer", "default": 60, "description": "Dias desde que inicio la poliza"},
                    "dias_desde_fin_poliza": {"type": "integer", "default": 305, "description": "Dias hasta que termine la poliza"},
                    "dias_entre_ocurrencia_reporte": {"type": "integer", "default": 1, "description": "Dias entre que paso el siniestro y se reporto"},
                    "historial_siniestros_asegurado": {"type": "integer", "default": 0},
                    "documentos_completos": {"type": "boolean", "default": True},
                    "tuvo_parte_policial": {"type": "boolean", "default": True},
                    "tuvo_testigo": {"type": "boolean", "default": False},
                    "fault_responsable": {"type": "boolean", "default": True},
                    "estado": {"type": "string", "default": "Reserva"},
                    "ciudad_evento": {"type": "string", "default": "Quito"},
                    "sucursal": {"type": "string", "default": "Quito"},
                    "proveedor_en_lista_restrictiva": {"type": "boolean", "default": False, "description": "Si true, dispara RF-03 ROJO"},
                    "proveedor_tipo": {"type": "string", "enum": ["Taller","Clinica","Perito","Otro"], "default": "Taller"},
                    "descripcion": {"type": "string", "default": "Caso hipotetico"},
                },
                "required": ["cobertura", "monto_reclamado_usd"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generar_reporte_pdf",
            "description": (
                "Genera un reporte PDF descargable (HTML imprimible). Usar cuando el usuario pide "
                "'generame el reporte ejecutivo', 'descargame el reporte del comite antifraude', "
                "'reporte para auditoria', 'reporte para el directorio', 'dame el PDF', etc. "
                "Devuelve la URL al HTML que el usuario puede abrir e imprimir como PDF."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "tipo": {
                        "type": "string",
                        "enum": ["ejecutivo", "antifraude", "auditoria", "directorio"],
                        "default": "ejecutivo",
                        "description": "ejecutivo=briefing 1pag GPT, antifraude=comite, auditoria=trazabilidad SBS, directorio=board",
                    },
                    "nivel": {
                        "type": "string",
                        "enum": ["VERDE", "AMARILLO", "ROJO"],
                        "default": "ROJO",
                        "description": "Nivel de los casos a incluir",
                    },
                    "limit": {"type": "integer", "default": 20},
                },
            },
        },
    },
]
