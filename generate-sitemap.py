#!/usr/bin/env python3
"""Rigenera sitemap.xml a partire dalle pagine .html presenti nella cartella
e dalla loro data di ultima modifica su git. Da rilanciare ogni volta che si
aggiunge o rimuove una pagina.

Uso: python3 generate-sitemap.py
"""
import subprocess
from pathlib import Path

BASE_URL = "https://rafdepprj.github.io/comestasolofra/"
ROOT = Path(__file__).parent

def last_modified(path):
    out = subprocess.run(
        ["git", "log", "-1", "--format=%ad", "--date=short", "--", path],
        cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout.strip()
    return out

def main():
    pages = sorted(p.name for p in ROOT.glob("*.html"))
    entries = []
    for page in pages:
        loc = BASE_URL if page == "index.html" else BASE_URL + page
        lastmod = last_modified(page)
        entries.append((loc, lastmod))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lastmod in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        if lastmod:
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")

    (ROOT / "sitemap.xml").write_text("\n".join(lines), encoding="utf-8")
    print(f"sitemap.xml aggiornata con {len(entries)} pagine.")

if __name__ == "__main__":
    main()
