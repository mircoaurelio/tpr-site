"""Extract original menu vector operators from the supplied Menu_TPR.pdf.

Usage: python scripts/import_menu_export.py path/to/Menu_TPR.pdf
Requires pypdf. No artwork is traced or approximated.
"""
import hashlib
import json
from pathlib import Path
import sys

from pypdf import PdfReader
from pypdf.generic import ContentStream

ROOT = Path(__file__).resolve().parents[1]


def svg_block(operations):
    transform = None
    color = None
    commands = []
    paths = []
    for args, operator in operations:
        if operator == b"cm":
            assert transform is None, "Unexpected nested transform"
            transform = "matrix(" + " ".join(map(str, args)) + ")"
        elif operator == b"scn":
            assert len(args) == 3
            color = "#" + "".join(f"{round(float(c) * 255):02x}" for c in args)
        elif operator in (b"m", b"l", b"c"):
            commands.append(operator.decode().upper() + " ".join(map(str, args)))
        elif operator == b"h":
            commands.append("Z")
        elif operator in (b"f", b"f*"):
            rule = ' fill-rule="evenodd"' if operator == b"f*" else ""
            paths.append(f'<path fill="{color}"{rule} d="{" ".join(commands)}"/>')
            commands = []
        elif operator not in (b"q", b"Q", b"n"):
            raise ValueError(f"Unsupported source operator: {operator!r}")
    assert not commands and paths and transform
    return f'<g transform="{transform}">' + "".join(paths) + "</g>"


def main(source):
    reader = PdfReader(source)
    assert len(reader.pages) == 1
    page = reader.pages[0]
    assert list(map(float, page.mediabox)) == [0, 0, 1512, 982]
    form = page["/Resources"]["/XObject"]["/X1"].get_object()
    operations = ContentStream(form, reader).operations
    blocks, depth, start = [], 0, None
    for index, (_, operator) in enumerate(operations):
        if operator == b"q":
            if depth == 0:
                start = index
            depth += 1
        elif operator == b"Q":
            depth -= 1
            if depth == 0:
                blocks.append(operations[start:index + 1])
    assert depth == 0
    output = ROOT / "assets/figma-updated/menu"
    output.mkdir(parents=True, exist_ok=True)
    products = {}

    def write(name, viewbox, indices):
        # PDF y=952 is the actual page top after omitting 30px mock macOS chrome.
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">'
               '<g transform="matrix(1 0 0 -1 0 952)">'
               + "".join(svg_block(blocks[i]) for i in indices) + "</g></svg>\n")
        (output / name).write_text(svg, encoding="utf-8")
        products[name] = {"source_form": "/X1", "source_blocks": indices,
                          "viewBox": viewbox, "sha256": hashlib.sha256(svg.encode()).hexdigest()}

    write("background.svg", "0 0 1512 952", [0, 1])
    for key, x, indices in [
        ("coworking", 572, [4, 5]), ("wellness", 652, [6, 7]),
        ("media", 732, [8, 9]), ("reformer", 812, [10, 11]),
        ("bar", 892, [12, 13, 14, 15]),
    ]:
        # Keep the original 54px contour plus its 2px outward stroke geometry.
        write(f"{key}.svg", f"{x - 2} 394.600586 58 58", indices)
    provenance = {
        "source": "2_AGGIORNATO/Menu/Menu_TPR.pdf",
        "source_sha256": hashlib.sha256(Path(source).read_bytes()).hexdigest(),
        "source_canvas": [1512, 982], "content_canvas": [1512, 952],
        "omitted_mock_browser_chrome": 30,
        "method": "Original PDF vector commands, colors, transforms and compound-path winding preserved.",
        "room_order": ["coworking", "wellness", "media", "reformer", "bar"],
        "assets": products,
    }
    (output / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(products)} original menu SVGs")


if __name__ == "__main__":
    main(sys.argv[1])
