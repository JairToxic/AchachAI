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

    # Guardar embeddings + ids para evitar recomputar en futuras iteraciones
    EMB_PATH = PROC / "embeddings_descripciones.npz"
    np.savez_compressed(EMB_PATH, embeddings=embeddings,
                        ids=s["id_siniestro"].values)
    log(f"  matriz de embeddings guardada en {EMB_PATH.name} ({EMB_PATH.stat().st_size/1024/1024:.1f} MB)")

    # Estrategia TOP-K: encontrar los PARES mas similares globalmente.
    # Como todos los textos del dominio se parecen entre si (~0.97 medio),
    # un umbral absoluto no sirve. Usamos top 100 pares para marcar como sospechosos
    # de "narrativa clonada" - los outliers reales.
    log("Calculando similitudes coseno (chunked) y guardando top-K...")
    chunk = 500
    top_k = 100  # los 100 pares mas similares en TODO el dataset
    # Heap de los top K pares (sim, i, j)
    import heapq
    heap = []  # min-heap, mantenemos solo los top K mas grandes

    # Tambien guardamos max_sim por siniestro (para diagnostico)
    max_sims = np.zeros(len(s), dtype=np.float32)
    match_ids = np.empty(len(s), dtype=object)

    for i in range(0, len(s), chunk):
        block = embeddings[i:i+chunk]
        sim = block @ embeddings.T  # (chunk, N)
        # Excluir self-match
        for k in range(len(block)):
            sim[k, i + k] = -1.0
            # Excluir tambien la mitad inferior para no contar (i,j) y (j,i)
            sim[k, :i+k+1] = -1.0  # solo j > i

        # Max por fila (para diagnostico)
        max_idx = sim.argmax(axis=1)
        max_val = sim[np.arange(len(block)), max_idx]
        max_sims[i:i+chunk] = max_val
        match_ids[i:i+chunk] = s["id_siniestro"].iloc[max_idx].values

        # Top-K global: para cada par valido, pushear al heap
        rows, cols = np.unravel_index(
            np.argpartition(sim.flatten(), -top_k)[-top_k:],
            sim.shape,
        )
        for r, c in zip(rows, cols):
            val = float(sim[r, c])
            if val < 0:
                continue
            entry = (val, i + r, int(c))
            if len(heap) < top_k:
                heapq.heappush(heap, entry)
            elif val > heap[0][0]:
                heapq.heapreplace(heap, entry)

    # Salida 1: max_sim por siniestro (diagnostico)
    df_max = pd.DataFrame({
        "id_siniestro": s["id_siniestro"].values,
        "max_sim": max_sims,
        "id_match": match_ids,
    })

    # Salida 2: top-K pares globales (lo que de verdad usa el motor de reglas)
    top_pairs = sorted(heap, key=lambda x: -x[0])
    df_pairs = pd.DataFrame([
        {
            "sim": v,
            "id_siniestro_a": s["id_siniestro"].iloc[a],
            "id_siniestro_b": s["id_siniestro"].iloc[b],
            "rank": rank + 1,
        }
        for rank, (v, a, b) in enumerate(top_pairs)
    ])

    # Calcular el set de ids EN top-K para marcado rapido
    ids_en_topk = set(df_pairs["id_siniestro_a"]) | set(df_pairs["id_siniestro_b"])
    df_max["en_top_k"] = df_max["id_siniestro"].isin(ids_en_topk)
    # Y rank si esta
    sim_by_id = {}
    for _, row in df_pairs.iterrows():
        for _id in (row["id_siniestro_a"], row["id_siniestro_b"]):
            if _id not in sim_by_id or sim_by_id[_id] < row["sim"]:
                sim_by_id[_id] = row["sim"]
    df_max["sim_topk"] = df_max["id_siniestro"].map(sim_by_id).fillna(0.0)

    PROC.mkdir(parents=True, exist_ok=True)
    df_max.to_parquet(OUT, index=False)
    df_pairs.to_parquet(PROC / "similitudes_top_pares.parquet", index=False)

    # Stats
    print("\n" + "=" * 60)
    print("ESTADISTICAS DE SIMILITUD (top-K)")
    print("=" * 60)
    print(f"  N siniestros: {len(df_max):,}")
    print(f"  Top {top_k} pares mas similares calculados")
    print(f"  Siniestros en top-K (marcados como sospechosos): {df_max['en_top_k'].sum()}")
    print(f"  Sim minima en top-K: {df_pairs['sim'].min():.4f}")
    print(f"  Sim maxima en top-K: {df_pairs['sim'].max():.4f}")
    print(f"  Sim mediana global (referencia): {df_max['max_sim'].median():.4f}")
    print("=" * 60)
    log(f"Guardado en {OUT}")
    log(f"Top pares: {PROC / 'similitudes_top_pares.parquet'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
