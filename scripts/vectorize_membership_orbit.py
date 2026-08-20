"""Trace the Figma yellow membership orbit into an SVG that keeps export size."""
from __future__ import annotations

from pathlib import Path
from shutil import copyfile

import numpy as np
from PIL import Image
from potrace import Bitmap

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    r"C:\Users\mirco.devito\AppData\Roaming\Cursor\User\workspaceStorage"
    r"\empty-window\images\Vector (2)-28848d77-7106-4680-9db2-9ecfb138bda3.png"
)
DST_SVG = ROOT / "assets" / "membership-orbit.svg"
DST_PNG = ROOT / "assets" / "membership-orbit.png"


def fmt(n: float) -> str:
    value = round(float(n), 2)
    if value.is_integer():
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def xy(point) -> str:
    return f"{fmt(point.x)} {fmt(point.y)}"


def curve_to_d(curve) -> str:
    parts = [f"M{xy(curve.start_point)}"]
    for segment in curve:
        if segment.is_corner:
            parts.append(f"L{xy(segment.c)} L{xy(segment.end_point)}")
        else:
            parts.append(f"C{xy(segment.c1)} {xy(segment.c2)} {xy(segment.end_point)}")
    parts.append("Z")
    return " ".join(parts)


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    copyfile(SRC, DST_PNG)

    arr = np.array(im)
    yellow = (arr[:, :, 0] > 180) & (arr[:, :, 1] > 140) & (arr[:, :, 2] < 80) & (arr[:, :, 3] > 128)
    paths = Bitmap(~yellow).trace(turdsize=4, alphamax=0.8, opttolerance=0.25)
    d = " ".join(curve_to_d(curve) for curve in paths)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" fill="none">\n'
        f'  <path fill="#ffc100" d="{d}"/>\n'
        f"</svg>\n"
    )
    DST_SVG.write_text(svg, encoding="utf-8")
    print("wrote", DST_SVG.name, DST_SVG.stat().st_size, "viewBox", w, h, "curves", len(paths))
    print("wrote", DST_PNG.name, DST_PNG.stat().st_size, DST_PNG)


if __name__ == "__main__":
    main()
