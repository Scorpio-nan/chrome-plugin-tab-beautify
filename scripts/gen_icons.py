"""生成扩展图标 public/icon/{16,32,48,128}.png
用法: python scripts/gen_icons.py
设计: 紫蓝渐变圆角方块 + 白色 W 字标
"""
import os
from PIL import Image, ImageDraw

SIZES = [16, 32, 48, 128]
GRAD_TOP = (102, 126, 234)   # #667eea
GRAD_BOT = (118, 82, 170)    # #764ba2


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 1) 竖直渐变底
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=lerp(GRAD_TOP, GRAD_BOT, t) + (255,))

    # 2) 圆角遮罩
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=size * 0.22, fill=255)
    img.putalpha(mask)

    # 3) 白色 W 字标（粗线条折线）
    w = max(2, round(size * 0.11))
    margin = size * 0.24
    half = size / 2
    pts = [
        (half - size * 0.26, margin),
        (half - size * 0.10, size - margin),
        (half, half),
        (half + size * 0.10, size - margin),
        (half + size * 0.26, margin),
    ]
    d2 = ImageDraw.Draw(img)
    d2.line(pts, fill=(255, 255, 255, 255), width=w, joint="curve")
    return img


if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "icon")
    os.makedirs(out_dir, exist_ok=True)
    for s in SIZES:
        make_icon(s).save(os.path.join(out_dir, f"{s}.png"))
        print(f"icon/{s}.png ✓")