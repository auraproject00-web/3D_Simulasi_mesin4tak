"""Bangun halaman dari src/.

    python3 tools/build.py

Menulis:
  index.html                 halaman untuk repo / GitHub Pages; modul dimuat dari src/ dan three.js dari vendor/
  dist/mesin-bebek.html      satu file berisi semua modul, three.js dari CDN (untuk dibagikan sebagai satu halaman)
  dist/mesin-bebek.local.html  sama seperti di atas tetapi three.js dari vendor/, untuk uji tanpa internet
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
THREE_VERSION = "0.169.0"
ADDONS = {
    "three/addons/controls/OrbitControls.js",
    "three/addons/environments/RoomEnvironment.js",
    "three/addons/geometries/RoundedBoxGeometry.js",
}


def importmap(base_three, base_addons):
    return (
        '<script type="importmap">\n'
        f'{{ "imports": {{ "three": "{base_three}", "three/addons/": "{base_addons}" }} }}\n'
        "</script>\n"
    )


IMPORT_RE = re.compile(r"import\s*(\{[^}]*\}|\*\s+as\s+\w+)\s*from\s*'([^']+)';", re.S)


def split_top(s, sep=","):
    out, depth, cur, quote = [], 0, "", None
    for ch in s:
        if quote:
            cur += ch
            if ch == quote:
                quote = None
            continue
        if ch in "'\"`":
            quote = ch
        elif ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if ch == sep and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def statement_end(text, start):
    depth, quote, i = 0, None, start
    while i < len(text):
        ch = text[i]
        if quote:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
        elif ch in "'\"`":
            quote = ch
        elif ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == ";" and depth == 0:
            return i
        i += 1
    raise ValueError("statement tanpa titik koma")


def bundle(entry):
    mods, order, externals = {}, [], []

    def load(path):
        path = path.resolve()
        if path in mods:
            return
        text = path.read_text()
        deps = []
        for m in IMPORT_RE.finditer(text):
            spec = m.group(2)
            if spec.startswith("."):
                deps.append((path.parent / spec).resolve())
            elif m.group(0) not in externals:
                externals.append(m.group(0))
        mods[path] = text
        for d in deps:
            load(d)
        order.append(path)

    load(entry)
    ids = {p: "__m_" + re.sub(r"\W", "_", str(p.relative_to(SRC)).replace(".js", "")) for p in order}
    chunks = []
    for p in order:
        text = mods[p]

        def repl(m, p=p):
            spec = m.group(2)
            if not spec.startswith("."):
                return ""
            target = ids[(p.parent / spec).resolve()]
            names = m.group(1).strip()[1:-1]
            parts = []
            for n in split_top(names):
                n = " ".join(n.split())
                if not n:
                    continue
                if " as " in n:
                    a, b = n.split(" as ")
                    parts.append(f"{a.strip()}: {b.strip()}")
                else:
                    parts.append(n)
            return f"const {{ {', '.join(parts)} }} = {target};"

        text = IMPORT_RE.sub(repl, text)
        exports = []
        for m in re.finditer(r"^export\s+(async\s+)?function\s*\*?\s*(\w+)", text, re.M):
            exports.append(m.group(2))
        for m in re.finditer(r"^export\s+class\s+(\w+)", text, re.M):
            exports.append(m.group(1))
        for m in re.finditer(r"^export\s+(const|let|var)\s+", text, re.M):
            end = statement_end(text, m.end())
            for decl in split_top(text[m.end():end]):
                name = decl.split("=")[0].strip()
                if re.fullmatch(r"\w+", name):
                    exports.append(name)
        text = re.sub(r"^export\s+", "", text, flags=re.M)
        chunks.append(f"// ---- {p.relative_to(SRC)} ----\nconst {ids[p]} = (() => {{\n{text}\nreturn {{ {', '.join(exports)} }};\n}})();\n")
    return "\n".join(externals) + "\n\n" + "\n".join(chunks)


def main():
    template = (SRC / "page.html").read_text()
    head, rest = template.split("<!--BODY-->")
    body, _ = rest.split("<!--SCRIPTS-->")
    base_style = (
        "<style>\n:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }\n"
        "body { margin: 0; font: 14px system-ui, -apple-system, \"Segoe UI\", sans-serif; }\nimg { max-width: 100%; }\n[hidden] { display: none !important; }\n</style>\n"
    )
    index = (
        '<!doctype html>\n<html lang="id">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + base_style + head + "</head>\n<body>\n" + body
        + importmap("./vendor/three/three.module.js", "./vendor/three/addons/")
        + '<script type="module" src="./src/main.js"></script>\n</body>\n</html>\n'
    )
    (ROOT / "index.html").write_text(index)
    code = bundle(SRC / "main.js")
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    cdn = f"https://cdn.jsdelivr.net/npm/three@{THREE_VERSION}/"
    single = head + body + importmap(cdn + "build/three.module.js", cdn + "examples/jsm/") + '<script type="module">\n' + code + "</script>\n"
    (dist / "mesin-bebek.html").write_text(single)
    local = (
        '<!doctype html>\n<html lang="id">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + base_style + head + "</head>\n<body>\n" + body
        + importmap("../vendor/three/three.module.js", "../vendor/three/addons/")
        + '<script type="module">\n' + code + "</script>\n</body>\n</html>\n"
    )
    (dist / "mesin-bebek.local.html").write_text(local)
    print(f"index.html, dist/mesin-bebek.html ({len(single) // 1024} KB)")


if __name__ == "__main__":
    main()
