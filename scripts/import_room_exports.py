"""Import original Figma Room PDF layers without changing Room interaction geometry.

The PDF is never modified on disk. Temporary in-memory pages isolate original
painting operators for Poppler. Alpha fronts use independent black/white mattes;
no screen tracing, color replacement, or photo inpainting is used.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import date
import hashlib
from io import BytesIO
import json
from pathlib import Path
import shutil
import subprocess
import zlib

import numpy as np
from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, DecodedStreamObject, EncodedStreamObject, NameObject, NumberObject

ROOT = Path(__file__).resolve().parents[1]
CANVAS = [3432, 952]
FRAME_X = [1512, 2152, 2792]
SLUGS = {
    "coworking": ["postazioni", "sale-riunioni", "eventi"],
    "reformer": ["studio", "classi", "attrezzature"],
    "wellness": ["gym", "contrast-therapy", "longevity"],
    "bar": ["servizi", "accessibilita", "storage"],
    "media": ["podcast", "set-fotografico", "studio-audio"],
}
IDENTITY = (1, 0, 0, 1, 0, 0)
PAINT = {b"f", b"f*", b"S", b"s", b"B", b"B*", b"b", b"b*"}
TEXT_PAINT = {b"Tj", b"TJ", b"'", b'"'}


class PaintOperations(list):
    def __init__(self, items, strip_footers=False):
        super().__init__(items)
        self.strip_footers = strip_footers


def multiply(a, b):
    return (a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
            a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
            a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5])


def transformed(matrix, x, y):
    return (matrix[0]*x+matrix[2]*y+matrix[4], matrix[1]*x+matrix[3]*y+matrix[5])


def bounds(points):
    return (min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)) if points else None


def within(box, region):
    return bool(box and box[0] >= region[0] and box[1] >= region[1] and box[2] <= region[2] and box[3] <= region[3])


def digest(data):
    return hashlib.sha256(data).hexdigest()


def without_footer(operations, region):
    matrix, stack, points, result = IDENTITY, [], [], []
    for args, operator in operations:
        if operator == b"q":
            stack.append(matrix)
        elif operator == b"Q":
            matrix = stack.pop()
        elif operator == b"cm":
            matrix = multiply(matrix, list(map(float, args)))
        elif operator in (b"m", b"l", b"c", b"v", b"y"):
            points.extend(transformed(matrix, float(args[i]), float(args[i+1])) for i in range(0, len(args), 2))
        elif operator == b"re":
            x,y,width,height = map(float,args)
            points.extend(transformed(matrix, px, py) for px,py in ((x,y),(x+width,y),(x+width,y+height),(x,y+height)))
        elif operator in PAINT:
            if within(bounds(points), region):
                operator = b"n"
            points = []
        elif operator == b"n":
            points = []
        elif operator in TEXT_PAINT:
            continue
        result.append((args, operator))
    return result


class RoomSource:
    def __init__(self, path, source_node):
        self.path = Path(path)
        self.reader = PdfReader(self.path)
        if len(self.reader.pages) != 1:
            raise ValueError("Expected one complete Room frame per PDF")
        self.page = self.reader.pages[0]
        if [float(self.page.mediabox.width), float(self.page.mediabox.height)] != CANVAS:
            raise ValueError("Use the complete 3432×952 Room PDF, not the cropped _dentro variant")
        forms = [(name, ref) for name, ref in self.page["/Resources"]["/XObject"].items() if ref.get_object().get("/Subtype") == "/Form"]
        if len(forms) != 1:
            raise ValueError("Expected a single original graphics Form")
        self.root_name, self.root_ref = forms[0]
        self.root = self.root_ref.get_object()
        self.operations = ContentStream(self.root, self.reader).operations
        self.resources = self.root["/Resources"]["/XObject"]
        self.draws = list(self.walk_draws(self.root))
        self.direct_images = [draw for draw in self.draws if draw[1].get_object().get("/Subtype") == "/Image"]
        self.cards = {}
        for name, reference, _ in self.draws:
            obj = reference.get_object()
            if obj.get("/Subtype") != "/Form":
                continue
            for args, operator in ContentStream(obj, self.reader).operations:
                if operator == b"cm" and any(abs(float(args[4])-x) < .01 for x in FRAME_X) and abs(float(args[5])-259) < .01:
                    self.cards[round(float(args[4]))] = (name, reference)
                    break
        if set(self.cards) != set(FRAME_X):
            raise ValueError("The three original 560×434 Card Front Forms were not identified")
        self.provenance = {"file": self.path.name, "sha256": digest(self.path.read_bytes()), "node": source_node, "page": 1, "canvas": CANVAS}
        self.poppler = shutil.which("pdftoppm")
        if not self.poppler:
            raise RuntimeError("pdftoppm is required")

    def walk_draws(self, obj, parent=IDENTITY):
        matrix = parent
        stack = []
        for args, operator in ContentStream(obj, self.reader).operations:
            if operator == b"q":
                stack.append(matrix)
            elif operator == b"Q":
                matrix = stack.pop()
            elif operator == b"cm":
                matrix = multiply(matrix, list(map(float, args)))
            elif operator == b"Do":
                yield args[0], obj["/Resources"]["/XObject"].raw_get(args[0]), matrix

    def descendant_images(self, obj):
        for _, reference, matrix in self.walk_draws(obj):
            child = reference.get_object()
            if child.get("/Subtype") == "/Image":
                yield reference, matrix
            elif child.get("/Subtype") == "/Form":
                yield from self.descendant_images(child)

    def filter_graphics(self, mode, selected=None):
        """Omit source paint, retaining all original clip paths and transforms."""
        matrix = IDENTITY
        stack, points, result = [], [], []
        selected_frame = (selected-8, 251, selected+568, 701) if isinstance(selected, int) else None
        card_regions = [(x-8, 251, x+568, 701) for x in FRAME_X]
        for args, operator in self.operations:
            if operator == b"q":
                stack.append(matrix)
            elif operator == b"Q":
                matrix = stack.pop()
            elif operator == b"cm":
                matrix = multiply(matrix, list(map(float, args)))
            elif operator in (b"m", b"l", b"c", b"v", b"y"):
                points.extend(transformed(matrix, float(args[i]), float(args[i+1])) for i in range(0, len(args), 2))
            elif operator == b"re":
                x, y, width, height = map(float, args)
                points.extend(transformed(matrix, px, py) for px, py in ((x,y), (x+width,y), (x+width,y+height), (x,y+height)))
            elif operator in PAINT:
                box = bounds(points)
                if mode == "front":
                    keep = within(box, selected_frame)
                elif mode in ("photos", "mask"):
                    keep = False
                elif mode == "fallback":
                    keep = not within(box, (740, 200, 1504, 740))
                else:
                    keep = not (any(within(box, region) for region in card_regions) or within(box, (740, 200, 1504, 740)))
                if not keep:
                    operator = b"n"
                points = []
            elif operator == b"n":
                points = []
            elif operator == b"Do":
                child = self.resources[args[0]].get_object()
                if mode == "front":
                    keep = args[0] == self.cards[selected][0]
                elif mode == "mask":
                    keep = args[0] == selected
                elif mode in ("background", "photos"):
                    keep = child.get("/Subtype") == "/Image"
                elif mode == "fallback":
                    keep = child.get("/Subtype") == "/Image" or args[0] in {value[0] for value in self.cards.values()} or bool(list(self.descendant_images(child)))
                else:
                    keep = False
                if not keep:
                    continue
            elif operator in TEXT_PAINT:
                continue
            result.append((args, operator))
        return PaintOperations(result, strip_footers=mode == "fallback")

    def bytes_for(self, operations, matte=1, white_image=None):
        writer = PdfWriter()
        writer.add_page(self.page)
        page = writer.pages[0]
        original = page["/Resources"]["/XObject"][self.root_name].get_object()
        replacement = DecodedStreamObject()
        for key, value in original.items():
            if key not in ("/Length", "/Filter", "/DecodeParms"):
                replacement[key] = value
        # Do not mutate the writer's shared original Resources dictionary.
        replacement[NameObject("/Resources")] = deepcopy(original["/Resources"])
        if getattr(operations, "strip_footers", False):
            objects = replacement["/Resources"]["/XObject"]
            for x, (name, _) in self.cards.items():
                card = objects[name].get_object()
                cleaned = DecodedStreamObject()
                for key, value in card.items():
                    if key not in ("/Length", "/Filter", "/DecodeParms"):
                        cleaned[key] = value
                content = ContentStream(None, writer)
                content.operations = without_footer(ContentStream(card, writer).operations, (x-8, 251, x+568, 363))
                cleaned.set_data(content.get_data())
                objects[name] = writer._add_object(cleaned)
        if white_image:
            images = replacement["/Resources"]["/XObject"]
            image = images[white_image].get_object()
            white = EncodedStreamObject()
            for key in ("/Width", "/Height", "/SMask", "/Interpolate"):
                if key in image:
                    white[NameObject(key)] = image.raw_get(key)
            white.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Image"), NameObject("/ColorSpace"): NameObject("/DeviceGray"), NameObject("/BitsPerComponent"): NumberObject(8), NameObject("/Filter"): NameObject("/FlateDecode")})
            white._data = zlib.compress(b"\xff" * (int(image["/Width"]) * int(image["/Height"])))
            images[white_image] = writer._add_object(white)
        stream = ContentStream(None, writer)
        stream.operations = operations
        replacement.set_data(stream.get_data())
        page["/Resources"]["/XObject"][self.root_name] = writer._add_object(replacement)
        content = DecodedStreamObject()
        # Source page text is accessibility metadata. The original visual
        # captions are paths inside the isolated Card Front Form.
        prefix = f"q {matte} g 0 0 3432 952 re f Q\n".encode()
        content.set_data(prefix + b"/C1 CS /C1 cs\n" * ("/C1" in page["/Resources"].get("/ColorSpace", {})) + b"q " + str(self.root_name).encode() + b" Do Q\n")
        page[NameObject("/Contents")] = writer._add_object(content)
        output = BytesIO()
        writer.write(output)
        return output.getvalue()

    def render(self, operations, crop=None, matte=1, white_image=None):
        command = [self.poppler, "-png", "-r", "144", "-singlefile", "-q"]
        if crop:
            x, y, width, height = crop
            command += ["-x", str(x*2), "-y", str(y*2), "-W", str(width*2), "-H", str(height*2)]
        command += ["-"]
        result = subprocess.run(command, input=self.bytes_for(operations, matte, white_image), capture_output=True, check=True)
        return Image.open(BytesIO(result.stdout)).convert("RGB")

    def alpha_render(self, operations, crop):
        white = np.asarray(self.render(operations, crop, 1)).astype(np.float32)
        black = np.asarray(self.render(operations, crop, 0)).astype(np.float32)
        alpha = np.clip(255 - (white-black).max(axis=2), 0, 255)
        rgb = np.clip(np.rint(black*255/np.maximum(alpha[..., None], 1)), 0, 255).astype(np.uint8)
        return Image.fromarray(np.dstack([rgb, alpha.astype(np.uint8)]))


def save_webp(root, relative, image):
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", lossless=True, quality=100, method=6, exact=True)
    decoded = Image.open(target).convert(image.mode)
    if decoded.size != image.size or decoded.tobytes() != image.tobytes():
        raise ValueError("WebP pixels differ from the original extracted raster: " + relative)
    return relative


def save_raw(source, reference, root, relative):
    obj = reference.get_object()
    data = obj.get_data()
    if not data.startswith(b"\xff\xd8"):
        raise ValueError("Expected an embedded JPEG; refusing to re-encode source bytes")
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    result = {"path": relative, "sha256": digest(data), "width": int(obj["/Width"]), "height": int(obj["/Height"]), "pdf": source.path.name, "xref": reference.idnum}
    if "/SMask" in obj:
        alpha = obj["/SMask"].get_data()
        result["intrinsic_alpha_opaque"] = alpha.count(255) == len(alpha)
    return result


def json_file(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def import_room(room, pdf, output_root, source_node, update_registry=False):
    root = Path(output_root)
    source = RoomSource(pdf, source_node)
    prefix = f"assets/figma-updated/composites/room-{room}"
    image = source.render(source.filter_graphics("background"))
    record = {"source": source.provenance, "background": save_webp(root, prefix+"-panorama-background-2x.webp", image), "artwork": save_webp(root, prefix+"-artwork-2x.webp", image.crop((0,0,3024,1904))), "cards": [], "photoLayers": []}
    print(f"{room}: original source background isolated", flush=True)
    plain = source.render(source.filter_graphics("without-photos"))
    record["backgroundWithoutPhotos"] = save_webp(root, prefix+"-background-without-photos-2x.webp", plain)
    record["artworkWithoutPhotos"] = save_webp(root, prefix+"-artwork-without-photos-2x.webp", plain.crop((0,0,3024,1904)))
    record["photoComposite"] = save_webp(root, prefix+"-masked-photos-2x.webp", source.alpha_render(source.filter_graphics("photos"), (0,0,1512,952)))
    for index, (name, reference, matrix) in enumerate(source.direct_images):
        raw = save_raw(source, reference, root, f"assets/figma-updated/photos/room-{room}-primary-{index+1}-source.jpeg")
        width, height = raw["width"], raw["height"]
        a,b,c,d,e,f = matrix
        css = [a/width, -b/width, -c/height, d/height, e+c, 952-d-f]
        alpha = source.render(source.filter_graphics("mask", name), (0,0,1512,952), matte=0, white_image=name).getchannel("R")
        mask = Image.new("RGBA", alpha.size, "white")
        mask.putalpha(alpha)
        record["photoLayers"].append({"raw": raw["path"], "rawSize": [width,height], "matrix": css, "mask": save_webp(root, prefix+f"-photo-mask-{index+1}-2x.webp", mask), "maskFrame": [0,0,1512,952], "source": raw})
    for index, x in enumerate(FRAME_X):
        slug = SLUGS[room][index]
        crop = [x-8, 251, 576, 450]
        front = source.alpha_render(source.filter_graphics("front", x), crop)
        front_path = save_webp(root, prefix+f"-card-{slug}-front-2x.webp", front)
        photo = front.crop((16,16,1136,692))
        window = Image.new("RGB", photo.size, "white")
        window.paste(photo, mask=photo.getchannel("A"))
        photo_path = save_webp(root, f"assets/figma-updated/photos/room-{room}-{slug}-window-2x.webp", window)
        name, reference = source.cards[x]
        images = list(source.descendant_images(reference.get_object()))
        raw = save_raw(source, images[-1][0], root, f"assets/figma-updated/photos/room-{room}-{slug}-source.jpeg") if images else None
        record["cards"].append({"role": f"rooms.{room}.cards.{slug}", "front": front_path, "crop": crop, "nominalFrame": [x,259,560,434], "photo": photo_path, "photoKind": "photo" if raw else "illustration", "rawPhoto": raw["path"] if raw else None, "sourceFormXref": reference.idnum, "sourcePhoto": raw})
        print(f"{room}: source front and window verified for {slug}", flush=True)
    manifest_path = root / "design/room-card-faces.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"sourceCanvas": CANVAS, "rooms": {}}
    manifest["rooms"][room] = record
    json_file(manifest_path, manifest)
    if update_registry:
        registry_path = root / "design/asset-files.json"
        registry = json.loads(registry_path.read_text(encoding="utf-8")) if registry_path.exists() else {"assets": {}}
        assets = registry["assets"]
        for card in record["cards"]:
            item = assets.setdefault(card["role"], {})
            item.update({"path": card["photo"], "status": "available", "kind": "lossless-source-"+card["photoKind"]+"-crop", "width":1120, "height":676, "source_pdf": source.provenance, "source_front": card["front"], "source_crop": [card["nominalFrame"][0],259,560,338]})
            item.pop("note", None)
            if card["sourcePhoto"]:
                item["embedded_photo"] = card["sourcePhoto"]
        item = assets.setdefault(f"rooms.{room}.artwork", {})
        item.update({"path":record["artwork"], "status":"available", "kind":"lossless-static-composite", "width":3024, "height":1904, "source_pdf":source.provenance, "photo_layers":record["photoLayers"]})
        assets[f"rooms.{room}.panorama-background"] = {"path":record["background"], "status":"available", "kind":"lossless-static-composite", "width":6864, "height":1904, "source_pdf":source.provenance}
        registry["missing_exact_photo_roles"] = [role for role in registry.get("missing_exact_photo_roles", []) if not assets.get(role, {}).get("path")]
        json_file(registry_path, registry)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--room", choices=SLUGS, required=True)
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--source-node", required=True)
    parser.add_argument("--output-root", type=Path, default=ROOT)
    parser.add_argument("--update-registry", action="store_true")
    args = parser.parse_args()
    result = import_room(args.room, args.pdf, args.output_root, args.source_node, args.update_registry)
    print(json.dumps({"room":args.room, "cards":len(result["cards"]), "background":result["background"], "source":result["source"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
