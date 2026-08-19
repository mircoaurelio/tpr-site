from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]

IMAGES = [
    "assets/tpr-hero.png",
    "assets/homepage-tpr-hero-2x.png",
    "assets/tpr-startup.png",
    "assets/tpr-freelancer.png",
    "assets/tpr-events.png",
    "assets/tpr-reformer.png",
    "assets/tpr-wellness.png",
    "assets/tpr-bar.png",
    "assets/tpr-media.png",
    "assets/tpr-app-booking.png",
    "assets/tpr-app-brand.png",
    "assets/tpr-phone-left.png",
    "assets/tpr-phone-right.png",
    "assets/homepage-room-coworking-clean-2x.png",
    "assets/homepage-room-reformer-clean-2x.png",
    "assets/homepage-room-wellness-clean-2x.png",
    "assets/homepage-room-bar-clean-2x.png",
    "assets/homepage-room-media-clean-2x.png",
    "assets/homepage-hero-about-2x.png",
    "assets/homepage-events-2x.png",
    "assets/homepage-membership-partners-2x.png",
    "assets/homepage-footer-2x.png",
    "assets/routes/about-2x.png",
    "assets/routes/eventi-2x.png",
    "assets/routes/contatti-2x.png",
    "assets/routes/coworking-2x.png",
    "assets/routes/reformer-2x.png",
    "assets/routes/wellness-2x.png",
    "assets/routes/bar-2x.png",
    "assets/routes/media-2x.png",
]


def main() -> None:
    source_total = 0
    output_total = 0
    for relative in IMAGES:
        source = ROOT / relative
        target = source.with_suffix(".webp")
        with Image.open(source) as image:
            source_total += source.stat().st_size
            image.save(
                target,
                "WEBP",
                quality=90,
                method=6,
                exact=True,
            )
        if target.stat().st_size >= source.stat().st_size:
            target.unlink()
            output_total += source.stat().st_size
            print(f"{relative}: kept original ({source.stat().st_size})")
            continue

        output_total += target.stat().st_size
        print(f"{relative}: {source.stat().st_size} -> {target.stat().st_size}")

    saved = source_total - output_total
    ratio = (saved / source_total * 100) if source_total else 0
    print(f"TOTAL: {source_total} -> {output_total} ({ratio:.1f}% saved)")


if __name__ == "__main__":
    main()
