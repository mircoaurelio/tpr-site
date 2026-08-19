from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation

ROOT = Path(__file__).resolve().parents[1]
ROYAL_RGB = (44, 100, 232)
CLEAR = (44, 100, 232, 0)
OPAQUE = (44, 100, 232, 255)
BOX = (1500, 1080, 3024, 1940)


def letter_core(pixels):
    r, g, b, a = (pixels[..., c] for c in range(4))
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    return ((r >= 168) & (g >= 168) & (b >= 168) & (a >= 8)) | ((luma >= 190) & (a >= 8))


def inpaint_letters(region):
    core = letter_core(region)
    unknown = binary_dilation(core, iterations=2)
    if not unknown.any():
        return 0

    alpha = region[..., 3].copy()
    mask = unknown.astype(np.uint8) * 255
    filled = cv2.inpaint(alpha, mask, 12, cv2.INPAINT_TELEA)
    opaque = unknown & (filled >= 128)
    clear = unknown & ~opaque
    region[opaque] = OPAQUE
    region[clear] = CLEAR
    return int(core.sum())


def restore_overlay():
    path = ROOT / "assets" / "tpr-hero-art.png"
    image = Image.open(path).convert("RGBA")
    pixels = np.array(image)
    left, top, right, bottom = BOX
    right = min(right, pixels.shape[1])
    bottom = min(bottom, pixels.shape[0])
    filled = inpaint_letters(pixels[top:bottom, left:right])
    Image.fromarray(pixels, "RGBA").save(path, "PNG")
    leftover = int(letter_core(pixels[top:bottom, left:right]).sum())
    print(f"hero overlay inpainted {filled} letter pixels; remaining={leftover}")


if __name__ == "__main__":
    restore_overlay()
