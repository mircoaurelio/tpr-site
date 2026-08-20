"""Compose clean elevator icons from OFF SVG geometry + sprite colors.

ON icons are a solid scalloped sticker with no white ring:
  1. colored fill of the outer jagged shape (room accent)
  2. glyph in the room background color (light blue / dark green / lime / orange / yellow)
OFF icons stay white ring + white glyph on transparent.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path("assets")
SIZE = 124

ROOMS = {
    "coworking": {"fill": "#2c64e8", "glyph": "#98caff", "label": "Coworking room"},
    "reformer": {"fill": "#ffc100", "glyph": "#3f9941", "label": "Reformer room"},
    "wellness": {"fill": "#3f9941", "glyph": "#c2d569", "label": "Wellness room"},
    "bar": {"fill": "#ffc100", "glyph": "#eb642b", "label": "Bar room"},
    "media": {"fill": "#2c64e8", "glyph": "#ffc100", "label": "Media room"},
}


def subpaths(d: str) -> list[str]:
    parts = [part.strip() for part in re.split(r"Z", d) if part.strip()]
    return [f"{part} Z" for part in parts]


def read_off_geometry(room: str) -> tuple[str, str, str]:
    text = (ROOT / f"elevator-icon-{room}-off.svg").read_text(encoding="utf-8")
    ds = re.findall(r'\sd="([^"]+)"', text)
    if not ds:
        raise SystemExit(f"missing path in elevator-icon-{room}-off.svg")
    paths: list[str] = []
    for d in ds:
        paths.extend(subpaths(d))
    if len(paths) < 3:
        raise SystemExit(f"expected ring+glyph subpaths in {room} off icon, got {len(paths)}")
    outer, inner, glyph = paths[0], paths[1], " ".join(paths[2:])
    return outer, inner, glyph


def svg_doc(body: str, label: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" '
        f'role="img" aria-label="{label}">\n{body}</svg>\n'
    )


def write_svg(name: str, body: str, label: str) -> None:
    dest = ROOT / name
    dest.write_text(svg_doc(body, label), encoding="utf-8")
    print("wrote", dest.name, dest.stat().st_size, "bytes")


def raster_preview(name: str, svg: str) -> None:
    preview = ROOT / "_inspect" / "vector-preview"
    preview.mkdir(parents=True, exist_ok=True)
    try:
        import cairosvg
    except Exception:
        return
    png = cairosvg.svg2png(
        bytestring=svg.encode("utf-8"),
        output_width=248,
        output_height=248,
        background_color="black",
    )
    (preview / name).write_bytes(png)


def main() -> None:
    geometry = {room: read_off_geometry(room) for room in ROOMS}
    for room, colors in ROOMS.items():
        outer, inner, glyph = geometry[room]
        ring = f"{outer} {inner}"
        off_body = (
            f'  <path fill="#ffffff" fill-rule="evenodd" d="{ring}"/>\n'
            f'  <path fill="#ffffff" fill-rule="evenodd" d="{glyph}"/>\n'
        )
        on_body = (
            f'  <path fill="{colors["fill"]}" d="{outer}"/>\n'
            f'  <path fill="{colors["glyph"]}" fill-rule="evenodd" d="{glyph}"/>\n'
        )
        write_svg(f"elevator-icon-{room}-off.svg", off_body, colors["label"])
        write_svg(f"elevator-icon-{room}.svg", on_body, colors["label"])
        raster_preview(f"{room}-off-vector.png", svg_doc(off_body, colors["label"]))
        raster_preview(f"{room}-on-vector.png", svg_doc(on_body, colors["label"]))


if __name__ == "__main__":
    main()
