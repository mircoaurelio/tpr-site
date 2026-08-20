"""Trace each room character PNG into grouped SVG paths (person vs objects)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from potrace import Bitmap
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ROOT / "little-man" / "svg"
OUT.mkdir(parents=True, exist_ok=True)

ROOMS = {
    "coworking": {"file": "character-coworking.png", "fill": "#2c64e8", "split": None},
    "bar": {"file": "character-bar.png", "fill": "#ffc100", "split": {"mode": "overlap", "y": 252, "overlap": 36, "torso_y": 260, "torso_pad": 6}},
    "media": {"file": "character-media.png", "fill": "#2c64e8", "split": {"mode": "arch", "cap_end": 206, "arch_end": 242, "overlap": 28}},
    "reformer": {"file": "character-reformer.png", "fill": "#ffc100", "split": None},
    "wellness": {"file": "character-wellness.png", "fill": "#3f9941", "split": None},
}


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


def trace_mask(mask: np.ndarray) -> str:
    if not mask.any():
        return ""
    paths = Bitmap(~mask).trace(turdsize=2, alphamax=0.9, opttolerance=0.2)
    return " ".join(curve_to_d(curve) for curve in paths)


def row_runs(row: np.ndarray) -> list[tuple[int, int]]:
    xs = np.flatnonzero(row)
    if xs.size == 0:
        return []
    gaps = np.where(np.diff(xs) > 1)[0]
    starts = np.concatenate(([xs[0]], xs[gaps + 1]))
    ends = np.concatenate((xs[gaps], [xs[-1]]))
    return [(int(start), int(end)) for start, end in zip(starts, ends)]


def split_overlap(body: np.ndarray, yy: np.ndarray, spec: dict) -> tuple[np.ndarray, np.ndarray]:
    split_y = int(spec["y"])
    overlap = int(spec["overlap"])
    upper = body & (yy < split_y + overlap)
    lower = body & (yy >= split_y - overlap)
    torso_y = spec.get("torso_y")
    upper = ndimage.binary_dilation(upper, iterations=3)
    lower = ndimage.binary_dilation(lower, iterations=3)
    lower = lower & body
    upper = upper & body
    if torso_y is not None:
        xs = np.flatnonzero(body[int(torso_y)])
        if xs.size:
            pad = int(spec.get("torso_pad", 0))
            left = max(0, int(xs.min()) - pad)
            right = min(body.shape[1] - 1, int(xs.max()) + pad)
            lower = lower.copy()
            lower[:split_y, :left] = False
            lower[:split_y, right + 1 :] = False
    return lower, upper


def split_arch(body: np.ndarray, spec: dict) -> tuple[np.ndarray, np.ndarray]:
    h, w = body.shape
    cap_end = int(spec["cap_end"])
    arch_end = int(spec["arch_end"])
    overlap = int(spec["overlap"])
    dome = np.zeros_like(body, dtype=bool)
    dome[:cap_end] = body[:cap_end]
    for y in range(cap_end, arch_end):
        runs = row_runs(body[y])
        if not runs:
            continue
        left0, left1 = runs[0]
        right0, right1 = runs[-1]
        dome[y, left0 : left1 + 1] = True
        if len(runs) > 1:
            dome[y, right0 : right1 + 1] = True
    person = body.copy()
    person[: arch_end - overlap] = body[: arch_end - overlap] & ~dome[: arch_end - overlap]
    dome = ndimage.binary_dilation(dome, iterations=4) & ndimage.binary_dilation(body, iterations=2)
    person = ndimage.binary_dilation(person, iterations=3) & ndimage.binary_dilation(body, iterations=2)
    return person, dome


def masks_for(name: str, split: dict | None) -> list[tuple[str, np.ndarray]]:
    arr = np.array(Image.open(ASSETS / name).convert("RGBA"))
    ink = (arr[:, :, 3] > 40) & (arr[:, :, 0:3].max(axis=2) > 40)
    h, w = ink.shape
    yy = np.arange(h)[:, None]
    labeled, count = ndimage.label(ink)
    parts: list[tuple[np.ndarray, int]] = []

    for index in range(1, count + 1):
        component = labeled == index
        pixels = int(component.sum())
        if pixels < 8:
            continue
        parts.append((component, pixels))

    parts.sort(key=lambda item: item[1], reverse=True)
    body = parts[0][0]
    objects = [item[0] for item in parts[1:]]

    if split:
        if split["mode"] == "overlap":
            body, upper = split_overlap(body, yy, split)
            objects.append(upper)
        elif split["mode"] == "arch":
            body, dome = split_arch(body, split)
            objects.append(dome)

    def centroid_y(mask: np.ndarray) -> float:
        ys = np.where(mask)[0]
        return float(ys.mean()) if ys.size else 0.0

    objects.sort(key=centroid_y)
    labeled_parts = [("person", body)]
    for i, mask in enumerate(objects, start=1):
        labeled_parts.append((f"object-{i}", mask))
    return labeled_parts


def svg_for(room: str, spec: dict) -> str:
    im = Image.open(ASSETS / spec["file"])
    w, h = im.size
    groups = []
    person_paths = []
    object_paths = []
    for role, mask in masks_for(spec["file"], spec["split"]):
        d = trace_mask(mask)
        if not d:
            continue
        path = f'      <path fill-rule="evenodd" d="{d}"/>'
        if role == "person":
            person_paths.append(path)
        else:
            object_paths.append(
                f'    <g class="object {role}">\n{path}\n    </g>'
            )
    groups.append('    <g class="person">\n' + "\n".join(person_paths) + "\n    </g>")
    groups.append('    <g class="objects">\n' + "\n".join(object_paths) + "\n    </g>")
    return (
        f'<svg class="little-man little-man--{room}" viewBox="0 0 {w} {h}" '
        f'xmlns="http://www.w3.org/2000/svg" fill="{spec["fill"]}" '
        f'role="img" aria-label="{room}">\n'
        + "\n".join(groups)
        + "\n</svg>\n"
    )


def main() -> None:
    for room, spec in ROOMS.items():
        svg = svg_for(room, spec)
        dest = OUT / f"{room}.svg"
        dest.write_text(svg, encoding="utf-8")
        print("wrote", dest.name, dest.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
