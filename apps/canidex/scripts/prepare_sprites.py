#!/usr/bin/env python3

from __future__ import annotations

import argparse
import colorsys
import json
from collections import deque
from pathlib import Path

from PIL import Image


CHROMA_HEX = "#ff00aa"
CANVAS_SIZE = 256
TARGET_FOOTPRINT = 214


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    if len(value) != 6:
        raise ValueError(f"Expected 6-digit hex color, got {value!r}")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def is_chroma_background(r: int, g: int, b: int, a: int, chroma_rgb: tuple[int, int, int]) -> bool:
    if a == 0:
        return True
    cr, cg, cb = chroma_rgb
    if abs(r - cr) <= 12 and abs(g - cg) <= 12 and abs(b - cb) <= 12:
        return True
    h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
    deg = h * 360
    return 315 <= deg <= 345 and s > 0.5 and v > 0.4


def is_magenta_fringe(r: int, g: int, b: int, a: int) -> bool:
    if a == 0:
        return False
    h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
    deg = h * 360
    return 300 <= deg <= 355 and s >= 0.18 and v >= 0.18 and r >= g + 10 and b >= g + 8


def cleanup_chroma(img: Image.Image, chroma_rgb: tuple[int, int, int]) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if is_chroma_background(r, g, b, a, chroma_rgb) or is_magenta_fringe(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a == 0 and (r or g or b):
                px[x, y] = (0, 0, 0, 0)
    return img


def tight_crop(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("Image is fully transparent after cleanup")
    return img.crop(bbox)


def normalize_canvas(img: Image.Image, canvas_size: int, target_footprint: int) -> Image.Image:
    width, height = img.size
    scale = min(target_footprint / width, target_footprint / height)
    target_w = max(1, round(width * scale))
    target_h = max(1, round(height * scale))
    scaled = img.resize((target_w, target_h), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    offset_x = (canvas_size - target_w) // 2
    offset_y = (canvas_size - target_h) // 2
    canvas.alpha_composite(scaled, (offset_x, offset_y))
    return canvas


def prepare_single(input_path: Path, output_path: Path, chroma_rgb: tuple[int, int, int]) -> None:
    img = Image.open(input_path)
    cleaned = cleanup_chroma(img, chroma_rgb)
    cropped = tight_crop(cleaned)
    normalized = normalize_canvas(cropped, CANVAS_SIZE, TARGET_FOOTPRINT)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    normalized.save(output_path)


def extract_components(sheet_path: Path, chroma_rgb: tuple[int, int, int]) -> list[dict]:
    img = Image.open(sheet_path).convert("RGBA")
    px = img.load()
    width, height = img.size
    seen = [[False] * width for _ in range(height)]
    components: list[dict] = []

    for y in range(height):
        for x in range(width):
            if seen[y][x]:
                continue
            seen[y][x] = True
            if is_chroma_background(*px[x, y], chroma_rgb):
                continue
            q = deque([(x, y)])
            points = []
            min_x = max_x = x
            min_y = max_y = y
            while q:
                cx, cy = q.popleft()
                points.append((cx, cy))
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < width and 0 <= ny < height and not seen[ny][nx]:
                        seen[ny][nx] = True
                        if not is_chroma_background(*px[nx, ny], chroma_rgb):
                            q.append((nx, ny))
            if len(points) > 500:
                components.append(
                    {
                        "bbox": (min_x, min_y, max_x, max_y),
                        "points": points,
                        "cx": (min_x + max_x) / 2,
                        "cy": (min_y + max_y) / 2,
                    }
                )

    components.sort(key=lambda c: c["cy"])
    ordered = []
    for i in range(0, len(components), 4):
        ordered.extend(sorted(components[i : i + 4], key=lambda c: c["cx"]))
    return ordered


def component_to_image(sheet_path: Path, component: dict, chroma_rgb: tuple[int, int, int]) -> Image.Image:
    sheet = Image.open(sheet_path).convert("RGBA")
    src = sheet.load()
    min_x, min_y, max_x, max_y = component["bbox"]
    sprite = Image.new("RGBA", (max_x - min_x + 1, max_y - min_y + 1), (0, 0, 0, 0))
    dst = sprite.load()
    for x, y in component["points"]:
        dst[x - min_x, y - min_y] = src[x, y]
    sprite = cleanup_chroma(sprite, chroma_rgb)
    sprite = tight_crop(sprite)
    return normalize_canvas(sprite, CANVAS_SIZE, TARGET_FOOTPRINT)


def command_normalize(args: argparse.Namespace) -> None:
    chroma_rgb = hex_to_rgb(args.chroma)
    for input_value in args.inputs:
        input_path = Path(input_value)
        if args.output_dir:
            output_path = Path(args.output_dir) / input_path.name.replace("-source", "-transparent")
        else:
            output_path = input_path.with_name(input_path.name.replace("-source", "-transparent"))
        prepare_single(input_path, output_path, chroma_rgb)
        print(f"normalized {input_path} -> {output_path}")


def command_extract_sheet(args: argparse.Namespace) -> None:
    chroma_rgb = hex_to_rgb(args.chroma)
    sheet_path = Path(args.sheet)
    mapping = json.loads(Path(args.mapping).read_text())
    components = extract_components(sheet_path, chroma_rgb)
    if len(components) < len(mapping):
        raise ValueError(f"Sheet has {len(components)} components but mapping requires {len(mapping)}")
    for index, output_name in enumerate(mapping):
        img = component_to_image(sheet_path, components[index], chroma_rgb)
        output_path = Path(args.output_dir) / output_name
        output_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(output_path)
        print(f"extracted component {index + 1} -> {output_path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare Canidex sprite assets")
    subparsers = parser.add_subparsers(dest="command", required=True)

    normalize_parser = subparsers.add_parser("normalize", help="Normalize individual sprite source files")
    normalize_parser.add_argument("inputs", nargs="+", help="Source PNG files to prepare")
    normalize_parser.add_argument("--output-dir", help="Directory for prepared files")
    normalize_parser.add_argument("--chroma", default=CHROMA_HEX, help="Flat chroma background color")
    normalize_parser.set_defaults(func=command_normalize)

    extract_parser = subparsers.add_parser("extract-sheet", help="Extract normalized sprites from a batch sheet")
    extract_parser.add_argument("--sheet", required=True, help="Sprite sheet PNG path")
    extract_parser.add_argument("--mapping", required=True, help="JSON file listing output filenames in component order")
    extract_parser.add_argument("--output-dir", required=True, help="Directory for prepared output assets")
    extract_parser.add_argument("--chroma", default=CHROMA_HEX, help="Flat chroma background color")
    extract_parser.set_defaults(func=command_extract_sheet)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
