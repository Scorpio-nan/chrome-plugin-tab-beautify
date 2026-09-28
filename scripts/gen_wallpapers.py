"""生成精选壁纸 public/wallpapers/*.svg
用法: python scripts/gen_wallpapers.py
设计: 纯矢量插画（渐变天空 + 剪影层次），不依赖外部图床，断网可用、体积小。
      与 lib/wallpaper.ts 的 WALLPAPER_CATEGORIES 一一对应。
"""
import math
import os
import random

W, H = 1600, 900
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "wallpapers")


# ---------- 基础构件 ----------

def svg(title, defs, body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'preserveAspectRatio="xMidYMid slice">'
        f"<title>{title}</title><defs>{defs}</defs>{body}</svg>"
    )


def lgrad(gid, stops, x2=0, y2=1):
    s = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{gid}" x1="0" y1="0" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def rgrad(gid, inner, outer, r=0.6):
    return (
        f'<radialGradient id="{gid}" cx="0.5" cy="0.5" r="{r}">'
        f'<stop offset="0" stop-color="{inner}"/>'
        f'<stop offset="1" stop-color="{outer}" stop-opacity="0"/>'
        f"</radialGradient>"
    )


def ridge(rnd, base, amp, freq, phase, jitter=0.25, step=40):
    """一条起伏的地平线，闭合到画布底部"""
    pts = []
    for x in range(0, W + step, step):
        y = base + amp * math.sin(x * freq / 1000 + phase) + rnd.uniform(-amp * jitter, amp * jitter)
        pts.append((x, y))
    d = f"M0,{H} " + " ".join(f"L{x:.0f},{y:.0f}" for x, y in pts) + f" L{W},{H} Z"
    return f'<path d="{d}"/>'


def sun(cx, cy, r, core, glow_id):
    return (
        f'<circle cx="{cx}" cy="{cy}" r="{r * 4.2}" fill="url(#{glow_id})"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{core}"/>'
    )


def stars(rnd, n=140, ymax=H * 0.72):
    out = []
    for _ in range(n):
        x, y = rnd.uniform(0, W), rnd.uniform(0, ymax)
        r, o = rnd.uniform(0.7, 2.3), rnd.uniform(0.3, 1)
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="#fff" opacity="{o:.2f}"/>')
    return "".join(out)


def pines(rnd, base, count, hmin, hmax, color, wob=10):
    out = []
    for i in range(count):
        x = (i + rnd.uniform(0.1, 0.9)) * W / count
        h = rnd.uniform(hmin, hmax)
        w = h * 0.4
        y = base + rnd.uniform(-wob, wob)
        out.append(
            f'<path d="M{x:.0f},{y - h:.0f} L{x + w / 2:.0f},{y:.0f} L{x - w / 2:.0f},{y:.0f} Z" fill="{color}"/>'
        )
    return "".join(out)


def skyline(rnd, base, color, win_color=None, density=1.0):
    out, wins, x = [], [], -30
    while x < W + 30:
        w = rnd.uniform(46, 118) * density
        h = rnd.uniform(110, 430) * density
        out.append(f'<rect x="{x:.0f}" y="{base - h:.0f}" width="{w:.0f}" height="{H - base + h + 60:.0f}" fill="{color}"/>')
        if win_color:
            for _ in range(int(w * h / 5200)):
                wx = x + rnd.uniform(6, max(7, w - 12))
                wy = base - h + rnd.uniform(10, max(11, h - 14))
                if rnd.random() < 0.55:
                    wins.append(
                        f'<rect x="{wx:.0f}" y="{wy:.0f}" width="4" height="6" fill="{win_color}" '
                        f'opacity="{rnd.uniform(0.25, 0.95):.2f}"/>'
                    )
        x += w + rnd.uniform(4, 16)
    return "".join(out) + "".join(wins)


