"""Porta los .jsx del design (con vars globales + Babel-standalone)
a .tsx components de Next.js (con imports ES6 + 'use client').
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "frontend" / "public" / "achachai"
DST = ROOT / "frontend" / "src" / "app" / "achachai" / "_components"

# Mapping nombre simbolo -> de donde lo importamos
EXTERNAL_IMPORTS = {
    "Condor": "./Condor",
    "VueloDelCondor": "./Condor",
    "CondorMini": "./Condor",
    "CondorBubble": "./Condor",
    "LearningBar": "./Condor",
    "CondorOverPeaks": "./Condor",
}

# Mapping nombre archivo .jsx -> .tsx (saltamos los ya portados o no necesarios)
FILES = {
    "chat.jsx": "Chat.tsx",
    "screens.jsx": "Screens.tsx",
    "role-homes.jsx": "RoleHomes.tsx",
    "investigation.jsx": "Investigation.tsx",
}


def port(src_path: Path, dst_path: Path) -> None:
    txt = src_path.read_text(encoding="utf-8")

    # 1. Detectar globales referenciados (/* global X, Y */)
    globals_match = re.search(r"/\*\s*global\s+([\w,\s]+)\*/", txt)
    referenced = []
    if globals_match:
        for g in re.split(r"[,\s]+", globals_match.group(1).strip()):
            if g and g != "React":
                referenced.append(g)

    # 2. Detectar locals de React (const { useState: useSc, useEffect... } = React)
    hooks_match = re.search(r"const\s*\{([^}]+)\}\s*=\s*React\s*;?", txt)
    react_hooks = set()
    alias_pairs = []  # [(alias, originalHook)]
    if hooks_match:
        for tok in hooks_match.group(1).split(","):
            tok = tok.strip()
            if not tok:
                continue
            if ":" in tok:
                orig, alias = [p.strip() for p in tok.split(":")]
                react_hooks.add(orig)
                alias_pairs.append((alias, orig))
            else:
                react_hooks.add(tok)
                alias_pairs.append((tok, tok))

    # Si no hubo declaracion explicita, detectar uso de useState/useEffect/useRef/useMemo
    for hook in ["useState", "useEffect", "useRef", "useMemo", "useCallback"]:
        if re.search(rf"\b{hook}\b", txt):
            react_hooks.add(hook)
            if all(alias != hook for alias, _ in alias_pairs):
                alias_pairs.append((hook, hook))

    # 3. Borrar headers/footers
    # /* global X */
    txt = re.sub(r"/\*\s*global[^*]+\*/\s*", "", txt)
    # const { ... } = React;
    txt = re.sub(r"const\s*\{[^}]+\}\s*=\s*React\s*;?\s*", "", txt)
    # Object.assign(window, { ... });  <-- ultima linea
    exported_names = []
    obj_assign = re.search(r"Object\.assign\(\s*window\s*,\s*\{([^}]+)\}\s*\)\s*;?", txt)
    if obj_assign:
        for n in re.split(r"[,\s]+", obj_assign.group(1).strip()):
            if n:
                exported_names.append(n)
        txt = re.sub(r"Object\.assign\(\s*window\s*,\s*\{[^}]+\}\s*\)\s*;?\s*", "", txt)

    # 4. Renombrar aliases (useSc -> useState, etc.) cuando hay alias
    rename_lines = []
    for alias, orig in alias_pairs:
        if alias != orig:
            # solo si el alias se usa
            if re.search(rf"\b{alias}\b", txt):
                rename_lines.append(f"const {alias} = {orig};")

    # 5. Detectar componentes definidos como function FOO(...)
    component_defs = re.findall(r"^function\s+([A-Z]\w+)\s*\(", txt, re.MULTILINE)
    # Si no hay exports declarados, exportar TODOS los componentes top-level
    if not exported_names:
        exported_names = list(set(component_defs))
    # Tambien exportar constantes en MAYUSCULAS top-level (ej. ROLES, ROLE_PROMPTS)
    consts = re.findall(r"^const\s+([A-Z][A-Z_0-9]*)\s*=", txt, re.MULTILINE)
    for c in consts:
        if c not in exported_names:
            exported_names.append(c)

    # 6. Marcar como export cada definicion top-level que esta en exported_names
    for name in exported_names:
        # function NAME(...) -> export function NAME(...)
        txt = re.sub(rf"^function\s+{name}\b", f"export function {name}", txt, flags=re.MULTILINE)
        # const NAME = -> export const NAME =
        txt = re.sub(rf"^const\s+{name}\b", f"export const {name}", txt, flags=re.MULTILINE)

    # 7. Construir imports
    import_lines = ["'use client';"]
    if react_hooks:
        import_lines.append(f"import {{ {', '.join(sorted(react_hooks))} }} from 'react';")

    # Importar componentes externos referenciados
    by_module: dict[str, list[str]] = {}
    for name in referenced:
        mod = EXTERNAL_IMPORTS.get(name)
        if mod:
            by_module.setdefault(mod, []).append(name)
    for mod, names in by_module.items():
        import_lines.append(f"import {{ {', '.join(names)} }} from '{mod}';")

    header = "\n".join(import_lines) + "\n\n"
    if rename_lines:
        header += "\n".join(rename_lines) + "\n\n"

    dst_path.parent.mkdir(parents=True, exist_ok=True)
    dst_path.write_text(header + txt.lstrip(), encoding="utf-8")
    print(f"OK {src_path.name} -> {dst_path.name}")


def main() -> int:
    for fname, dst_name in FILES.items():
        port(SRC / fname, DST / dst_name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
