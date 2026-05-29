"""Bootstrap del backend: descarga assets pesados desde Azure Blob al arrancar.

Se invoca desde src/api/main.py antes de cualquier import de tools/rules.

Hoy descarga:
- data/processed/embeddings_descripciones.npz (~236MB) desde EMBEDDINGS_BLOB_URL

El archivo solo se descarga si:
1. No existe localmente
2. La env var EMBEDDINGS_BLOB_URL esta seteada con una URL valida (SAS recomendado)

Si la descarga falla, el sistema sigue funcionando: las features que
dependen del .npz (RF-07 narrativa clonada) se desactivan silenciosamente.
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from urllib.request import urlopen

log = logging.getLogger("bootstrap")

ROOT = Path(__file__).resolve().parents[1]
EMB_PATH = ROOT / "data" / "processed" / "embeddings_descripciones.npz"
EMB_ENV = "EMBEDDINGS_BLOB_URL"


def ensure_embeddings(timeout_sec: int = 300) -> bool:
    """Garantiza que el archivo de embeddings exista localmente.

    Devuelve True si el archivo esta presente (descargado o ya existente).
    Devuelve False si la descarga fallo (el resto del sistema sigue funcionando).
    """
    if EMB_PATH.exists() and EMB_PATH.stat().st_size > 1024:
        log.info("embeddings ya presentes en %s (%.1f MB)",
                 EMB_PATH, EMB_PATH.stat().st_size / 1024 / 1024)
        return True

    url = os.environ.get(EMB_ENV)
    if not url:
        log.warning(
            "embeddings no estan en disco y %s no esta seteada. "
            "Las features dependientes (RF-07) quedaran desactivadas.",
            EMB_ENV,
        )
        return False

    EMB_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = EMB_PATH.with_suffix(".npz.partial")
    try:
        log.info("descargando embeddings desde blob (timeout %ds)...", timeout_sec)
        t0 = time.time()
        with urlopen(url, timeout=timeout_sec) as resp:
            total = 0
            with open(tmp_path, "wb") as fout:
                while True:
                    chunk = resp.read(1024 * 1024)  # 1MB chunks
                    if not chunk:
                        break
                    fout.write(chunk)
                    total += len(chunk)
        tmp_path.replace(EMB_PATH)
        elapsed = time.time() - t0
        log.info("embeddings descargados OK: %.1f MB en %.1fs", total / 1024 / 1024, elapsed)
        return True
    except Exception as exc:
        log.warning("descarga de embeddings fallo: %s. RF-07 quedara desactivada.", exc)
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except OSError:
            pass
        return False


def run() -> None:
    """Ejecuta todos los bootstraps necesarios. Idempotente y safe-to-fail."""
    logging.basicConfig(level=logging.INFO)
    ensure_embeddings()


if __name__ == "__main__":
    run()
