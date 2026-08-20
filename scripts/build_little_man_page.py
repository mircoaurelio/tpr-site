"""Build little-man/index.html with all five traced characters inlined."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "little-man"
ROOMS = [
    ("coworking", "Coworking", "Clouds"),
    ("bar", "Bar", "Globe"),
    ("media", "Media", "Lightning"),
    ("reformer", "Reformer", "Wave"),
    ("wellness", "Wellness", "Signal"),
]


def main() -> None:
    figures = []
    for key, label, obj in ROOMS:
        svg = (ROOT / "svg" / f"{key}.svg").read_text(encoding="utf-8").strip()
        figures.append(
            f'      <article class="figure figure--{key}">\n'
            f"        {svg}\n"
            f"        <p><strong>{label}</strong>{obj}</p>\n"
            f"      </article>"
        )

    html = """<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Little men — object animation</title>
    <style>
      :root { --ink: #f4f6ff; --muted: #9aa8d6; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        background: #000;
        color: var(--ink);
        font: 16px/1.4 "Alte Haas Grotesk", Arial, sans-serif;
      }
      body { padding: clamp(1.5rem, 4vw, 4rem); }
      h1 {
        margin: 0 0 .35rem;
        font-size: clamp(1.8rem, 4vw, 3rem);
        letter-spacing: -.04em;
      }
      .lede {
        max-width: 46rem;
        margin: 0 0 2.5rem;
        color: var(--muted);
      }
      .row {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: clamp(.75rem, 2vw, 2rem);
        align-items: end;
      }
      .figure {
        display: grid;
        justify-items: center;
        gap: 1rem;
        min-height: 28rem;
        padding: 4.5rem .5rem 1.25rem;
        overflow: visible;
        border: 1px solid #1c1c1c;
        border-radius: 1.25rem;
        background: #050505;
      }
      .figure p {
        margin: 0;
        color: var(--muted);
        font-size: .85rem;
        text-align: center;
      }
      .figure strong {
        display: block;
        color: var(--ink);
        font-size: 1rem;
      }
      .little-man {
        width: min(100%, 11rem);
        height: auto;
        overflow: visible;
      }
      .person, .object { transform-box: fill-box; }
      .person {
        transform-origin: 50% 94%;
        animation: person-idle 6s ease-in-out infinite;
      }
      .object { transform-origin: 50% 80%; }

      .little-man--coworking .object-1 { animation: cloud-mid 1.7s ease-in-out infinite; }
      .little-man--coworking .object-2 { animation: cloud-left 2.1s ease-in-out infinite; }
      .little-man--coworking .object-3 { animation: cloud-right 1.85s ease-in-out infinite .12s; }

      .little-man--bar .object-1 {
        transform-origin: 50% 100%;
        animation: globe-wobble 1.6s ease-in-out infinite;
      }

      .little-man--media .object-1 { animation: bolt .7s ease-in-out infinite; }
      .little-man--media .object-2 { animation: bolt .85s ease-in-out infinite .12s; }
      .little-man--media .object-3 { animation: bolt .78s ease-in-out infinite .22s; }
      .little-man--media .object-4 {
        transform-origin: 50% 100%;
        animation: dome-sway 1.5s ease-in-out infinite;
      }

      .little-man--reformer .object-1 {
        transform-origin: 50% 50%;
        animation: wave-slither 1.15s ease-in-out infinite;
      }

      .little-man--wellness .object-1 { animation: signal 1.1s ease-in-out infinite; }
      .little-man--wellness .object-2 { animation: signal 1.1s ease-in-out infinite .12s; }
      .little-man--wellness .object-3,
      .little-man--wellness .object-4 { animation: signal 1.1s ease-in-out infinite .2s; }
      .little-man--wellness .object-5 { animation: signal 1.1s ease-in-out infinite .32s; }

      @keyframes person-idle {
        0%, 100% { transform: rotate(-.35deg); }
        50% { transform: rotate(.35deg) translateY(-1px); }
      }
      @keyframes cloud-mid {
        0%, 100% { transform: translate(0, 0) rotate(-24deg) scale(.9); }
        50% { transform: translate(8px, -56px) rotate(22deg) scale(1.42); }
      }
      @keyframes cloud-left {
        0%, 100% { transform: translate(0, 0) rotate(18deg) scale(.88); }
        50% { transform: translate(-28px, -44px) rotate(-20deg) scale(1.38); }
      }
      @keyframes cloud-right {
        0%, 100% { transform: translate(0, 0) rotate(-16deg) scale(.9); }
        50% { transform: translate(30px, -48px) rotate(18deg) scale(1.4); }
      }
      @keyframes globe-wobble {
        0%, 100% { transform: rotate(0) translateY(0) scale(1); }
        25% { transform: rotate(12deg) translateY(-22px) scale(1.08); }
        50% { transform: rotate(-10deg) translateY(-8px) scale(1.14); }
        75% { transform: rotate(14deg) translateY(-26px) scale(1.05); }
      }
      @keyframes bolt {
        0%, 100% { transform: translateY(0) scaleY(1) rotate(-10deg); opacity: 1; }
        25% { transform: translateY(-36px) scaleY(1.45) rotate(12deg); opacity: .2; }
        50% { transform: translateY(-8px) scaleY(.7) rotate(-14deg); opacity: 1; }
        75% { transform: translateY(-42px) scaleY(1.5) rotate(8deg); opacity: .12; }
      }
      @keyframes dome-sway {
        0%, 100% { transform: rotate(0) scale(1); }
        50% { transform: rotate(8deg) scale(1.06, .94) translateY(-8px); }
      }
      @keyframes wave-slither {
        0%, 100% { transform: translateX(-26px) rotate(-10deg) scale(1, .85); }
        50% { transform: translateX(28px) rotate(10deg) scale(1.08, 1.4); }
      }
      @keyframes signal {
        0%, 100% { transform: scale(.92) translateY(0); opacity: 1; }
        50% { transform: scale(1.28) translateY(-22px); opacity: .25; }
      }
      @media (max-width: 900px) {
        .row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 560px) {
        .row { grid-template-columns: 1fr; }
      }
      @media (prefers-reduced-motion: reduce) {
        .person, .object { animation: none; }
      }
    </style>
  </head>
  <body>
    <h1>Little men</h1>
    <p class="lede">The people barely move. Clouds, globe, lightning, wave and signal loop with a much bigger motion.</p>
    <div class="row">
""" + "\n".join(figures) + """
    </div>
  </body>
</html>
"""
    dest = ROOT / "index.html"
    dest.write_text(html, encoding="utf-8")
    print("wrote", dest, dest.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
