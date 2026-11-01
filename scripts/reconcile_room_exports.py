"""Reconcile verified Room layer imports into runtime and provenance registries."""
from __future__ import annotations

import argparse
from datetime import date
import json
from pathlib import Path

from PIL import Image
from pypdf.generic import ContentStream

from import_room_exports import ROOT, SLUGS, RoomSource, digest, json_file, save_raw, save_webp


def reconcile(root, source_directory):
    root, source_directory = Path(root), Path(source_directory)
    manifest_path = root / "design/room-card-faces.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    registry_path = root / "design/asset-files.json"
    # Rendering all five source frames can take several minutes. Merge only
    # owned Room records into the latest registry after rendering, so unrelated
    # imports made concurrently are preserved.
    asset_updates = {}
    raw_inventory = {}
    for room, record in manifest["rooms"].items():
        if room not in SLUGS:
            raise ValueError("Unknown Room key")
        filename = record["source"]["file"]
        if Path(filename).name != filename:
            raise ValueError("Source metadata must use a basename")
        source_path = source_directory / filename
        if digest(source_path.read_bytes()) != record["source"]["sha256"]:
            raise ValueError("PDF changed after extraction: " + filename)
        source = RoomSource(source_path, record["source"]["node"])
        record["fallbackPanorama"] = save_webp(root, f"assets/figma-updated/composites/room-{room}-panorama-fallback-2x.webp", source.render(source.filter_graphics("fallback")))
        print(f"{room}: source-compatible fallback panorama verified", flush=True)
        with Image.open(root / record["photoComposite"]) as photo:
            alpha = photo.getchannel("A")
        mask = Image.new("RGBA", alpha.size, "white")
        mask.putalpha(alpha)
        record["photoMask"] = save_webp(root, f"assets/figma-updated/composites/room-{room}-photo-mask-union-2x.webp", mask)
        record["photoMaskFrame"] = [0, 0, 1512, 952]
        record["maskProvenance"] = "Alpha of original isolated PDF photo layers and their unmodified vector clips; no tracing."
        card_names = {str(value[0]) for value in source.cards.values()}
        underlays = []
        for name, reference, _ in source.draws:
            obj = reference.get_object()
            if obj.get("/Subtype") != "/Form" or str(name) in card_names:
                continue
            if not any(op == b"cm" and abs(float(args[4])-1474) < .01 and abs(float(args[5])-52) < .01 for args, op in ContentStream(obj, source.reader).operations):
                continue
            underlays.extend(source.descendant_images(obj))
        if len(underlays) == 1:
            raw = save_raw(source, underlays[0][0], root, f"assets/figma-updated/photos/room-{room}-image74-backing-source.jpeg")
            record["retainedUnderlay"] = raw
            item = asset_updates.setdefault(f"rooms.{room}.picture", {})
            item.update({"path": raw["path"], "status": "available", "kind": "embedded-source-photo", "embedded_photo": raw, "source_pdf": record["source"], "usage": "Exact retained image74 underlay, not the definitive primary left photo. Active artwork retains the complete overlaid source composition."})
            item.pop("note", None)
            item.setdefault("source_versions", {})["standalone"] = {"path": raw["path"], "status": "available", "source_pdf": record["source"]}
            raw_inventory[raw["sha256"]] = raw
        primary = record["photoLayers"][-1]
        asset_updates[f"rooms.{room}.primary-photo"] = {"path": primary["raw"], "status": "available", "kind": "embedded-source-photo", "width": primary["rawSize"][0], "height": primary["rawSize"][1], "source_pdf": record["source"], "source_transform": primary["matrix"], "note": "Last original left photo layer; the complete source layer stack and clip masks remain in room-card-faces.json."}
        artwork = asset_updates.setdefault(f"rooms.{room}.artwork", {})
        artwork.update({"photo_only": record["photoComposite"], "photo_mask": record["photoMask"], "background_without_photos": record["artworkWithoutPhotos"]})
        for layer in record["photoLayers"]:
            raw_inventory[layer["source"]["sha256"]] = layer["source"]
        for card in record["cards"]:
            if card.get("sourcePhoto"):
                raw_inventory[card["sourcePhoto"]["sha256"]] = card["sourcePhoto"]
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    assets = registry["assets"]
    for role, update in asset_updates.items():
        item = assets.setdefault(role, {})
        source_versions = update.pop("source_versions", {})
        item.update(update)
        if source_versions:
            item.setdefault("source_versions", {}).update(source_versions)
        if role.endswith(".picture"):
            item.pop("note", None)
    registry["missing_exact_photo_roles"] = [role for role in registry.get("missing_exact_photo_roles", []) if not assets.get(role, {}).get("path")]
    registry.setdefault("photo_inventory", {})["room_exports"] = {"source_pdf_count": len(manifest["rooms"]), "unique_jpeg_stream_count": len(raw_inventory), "files": list(raw_inventory.values()), "integrity": "Original embedded JPEG bytes, SHA-256 verified; no JPEG recompression."}
    verification = registry.setdefault("verification", {})
    if isinstance(verification, dict):
        verification["room_exports"] = {"manifest": "design/room-card-faces.json", "background_pixels": [6864,1904], "front_pixels": [1152,900], "photo_window_pixels": [1120,676], "webp": "Every emitted lossless WebP decode compared byte-for-byte with its extracted PNG raster.", "source_mask": "Original PDF image transforms, alpha and vector clips, not screenshots or reconstructed contours."}
    json_file(manifest_path, manifest)
    json_file(registry_path, registry)
    status_path = root / "design/asset-status.json"
    if status_path.exists():
        status = json.loads(status_path.read_text(encoding="utf-8"))
        remaining = status["remaining"]
        for group, count, resolved in [("photo_roles","photo_role_count","recovered_photo_roles"), ("source_illustrations","source_illustration_count","recovered_source_illustrations")]:
            old = remaining.get(group, [])
            available = [entry for entry in old if assets.get(entry["role"], {}).get("path")]
            pending = [entry for entry in old if not assets.get(entry["role"], {}).get("path")]
            remaining[group] = pending
            remaining[count] = len(pending)
            recovered = {entry["role"]: entry for entry in status.get(resolved, [])}
            for entry in available:
                item = assets[entry["role"]]
                recovered[entry["role"]] = {**entry, "status":"available", "path":item["path"], "source_pdf":item.get("source_pdf")}
            status[resolved] = list(recovered.values())
        pending_stages = []
        recovered_stages = {entry["route"]: entry for entry in status.get("recovered_left_photo_eye_stages", [])}
        for entry in remaining.get("left_photo_eye_stages", []):
            room = entry["route"].strip("/").split("/")[-1]
            if room in manifest["rooms"]:
                recovered_stages[entry["route"]] = {**entry, "status":"available", "path":manifest["rooms"][room]["artwork"], "source_pdf":manifest["rooms"][room]["source"]}
            else:
                pending_stages.append(entry)
        remaining["left_photo_eye_stages"] = pending_stages
        remaining["left_photo_eye_stage_count"] = len(pending_stages)
        status["recovered_left_photo_eye_stages"] = list(recovered_stages.values())
        pending_photos = remaining.get("photo_roles", [])
        remaining["photo_role_breakdown"] = {"standalone_picture_roles_not_rendered_by_current_template":sum(not entry.get("rendered_in_current_template") for entry in pending_photos), "card_photos_rendered_as_empty_media":sum(bool(entry.get("rendered_in_current_template")) for entry in pending_photos)}
        if not pending_stages:
            remaining["stage_source_note"] = "Full original Room PDFs recovered. Native copy/CTA, source character and Card Front layers are separated from the source backdrop; exact photo transforms and clip masks are retained."
        status["updated_on"] = date.today().isoformat()
        status["status"] = "room-source-assets-recovered-with-other-reference-limits-retained"
        status.setdefault("registries", {})["room_card_faces"] = "design/room-card-faces.json"
        status.setdefault("source_integrity", {})["room_exports"] = "Original PDF image bytes and source vector painting operators isolated for backgrounds, full alpha card fronts and per-photo clip masks. No traced masks or fabricated photographs."
        hashes = {entry["sha256"] for entry in registry["photo_inventory"].values() if "sha256" in entry}
        hashes.update(raw_inventory)
        status["source_integrity"]["photos"] = f"{len(hashes)} unique embedded JPEG streams across the original supplied PDFs and recovered Room exports; source bytes and SHA-256 verified. Some are retained ingredients rather than active page images."
        integrated = status.setdefault("integrated_assets", {})
        integrated["unique_photo_count"] = len(hashes)
        integrated["photo_roles"] = sorted(set(integrated.get("photo_roles", [])) | {role for role in asset_updates if role.endswith((".picture", ".primary-photo"))} | {card["role"] for room in manifest["rooms"].values() for card in room["cards"] if card.get("photoKind") == "photo"})
        integrated["source_illustration_roles"] = [card["role"] for room in manifest["rooms"].values() for card in room["cards"] if card.get("photoKind") == "illustration"]
        json_file(status_path, status)
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, default=ROOT)
    args = parser.parse_args()
    result = reconcile(args.output_root, args.source_dir)
    print(json.dumps({"rooms": list(result["rooms"]), "registry": "design/room-card-faces.json"}))
