#!/usr/bin/env python3
"""Wählt ein zufälliges Foto aus dem Ordner tallinn/ aus.

Aufruf:
    python3 zufallsfoto.py          # gibt den Pfad aus
    python3 zufallsfoto.py --open   # öffnet das Foto zusätzlich im Standard-Programm
"""
import argparse
import random
import subprocess
import sys
from pathlib import Path

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".avif"}
FOLDER = Path(__file__).resolve().parent / "tallinn"


def find_photos(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXT)


def open_file(path: Path) -> None:
    if sys.platform == "darwin":
        cmd = ["open", str(path)]
    elif sys.platform.startswith("win"):
        cmd = ["cmd", "/c", "start", "", str(path)]
    else:
        cmd = ["xdg-open", str(path)]
    subprocess.run(cmd, check=False)


def main() -> int:
    parser = argparse.ArgumentParser(description="Zufälliges Foto aus Tallinn auswählen")
    parser.add_argument("--open", action="store_true", help="Foto direkt öffnen")
    args = parser.parse_args()

    photos = find_photos(FOLDER)
    if not photos:
        print(f"Keine Fotos in {FOLDER} gefunden. Lege dort zuerst Bilder ab.", file=sys.stderr)
        return 1

    pick = random.choice(photos)
    print(pick)
    if args.open:
        open_file(pick)
    return 0


if __name__ == "__main__":
    sys.exit(main())
