"""Exercise the static audit with production URLs and native redirect pages."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


REPOSITORY = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("seo_audit", REPOSITORY / "scripts/seo_audit.py")
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)
ORIGIN = "https://thepeoplesroom.it"
ROUTES = ["/", "/about/", "/contatti/", "/eventi/", "/vivi-tpr/", "/prenota/",
          "/rooms/coworking/", "/rooms/reformer/", "/rooms/wellness/", "/rooms/bar/", "/rooms/media/"]


class ProductionSeoAuditTest(unittest.TestCase):
    def fixture(self, root):
        for index, route in enumerate(ROUTES):
            target = root / route.lstrip("/") / "index.html"
            target.parent.mkdir(parents=True, exist_ok=True)
            schema = ""
            if route in ("/", "/contatti/"):
                schema_type = "WebSite" if route == "/" else "LocalBusiness"
                schema = '<script type="application/ld+json">' + json.dumps({"@type": schema_type}) + '</script>'
            target.write_text(f'''<!doctype html><html lang="it"><head><title>Page {index}</title>
<meta name="robots" content="index,follow"><meta name="description" content="Description {index}">
<meta property="og:title" content="Page {index}"><meta property="og:description" content="Description {index}">
<meta property="og:url" content="{ORIGIN}{route}"><meta property="og:image" content="{ORIGIN}/image.webp">
<link rel="canonical" href="{ORIGIN}{route}">{schema}</head><body><h1>Page {index}</h1></body></html>''', encoding="utf-8")
        (root / "homepage-tpr").mkdir()
        (root / "homepage-tpr/index.html").write_text((root / "index.html").read_text(encoding="utf-8"), encoding="utf-8")
        (root / "_redirects").write_text("/homepage-tpr/ / 301\n/homepage-tpr / 301\n", encoding="utf-8")
        (root / "sitemap.xml").write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            ''.join(f'<url><loc>{ORIGIN}{route}</loc></url>' for route in ROUTES) + '</urlset>', encoding="utf-8")

    def test_complete_production_artifact_does_not_require_preview_urls_or_schema_everywhere(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            with patch.object(AUDIT, "ROOT", root):
                self.assertEqual(AUDIT.audit(), [])

    def test_duplicate_descriptions_are_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            page = root / "about/index.html"
            page.write_text(page.read_text(encoding="utf-8").replace("Description 1", "Description 0"), encoding="utf-8")
            with patch.object(AUDIT, "ROOT", root):
                self.assertTrue(any("description duplicata" in error for error in AUDIT.audit()))

    def test_github_project_mount_is_a_broken_reference_in_production(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            (root / "assets").mkdir()
            (root / "assets/photo.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"/>', encoding="utf-8")
            page = root / "about/index.html"
            page.write_text(page.read_text(encoding="utf-8").replace('</body>', '<img src="/tpr-site/assets/photo.svg" alt=""></body>'), encoding="utf-8")
            with patch.object(AUDIT, "ROOT", root):
                self.assertTrue(any("non trovato: /tpr-site/assets/photo.svg" in error for error in AUDIT.audit()))


if __name__ == "__main__":
    unittest.main()
