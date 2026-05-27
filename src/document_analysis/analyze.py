"""Analizador de documentos multimodal.

Combina:
- Azure Document Intelligence (prebuilt-invoice, prebuilt-document, prebuilt-layout)
- Azure OpenAI gpt-4o (vision) para razonar sobre imagenes

Funciones:
- analyze_factura(file_bytes): extrae campos + valida coherencia + score
- analyze_imagen_dano(file_bytes, descripcion_siniestro): cruza con relato
- analyze_documento_generico(file_bytes, tipo): para denuncias/partes
"""
from __future__ import annotations

import base64
import io
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI


@dataclass
class DocumentAnalysisResult:
    """Resultado del analisis multimodal de un documento."""
    tipo_documento: str            # "factura", "imagen_dano", "parte_policial", ...
    extracted_fields: dict[str, Any] = field(default_factory=dict)
    inconsistencias: list[dict] = field(default_factory=list)
    nivel_riesgo_doc: str = "VERDE"  # VERDE / AMARILLO / ROJO
    score_doc: int = 0                 # 0-100
    explicacion: str = ""
    raw_di_response: Optional[dict] = None  # respuesta cruda de Document Intelligence
    raw_vision_response: Optional[str] = None  # respuesta cruda del LLM

    def to_dict(self) -> dict:
        return asdict(self)


def _di_client() -> DocumentIntelligenceClient:
    return DocumentIntelligenceClient(
        endpoint=os.environ["AZURE_DOCINTEL_ENDPOINT"],
        credential=AzureKeyCredential(os.environ["AZURE_DOCINTEL_KEY"]),
    )


def _vision_client() -> AzureOpenAI:
    return AzureOpenAI(
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21"),
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    )


# ===================== FACTURA =====================
def analyze_factura(file_bytes: bytes, fecha_ocurrencia: Optional[str] = None) -> DocumentAnalysisResult:
    """Analiza una factura (PDF/imagen) usando el modelo prebuilt-invoice de Azure DI.

    Detecta:
    - Fecha de emision < fecha de ocurrencia (RF-02 falsificacion)
    - Total inconsistente con subtotal+impuestos
    - Datos del vendedor sospechosos
    - Falta de RUC/datos legales
    """
    client = _di_client()
    poller = client.begin_analyze_document(
        model_id="prebuilt-invoice",
        body=AnalyzeDocumentRequest(bytes_source=file_bytes),
    )
    result = poller.result()

    extracted = {}
    inconsistencias = []
    score = 0

    if not result.documents:
        return DocumentAnalysisResult(
            tipo_documento="factura",
            extracted_fields={},
            inconsistencias=[{"tipo": "vacio", "evidencia": "Document Intelligence no extrajo ningun campo"}],
            nivel_riesgo_doc="AMARILLO",
            score_doc=30,
            explicacion="Factura ilegible o formato no reconocido. Pedir version original.",
        )

    doc = result.documents[0]
    for name, field_obj in (doc.fields or {}).items():
        # Extraer valor segun el tipo
        if field_obj.value_string:
            extracted[name] = field_obj.value_string
        elif field_obj.value_date:
            extracted[name] = field_obj.value_date.isoformat() if hasattr(field_obj.value_date, "isoformat") else str(field_obj.value_date)
        elif field_obj.value_number is not None:
            extracted[name] = field_obj.value_number
        elif field_obj.value_currency:
            extracted[name] = {"amount": field_obj.value_currency.amount,
                                "currency": field_obj.value_currency.currency_code}
        else:
            try:
                extracted[name] = str(field_obj.value_string or field_obj.content)
            except AttributeError:
                pass

    # ===== Reglas de coherencia =====
    # 1. Fecha factura vs fecha ocurrencia (RF-02 critico)
    fac_date = extracted.get("InvoiceDate")
    if fecha_ocurrencia and fac_date:
        try:
            d_fac = datetime.fromisoformat(str(fac_date)[:10])
            d_oc = datetime.fromisoformat(str(fecha_ocurrencia)[:10])
            if d_fac < d_oc:
                dias_diff = (d_oc - d_fac).days
                inconsistencias.append({
                    "tipo": "factura_anterior_al_evento",
                    "severidad": "CRITICA",
                    "evidencia": f"Factura emitida {dias_diff} dias ANTES del siniestro ({fac_date} < {fecha_ocurrencia})",
                })
                score += 50
        except (ValueError, TypeError):
            pass

    # 2. Total no coincide con subtotal
    total = extracted.get("InvoiceTotal", {}).get("amount") if isinstance(extracted.get("InvoiceTotal"), dict) else extracted.get("InvoiceTotal")
    subtotal = extracted.get("SubTotal", {}).get("amount") if isinstance(extracted.get("SubTotal"), dict) else extracted.get("SubTotal")
    tax = extracted.get("TotalTax", {}).get("amount") if isinstance(extracted.get("TotalTax"), dict) else extracted.get("TotalTax")
    if total and subtotal and tax:
        try:
            esperado = float(subtotal) + float(tax)
            if abs(float(total) - esperado) > 1.0:
                inconsistencias.append({
                    "tipo": "total_no_coincide",
                    "severidad": "ALTA",
                    "evidencia": f"Total ${total} != subtotal ${subtotal} + tax ${tax} = ${esperado:.2f}",
                })
                score += 30
        except (ValueError, TypeError):
            pass

    # 3. Falta RUC del vendedor (campo VendorTaxId)
    if not extracted.get("VendorTaxId"):
        inconsistencias.append({
            "tipo": "falta_ruc",
            "severidad": "MEDIA",
            "evidencia": "Factura no tiene RUC del vendedor (VendorTaxId)",
        })
        score += 10

    # 4. Falta numero de factura
    if not extracted.get("InvoiceId"):
        inconsistencias.append({
            "tipo": "falta_numero",
            "severidad": "MEDIA",
            "evidencia": "Factura sin numero (InvoiceId)",
        })
        score += 10

    score = min(score, 100)
    nivel = "ROJO" if score >= 50 else "AMARILLO" if score >= 20 else "VERDE"
    expl = (
        f"Factura analizada con Azure Document Intelligence (prebuilt-invoice). "
        f"Detectadas {len(inconsistencias)} inconsistencia(s). "
        f"Score documento: {score}/100 ({nivel})."
    )

    return DocumentAnalysisResult(
        tipo_documento="factura",
        extracted_fields=extracted,
        inconsistencias=inconsistencias,
        nivel_riesgo_doc=nivel,
        score_doc=score,
        explicacion=expl,
    )


