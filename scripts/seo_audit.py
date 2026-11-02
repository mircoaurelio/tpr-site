"""Audit the built Cloudflare production artifact, not the noindex design preview."""

from __future__ import annotations

import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree


REPOSITORY = Path(__file__).resolve().parents[1]
ROOT = REPOSITORY / "dist-cloudflare"
BASE_URL = "https://thepeoplesroom.it"
ROUTES = json.loads((REPOSITORY / "routes.json").read_text(encoding="utf-8"))
INDEXABLE = {
    "index.html" if page["path"] == ROUTES["canonical_home"] else page["path"].lstrip("/") + "index.html"
    for page in ROUTES["pages"]
}


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self._in_title = False
        self._in_json_ld = False
        self._json_ld_parts: list[str] = []
        self.json_ld: list[str] = []
        self.meta: dict[str, str] = {}
        self.links: list[dict[str, str]] = []
        self.references: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {name.lower(): value or "" for name, value in attrs}
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = data.get("name") or data.get("property")
            if key:
                self.meta[key.lower()] = data.get("content", "").strip()
        elif tag == "link":
            self.links.append(data)
        elif tag == "script" and data.get("type", "").lower() == "application/ld+json":
            self._in_json_ld = True
            self._json_ld_parts = []

        for attribute in ("href", "src", "poster"):
            value = data.get(attribute)
            if value:
                self.references.append((attribute, value))

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "script" and self._in_json_ld:
            self._in_json_ld = False
            self.json_ld.append("".join(self._json_ld_parts).strip())

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        if self._in_json_ld:
            self._json_ld_parts.append(data)


def parse_page(path: Path) -> PageParser:
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.title = parser.title.strip()
    return parser


def canonical(parser: PageParser) -> str:
    for link in parser.links:
        if "canonical" in link.get("rel", "").lower().split():
            return link.get("href", "")
    return ""


def local_target(page: Path, reference: str) -> Path | None:
    split = urlsplit(reference)
    if split.scheme or split.netloc or reference.startswith(("#", "mailto:", "tel:", "javascript:")):
        return None
    raw_path = unquote(split.path)
    if not raw_path:
        return None
    if raw_path.startswith("/"):
        target = ROOT / raw_path.lstrip("/")
    else:
        target = page.parent / raw_path
    if raw_path.endswith("/") or target.is_dir():
        target /= "index.html"
    return target.resolve()


def audit() -> list[str]:
    errors: list[str] = []
    if not ROOT.is_dir():
        return ["Artefatto produzione mancante: eseguire npm run build:cloudflare prima dell'audit."]
    titles: dict[str, str] = {}
    descriptions: dict[str, str] = {}
    redirects: dict[str, str] = {}
    redirect_file = ROOT / "_redirects"
    if redirect_file.is_file():
        for line in redirect_file.read_text(encoding="utf-8").splitlines():
            fields = line.split()
            if len(fields) == 3 and fields[2] in {"301", "308"}:
                redirects[fields[0]] = fields[1]
    else:
        errors.append("Manifest dei redirect di produzione mancante")
    for relative in sorted(INDEXABLE):
        if not (ROOT / relative).is_file():
            errors.append(f"{relative}: pagina canonica mancante")

    pages = sorted(ROOT.rglob("index.html"))
    for page in pages:
        relative = page.relative_to(ROOT).as_posix()
        parser = parse_page(page)
        robots = parser.meta.get("robots", "").lower()
        page_canonical = canonical(parser)

        if not parser.title:
            errors.append(f"{relative}: title mancante")

        if relative in INDEXABLE:
            required_meta = (
                "description",
                "robots",
                "og:title",
                "og:description",
                "og:url",
                "og:image",
            )
            for field in required_meta:
                if not parser.meta.get(field):
                    errors.append(f"{relative}: meta {field} mancante")
            if "noindex" in robots or "index" not in robots:
                errors.append(f"{relative}: robots non indexabile: {robots!r}")
            if not page_canonical.startswith(f"{BASE_URL}/"):
                errors.append(f"{relative}: canonical non valido: {page_canonical!r}")
            if relative in {"index.html", "contatti/index.html"} and not parser.json_ld:
                errors.append(f"{relative}: JSON-LD mancante")
            if parser.title in titles:
                errors.append(f"{relative}: title duplicato con {titles[parser.title]}")
            titles.setdefault(parser.title, relative)
            description = parser.meta.get("description", "")
            if description in descriptions:
                errors.append(f"{relative}: description duplicata con {descriptions[description]}")
            descriptions.setdefault(description, relative)
        elif (route := "/" + relative.removesuffix("index.html")) in redirects:
            # A redirect is served before this fallback HTML, including the duplicate Home.
            wanted = BASE_URL + urlsplit(redirects[route]).path
            if page_canonical != wanted:
                errors.append(f"{relative}: canonical del redirect non coerente: {page_canonical!r}")
        else:
            if "noindex" not in robots:
                errors.append(f"{relative}: pagina non canonica senza noindex")
            if not page_canonical:
                errors.append(f"{relative}: canonical mancante")

        for block in parser.json_ld:
            try:
                json.loads(block)
            except json.JSONDecodeError as exc:
                errors.append(f"{relative}: JSON-LD non valido ({exc})")

        for attribute, reference in parser.references:
            target = local_target(page, reference)
            if target is None:
                continue
            try:
                target.relative_to(ROOT.resolve())
            except ValueError:
                errors.append(f"{relative}: {attribute} esce dal progetto: {reference}")
                continue
            if not target.exists():
                errors.append(f"{relative}: {attribute} non trovato: {reference}")

    try:
        sitemap = ElementTree.parse(ROOT / "sitemap.xml").getroot()
    except (OSError, ElementTree.ParseError) as exc:
        errors.append(f"sitemap di produzione mancante o non valido: {exc}")
        return errors
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    sitemap_urls = {node.text for node in sitemap.findall("sm:url/sm:loc", namespace)}
    canonical_urls = {canonical(parse_page(ROOT / relative)) for relative in INDEXABLE if (ROOT / relative).is_file()}
    if sitemap_urls != canonical_urls:
        missing = sorted(canonical_urls - sitemap_urls)
        extra = sorted(sitemap_urls - canonical_urls)
        if missing:
            errors.append(f"sitemap: URL mancanti: {missing}")
        if extra:
            errors.append(f"sitemap: URL extra: {extra}")

    return errors


if __name__ == "__main__":
    problems = audit()
    if problems:
        print("SEO AUDIT FAILED")
        for problem in problems:
            print(f"- {problem}")
        raise SystemExit(1)
    print(f"SEO AUDIT OK: {len(INDEXABLE)} pagine canoniche e sitemap coerente")