def blobs(items, blur=110):
    defs = f'<filter id="bl" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="{blur}"/></filter>'
    body = "".join(
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{c}" opacity="{o}" filter="url(#bl)"/>'
        for cx, cy, r, c, o in items
    )
    return defs, body


def clouds(rnd, base, n, color, blur=34):
    defs = f'<filter id="cl" x="-30%" y="-60%" width="160%" height="240%"><feGaussianBlur stdDeviation="{blur}"/></filter>'
    out = []
    for _ in range(n):
        cx, cy = rnd.uniform(-60, W + 60), base + rnd.uniform(-90, 90)
        out.append(
            f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{rnd.uniform(150, 330):.0f}" '
            f'ry="{rnd.uniform(26, 58):.0f}" fill="{color}" opacity="{rnd.uniform(0.35, 0.8):.2f}" filter="url(#cl)"/>'
        )
    return defs, "".join(out)


def grid_floor(horizon, color):
    out = [f'<rect x="0" y="{horizon}" width="{W}" height="{H - horizon}" fill="#07040f"/>']
    for i in range(-16, 17):
        out.append(
            f'<line x1="{W / 2 + i * 42:.0f}" y1="{horizon}" x2="{W / 2 + i * 430:.0f}" y2="{H}" '
            f'stroke="{color}" stroke-width="2" opacity="0.45"/>'
        )
    for k in range(1, 15):
        y = horizon + (H - horizon) * (k / 15) ** 2.5
        out.append(
            f'<line x1="0" y1="{y:.0f}" x2="{W}" y2="{y:.0f}" stroke="{color}" stroke-width="1.6" opacity="0.3"/>'
        )
    return "".join(out)


# ---------- 16 张壁纸 ----------

def build(wallpaper_id, label, sky, body_fn):
    rnd = random.Random(wallpaper_id)
    defs = [lgrad("sky", sky)]
    extra_defs, body = body_fn(rnd)
    defs += extra_defs
    return svg(label, "".join(defs), f'<rect width="{W}" height="{H}" fill="url(#sky)"/>{body}')


def walls():
    out = {}

    def nature1(rnd):
        d = [rgrad("glow", "#fff3c4", "#ffd97a")]
        b = [sun(1180, 250, 62, "#fff6d5", "glow")]
        b.append(f'<g fill="#2b6b57" opacity="0.95">{ridge(rnd, 520, 70, 2.2, 0.4)}</g>')
        b.append(f'<g fill="#1d5344">{ridge(rnd, 620, 90, 1.7, 2.1)}</g>')
        b.append(f'<g fill="#123a33">{ridge(rnd, 730, 70, 1.3, 4.2)}</g>')
        return d, "".join(b)

    def nature2(rnd):
        d = [rgrad("glow", "#dff6ff", "#8fd3f4")]
        b = [sun(420, 220, 52, "#f4fbff", "glow")]
        b.append(f'<g fill="#3c6e8f" opacity="0.9">{ridge(rnd, 470, 110, 1.6, 1.1)}</g>')
        b.append(f'<g fill="#274c63">{ridge(rnd, 560, 80, 2.0, 3.3)}</g>')
        b.append(f'<rect x="0" y="640" width="{W}" height="{H - 640}" fill="#132c3d"/>')
        b.append(f'<rect x="0" y="640" width="{W}" height="120" fill="#1d4a63" opacity="0.6"/>')
        for _ in range(26):
            x, y = rnd.uniform(0, W), rnd.uniform(660, H)
            b.append(f'<line x1="{x:.0f}" y1="{y:.0f}" x2="{x + rnd.uniform(30, 120):.0f}" y2="{y:.0f}" stroke="#8fd3f4" stroke-width="2" opacity="{rnd.uniform(0.1, 0.4):.2f}"/>')
        return d, "".join(b)

    def forest1(rnd):
        d = [rgrad("glow", "#cfe9ff", "#5b8ec4")]
        b = [stars(rnd, 120, H * 0.55), sun(1250, 190, 40, "#eaf4ff", "glow")]
        b.append(f'<g fill="#123331">{pines(rnd, 620, 26, 130, 250, "#123331")}</g>')
        b.append(f'<rect x="0" y="600" width="{W}" height="{H - 600}" fill="#0b2220"/>')
        b.append(f'<g fill="#071715">{pines(rnd, 760, 18, 200, 360, "#071715")}</g>')
        return d, "".join(b)

    def forest2(rnd):
        d = [rgrad("mist", "#ffffff", "#cfe8d6")]
        b = [f'<g fill="#5f8f6b" opacity="0.5">{pines(rnd, 520, 30, 120, 210, "#5f8f6b")}</g>']
        b.append(f'<g fill="#3f6f52" opacity="0.75">{pines(rnd, 620, 24, 150, 260, "#3f6f52")}</g>')
        b.append(f'<g fill="#254c3b">{pines(rnd, 760, 18, 210, 340, "#254c3b")}</g>')
        b.append(f'<rect x="0" y="430" width="{W}" height="260" fill="url(#mist)" opacity="0.55"/>')
        return d, "".join(b)

    def city1(rnd):
        d = [rgrad("glow", "#ffd9a0", "#ff9d6c")]
        b = [sun(300, 330, 70, "#ffe6bd", "glow")]
        b.append(f'<g fill="#2a2f4a">{skyline(rnd, 640, "#2a2f4a", None)}</g>')
        b.append(f'<g fill="#191d33">{skyline(rnd, 700, "#191d33", "#ffcf87", 0.8)}</g>')
        b.append(f'<rect x="0" y="700" width="{W}" height="{H - 700}" fill="#0e1120"/>')
        return d, "".join(b)

    def city2(rnd):
        d = [rgrad("glow", "#7ce7ff", "#2b6cff")]
        b = [stars(rnd, 60, H * 0.4)]
        b.append(f'<g fill="#161233">{skyline(rnd, 660, "#161233", None)}</g>')
        b.append(f'<g fill="#0b0820">{skyline(rnd, 720, "#0b0820", "#63f2ff", 0.9)}</g>')
        b.append(f'<rect x="0" y="720" width="{W}" height="{H - 720}" fill="#06040f"/>')
        db, bb = blobs([(300, 300, 240, "#ff3d81", 0.35), (1200, 240, 260, "#22d3ee", 0.3)], 130)
        b.append(bb)
        return d + [db], "".join(b)

    def travel1(rnd):
        d = [rgrad("glow", "#fff1c2", "#ffb85c")]
        b = [sun(820, 360, 90, "#fff3cf", "glow")]
        b.append(f'<g fill="#c9803f">{ridge(rnd, 520, 46, 1.2, 0.7)}</g>')
        b.append(f'<g fill="#a45c2c">{ridge(rnd, 620, 60, 1.0, 2.6)}</g>')
        b.append(f'<g fill="#7c3f20">{ridge(rnd, 740, 44, 0.8, 4.6)}</g>')
        return d, "".join(b)

    def travel2(rnd):
        d = [rgrad("glow", "#ffe9c9", "#ff8f6b")]
        b = [sun(1150, 300, 74, "#fff0d8", "glow")]
        b.append(f'<rect x="0" y="560" width="{W}" height="{H - 560}" fill="#1f5f78"/>')
        b.append(f'<g fill="#2b7f96">{ridge(rnd, 575, 22, 3.2, 1.4)}</g>')
        b.append(f'<g fill="#123f52">{ridge(rnd, 700, 60, 1.4, 3.9)}</g>')
        b.append(f'<path d="M0,{H} L0,690 Q260,640 520,720 L520,{H} Z" fill="#0d2b39"/>')
        return d, "".join(b)

    def ocean1(rnd):
        d = [rgrad("glow", "#e6fbff", "#5fd0e8")]
        b = [sun(760, 210, 58, "#f2fdff", "glow")]
        for i, base in enumerate((470, 545, 625, 710, 795)):
            shade = ["#63c8dd", "#3fa9c4", "#2b85a3", "#1c6382", "#0f4560"][i]
            b.append(f'<g fill="{shade}">{ridge(rnd, base, 34 - i * 3, 3.4 + i * 0.5, i * 1.7)}</g>')
        return d, "".join(b)

    def ocean2(rnd):
        d = [rgrad("glow", "#9ffbe8", "#0e7f8f")]
        b = [f'<rect width="{W}" height="{H}" fill="#04212e"/>', sun(800, 120, 120, "#0a5f74", "glow")]
        for _ in range(30):
            x, y = rnd.uniform(0, W), rnd.uniform(0, H)
            b.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.uniform(2, 9):.0f}" fill="#9ffbe8" opacity="{rnd.uniform(0.06, 0.3):.2f}"/>')
        b.append(f'<g fill="#03151f" opacity="0.9">{ridge(rnd, 780, 60, 1.5, 2.2)}</g>')
        return d, "".join(b)

    def starry1(rnd):
        d = [rgrad("glow", "#ffffff", "#8ea2ff")]
        b = [stars(rnd, 320, H * 0.86)]
        for _ in range(10):
            x, y = rnd.uniform(0, W), rnd.uniform(0, H * 0.6)
            b.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.uniform(2.6, 4.4):.1f}" fill="#fff" opacity="0.95"/>')
        b.append(f'<g fill="#0d1330">{ridge(rnd, 700, 70, 1.4, 0.9)}</g>')
        b.append(f'<g fill="#05060f">{ridge(rnd, 800, 44, 1.1, 3.4)}</g>')
        return d, "".join(b)

    def starry2(rnd):
        b = [stars(rnd, 220, H * 0.6)]
        db, bb = blobs([(420, 300, 320, "#3ef2c6", 0.5), (900, 240, 300, "#4f8cff", 0.45), (1300, 330, 280, "#a56bff", 0.4)], 150)
        b.append(bb)
        b.append(f'<g fill="#0a1526">{ridge(rnd, 660, 70, 1.5, 1.9)}</g>')
        b.append(f'<g fill="#040a14">{ridge(rnd, 790, 50, 1.2, 4.1)}</g>')
        return [db], "".join(b)

    def anime1(rnd):
        d = [rgrad("glow", "#ffffff", "#ffd7ec")]
        cd, cb = clouds(rnd, 300, 9, "#ffffff")
        b = [cb, sun(1200, 220, 60, "#fffdf5", "glow")]
        b.append(f'<g fill="#8fd6a6">{ridge(rnd, 640, 60, 1.6, 0.8)}</g>')
        b.append(f'<g fill="#5cb88a">{ridge(rnd, 740, 48, 1.3, 2.9)}</g>')
        return d + [cd], "".join(b)

    def anime2(rnd):
        d = [rgrad("glow", "#fff0d0", "#ff9db0")]
        cd, cb = clouds(rnd, 380, 8, "#ffd9c9")
        b = [sun(560, 420, 110, "#fff2d2", "glow"), cb]
        b.append(f'<g fill="#7a4a6a" opacity="0.85">{ridge(rnd, 660, 50, 1.5, 1.2)}</g>')
        b.append(f'<g fill="#43263f">{ridge(rnd, 770, 40, 1.2, 3.6)}</g>')
        return d + [cd], "".join(b)

    def tech1(rnd):
        d = [rgrad("glow", "#ff6bd6", "#3b1a6b")]
        b = [f'<rect x="0" y="0" width="{W}" height="520" fill="#0a0620"/>', sun(800, 500, 200, "#ff5ea8", "glow")]
        b.append(f'<rect x="0" y="470" width="{W}" height="6" fill="#ff8ad4" opacity="0.8"/>')
        b.append(grid_floor(476, "#5de1ff"))
        return d, "".join(b)

    def tech2(rnd):
        items = [(rnd.uniform(120, W - 120), rnd.uniform(120, H - 120), rnd.uniform(180, 380), c, 0.62)
                 for c in ("#6a8bff", "#b06bff", "#37e6c8", "#ff7ad9")]
        db, bb = blobs(items, 140)
        return [db], f'<rect width="{W}" height="{H}" fill="#080a1e"/>' + bb

    out["nature-1"] = ("自然 · 晨雾丘陵", nature1)
    out["nature-2"] = ("自然 · 苔原湖泊", nature2)
    out["forest-1"] = ("森林 · 云杉夜色", forest1)
    out["forest-2"] = ("森林 · 晨光林间", forest2)
    out["city-1"] = ("建筑 · 暮色天际线", city1)
    out["city-2"] = ("建筑 · 霓虹都市", city2)
    out["travel-1"] = ("旅行 · 落日沙丘", travel1)
    out["travel-2"] = ("旅行 · 海岸公路", travel2)
    out["ocean-1"] = ("海洋 · 叠浪", ocean1)
    out["ocean-2"] = ("海洋 · 深海微光", ocean2)
    out["starry-1"] = ("星空 · 银河", starry1)
    out["starry-2"] = ("星空 · 极光之夜", starry2)
    out["anime-1"] = ("动漫 · 粉色天空", anime1)
    out["anime-2"] = ("动漫 · 夏日晚霞", anime2)
    out["tech-1"] = ("技术 · 网格地平线", tech1)
    out["tech-2"] = ("技术 · 流体色块", tech2)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for wid, (label, fn) in walls().items():
        sky = {
            "nature-1": ((0, "#bfe3ff"), (0.55, "#eaf7ff"), (1, "#f6ffe9")),
            "nature-2": ((0, "#8fd3f4"), (1, "#e8f7ff")),
            "forest-1": ((0, "#040b1a"), (0.6, "#0d2440"), (1, "#16404a")),
            "forest-2": ((0, "#dff2e3"), (0.6, "#a8d8b8"), (1, "#e9f7e6")),
            "city-1": ((0, "#2b2a55"), (0.5, "#8a4f6b"), (1, "#ff9d6c")),
            "city-2": ((0, "#070518"), (0.6, "#1b1040"), (1, "#3a1b5c")),
            "travel-1": ((0, "#ffd79a"), (0.5, "#ffb166"), (1, "#ff8458")),
            "travel-2": ((0, "#ffd9c4"), (0.5, "#ff9f7d"), (1, "#6fb7c9")),
            "ocean-1": ((0, "#c9f2ff"), (0.5, "#7fdcee"), (1, "#2b9dc0")),
            "ocean-2": ((0, "#0a3550"), (0.6, "#062234"), (1, "#020d16")),
            "starry-1": ((0, "#03050f"), (0.55, "#0a1030"), (1, "#1b2350")),
            "starry-2": ((0, "#03060f"), (0.6, "#070d1f"), (1, "#0b1428")),
            "anime-1": ((0, "#bfe6ff"), (0.55, "#ffe1ef"), (1, "#fff4e0")),
            "anime-2": ((0, "#5f4b8b"), (0.45, "#ff9e7d"), (1, "#ffd9a8")),
            "tech-1": ((0, "#0a0620"), (1, "#1a0a3c")),
            "tech-2": ((0, "#080a1e"), (1, "#101436")),
        }[wid]
        content = build(wid, label, sky, fn)
        path = os.path.join(OUT, f"{wid}.svg")
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"{path}  {len(content) // 1024}KB")


if __name__ == "__main__":
    main()
