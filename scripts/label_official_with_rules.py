"""Carga los 500 casos oficiales del Excel del reto y aplica las 7 reglas RF
para asignar etiqueta_fraude_simulada de forma defendible (no asumimos nada,
solo aplicamos las reglas del PDF).

Outputs:
  data/processed/siniestros_oficial.parquet      (500 filas)
  data/processed/polizas_oficial.parquet         (500 filas)
  data/processed/asegurados_oficial.parquet      (174 filas)
  data/processed/proveedores_oficial.parquet     (33 filas)
  data/processed/documentos_oficial.parquet      (1.263 filas)

Etiquetado:
  etiqueta_fraude_simulada = 1 si activa cualquier regla CRITICA (RF-01..04)
                            o si activa >= 2 reglas AMARILLAS (RF-05..07)
                            sino 0.

Uso:
    python scripts/label_official_with_rules.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "data" / "Data set documentos evento" / "Evento Datasets_Sinteticos_Fraude_500_v2.xlsx"
OUT = ROOT / "data" / "processed"

PATRONES_IMPOSIBLES = [
    "garaje cerrado", "estacionado dentro", "candado",
    "estaba apagado", "freno de mano",
    "no presenta marcas", "sin marcas en el lado",
    "5 km/h", "5km/h", "10 km/h",
    "taller no reporta",
]


def _si_no(v) -> bool:
    if pd.isna(v): return False
    s = str(v).strip().lower()
    return s in {"si", "sí", "s", "true", "1", "yes"}


def aplicar_reglas(row: pd.Series, prov_restrictivos: set) -> dict:
    """Aplica las 7 reglas RF a una fila del oficial. Devuelve dict con reglas
    activadas y nivel (ROJO/AMARILLO/VERDE)."""
    activadas = []

    cobertura = str(row.get("Cobertura", ""))
    estado = str(row.get("Estado", ""))
    pagado = float(row.get("Monto Pagado ($)", 0) or 0)
    suma_aseg = float(row.get("Suma Asegurada ($)", 0) or 0)
    docs_completos = _si_no(row.get("Docs Completos", "Sí"))
    id_prov = str(row.get("ID Proveedor", "")).strip()
    descripcion = str(row.get("Descripción del Evento", "")).lower()
    dias_inicio = abs(int(row.get("Días desde Inicio Póliza", 999) or 999))
    dias_fin = abs(int(row.get("Días hasta Fin Póliza", 999) or 999))
    dias_oc_rep = int(row.get("Días Ocurr→Reporte", 0) or 0)
    similitud = float(row.get("Similitud Narrativa Máx.", 0) or 0)

    # RF-01: PTxRB
    if cobertura in ("Robo", "Pérdida Total"):
        if estado in ("Pago Total", "Liquidado") and suma_aseg > 0 and pagado >= 0.95 * suma_aseg:
            activadas.append(("RF-01", "ROJO"))

    # RF-02: Docs incompletos (proxy de falsificacion/adulteracion)
    if not docs_completos:
        activadas.append(("RF-02", "ROJO"))

    # RF-03: Proveedor en lista restrictiva
    if id_prov in prov_restrictivos:
        activadas.append(("RF-03", "ROJO"))

    # RF-04: Dinamica imposible
    for pat in PATRONES_IMPOSIBLES:
        if pat in descripcion:
            activadas.append(("RF-04", "ROJO"))
            break

    # RF-05: Borde de vigencia (<2 dias)
    if min(dias_inicio, dias_fin) < 2:
        activadas.append(("RF-05", "AMARILLO"))

    # RF-06: Demora denuncia robo (>4 dias)
    if cobertura == "Robo" and dias_oc_rep > 4:
        activadas.append(("RF-06", "AMARILLO"))

    # RF-07: Narrativa clonada (similitud > 0.85, umbral conservador)
    if similitud > 0.85:
        activadas.append(("RF-07", "AMARILLO"))

    rojas = [r for r, n in activadas if n == "ROJO"]
    amarillas = [r for r, n in activadas if n == "AMARILLO"]

    if rojas:
        nivel = "ROJO"
    elif len(amarillas) >= 2:
        nivel = "AMARILLO_DOBLE"
    elif amarillas:
        nivel = "AMARILLO"
    else:
        nivel = "VERDE"

    return {
        "reglas_activadas": ",".join(r for r, _ in activadas),
        "n_reglas_rojas": len(rojas),
        "n_reglas_amarillas": len(amarillas),
        "nivel_reglas": nivel,
        "etiqueta_fraude_simulada": 1 if nivel in ("ROJO", "AMARILLO_DOBLE") else 0,
    }


def main() -> int:
    print(f"[label-of] Leyendo Excel oficial: {XLSX.name}")
    of_sin = pd.read_excel(XLSX, sheet_name="1_Siniestros")
    of_pol = pd.read_excel(XLSX, sheet_name="2_Polizas")
    of_ase = pd.read_excel(XLSX, sheet_name="3_Asegurados")
    of_prov = pd.read_excel(XLSX, sheet_name="4_Proveedores")
    of_doc = pd.read_excel(XLSX, sheet_name="5_Documentos")
    print(f"[label-of]   {len(of_sin)} siniestros, {len(of_pol)} polizas, "
          f"{len(of_ase)} asegurados, {len(of_prov)} proveedores, {len(of_doc)} docs")

    # ----- proveedores -----
    of_prov = of_prov.rename(columns={c: str(c).strip() for c in of_prov.columns})
    of_prov["lista_restrictiva"] = of_prov["En Lista Restrictiva"].apply(_si_no)
    prov_restrictivos = set(of_prov.loc[of_prov["lista_restrictiva"], "ID Proveedor"].astype(str))
    print(f"[label-of]   Proveedores restrictivos: {len(prov_restrictivos)}")

    # ----- aplicar reglas a cada siniestro -----
    print("[label-of] Aplicando reglas RF a 500 casos...")
    resultados = of_sin.apply(lambda r: aplicar_reglas(r, prov_restrictivos), axis=1)
    res_df = pd.DataFrame(list(resultados))
    of_sin = pd.concat([of_sin.reset_index(drop=True), res_df.reset_index(drop=True)], axis=1)

    n_fraude = int(of_sin["etiqueta_fraude_simulada"].sum())
    print(f"[label-of]   Etiqueta fraude=1: {n_fraude} / 500 = {n_fraude/5:.1f}%")
    print(f"[label-of]   Distribucion nivel_reglas:")
    print(of_sin["nivel_reglas"].value_counts())
    print()
    print(f"[label-of]   Cruz contra Estado oficial (validacion):")
    print(pd.crosstab(of_sin["Estado"], of_sin["etiqueta_fraude_simulada"]))

    # ----- transformar a esquema nuestro -----
    print("[label-of] Mapeando al esquema nuestro...")

    # siniestros
    sin_out = pd.DataFrame({
        "id_siniestro": of_sin["ID Siniestro"].astype(str),
        "id_poliza": of_sin["ID Póliza"].astype(str),
        "id_asegurado": of_sin["ID Asegurado"].astype(str),
        "id_vehiculo": of_sin["Placa Vehículo Asegurado"].apply(
            lambda p: f"VEH-OF-{str(p).replace('-', '').upper()}" if isinstance(p, str) and p.strip() else None
        ),
        "id_proveedor": of_sin["ID Proveedor"].astype(str),
        "id_conductor": None,  # oficial no trae conductor
        "ramo": of_sin["Ramo"].astype(str),
        "cobertura": of_sin["Cobertura"].astype(str),
        "fecha_ocurrencia": pd.to_datetime(of_sin["Fecha Ocurrencia"], errors="coerce").dt.strftime("%Y-%m-%d"),
        "fecha_reporte": pd.to_datetime(of_sin["Fecha Reporte"], errors="coerce").dt.strftime("%Y-%m-%d"),
        "monto_reclamado_usd": of_sin["Monto Reclamado ($)"].astype(float),
        "monto_estimado_usd": of_sin["Monto Estimado ($)"].astype(float),
        "monto_pagado_usd": of_sin["Monto Pagado ($)"].astype(float),
        "estado": of_sin["Estado"].astype(str),
        "sucursal": of_sin["Sucursal"].astype(str),
        "ciudad_evento": of_sin["Sucursal"].astype(str),
        "descripcion": of_sin["Descripción del Evento"].astype(str),
        "documentos_completos": of_sin["Docs Completos"].apply(_si_no),
        "tipo_beneficiario": of_sin["Cobertura"].apply(
            lambda c: "Clínica" if c in ("Hospitalización", "Cirugía", "Consulta Externa",
                                          "Maternidad", "Urgencias", "Exámenes") else "Taller"
        ),
        "dias_desde_inicio_poliza": of_sin["Días desde Inicio Póliza"].astype(int),
        "dias_desde_fin_poliza": of_sin["Días hasta Fin Póliza"].astype(int),
        "dias_entre_ocurrencia_reporte": of_sin["Días Ocurr→Reporte"].astype(int),
        "historial_siniestros_asegurado": of_sin["N° Reclamos Previos Asegurado"].astype(int),
        "tuvo_parte_policial": of_sin["Número Parte Policial"].notna(),
        "tuvo_testigo": False,
        "fault_responsable": "Asegurado",
        "etiqueta_fraude_simulada": of_sin["etiqueta_fraude_simulada"].astype(int),
        "caso_inyectado": False,
    })
    sin_out.to_parquet(OUT / "siniestros_oficial.parquet", index=False)
    print(f"[label-of]   -> siniestros_oficial.parquet ({len(sin_out)} filas)")

    # polizas
    pol_out = pd.DataFrame({
        "id_poliza": of_pol["ID Póliza"].astype(str),
        "id_asegurado": of_pol["ID Asegurado"].astype(str),
        "ramo": of_pol["Ramo"].astype(str),
        "fecha_inicio": pd.to_datetime(of_pol["Fecha Inicio"], errors="coerce").dt.strftime("%Y-%m-%d"),
        "fecha_fin": pd.to_datetime(of_pol["Fecha Fin"], errors="coerce").dt.strftime("%Y-%m-%d"),
        "prima_usd": of_pol["Prima Anual ($)"].astype(float),
        "suma_asegurada_usd": of_pol["Suma Asegurada ($)"].astype(float),
        "deducible_usd": (of_pol["Suma Asegurada ($)"].astype(float) * 0.025).round(2),
        "canal_venta": of_pol["Canal Venta"].astype(str),
        "ciudad": "Quito",  # no viene; default
        "estado_poliza": of_pol["Estado Póliza"].astype(str),
        "tipo_cobertura": of_pol["Ramo"].astype(str),  # placeholder
    })
    pol_out.to_parquet(OUT / "polizas_oficial.parquet", index=False)
    print(f"[label-of]   -> polizas_oficial.parquet ({len(pol_out)} filas)")

    # asegurados
    ase_out = pd.DataFrame({
        "id_asegurado": of_ase["ID Asegurado"].astype(str),
        "segmento": of_ase["Segmento"].astype(str),
        "antiguedad_anios": of_ase["Antigüedad (años)"].astype(int),
        "ciudad": of_ase["Ciudad"].astype(str),
        "num_polizas": of_ase["N° Pólizas Activas"].astype(int),
        "reclamos_ultimos_12_meses": of_ase["N° Reclamos Últimos 12 Meses"].astype(int),
        "mora_actual": False,
        "score_cliente_simulado": of_ase["Perfil Riesgo Histórico"].map(
            {"Bajo": 780, "Medio": 620, "Alto": 460}).fillna(600).astype(int),
    })
    ase_out.to_parquet(OUT / "asegurados_oficial.parquet", index=False)
    print(f"[label-of]   -> asegurados_oficial.parquet ({len(ase_out)} filas)")

    # proveedores
    prov_out = pd.DataFrame({
        "id_proveedor": of_prov["ID Proveedor"].astype(str),
        "nombre": of_prov["Nombre Proveedor"].astype(str),
        "tipo": of_prov["Tipo"].astype(str),
        "ciudad": of_prov["Ciudad"].astype(str),
        "antiguedad_anios": 5,
        "lista_restrictiva": of_prov["lista_restrictiva"],
        "reclamos_asociados": of_prov["N° Siniestros Asociados"].astype(int),
        "porcentaje_casos_observados": 0,
        "monto_promedio_reclamado_usd": pd.to_numeric(
            of_prov["Promedio Monto ($)"], errors="coerce").fillna(0).astype(float),
    })
    prov_out.to_parquet(OUT / "proveedores_oficial.parquet", index=False)
    print(f"[label-of]   -> proveedores_oficial.parquet ({len(prov_out)} filas)")

    # documentos
    doc_out = pd.DataFrame({
        "id_documento": of_doc["ID Documento"].astype(str),
        "id_siniestro": of_doc["ID Siniestro"].astype(str),
        "tipo_documento": of_doc["Tipo Documento"].astype(str),
        "entregado": True,
        "legible": True,
        "fecha_emision": None,
        "inconsistencia_detectada": False,  # oficial no trae flag
        "observacion": None,
    })
    doc_out.to_parquet(OUT / "documentos_oficial.parquet", index=False)
    print(f"[label-of]   -> documentos_oficial.parquet ({len(doc_out)} filas)")

    print()
    print("[label-of] DONE - todos los parquets oficiales escritos en data/processed/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
