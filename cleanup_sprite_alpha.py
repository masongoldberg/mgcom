#!/usr/bin/env python3
"""Remove chroma-colored edge pixels from transparent sprite assets.

This is a post-process cleanup for Aviadex sprites generated on a hot pink
background. It only targets visible pixels on the transparency boundary, which
helps remove magenta gaps around feet and other tight shapes without damaging
interior plumage colors.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

from PIL import Image


def is_magenta_spill(r: int, g: int, b: int) -> bool:
    return r > 150 and b > 120 and g < 120 and r > g + 30 and b > g + 20


def cleanup(path: Path) -> int:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    to_clear: list[tuple[int, int]] = []

    for y in range(1, height - 1):
      for x in range(1, width - 1):
        r, g, b, a = pixels[x, y]
        if a == 0 or not is_magenta_spill(r, g, b):
            continue

        neighbors = [
            pixels[x + 1, y][3],
            pixels[x - 1, y][3],
            pixels[x, y + 1][3],
            pixels[x, y - 1][3],
            pixels[x + 1, y + 1][3],
            pixels[x - 1, y - 1][3],
            pixels[x + 1, y - 1][3],
            pixels[x - 1, y + 1][3],
        ]

        if any(alpha == 0 for alpha in neighbors):
            to_clear.append((x, y))

    for x, y in to_clear:
        r, g, b, _a = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)

    # Decontaminate fully transparent pixels bordering visible sprite pixels.
    # Browsers can sample RGB from alpha-0 pixels during scaling, which causes
    # hot-pink chroma bleed in gaps like the space between feet.
    to_recolor: list[tuple[int, int, tuple[int, int, int]]] = []
    for y in range(1, height - 1):
        for x in range(1, width - 1):
            r, g, b, a = pixels[x, y]
            if a != 0:
                continue

            neighbor_rgbs: list[tuple[int, int, int]] = []
            for nx, ny in (
                (x + 1, y),
                (x - 1, y),
                (x, y + 1),
                (x, y - 1),
                (x + 1, y + 1),
                (x - 1, y - 1),
                (x + 1, y - 1),
                (x - 1, y + 1),
            ):
                nr, ng, nb, na = pixels[nx, ny]
                if na > 0:
                    neighbor_rgbs.append((nr, ng, nb))

            if not neighbor_rgbs:
                continue

            avg = tuple(round(sum(channel) / len(neighbor_rgbs)) for channel in zip(*neighbor_rgbs))
            to_recolor.append((x, y, avg))

    for x, y, (r, g, b) in to_recolor:
        pixels[x, y] = (r, g, b, 0)

    image.save(path)
    return len(to_clear)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", help="Transparent PNG sprite paths.")
    args = parser.parse_args()

    total = 0
    for raw_path in args.paths:
        path = Path(raw_path)
        if not path.exists():
            print(f"missing: {path}", file=sys.stderr)
            return 1
        cleared = cleanup(path)
        total += cleared
        print(f"{path}: cleared {cleared} edge pixels")

    print(f"total cleared: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
