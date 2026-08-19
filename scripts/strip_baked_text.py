from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ICE = (152, 202, 255)
ROYAL = (44, 100, 232)


def is_white(pixel, threshold):
    return pixel[0] >= threshold and pixel[1] >= threshold and pixel[2] >= threshold


def punch_white(image, box, threshold=232):
    pixels = image.load()
    width, height = image.size
    left, top, right, bottom = box
    white = []
    for y in range(top, min(bottom, height)):
        for x in range(left, min(right, width)):
            if is_white(pixels[x, y], threshold):
                white.append((x, y))
    offsets = ((8, 0), (14, 0), (6, -6), (6, 6), (22, 0), (-10, 0), (0, 10), (0, -10))
    for x, y in reversed(white):
        if image.mode == "RGBA":
            pixels[x, y] = (*ROYAL, 0)
            continue
        replacement = None
        for dy, dx in offsets:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height and not is_white(pixels[nx, ny], threshold):
                replacement = pixels[nx, ny][:3]
                break
        pixels[x, y] = replacement or ROYAL


def cover_coworking_nav():
    path = ROOT / "assets" / "homepage-room-coworking-no-text-2x.webp"
    image = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(image)
    draw.rectangle((1020, 1460, 2020, 1904), fill=ICE)
    image.save(path, "WEBP", quality=92, method=6)
    png = ROOT / "assets" / "homepage-room-coworking-no-text-2x.png"
    if png.exists():
        image.save(png, "PNG")
    print("coworking nav covered")


def clear_box(image, box, fill):
    ImageDraw.Draw(image).rectangle(box, fill=fill)


def strip_hero_art():
    print("hero art title strip skipped; use scripts/fix_hero.py")


def strip_hero_composite():
    print("hero composite title strip skipped")


ROOMS = {
    "coworking": (152, 202, 255),
    "reformer": (63, 153, 65),
    "wellness": (194, 213, 105),
    "bar": (235, 100, 43),
    "media": (255, 193, 0),
}
CARD_POSITIONS = (0.439, 0.6265, 0.812)
COPY_BOX = (0.232, 0.268, 0.418, 0.455)
PINK = (255, 123, 255)


def strip_room_panorama(name, color):
    path = ROOT / "assets" / "routes" / f"{name}-2x.webp"
    image = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(image)
    width, height = image.size
    left = int(COPY_BOX[0] * width)
    top = int(COPY_BOX[1] * height)
    right = int((COPY_BOX[0] + COPY_BOX[2]) * width)
    bottom = int((COPY_BOX[1] + COPY_BOX[3]) * height)
    draw.rectangle((left, top, right, bottom), fill=color)
    card_width = int(0.166 * width)
    card_height = int(0.47 * height)
    card_top = int(0.264 * height)
    label_top = card_top + int(card_height * 0.82)
    label_bottom = card_top + card_height - 18
    for position in CARD_POSITIONS:
        card_left = int(position * width)
        draw.rectangle(
            (card_left + 28, label_top, card_left + card_width - 28, label_bottom),
            fill=(255, 255, 255),
        )
    image.save(path, "WEBP", quality=92, method=6)
    print(f"{path.name} text covered")


def strip_explore_panoramas():
    for name, color in ROOMS.items():
        strip_room_panorama(name, color)


def make_organic_event_mask():
    import math

    width, height = 3024, 1428
    alpha = Image.new("L", (width, height), 255)
    draw = ImageDraw.Draw(alpha)
    cx, cy = width * 0.49, height * 0.58
    points = []
    for index in range(96):
        angle = index / 96 * math.tau
        radius = 0.46 + 0.09 * math.sin(3 * angle) + 0.05 * math.cos(5 * angle + 0.4) + 0.035 * math.sin(2 * angle + 1.1)
        points.append((
            cx + radius * width * 0.52 * math.cos(angle),
            cy + radius * height * 0.72 * math.sin(angle),
        ))
    draw.polygon(points, fill=0)
    image = Image.new("RGBA", (width, height), (*PINK, 255))
    image.putalpha(alpha)
    path = ROOT / "assets" / "event-mask-exact.png"
    image.save(path, "PNG")
    print("event mask replaced with organic blob")


if __name__ == "__main__":
    cover_coworking_nav()
    strip_explore_panoramas()
    make_organic_event_mask()
