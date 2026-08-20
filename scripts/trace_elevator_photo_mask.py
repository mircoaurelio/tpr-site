"""Trace the shared elevator photo window from the coworking art overlay."""
from pathlib import Path

import numpy as np
from PIL import Image
from potrace import Bitmap
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
COLOR = np.array([152, 202, 255])


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
    image = np.array(Image.open(ASSETS / "homepage-room-coworking-no-text-2x.webp").convert("RGB"))
    overlay = np.abs(image.astype(np.int16) - COLOR.reshape(1, 1, 3)).sum(axis=2) < 42
    window = ~overlay
    window[:, -8:] = False
    window = ndimage.binary_opening(window, iterations=2)
    window = ndimage.binary_closing(window, iterations=3)
    labeled, count = ndimage.label(window)
    sizes = ndimage.sum(window, labeled, range(1, count + 1))
    window = labeled == (int(np.argmax(sizes)) + 1)
    mask = np.array(
        Image.fromarray(window.astype(np.uint8) * 255).resize((1512, 952), Image.Resampling.NEAREST)
    ) > 127
    paths = Bitmap(~mask).trace(turdsize=8, alphamax=0.9, opttolerance=0.2)
    d = " ".join(curve_to_d(curve) for curve in paths)
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1512 952" preserveAspectRatio="none">\n'
        f'  <path fill="#fff" d="{d}"/>\n'
        "</svg>\n"
    )
    out = ASSETS / "elevator-photo-mask.svg"
    out.write_text(svg, encoding="utf-8")
    rgba = np.zeros((*mask.shape, 4), dtype=np.uint8)
    rgba[mask] = (255, 255, 255, 255)
    Image.fromarray(rgba, "RGBA").save(ASSETS / "elevator-photo-mask.png")
    print(f"wrote {out.name} bytes={out.stat().st_size} window={mask.mean():.2%}")


if __name__ == "__main__":
    main()
