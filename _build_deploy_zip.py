"""Crea backend_deploy.zip excluyendo basura/secretos."""
import os, zipfile, fnmatch, sys

EXCLUDE_DIRS = {
    ".git", "frontend", "backups", "__pycache__", ".pytest_cache",
    ".mypy_cache", "notebooks", "tests", ".vscode", ".idea",
    ".venv", "venv", "node_modules",
}
EXCLUDE_PREFIXES = ("data/raw/", "data/synthetic/docs_demo/")
EXCLUDE_PATTERNS = ["*.pyc", "*.log", "*.swp", "*.zip"]
EXCLUDE_FILES = {
    ".env", ".env.example", ".gitignore", ".deployignore",
    "appsettings_backend.json", "appsettings_frontend.json",
    "_build_deploy_zip.py", "backend_deploy.zip",
}


def should_exclude(rel: str) -> bool:
    parts = rel.split("/")
    for d in parts[:-1]:
        if d in EXCLUDE_DIRS:
            return True
    fname = parts[-1]
    if fname in EXCLUDE_FILES:
        return True
    for pat in EXCLUDE_PATTERNS:
        if fnmatch.fnmatch(fname, pat):
            return True
    for pref in EXCLUDE_PREFIXES:
        if rel.startswith(pref):
            return True
    return False


def main() -> int:
    out = "backend_deploy.zip"
    count = 0
    size = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, allowZip64=True, compresslevel=6) as z:
        for root, dirs, files in os.walk("."):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, ".").replace("\\", "/")
                if should_exclude(rel):
                    continue
                try:
                    z.write(full, rel)
                    count += 1
                    size += os.path.getsize(full)
                except (OSError, PermissionError):
                    pass
    print(f"Archivos: {count:,}")
    print(f"Tamano original: {size/1024/1024:.1f} MB")
    print(f"Tamano del zip: {os.path.getsize(out)/1024/1024:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
