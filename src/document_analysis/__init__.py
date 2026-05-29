"""Modulo de analisis de documentos con Azure Document Intelligence + GPT-4o Vision."""

from src.document_analysis.analyze import (
    analyze_factura,
    analyze_imagen_dano,
    analyze_documento_generico,
    analyze_parte_policial,
    analyze_declaracion_accidente,
    analyze_visual_forensics,
    DocumentAnalysisResult,
)

__all__ = [
    "analyze_factura",
    "analyze_imagen_dano",
    "analyze_documento_generico",
    "analyze_parte_policial",
    "analyze_declaracion_accidente",
    "analyze_visual_forensics",
    "DocumentAnalysisResult",
]
