"""Exercise the actual preview generator with a Windows-style text locale."""
import contextlib
import io
from pathlib import Path
import runpy
import shutil
import tempfile
import unittest
from unittest.mock import patch


class PreviewGeneratorEncodingTest(unittest.TestCase):
    def test_utf8_pages_survive_a_non_utf8_default_locale(self):
        repo = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "scripts").mkdir()
            (root / "design" / "partials").mkdir(parents=True)
            for name in ("updated-content.json", "figma-slots.json", "asset-files.json", "page-decorations.json"):
                shutil.copyfile(repo / "design" / name, root / "design" / name)
            for name in ("home-hero.html", "home-people.html"):
                shutil.copyfile(repo / "design" / "partials" / name, root / "design" / "partials" / name)
            for name in ("aziende-startup", "privati-freelancer"):
                (root / "membership" / name).mkdir(parents=True)
            script = root / "scripts" / "build_updated_preview.py"
            shutil.copyfile(repo / "scripts" / script.name, script)
            original_read = Path.read_text
            original_write = Path.write_text

            # Only the platform's implicit encoding is simulated. The real
            # generator, source files, rendering and filesystem writes run.
            def locale_read(path, encoding=None, errors=None, **kwargs):
                return original_read(path, encoding=encoding or "cp1252", errors=errors, **kwargs)

            def locale_write(path, data, encoding=None, errors=None, **kwargs):
                return original_write(path, data, encoding=encoding or "cp1252", errors=errors, **kwargs)

            with patch.object(Path, "read_text", locale_read), patch.object(Path, "write_text", locale_write):
                with contextlib.redirect_stdout(io.StringIO()):
                    try:
                        runpy.run_path(str(script), run_name="__main__")
                    except UnicodeError as error:
                        self.fail(f"Preview generation must preserve UTF-8 independently of the default locale: {error}")

            pages = sorted(root.glob("**/index.html"))
            self.assertEqual(len(pages), 13)
            for page in pages:
                source = page.read_bytes().decode("utf-8")
                self.assertIn('charset="utf-8"', source, page)
                self.assertIn("</html>", source, page)
            self.assertIn("TPR è energia", (root / "about" / "index.html").read_bytes().decode("utf-8"))
            self.assertIn("Il nostro obiettivo quotidiano è ispirare", (root / "about" / "index.html").read_bytes().decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
