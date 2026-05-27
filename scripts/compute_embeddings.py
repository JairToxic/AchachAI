"""Calcula embeddings de las descripciones de los siniestros para activar:
- Senal 13: 'Narrativas similares' (>85% sim -> 8pts, 70-84% -> 4pts)
- RF-07:    'Narrativa identica/clonada' (>90% sim -> AMARILLO)

Usa Azure OpenAI text-embedding-3-large (3072 dims) en batches de 100.
Calcula la similitud coseno con FAISS y guarda el max por cada siniestro.

Lee:   data/processed/siniestros.parquet
Escribe: data/processed/similitudes.parquet  (id_siniestro -> max_sim, id_match)

Ejecutar 1 vez tras cualquier cambio del dataset.

Uso:
    python scripts/compute_embeddings.py
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from openai import AzureOpenAI

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

PROC = ROOT / "data" / "processed"
SRC = PROC / "siniestros.parquet"
OUT = PROC / "similitudes.parquet"

BATCH = 100
EMBED_DIM = 3072  # text-embedding-3-large


def log(msg: str) -> None:
    print(f"[embed] {msg}", flush=True)


def main() -> int:
    if not SRC.exists():
        log(f"ERROR: no encontre {SRC}")
        return 1

    s = pd.read_parquet(SRC)
    log(f"Cargados {len(s):,} siniestros")

    # Truncar descripciones a max 500 chars (text-embedding-3-large tolera 8K tokens pero
    # las narrativas reales tienen 100-300 chars).
    s["desc_clean"] = s["descripcion"].fillna("").astype(str).str[:500]

    client = AzureOpenAI(
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version=os.environ["AZURE_OPENAI_API_VERSION"],
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    )
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_EMBEDDINGS", "text-embedding-3-large")

    log(f"Generando embeddings con deployment={deployment} ({len(s)} textos, batches de {BATCH})")
    embeddings = np.zeros((len(s), EMBED_DIM), dtype=np.float32)
    start = time.time()
    for i in range(0, len(s), BATCH):
        batch = s["desc_clean"].iloc[i:i+BATCH].tolist()
        # Reemplazar vacios para evitar error de API
        batch = [t if t.strip() else "(sin descripcion)" for t in batch]
        try:
            resp = client.embeddings.create(model=deployment, input=batch)
            for j, e in enumerate(resp.data):
                embeddings[i + j] = e.embedding
        except Exception as exc:
            log(f"  WARN batch {i}: {exc}")
            continue
        if (i // BATCH) % 10 == 0:
            elapsed = time.time() - start
            log(f"  batch {i//BATCH+1}/{(len(s)+BATCH-1)//BATCH}  ({elapsed:.0f}s, {i+len(batch)}/{len(s)})")

    elapsed = time.time() - start
    log(f"Embeddings calculados en {elapsed:.0f}s ({len(s)/elapsed:.1f} textos/seg)")

    # Normalizar para usar cosine similarity como dot product
    log("Normalizando vectores (L2)...")
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1
    embeddings = embeddings / norms

    # Similitudes: para cada siniestro, encontrar la MAXIMA sim con OTRO siniestro
    # Usamos chunks para no comer toda la RAM (15K x 15K matriz = 1.7GB en float32)
    log("Calculando similitudes coseno (chunked)...")
    max_sims = np.zeros(len(s), dtype=np.float32)
    match_ids = np.empty(len(s), dtype=object)
    chunk = 500
    for i in range(0, len(s), chunk):
        # Sim de [i:i+chunk] contra TODO
        block = embeddings[i:i+chunk]
        sim = block @ embeddings.T  # (chunk, N)
        # Excluir self-match: poner -inf en diagonal
        for k in range(len(block)):
            sim[k, i + k] = -1.0
        # Max por fila
        max_idx = sim.argmax(axis=1)
        max_val = sim[np.arange(len(block)), max_idx]
        max_sims[i:i+chunk] = max_val
        match_ids[i:i+chunk] = s["id_siniestro"].iloc[max_idx].values

    df_out = pd.DataFrame({
        "id_siniestro": s["id_siniestro"].values,
        "max_sim": max_sims,
        "id_match": match_ids,
    })

    PROC.mkdir(parents=True, exist_ok=True)
    df_out.to_parquet(OUT, index=False)

    # Stats
    print("\n" + "=" * 60)
    print("ESTADISTICAS DE SIMILITUD")
    print("=" * 60)
    print(f"  N siniestros: {len(df_out):,}")
    print(f"  Sim > 0.95 (RF-07 fuerte): {(df_out['max_sim'] > 0.95).sum()}")
    print(f"  Sim > 0.90 (RF-07 trigger): {(df_out['max_sim'] > 0.90).sum()}")
    print(f"  Sim > 0.85 (Senal 13 alta): {(df_out['max_sim'] > 0.85).sum()}")
    print(f"  Sim 0.70-0.85 (Senal 13 media): {((df_out['max_sim'] >= 0.70) & (df_out['max_sim'] <= 0.85)).sum()}")
    print(f"  max similitud encontrada: {df_out['max_sim'].max():.3f}")
    print(f"  median: {df_out['max_sim'].median():.3f}")
    print("=" * 60)
    log(f"Guardado en {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
