"""Trace raster elevator icons into real SVG paths with Potrace."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import potrace
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path("assets")
SRC = ROOT / "_inspect"
PREVIEW = SRC / "vector-preview"
PREVIEW.mkdir(exist_ok=True)

ROOMS = {
    "coworking": {"bg": "#98caff", "accent": "#2c64e8"},
    "reformer": {"bg": "#3f9941", "accent": "#ffc100"},
    "wellness": {"bg": "#c2d569", "accent": "#3f9941"},
    "bar": {"bg": "#eb642b", "accent": "#ffc100"},
    "media": {"bg": "#ffc100", "accent": "#2c64e8"},
}

SIZE = 124
SCALE = 6


def hex_to_rgb(value: str) -> np.ndarray:
    value = value.lstrip("#")
    return np.array([int(value[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.int16)


def load_rgba(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGBA"))


def upscale_mask(mask: np.ndarray, blur: float = 1.15) -> np.ndarray:
    image = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
    scaled = image.resize((SIZE * SCALE, SIZE * SCALE), Image.Resampling.LANCZOS)
    if blur:
        scaled = scaled.filter(ImageFilter.GaussianBlur(radius=blur))
    return np.array(scaled) > 128


def path_d(path: potrace.Path, scale: float) -> str:
    def fmt(point) -> str:
        return f"{point.x / scale:.2f} {point.y / scale:.2f}"

    parts: list[str] = []
    for curve in path:
        if curve.start_point is None:
            continue
        parts.append(f"M{fmt(curve.start_point)}")
        for segment in curve:
            if segment.is_corner:
                parts.append(f"L{fmt(segment.c)} L{fmt(segment.end_point)}")
            else:
                parts.append(
                    f"C{fmt(segment.c1)} {fmt(segment.c2)} {fmt(segment.end_point)}"
                )
        parts.append("Z")
    return " ".join(parts)


def trace_mask(
    mask: np.ndarray,
    *,
    turdsize: int = 4,
    alphamax: float = 0.9,
    blur: float = 1.15,
    opttolerance: float = 0.36,
) -> str:
    if not mask.any():
        return ""
    bitmap = potrace.Bitmap(~upscale_mask(mask, blur=blur))
    traced = bitmap.trace(
        turdsize=turdsize,
        alphamax=alphamax,
        opticurve=True,
        opttolerance=opttolerance,
    )
    return path_d(traced, SCALE)


def svg_doc(paths: list[tuple[str, str]], label: str) -> str:
    body = "\n".join(
        f'  <path fill="{color}" fill-rule="evenodd" d="{d}"/>'
        for color, d in paths
        if d.strip()
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" '
        f'role="img" aria-label="{label}">\n{body}\n</svg>\n'
    )


def off_mask(arr: np.ndarray) -> np.ndarray:
    return arr[..., 3] > 96


def fill_holes(mask: np.ndarray) -> np.ndarray:
    inverted = Image.fromarray((~mask).astype(np.uint8) * 255, mode="L")
    ImageDraw.floodfill(inverted, (0, 0), 0)
    holes = np.array(inverted) > 0
    return mask | holes


def erode(mask: np.ndarray, radius: int = 7) -> np.ndarray:
    size = radius * 2 + 1
    image = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
    return np.array(image.filter(ImageFilter.MinFilter(size))) > 128


def on_masks(on_arr: np.ndarray, off_arr: np.ndarray, bg: str, accent: str) -> tuple[np.ndarray, np.ndarray]:
    rgb = on_arr[..., :3].astype(np.int16)
    visible = on_arr[..., 3] > 96
    d_accent = np.linalg.norm(rgb - hex_to_rgb(accent), axis=2)
    d_bg = np.linalg.norm(rgb - hex_to_rgb(bg), axis=2)
    accent_pixels = visible & (d_accent + 12 < d_bg)
    blob = fill_holes(accent_pixels if accent_pixels.any() else visible)
    off_white = off_mask(off_arr)
    interior = erode(fill_holes(off_white), radius=8)
    glyph = off_white & interior
    return blob, glyph


def write_svg(name: str, paths: list[tuple[str, str]], label: str) -> None:
    dest = ROOT / name
    dest.write_text(svg_doc(paths, label), encoding="utf-8")
    print("wrote", dest.name, dest.stat().st_size, "bytes")


def raster_preview(name: str, paths: list[tuple[str, str]]) -> None:
    # Keep a cheap mask preview by compositing filled paths via cairosvg if present.
    try:
        import cairosvg
    except Exception:
        return
    svg = svg_doc(paths, name)
    png = cairosvg.svg2png(
        bytestring=svg.encode("utf-8"),
        output_width=248,
        output_height=248,
        background_color="black",
    )
    (PREVIEW / name).write_bytes(png)


def main() -> None:
    for room, colors in ROOMS.items():
        off_arr = load_rgba(SRC / f"elevator-icon-{room}-off.png")
        on_arr = load_rgba(SRC / f"elevator-icon-{room}.png")

        off_path = trace_mask(off_mask(off_arr), turdsize=8, alphamax=0.95, blur=1.2)
        write_svg(
            f"elevator-icon-{room}-off.svg",
            [("#ffffff", off_path)],
            f"{room.title()} room",
        )
        raster_preview(f"{room}-off-vector.png", [("#ffffff", off_path)])

        blob, glyph = on_masks(on_arr, off_arr, colors["bg"], colors["accent"])
        blob_path = trace_mask(blob, turdsize=10, alphamax=1.0, blur=1.35, opttolerance=0.4)
        glyph_path = trace_mask(glyph, turdsize=2, alphamax=0.85, blur=0.55, opttolerance=0.22)
        paths = [(colors["accent"], blob_path), ("#ffffff", glyph_path)]
        write_svg(f"elevator-icon-{room}.svg", paths, f"{room.title()} room")
        raster_preview(f"{room}-on-vector.png", paths)
        print(
            room,
            "off pts",
            off_path.count("C") + off_path.count("L"),
            "glyph pts",
            glyph_path.count("C") + glyph_path.count("L"),
        )


if __name__ == "__main__":
    main()