# ===================== IMAGEN DEL DAÑO =====================
def analyze_imagen_dano(file_bytes: bytes, descripcion_siniestro: str,
                          tipo_imagen: str = "foto_vehiculo") -> DocumentAnalysisResult:
    """Usa GPT-4o Vision para analizar foto del dano y cruzar con la narrativa.

    Detecta:
    - Daño no coincide con descripcion ("dice frontal pero foto muestra trasera")
    - Foto sospechosamente similar a otras
    - Daño muy menor para el monto reclamado
    - Imagen alterada o foto de catalogo
    """
    client = _vision_client()
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_VISION", "gpt-4o")
    b64 = base64.b64encode(file_bytes).decode("utf-8")

    prompt = f"""Eres un analista antifraude. Te muestro una foto que un asegurado entrego como evidencia de un siniestro.

DESCRIPCION QUE EL ASEGURADO DIO DEL SINIESTRO:
\"\"\"{descripcion_siniestro}\"\"\"

Tu tarea: comparar la foto con la descripcion y detectar inconsistencias.

Devuelve un JSON con esta estructura exacta:
{{
  "describe_lo_que_ves": "...",
  "coincide_con_relato": true/false,
  "danos_visibles": ["...", "..."],
  "ubicacion_del_dano": "frontal | trasera | lateral_izq | lateral_der | techo | otro",
  "severidad_dano_observado": "menor | moderado | grave | total",
  "inconsistencias": [
    {{"tipo": "...", "severidad": "ALTA|MEDIA|BAJA", "evidencia": "..."}}
  ],
  "score_inconsistencia": 0-100,
  "explicacion": "1-2 lineas, lenguaje NO acusatorio"
}}

NUNCA acuses, solo senala patrones. Si no puedes ver la foto bien, di "imagen ilegible"."""

    resp = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": "Analista antifraude experto en peritajes vehiculares."},
            {"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ]},
        ],
        response_format={"type": "json_object"},
        max_tokens=800,
    )
    raw = resp.choices[0].message.content
    import json
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {
            "explicacion": "GPT-4o devolvio formato invalido",
            "score_inconsistencia": 0,
            "inconsistencias": [],
        }

    score = int(parsed.get("score_inconsistencia", 0))
    nivel = "ROJO" if score >= 60 else "AMARILLO" if score >= 30 else "VERDE"

    return DocumentAnalysisResult(
        tipo_documento="imagen_dano",
        extracted_fields={
            "describe_lo_que_ves": parsed.get("describe_lo_que_ves"),
            "coincide_con_relato": parsed.get("coincide_con_relato"),
            "danos_visibles": parsed.get("danos_visibles", []),
            "ubicacion_del_dano": parsed.get("ubicacion_del_dano"),
            "severidad_dano_observado": parsed.get("severidad_dano_observado"),
        },
        inconsistencias=parsed.get("inconsistencias", []),
        nivel_riesgo_doc=nivel,
        score_doc=score,
        explicacion=parsed.get("explicacion", ""),
        raw_vision_response=raw,
    )


