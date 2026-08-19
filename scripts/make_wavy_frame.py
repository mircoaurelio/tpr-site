import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def edge(x0, y0, x1, y1, n=22, amp=2.2, phase=0.4, nx=0, ny=0):
    pts = []
    for i in range(n):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        wobble = amp * math.sin(t * math.pi * 6 + phase) + 0.6 * amp * math.sin(t * math.pi * 13 + phase * 1.7)
        pts.append((x + nx * wobble, y + ny * wobble))
    return pts


def path(points):
    d = [f"M{points[0][0]:.2f},{points[0][1]:.2f}"]
    for x, y in points[1:]:
        d.append(f"L{x:.2f},{y:.2f}")
    d.append("Z")
    return " ".join(d)


inset = 4
amp = 2.15
w = h = 100
pts = (
    edge(inset, inset, w - inset, inset, 28, amp, 0.2, 0, 1)
    + edge(w - inset, inset, w - inset, h - inset, 22, amp, 1.1, -1, 0)
    + edge(w - inset, h - inset, inset, h - inset, 28, amp, 2.4, 0, -1)
    + edge(inset, h - inset, inset, inset, 22, amp, 3.3, 1, 0)
)
pts.append(pts[0])
d = path(pts)

(ROOT / "assets" / "wavy-frame.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">\n  <path fill="#fff" d="{d}"/>\n</svg>\n',
    encoding="utf-8",
)
(ROOT / "assets" / "wavy-stroke.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">\n  <path fill="none" stroke="#fff" stroke-width="0.7" d="{d}"/>\n</svg>\n',
    encoding="utf-8",
)
print("wrote wavy svgs", len(d))
