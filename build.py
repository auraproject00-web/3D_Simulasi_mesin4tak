"""Gabungkan src/ menjadi satu file index.html yang bisa dibuka langsung atau di GitHub Pages.

    python3 build.py
"""
from pathlib import Path

root = Path(__file__).parent
sim = (root / "src/sim.js").read_text().replace("export ", "")
app = (root / "src/app.js").read_text().replace("/*SIM*/", sim)
body = (root / "src/page.html").read_text().replace("/*APP*/", app)

head = """<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; font: 14px system-ui, -apple-system, "Segoe UI", sans-serif; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
"""
# <title>, <meta>, <link> dan <style> milik halaman masuk ke <head>, sisanya ke <body>
split = body.index('<div class="wrap">')
html = head + body[:split] + "</head>\n<body>\n" + body[split:] + "\n</body>\n</html>\n"
(root / "index.html").write_text(html)
print(f"index.html ditulis ({len(html) // 1024} KB)")