# ===================== DOCUMENTO GENERICO (parte policial, denuncia, etc) =====================
def analyze_documento_generico(file_bytes: bytes, tipo: str = "documento",
                                 contexto_siniestro: Optional[dict] = None) -> DocumentAnalysisResult:
    """Para partes policiales, denuncias, certificados. Usa prebuilt-document de Azure DI
    para extraer texto + tablas + pares clave-valor, luego pasa a gpt-5-mini para analizar.
    """
    client = _di_client()
    poller = client.begin_analyze_document(
        model_id="prebuilt-read",  # OCR + estructura basica
        body=AnalyzeDocumentRequest(bytes_source=file_bytes),
    )
    result = poller.result()

    text = ""
    for page in result.pages:
        for line in (page.lines or []):
            text += line.content + "\n"

    if not text.strip():
        return DocumentAnalysisResult(
            tipo_documento=tipo,
            extracted_fields={"texto": ""},
            inconsistencias=[{"tipo": "ilegible", "severidad": "ALTA",
                              "evidencia": "Document Intelligence no extrajo texto"}],
            nivel_riesgo_doc="AMARILLO",
            score_doc=40,
            explicacion="Documento ilegible. Pedir version mejor calidad.",
        )

    # Analisis con LLM
    llm = _vision_client()
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_CHAT", "gpt-5-mini")

    contexto_str = ""
    if contexto_siniestro:
        contexto_str = f"\nContexto del siniestro:\n{contexto_siniestro}\n"

    prompt = f"""Documento extraido por OCR (tipo {tipo}):
{contexto_str}
TEXTO:
\"\"\"{text[:3000]}\"\"\"

Detecta:
1. Si parece un documento OFICIAL (sello, firma, formato institucional)
2. Si las fechas/datos coinciden con el contexto
3. Inconsistencias internas
4. Si el lenguaje suena profesional/oficial vs improvisado

Devuelve JSON:
{{
  "parece_oficial": true/false,
  "datos_extraidos": {{"campo": "valor"}},
  "inconsistencias": [{{"tipo":"","severidad":"ALTA|MEDIA|BAJA","evidencia":""}}],
  "score_riesgo": 0-100,
  "explicacion": "1-2 lineas, NO acusatorio"
}}"""

    resp = llm.chat.completions.create(
        model=deployment,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    import json
    try:
        parsed = json.loads(resp.choices[0].message.content)
    except json.JSONDecodeError:
        parsed = {"score_riesgo": 0, "inconsistencias": [], "explicacion": "Parse error"}

    score = int(parsed.get("score_riesgo", 0))
    nivel = "ROJO" if score >= 60 else "AMARILLO" if score >= 30 else "VERDE"

    return DocumentAnalysisResult(
        tipo_documento=tipo,
        extracted_fields={
            "texto_extraido": text[:500],
            "n_paginas": len(result.pages),
            "parece_oficial": parsed.get("parece_oficial"),
            **parsed.get("datos_extraidos", {}),
        },
        inconsistencias=parsed.get("inconsistencias", []),
        nivel_riesgo_doc=nivel,
        score_doc=score,
        explicacion=parsed.get("explicacion", ""),
    )
