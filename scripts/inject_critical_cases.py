"""
inject_critical_cases.py - Inyecta ~40 casos extremos para que las reglas
criticas RF-01..RF-05 disparen ROJO de forma evidente en la demo.

Lee:   data/processed/{siniestros,polizas,asegurados,vehiculos,proveedores,conductores,documentos}.parquet
Escribe (sobreescribe):
  data/processed/siniestros.parquet         (+ casos inyectados, flag caso_inyectado=True)
  data/processed/polizas.parquet            (+ polizas nuevas)
  data/processed/vehiculos.parquet          (+ vehiculos nuevos)
  data/processed/conductores.parquet        (+ conductores nuevos)
  data/processed/documentos.parquet         (+ documentos nuevos con inconsistencias)
  data/processed/proveedores.parquet        (marca 2 mas en lista_restrictiva si hace falta)
  data/synthetic/casos_criticos.parquet     (solo los inyectados, para auditoria)

Distribucion:
  10 x RF-01 (PTxRB: cobertura=Robo, Pago Total, pagado>=95% suma_asegurada)
   8 x RF-02 (Factura con fecha_emision anterior al evento + inconsistencia)
   8 x RF-03 (Proveedor en lista_restrictiva)
   6 x RF-04 (Narrativa imposible)
   8 x RF-05 (Siniestro < 48 hrs despues del inicio de poliza)

Total ~40 casos. Todos con etiqueta_fraude_simulada=1 y caso_inyectado=True.

Uso:
    python scripts/inject_critical_cases.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
SYN = ROOT / "data" / "synthetic"
RNG = np.random.default_rng(2026)


CIUDADES = ["Guayaquil", "Quito", "Cuenca", "Manta", "Machala", "Ambato", "Ibarra"]
MARCAS = [("Toyota","Hilux"), ("Chevrolet","Sail"), ("Kia","Sportage"),
          ("Mazda","CX-5"), ("Hyundai","Tucson"), ("Honda","CR-V"),
          ("Nissan","Frontier"), ("Ford","Escape")]
SEGMENTOS = ["Premium", "Estandar", "Joven"]


def log(msg: str) -> None:
    print(f"[inject] {msg}")


def new_id(prefix: str, idx: int) -> str:
    """IDs inyectados comienzan en 900000 para distinguirlos visualmente."""
    return f"{prefix}-{900000 + idx:07d}" if prefix != "DOC" else f"DOC-{99000000 + idx:08d}"


def base_vehiculo(i: int) -> dict:
    marca, modelo = MARCAS[i % len(MARCAS)]
    return {
        "id_vehiculo": new_id("VEH", i),
        "placa": f"INY-{i:04d}",
        "chasis": f"INYCH{i:013d}"[:17],
        "motor": f"INYM{i:09d}",
        "marca": marca,
        "modelo": modelo,
        "anio_vehiculo": int(RNG.integers(2015, 2024)),
        "categoria": RNG.choice(["Sport", "SUV", "Sedan", "Pickup"]),
        "valor_comercial_usd": float(RNG.integers(12_000, 45_000)),
    }


def base_asegurado(i: int) -> dict:
    return {
        "id_asegurado": new_id("ASE", i),
        "segmento": RNG.choice(SEGMENTOS),
        "antiguedad_anios": int(RNG.integers(0, 15)),
        "ciudad": RNG.choice(CIUDADES),
        "num_polizas": int(RNG.integers(1, 4)),
        "reclamos_ultimos_12_meses": int(RNG.integers(0, 4)),
        "mora_actual": bool(RNG.random() < 0.15),
        "score_cliente_simulado": int(RNG.integers(300, 850)),
    }


def base_conductor(i: int, id_vehiculo: str) -> dict:
    edad = int(RNG.integers(18, 70))
    return {
        "id_conductor": new_id("CON", i),
        "id_vehiculo": id_vehiculo,
        "nombre_seudonimo": f"Conductor Inyectado #{i:03d}",
        "edad": edad,
        "genero": RNG.choice(["M", "F"]),
        "anios_licencia": max(0, edad - int(RNG.integers(18, 22))),
        "infracciones_previas": int(RNG.poisson(1.0)),
        "siniestros_18m": 1,
    }


def base_poliza(i: int, id_asegurado: str, ciudad: str, fecha_inicio: str,
                fecha_fin: str, suma_asegurada: float, prima: float) -> dict:
    return {
        "id_poliza": new_id("POL", i),
        "id_asegurado": id_asegurado,
        "ramo": "Vehiculos",
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "prima_usd": round(prima, 2),
        "suma_asegurada_usd": round(suma_asegurada, 2),
        "deducible_usd": round(suma_asegurada * 0.025, 2),
        "canal_venta": RNG.choice(["Web", "Banca seguros", "Broker", "Venta directa"]),
        "ciudad": ciudad,
        "estado_poliza": "Vigente",
        "tipo_cobertura": RNG.choice(["Collision", "Liability", "Comprehensive"]),
    }


def build_siniestro(i: int, *, cobertura: str, estado: str, descripcion: str,
                    fecha_ocurrencia: str, fecha_reporte: str,
                    monto_reclamado: float, monto_estimado: float, monto_pagado: float,
                    id_poliza: str, id_asegurado: str, id_vehiculo: str,
                    id_proveedor: str, id_conductor: str,
                    ciudad: str, dias_inicio_poliza: int, dias_fin_poliza: int,
                    dias_oc_reporte: int, doc_completos: bool,
                    tuvo_parte: bool, tuvo_testigo: bool,
                    fault: str, regla_objetivo: str) -> dict:
    return {
        "id_siniestro": new_id("SIN", i),
        "id_poliza": id_poliza,
        "id_asegurado": id_asegurado,
        "id_vehiculo": id_vehiculo,
        "id_proveedor": id_proveedor,
        "id_conductor": id_conductor,
        "ramo": "Vehiculos",
        "cobertura": cobertura,
        "fecha_ocurrencia": fecha_ocurrencia,
        "fecha_reporte": fecha_reporte,
        "monto_reclamado_usd": round(monto_reclamado, 2),
        "monto_estimado_usd": round(monto_estimado, 2),
        "monto_pagado_usd": round(monto_pagado, 2),
        "estado": estado,
        "sucursal": ciudad,
        "ciudad_evento": ciudad,
        "descripcion": descripcion + f" [INYECTADO: {regla_objetivo}]",
        "documentos_completos": bool(doc_completos),
        "tipo_beneficiario": "Taller",
        "dias_desde_inicio_poliza": int(dias_inicio_poliza),
        "dias_desde_fin_poliza": int(dias_fin_poliza),
        "dias_entre_ocurrencia_reporte": int(dias_oc_reporte),
        "historial_siniestros_asegurado": int(RNG.integers(0, 4)),
        "tuvo_parte_policial": bool(tuvo_parte),
        "tuvo_testigo": bool(tuvo_testigo),
        "fault_responsable": fault,
        "etiqueta_fraude_simulada": 1,
    }


def build_docs(i_base: int, id_siniestro: str, fecha_ocurrencia: str,
               *, factura_anterior_al_evento: bool = False,
               denuncia_falta: bool = False) -> list[dict]:
    """Genera docs base + opcionalmente uno con fecha previa al evento."""
    fecha_oc = pd.to_datetime(fecha_ocurrencia)
    docs = []
    # Factura
    if factura_anterior_al_evento:
        fecha_fac = (fecha_oc - pd.Timedelta(days=int(RNG.integers(5, 20)))).strftime("%Y-%m-%d")
        docs.append({
            "id_documento": new_id("DOC", i_base + 1),
            "id_siniestro": id_siniestro,
            "tipo_documento": "Factura",
            "entregado": True, "legible": True,
            "fecha_emision": fecha_fac,
            "inconsistencia_detectada": True,
            "observacion": "Factura emitida ANTES del evento",
        })
    else:
        docs.append({
            "id_documento": new_id("DOC", i_base + 1),
            "id_siniestro": id_siniestro,
            "tipo_documento": "Factura",
            "entregado": True, "legible": True,
            "fecha_emision": (fecha_oc + pd.Timedelta(days=int(RNG.integers(1, 7)))).strftime("%Y-%m-%d"),
            "inconsistencia_detectada": False, "observacion": None,
        })
    # Foto
    docs.append({
        "id_documento": new_id("DOC", i_base + 2),
        "id_siniestro": id_siniestro,
        "tipo_documento": "Foto",
        "entregado": True, "legible": True,
        "fecha_emision": (fecha_oc + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
        "inconsistencia_detectada": False, "observacion": None,
    })
    # Denuncia (opcional faltante)
    docs.append({
        "id_documento": new_id("DOC", i_base + 3),
        "id_siniestro": id_siniestro,
        "tipo_documento": "Denuncia",
        "entregado": not denuncia_falta, "legible": not denuncia_falta,
        "fecha_emision": (fecha_oc + pd.Timedelta(days=2)).strftime("%Y-%m-%d") if not denuncia_falta else None,
        "inconsistencia_detectada": False,
        "observacion": "Denuncia no entregada" if denuncia_falta else None,
    })
    return docs


# --------- Generadores por regla ----------
def gen_rf01_ptxrb(n: int, start_idx: int, prov_normales: list[str]):
    """Perdida Total por Robo: cobertura=Robo, estado=Pago Total, pagado>=95% suma_asegurada."""
    siniestros, polizas, asegurados, vehiculos, conductores, docs = [], [], [], [], [], []
    for k in range(n):
        i = start_idx + k
        suma_aseg = float(RNG.integers(15_000, 40_000))
        prima = round(suma_aseg * 0.045, 2)
        fecha_ini = pd.Timestamp("2024-01-01") + pd.Timedelta(days=int(RNG.integers(0, 300)))
        fecha_fin = fecha_ini + pd.Timedelta(days=365)
        fecha_oc = fecha_ini + pd.Timedelta(days=int(RNG.integers(60, 300)))
        fecha_rep = fecha_oc + pd.Timedelta(days=int(RNG.integers(1, 4)))
        ciudad = RNG.choice(CIUDADES)

        veh = base_vehiculo(i); vehiculos.append(veh)
        ase = base_asegurado(i); ase["ciudad"] = ciudad; asegurados.append(ase)
        con = base_conductor(i, veh["id_vehiculo"]); conductores.append(con)
        pol = base_poliza(i, ase["id_asegurado"], ciudad,
                          fecha_ini.strftime("%Y-%m-%d"), fecha_fin.strftime("%Y-%m-%d"),
                          suma_aseg, prima); polizas.append(pol)

        pagado = suma_aseg * float(RNG.uniform(0.96, 1.00))
        reclamado = suma_aseg * 1.0
        sin = build_siniestro(
            i, cobertura="Robo", estado="Pago Total",
            descripcion="Robo total del vehiculo en zona urbana. Se reporta como perdida total.",
            fecha_ocurrencia=fecha_oc.strftime("%Y-%m-%d"),
            fecha_reporte=fecha_rep.strftime("%Y-%m-%d"),
            monto_reclamado=reclamado, monto_estimado=reclamado,
            monto_pagado=pagado, id_poliza=pol["id_poliza"],
            id_asegurado=ase["id_asegurado"], id_vehiculo=veh["id_vehiculo"],
            id_proveedor=RNG.choice(prov_normales), id_conductor=con["id_conductor"],
            ciudad=ciudad, dias_inicio_poliza=(fecha_oc - fecha_ini).days,
            dias_fin_poliza=(fecha_fin - fecha_oc).days,
            dias_oc_reporte=(fecha_rep - fecha_oc).days,
            doc_completos=True, tuvo_parte=True, tuvo_testigo=False,
            fault="Asegurado", regla_objetivo="RF-01 PTxRB",
        )
        siniestros.append(sin)
        docs.extend(build_docs(i * 10, sin["id_siniestro"], sin["fecha_ocurrencia"]))
    return siniestros, polizas, asegurados, vehiculos, conductores, docs


def gen_rf02_falsificacion(n: int, start_idx: int, prov_normales: list[str]):
    """Factura con fecha_emision ANTES del evento (alteracion confirmada)."""
    siniestros, polizas, asegurados, vehiculos, conductores, docs = [], [], [], [], [], []
    for k in range(n):
        i = start_idx + k
        suma_aseg = float(RNG.integers(10_000, 35_000))
        prima = round(suma_aseg * 0.04, 2)
        fecha_ini = pd.Timestamp("2024-02-01") + pd.Timedelta(days=int(RNG.integers(0, 250)))
        fecha_fin = fecha_ini + pd.Timedelta(days=365)
        fecha_oc = fecha_ini + pd.Timedelta(days=int(RNG.integers(30, 250)))
        fecha_rep = fecha_oc + pd.Timedelta(days=int(RNG.integers(2, 8)))
        ciudad = RNG.choice(CIUDADES)

        veh = base_vehiculo(i); vehiculos.append(veh)
        ase = base_asegurado(i); ase["ciudad"] = ciudad; asegurados.append(ase)
        con = base_conductor(i, veh["id_vehiculo"]); conductores.append(con)
        pol = base_poliza(i, ase["id_asegurado"], ciudad,
                          fecha_ini.strftime("%Y-%m-%d"), fecha_fin.strftime("%Y-%m-%d"),
                          suma_aseg, prima); polizas.append(pol)

        reclamado = float(RNG.integers(3_000, 12_000))
        sin = build_siniestro(
            i, cobertura="Choque", estado="Reserva",
            descripcion="Colision en parqueadero, danos en costado y puerta. Se anexan facturas de reparacion previa.",
            fecha_ocurrencia=fecha_oc.strftime("%Y-%m-%d"),
            fecha_reporte=fecha_rep.strftime("%Y-%m-%d"),
            monto_reclamado=reclamado, monto_estimado=reclamado*0.9, monto_pagado=0,
            id_poliza=pol["id_poliza"], id_asegurado=ase["id_asegurado"],
            id_vehiculo=veh["id_vehiculo"], id_proveedor=RNG.choice(prov_normales),
            id_conductor=con["id_conductor"], ciudad=ciudad,
            dias_inicio_poliza=(fecha_oc - fecha_ini).days,
            dias_fin_poliza=(fecha_fin - fecha_oc).days,
            dias_oc_reporte=(fecha_rep - fecha_oc).days,
            doc_completos=True, tuvo_parte=False, tuvo_testigo=False,
            fault="Asegurado", regla_objetivo="RF-02 Falsificacion documental",
        )
        siniestros.append(sin)
        docs.extend(build_docs(i * 10, sin["id_siniestro"], sin["fecha_ocurrencia"],
                               factura_anterior_al_evento=True))
    return siniestros, polizas, asegurados, vehiculos, conductores, docs


def gen_rf03_lista_restrictiva(n: int, start_idx: int, prov_restrictivos: list[str]):
    """Proveedor en lista restrictiva."""
    siniestros, polizas, asegurados, vehiculos, conductores, docs = [], [], [], [], [], []
    for k in range(n):
        i = start_idx + k
        suma_aseg = float(RNG.integers(10_000, 30_000))
        prima = round(suma_aseg * 0.045, 2)
        fecha_ini = pd.Timestamp("2024-03-01") + pd.Timedelta(days=int(RNG.integers(0, 200)))
        fecha_fin = fecha_ini + pd.Timedelta(days=365)
        fecha_oc = fecha_ini + pd.Timedelta(days=int(RNG.integers(40, 200)))
        fecha_rep = fecha_oc + pd.Timedelta(days=int(RNG.integers(1, 5)))
        ciudad = RNG.choice(CIUDADES)

        veh = base_vehiculo(i); vehiculos.append(veh)
        ase = base_asegurado(i); ase["ciudad"] = ciudad; asegurados.append(ase)
        con = base_conductor(i, veh["id_vehiculo"]); conductores.append(con)
        pol = base_poliza(i, ase["id_asegurado"], ciudad,
                          fecha_ini.strftime("%Y-%m-%d"), fecha_fin.strftime("%Y-%m-%d"),
                          suma_aseg, prima); polizas.append(pol)

        reclamado = float(RNG.integers(4_000, 18_000))
        sin = build_siniestro(
            i, cobertura="Choque", estado="Pago Parcial",
            descripcion="Reparacion enviada a taller de confianza del asegurado.",
            fecha_ocurrencia=fecha_oc.strftime("%Y-%m-%d"),
            fecha_reporte=fecha_rep.strftime("%Y-%m-%d"),
            monto_reclamado=reclamado, monto_estimado=reclamado*0.95, monto_pagado=reclamado*0.6,
            id_poliza=pol["id_poliza"], id_asegurado=ase["id_asegurado"],
            id_vehiculo=veh["id_vehiculo"], id_proveedor=RNG.choice(prov_restrictivos),
            id_conductor=con["id_conductor"], ciudad=ciudad,
            dias_inicio_poliza=(fecha_oc - fecha_ini).days,
            dias_fin_poliza=(fecha_fin - fecha_oc).days,
            dias_oc_reporte=(fecha_rep - fecha_oc).days,
            doc_completos=True, tuvo_parte=False, tuvo_testigo=False,
            fault="Asegurado", regla_objetivo="RF-03 Lista restrictiva",
        )
        siniestros.append(sin)
        docs.extend(build_docs(i * 10, sin["id_siniestro"], sin["fecha_ocurrencia"]))
    return siniestros, polizas, asegurados, vehiculos, conductores, docs


def gen_rf04_dinamica_imposible(n: int, start_idx: int, prov_normales: list[str]):
    """Narrativa fisicamente imposible (texto explicito para que el LLM detecte)."""
    descripciones = [
        "Vehiculo asegurado estaba estacionado dentro del garaje cerrado con candado cuando recibio colision frontal a alta velocidad.",
        "Se reporta atropello a tercero mientras el vehiculo estaba apagado y con freno de mano puesto en pendiente, sin nadie al volante.",
        "Colision lateral del vehiculo con un poste en autopista, sin embargo el vehiculo no presenta marcas en el lado afectado.",
        "Volcadura completa del vehiculo en un parqueadero a 5 km/h, con dano total estructural.",
        "Choque multiple con 3 vehiculos en avenida desierta a las 3am en domingo, sin testigos, sin camaras y sin parte policial.",
        "Incendio del motor mientras el vehiculo estaba en mantenimiento programado en un taller, pero el taller no reporta el evento.",
    ]
    siniestros, polizas, asegurados, vehiculos, conductores, docs = [], [], [], [], [], []
    for k in range(n):
        i = start_idx + k
        suma_aseg = float(RNG.integers(12_000, 35_000))
        prima = round(suma_aseg * 0.045, 2)
        fecha_ini = pd.Timestamp("2024-04-01") + pd.Timedelta(days=int(RNG.integers(0, 200)))
        fecha_fin = fecha_ini + pd.Timedelta(days=365)
        fecha_oc = fecha_ini + pd.Timedelta(days=int(RNG.integers(50, 200)))
        fecha_rep = fecha_oc + pd.Timedelta(days=int(RNG.integers(2, 10)))
        ciudad = RNG.choice(CIUDADES)

        veh = base_vehiculo(i); vehiculos.append(veh)
        ase = base_asegurado(i); ase["ciudad"] = ciudad; asegurados.append(ase)
        con = base_conductor(i, veh["id_vehiculo"]); conductores.append(con)
        pol = base_poliza(i, ase["id_asegurado"], ciudad,
                          fecha_ini.strftime("%Y-%m-%d"), fecha_fin.strftime("%Y-%m-%d"),
                          suma_aseg, prima); polizas.append(pol)

        reclamado = float(RNG.integers(6_000, 25_000))
        sin = build_siniestro(
            i, cobertura="Choque", estado="Reserva",
            descripcion=descripciones[k % len(descripciones)],
            fecha_ocurrencia=fecha_oc.strftime("%Y-%m-%d"),
            fecha_reporte=fecha_rep.strftime("%Y-%m-%d"),
            monto_reclamado=reclamado, monto_estimado=reclamado, monto_pagado=0,
            id_poliza=pol["id_poliza"], id_asegurado=ase["id_asegurado"],
            id_vehiculo=veh["id_vehiculo"], id_proveedor=RNG.choice(prov_normales),
            id_conductor=con["id_conductor"], ciudad=ciudad,
            dias_inicio_poliza=(fecha_oc - fecha_ini).days,
            dias_fin_poliza=(fecha_fin - fecha_oc).days,
            dias_oc_reporte=(fecha_rep - fecha_oc).days,
            doc_completos=False, tuvo_parte=False, tuvo_testigo=False,
            fault="Asegurado", regla_objetivo="RF-04 Dinamica imposible",
        )
        siniestros.append(sin)
        docs.extend(build_docs(i * 10, sin["id_siniestro"], sin["fecha_ocurrencia"],
                               denuncia_falta=True))
    return siniestros, polizas, asegurados, vehiculos, conductores, docs


def gen_rf05_borde_vigencia(n: int, start_idx: int, prov_normales: list[str]):
    """Siniestro < 48 hrs despues de inicio de poliza."""
    siniestros, polizas, asegurados, vehiculos, conductores, docs = [], [], [], [], [], []
    for k in range(n):
        i = start_idx + k
        suma_aseg = float(RNG.integers(10_000, 30_000))
        prima = round(suma_aseg * 0.04, 2)
        fecha_ini = pd.Timestamp("2024-05-01") + pd.Timedelta(days=int(RNG.integers(0, 200)))
        fecha_fin = fecha_ini + pd.Timedelta(days=365)
        # Siniestro mismo dia o al dia siguiente
        fecha_oc = fecha_ini + pd.Timedelta(days=int(RNG.integers(0, 2)))
        fecha_rep = fecha_oc + pd.Timedelta(days=int(RNG.integers(1, 4)))
        ciudad = RNG.choice(CIUDADES)

        veh = base_vehiculo(i); vehiculos.append(veh)
        ase = base_asegurado(i); ase["ciudad"] = ciudad; asegurados.append(ase)
        con = base_conductor(i, veh["id_vehiculo"]); conductores.append(con)
        pol = base_poliza(i, ase["id_asegurado"], ciudad,
                          fecha_ini.strftime("%Y-%m-%d"), fecha_fin.strftime("%Y-%m-%d"),
                          suma_aseg, prima); polizas.append(pol)

        reclamado = float(RNG.integers(4_000, 15_000))
        sin = build_siniestro(
            i, cobertura="Choque", estado="Reserva",
            descripcion="Colision lateral en interseccion. Reclamo presentado al dia siguiente del inicio de la poliza.",
            fecha_ocurrencia=fecha_oc.strftime("%Y-%m-%d"),
            fecha_reporte=fecha_rep.strftime("%Y-%m-%d"),
            monto_reclamado=reclamado, monto_estimado=reclamado*0.9, monto_pagado=0,
            id_poliza=pol["id_poliza"], id_asegurado=ase["id_asegurado"],
            id_vehiculo=veh["id_vehiculo"], id_proveedor=RNG.choice(prov_normales),
            id_conductor=con["id_conductor"], ciudad=ciudad,
            dias_inicio_poliza=(fecha_oc - fecha_ini).days,
            dias_fin_poliza=(fecha_fin - fecha_oc).days,
            dias_oc_reporte=(fecha_rep - fecha_oc).days,
            doc_completos=True, tuvo_parte=True, tuvo_testigo=False,
            fault="Tercero", regla_objetivo="RF-05 Borde vigencia",
        )
        siniestros.append(sin)
        docs.extend(build_docs(i * 10, sin["id_siniestro"], sin["fecha_ocurrencia"]))
    return siniestros, polizas, asegurados, vehiculos, conductores, docs


# --------- Main ----------
def main() -> int:
    log("Leyendo tablas existentes...")
    siniestros = pd.read_parquet(PROC / "siniestros.parquet")
    polizas = pd.read_parquet(PROC / "polizas.parquet")
    asegurados = pd.read_parquet(PROC / "asegurados.parquet")
    vehiculos = pd.read_parquet(PROC / "vehiculos.parquet")
    proveedores = pd.read_parquet(PROC / "proveedores.parquet")
    conductores = pd.read_parquet(PROC / "conductores.parquet")
    documentos = pd.read_parquet(PROC / "documentos.parquet")

    # Marcar 4 proveedores adicionales en lista restrictiva si solo hay 2
    if proveedores["lista_restrictiva"].sum() < 4:
        candidatos = proveedores[~proveedores["lista_restrictiva"]].sample(4 - int(proveedores["lista_restrictiva"].sum()), random_state=2026)
        proveedores.loc[candidatos.index, "lista_restrictiva"] = True
        log(f"Marcados {len(candidatos)} proveedores adicionales en lista_restrictiva")

    prov_restrictivos = proveedores[proveedores["lista_restrictiva"]]["id_proveedor"].tolist()
    prov_normales = proveedores[~proveedores["lista_restrictiva"]]["id_proveedor"].tolist()

    # flag caso_inyectado en tabla siniestros existente
    siniestros["caso_inyectado"] = False

    all_new_sin, all_new_pol, all_new_ase, all_new_veh, all_new_con, all_new_doc = [], [], [], [], [], []

    log("Generando 10 casos RF-01 (Perdida Total por Robo)...")
    s, p, a, v, c, d = gen_rf01_ptxrb(10, 0, prov_normales)
    all_new_sin += s; all_new_pol += p; all_new_ase += a; all_new_veh += v; all_new_con += c; all_new_doc += d

    log("Generando 8 casos RF-02 (Falsificacion documental)...")
    s, p, a, v, c, d = gen_rf02_falsificacion(8, 10, prov_normales)
    all_new_sin += s; all_new_pol += p; all_new_ase += a; all_new_veh += v; all_new_con += c; all_new_doc += d

    log("Generando 8 casos RF-03 (Lista restrictiva)...")
    s, p, a, v, c, d = gen_rf03_lista_restrictiva(8, 20, prov_restrictivos)
    all_new_sin += s; all_new_pol += p; all_new_ase += a; all_new_veh += v; all_new_con += c; all_new_doc += d

    log("Generando 6 casos RF-04 (Dinamica imposible)...")
    s, p, a, v, c, d = gen_rf04_dinamica_imposible(6, 30, prov_normales)
    all_new_sin += s; all_new_pol += p; all_new_ase += a; all_new_veh += v; all_new_con += c; all_new_doc += d

    log("Generando 8 casos RF-05 (Borde de vigencia <48h)...")
    s, p, a, v, c, d = gen_rf05_borde_vigencia(8, 40, prov_normales)
    all_new_sin += s; all_new_pol += p; all_new_ase += a; all_new_veh += v; all_new_con += c; all_new_doc += d

    new_sin_df = pd.DataFrame(all_new_sin); new_sin_df["caso_inyectado"] = True
    new_pol_df = pd.DataFrame(all_new_pol)
    new_ase_df = pd.DataFrame(all_new_ase)
    new_veh_df = pd.DataFrame(all_new_veh)
    new_con_df = pd.DataFrame(all_new_con)
    new_doc_df = pd.DataFrame(all_new_doc)

    # Concatenar y guardar
    siniestros = pd.concat([siniestros, new_sin_df], ignore_index=True)
    polizas = pd.concat([polizas, new_pol_df], ignore_index=True)
    asegurados = pd.concat([asegurados, new_ase_df], ignore_index=True)
    vehiculos = pd.concat([vehiculos, new_veh_df], ignore_index=True)
    conductores = pd.concat([conductores, new_con_df], ignore_index=True)
    documentos = pd.concat([documentos, new_doc_df], ignore_index=True)

    # Verificar integridad post-inyeccion
    print("\n--- Integridad referencial post-inyeccion ---")
    for fk, tabla_pk, dim in [
        ("id_poliza", "polizas", polizas), ("id_asegurado", "asegurados", asegurados),
        ("id_vehiculo", "vehiculos", vehiculos), ("id_proveedor", "proveedores", proveedores),
        ("id_conductor", "conductores", conductores),
    ]:
        huerfanos = set(siniestros[fk].dropna()) - set(dim[fk])
        print(f"  siniestros.{fk:<15} -> {tabla_pk:<12} : {'OK' if not huerfanos else f'FALLO ({len(huerfanos)})'}")

    # Guardar
    log("\nGuardando parquet actualizados...")
    siniestros.to_parquet(PROC / "siniestros.parquet", index=False)
    polizas.to_parquet(PROC / "polizas.parquet", index=False)
    asegurados.to_parquet(PROC / "asegurados.parquet", index=False)
    vehiculos.to_parquet(PROC / "vehiculos.parquet", index=False)
    proveedores.to_parquet(PROC / "proveedores.parquet", index=False)
    conductores.to_parquet(PROC / "conductores.parquet", index=False)
    documentos.to_parquet(PROC / "documentos.parquet", index=False)

    SYN.mkdir(parents=True, exist_ok=True)
    new_sin_df.to_parquet(SYN / "casos_criticos.parquet", index=False)

    print("\n" + "=" * 60)
    print("RESUMEN INYECCION")
    print("=" * 60)
    print(f"  Casos inyectados: {len(new_sin_df)}")
    print(f"  Siniestros totales: {len(siniestros):,} ({siniestros['caso_inyectado'].sum()} inyectados)")
    print(f"  Polizas totales: {len(polizas):,}")
    print(f"  Vehiculos totales: {len(vehiculos):,}")
    print(f"  Documentos totales: {len(documentos):,}")
    print(f"  Proveedores en lista_restrictiva: {proveedores['lista_restrictiva'].sum()}")
    print("\nCasos inyectados por regla objetivo:")
    print(new_sin_df["descripcion"].str.extract(r"\[INYECTADO: (RF-\d+)").value_counts().to_string())
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
