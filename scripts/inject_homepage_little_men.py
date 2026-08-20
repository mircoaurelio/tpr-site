"""Copy little-man SVGs into assets and inject them into the homepage people row."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "little-man" / "svg"
DST = ROOT / "assets" / "little-man"
HOME = ROOT / "homepage-tpr" / "index.html"

FIGURES = [
    ("coworking", "#coworking", "hover1", "COWORKING ROOM", "Coworking"),
    ("bar", "#bar", "hover4", "BAR ROOM", "Bar Room"),
    ("media", "#media", "hover5", "MEDIA ROOM", "Media"),
    ("reformer", "#reformer", "hover2", "REFORMER ROOM", "Reformer"),
    ("wellness", "#wellness", "hover3", "WELLNESS ROOM", "Wellness"),
]


def current_color(svg: str) -> str:
    return re.sub(r'fill="#[0-9a-fA-F]+"', 'fill="currentColor"', svg, count=1)


def main() -> None:
    DST.mkdir(parents=True, exist_ok=True)
    cards = []
    for key, href, hover, label, sr in FIGURES:
        svg = current_color((SRC / f"{key}.svg").read_text(encoding="utf-8")).strip()
        svg = re.sub(r'\srole="img" aria-label="[^"]+"', ' aria-hidden="true"', svg, count=1)
        (DST / f"{key}.svg").write_text(svg + "\n", encoding="utf-8")
        cards.append(
            "            "
            f'<a class="people-figure" href="{href}" data-room-link="{key}" '
            f'data-hover-state="{hover}" data-hover-label="{label}">\n'
            f"              {svg}\n"
            f'              <span class="sr-only">{sr}</span>\n'
            "            </a>"
        )

    html = HOME.read_text(encoding="utf-8")
    pattern = re.compile(
        r"        <nav class=\"people-nav\" aria-label=\"Scegli una room\">.*?"
        r"        </nav>",
        re.S,
    )
    replacement = (
        '        <nav class="people-nav" aria-label="Scegli una room">\n'
        '          <div class="people-canvas">\n'
        '            <div class="people-figures">\n'
        + "\n".join(cards)
        + "\n            </div>\n"
        '            <output class="people-tooltip" id="peopleTooltip" aria-hidden="true">'
        '<img src="../assets/hover-label-1.svg" alt="" width="275" height="80"></output>\n'
        "          </div>\n"
        "        </nav>"
    )
    if not pattern.search(html):
        raise SystemExit("people-nav block not found")
    HOME.write_text(pattern.sub(replacement, html, count=1), encoding="utf-8")
    print("updated", HOME)
    print("copied", list(p.name for p in DST.glob("*.svg")))


if __name__ == "__main__":
    main()
