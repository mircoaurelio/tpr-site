"""Exercise source-layer isolation with a real, independently drawn PDF."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image
from reportlab.pdfgen import canvas

REPO = Path(__file__).resolve().parents[1]
SCRIPT = REPO / "scripts" / "import_room_exports.py"
sys.path.insert(0, str(REPO / "scripts"))


class RoomExportImporterTest(unittest.TestCase):
    def make_source(self, directory):
        colors = [(225, 30, 35), (30, 205, 40), (35, 45, 225)]
        photos = []
        for index, color in enumerate(colors):
            path = directory / f"photo-{index}.jpg"
            Image.new("RGB", (320, 240), color).save(path, "JPEG", quality=95)
            photos.append(path)
        source = directory / "Fixture.pdf"
        pdf = canvas.Canvas(str(source), pagesize=(3432, 952))
        for index, x in enumerate((1512, 2152, 2792)):
            pdf.beginForm(f"card{index}", 0, 0, 3432, 952)
            pdf.translate(x, 259)
            pdf.setFillColorRGB(1, 1, 1)
            pdf.roundRect(0, 0, 560, 434, 12, stroke=0, fill=1)
            pdf.drawImage(str(photos[index]), 0, 96, width=560, height=338)
            pdf.setFillColorRGB(0, 0, 0)
            pdf.setFont("Helvetica-Bold", 30)
            pdf.drawString(24, 28, f"CARD {index + 1}")
            pdf.circle(520, 44, 18, stroke=1, fill=0)
            pdf.endForm()
        pdf.beginForm("backing", 0, 0, 3432, 952)
        pdf.translate(1474, 52)
        pdf.drawImage(str(photos[2]), 0, 0, width=636, height=848)
        pdf.endForm()
        pdf.beginForm("mascot", 0, 0, 3432, 952)
        pdf.translate(100, 400)
        pdf.setFillColorRGB(1, 1, 0)
        pdf.rect(0, 0, 40, 80, fill=1, stroke=0)
        pdf.endForm()
        pdf.beginForm("graphics", 0, 0, 3432, 952)
        pdf.setFillColorRGB(63 / 255, 153 / 255, 65 / 255)
        pdf.rect(0, 0, 3432, 952, fill=1, stroke=0)
        pdf.setFillColorRGB(1, 193 / 255, 0)
        pdf.rect(1500, 200, 1932, 552, fill=1, stroke=0)
        pdf.drawImage(str(photos[2]), 0, 0, width=716, height=952)
        pdf.setFillColorRGB(1, 1, 1)
        pdf.setFont("Helvetica-Bold", 55)
        pdf.drawString(800, 640, "BAKED TITLE")
        pdf.rect(800, 315, 260, 32, fill=1, stroke=0)
        pdf.doForm("backing")
        for index, x in enumerate((1512, 2152, 2792)):
            pdf.doForm(f"card{index}")
            pdf.setStrokeColorRGB(1, 1, 1)
            pdf.setLineWidth(2)
            pdf.rect(x - 6, 253, 572, 446, fill=0, stroke=1)
        pdf.doForm("mascot")
        pdf.endForm()
        pdf.doForm("graphics")
        pdf.showPage()
        pdf.save()
        return source, photos

    def test_fallback_panorama_retains_photos_and_paper_for_native_caption_overlays(self):
        from import_room_exports import RoomSource
        with tempfile.TemporaryDirectory() as name:
            source_path, _ = self.make_source(Path(name))
            source = RoomSource(source_path, "fixture:1")
            image = source.render(source.filter_graphics("fallback"))
            pixel = image.getpixel((1792*2, 476*2))
            self.assertTrue(pixel[0] > 180 and pixel[1] < 80 and pixel[2] < 80, "compatibility panorama must retain the first definitive red photo")
            footer = image.crop((1532*2, 620*2, 2052*2, 680*2))
            self.assertGreaterEqual(np.asarray(footer).min(), 250, "baked caption/arrow must be removed so native overlay remains unique")

    def test_original_layers_produce_cardless_background_and_complete_alpha_fronts(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            source, photos = self.make_source(directory)
            output = directory / "output"
            (output / "design").mkdir(parents=True)
            registry = {"assets": {"unrelated.logo": {"path": "keep.svg"}}}
            (output / "design" / "asset-files.json").write_text(json.dumps(registry), encoding="utf-8")
            result = subprocess.run([sys.executable, str(SCRIPT), "--room", "reformer", "--pdf", str(source), "--source-node", "fixture:1", "--output-root", str(output), "--update-registry"], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, "source importer must complete: " + result.stderr)
            manifest = json.loads((output / "design" / "room-card-faces.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["sourceCanvas"], [3432, 952])
            room = manifest["rooms"]["reformer"]
            background = Image.open(output / room["background"]).convert("RGB")
            self.assertEqual(background.size, (6864, 1904))
            self.assertEqual(background.getpixel((1792 * 2, 476 * 2)), (255, 193, 0), "omitting the card must reveal the original yellow source backdrop")
            self.assertEqual(background.getpixel((930 * 2, 621 * 2)), (63, 153, 65), "baked CTA paint must be removed from the native copy region")
            for index, card in enumerate(room["cards"]):
                x = (1512, 2152, 2792)[index]
                self.assertEqual(card["crop"], [x - 8, 251, 576, 450])
                front = Image.open(output / card["front"]).convert("RGBA")
                self.assertEqual(front.size, (1152, 900))
                self.assertEqual(front.getpixel((0, 0))[3], 0)
                self.assertEqual(front.getpixel((500, 400))[3], 255)
                self.assertGreater(max(front.getpixel((500, 400))[:3]), 180, "dual-matte unpremultiplication must not overflow bright source colors")
                footer = front.crop((40, 720, 800, 850))
                pixels = np.asarray(footer)
                self.assertGreater(int(((pixels[..., 3] == 255) & (pixels[..., :3].max(axis=2) < 30)).sum()), 40, "complete source caption must remain on the rotating front")
                with Image.open(output / card["photo"]) as photo:
                    self.assertEqual(photo.size, (1120, 676))
                raw = (output / card["rawPhoto"]).read_bytes()
                self.assertEqual(hashlib.sha256(raw).digest(), hashlib.sha256(photos[index].read_bytes()).digest(), "embedded JPEG must be copied without re-encoding")
            layer = room["photoLayers"][0]
            self.assertEqual(layer["rawSize"], [320, 240])
            self.assertEqual(layer["matrix"], [2.2375, 0, 0, 952 / 240, 0, 0])
            mask = Image.open(output / layer["mask"]).convert("RGBA")
            self.assertEqual(mask.size, (3024, 1904))
            self.assertEqual(mask.getpixel((50, 50))[3], 255)
            self.assertEqual(mask.getpixel((1700, 50))[3], 0)
            updated = json.loads((output / "design" / "asset-files.json").read_text(encoding="utf-8"))
            self.assertEqual(updated["assets"]["unrelated.logo"], {"path": "keep.svg"})
            self.assertEqual(updated["assets"]["rooms.reformer.cards.studio"]["path"], room["cards"][0]["photo"])
            # The final reconciliation renders slowly: preserve both a previous
            # Room source version and unrelated concurrent asset imports.
            from import_room_exports import RoomSource
            from reconcile_room_exports import reconcile
            registry_path = output / "design" / "asset-files.json"
            updated["assets"]["rooms.reformer.picture"] = {"source_versions": {"home_instance": {"path": "keep-home.jpeg"}}}
            registry_path.write_text(json.dumps(updated), encoding="utf-8")
            original_render = RoomSource.render
            def render_with_concurrent_import(source, *args, **kwargs):
                current = json.loads(registry_path.read_text(encoding="utf-8"))
                current["assets"]["unrelated.new-menu"] = {"path": "current-menu.svg"}
                registry_path.write_text(json.dumps(current), encoding="utf-8")
                return original_render(source, *args, **kwargs)
            with patch.object(RoomSource, "render", render_with_concurrent_import):
                final = reconcile(output, directory)
            latest = json.loads(registry_path.read_text(encoding="utf-8"))
            self.assertEqual(latest["assets"]["unrelated.new-menu"]["path"], "current-menu.svg")
            self.assertEqual(latest["assets"]["rooms.reformer.picture"]["source_versions"]["home_instance"]["path"], "keep-home.jpeg")
            with Image.open(output / final["rooms"]["reformer"]["photoMask"]) as union:
                with Image.open(output / room["photoComposite"]) as photos:
                    self.assertTrue(np.array_equal(np.asarray(union.getchannel("A")), np.asarray(photos.getchannel("A"))))


if __name__ == "__main__":
    unittest.main()
