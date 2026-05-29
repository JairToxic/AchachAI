"""Crea frontend_deploy.zip con Next.js standalone build.

Estrategia: bundle autocontenido + .next/static + public/, todo en la raiz.
Startup en App Service: `node server.js`
"""
import os, zipfile, sys
from pathlib import Path

FRONTEND = Path("frontend")
STANDALONE = FRONTEND / ".next" / "standalone"
STATIC = FRONTEND / ".next" / "static"
PUBLIC = FRONTEND / "public"


def add_tree(z: zipfile.ZipFile, root: Path, arc_prefix: str = "") -> tuple[int, int]:
    count = 0
    size = 0
    for fp in root.rglob("*"):
        if not fp.is_file():
            continue
        arc = (Path(arc_prefix) / fp.relative_to(root)).as_posix()
        try:
            z.write(fp, arc)
            count += 1
            size += fp.stat().st_size
        except (OSError, PermissionError):
            pass
    return count, size


def main() -> int:
    if not STANDALONE.exists():
        print("ERROR: no existe .next/standalone (corre 'npm run build' primero)")
        return 1
    out = "frontend_deploy.zip"
    total_count = 0
    total_size = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, allowZip64=True, compresslevel=6) as z:
        # 1) Contenido de .next/standalone/ en la raiz del zip
        c, s = add_tree(z, STANDALONE, arc_prefix="")
        print(f"  standalone: {c} archivos, {s/1024/1024:.1f} MB")
        total_count += c; total_size += s
        # 2) .next/static a /.next/static (lo espera el server de standalone)
        if STATIC.exists():
            c, s = add_tree(z, STATIC, arc_prefix=".next/static")
            print(f"  static:     {c} archivos, {s/1024/1024:.1f} MB")
            total_count += c; total_size += s
        # 3) public/ a /public (assets como condor-logo.svg)
        if PUBLIC.exists():
            c, s = add_tree(z, PUBLIC, arc_prefix="public")
            print(f"  public:     {c} archivos, {s/1024/1024:.1f} MB")
            total_count += c; total_size += s
    print()
    print(f"Total archivos: {total_count:,}")
    print(f"Tamano descomprimido: {total_size/1024/1024:.1f} MB")
    print(f"Tamano del zip: {os.path.getsize(out)/1024/1024:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
