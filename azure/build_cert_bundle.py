"""Construye un cert bundle combinando certifi + certs del Windows store.

Esto es necesario para que `az` CLI funcione en redes corporativas donde
hay un certificado intermedio que intercepta las llamadas a Microsoft.

Genera: %USERPROFILE%\.certs\corp-cacert.pem

Despues, exportar:
    setx REQUESTS_CA_BUNDLE "%USERPROFILE%\.certs\corp-cacert.pem"
    setx CURL_CA_BUNDLE     "%USERPROFILE%\.certs\corp-cacert.pem"
"""
from __future__ import annotations

import os
import ssl
import sys
from pathlib import Path

import certifi


def main() -> int:
    out_dir = Path(os.path.expandvars("%USERPROFILE%")) / ".certs"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / "corp-cacert.pem"

    print(f"Bundle destino: {out}")
    print(f"certifi base:   {certifi.where()}")

    # 1. Copiar bundle base de certifi
    base = Path(certifi.where()).read_bytes()
    out.write_bytes(base)
    print(f"  certifi base copiado: {len(base)} bytes")

    # 2. Agregar certs de Windows store (ssl.enum_certificates)
    appended = 0
    extra_bytes = bytearray()
    for store in ("ROOT", "CA"):
        try:
            certs = ssl.enum_certificates(store)
        except Exception as e:
            print(f"  WARN: no pude leer store {store}: {e}")
            continue
        for cert_bytes, enc_type, trust in certs:
            try:
                pem = ssl.DER_cert_to_PEM_cert(cert_bytes)
                extra_bytes.extend(pem.encode("utf-8"))
                extra_bytes.extend(b"\n")
                appended += 1
            except Exception:
                pass
    print(f"  certs del Windows store agregados: {appended}")

    # 3. Append al archivo final
    with out.open("ab") as f:
        f.write(b"\n# === Certificados del Windows store ===\n")
        f.write(bytes(extra_bytes))

    size_kb = out.stat().st_size / 1024
    print(f"\nBundle final: {out}")
    print(f"  tamano: {size_kb:.1f} KB")
    print(f"  total certs (aprox): {base.count(b'-----BEGIN CERTIFICATE-----') + appended}")
    print("\nAhora corre estos comandos para activar el bundle permanentemente:")
    print(f'  setx REQUESTS_CA_BUNDLE "{out}"')
    print(f'  setx CURL_CA_BUNDLE     "{out}"')
    print("\nDespues cierra y reabre la terminal (o setea las env vars en la sesion actual).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
