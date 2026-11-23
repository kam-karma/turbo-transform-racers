"""Cut a generated icon sheet (N x N grid on white) into transparent 256 px PNG icons.

Background removal: flood fill from the cell border through near-white pixels, so white
highlights inside an outlined icon are kept. Usage:
  python cut_sheet.py sheet.jpg 4 out_dir name1,name2,...
"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

TOL = 38  # max distance from pure white still treated as background


def remove_bg(cell: Image.Image) -> Image.Image:
    a = np.asarray(cell.convert('RGB')).astype(np.int16)
    h, w, _ = a.shape
    near_white = (255 - a).max(axis=2) <= TOL
    bg = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near_white[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near_white[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and near_white[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
    # Soften the cut edge a little so icons do not look jagged on coloured UI.
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8))
    out = cell.convert('RGBA')
    out.putalpha(alpha)
    return out


def main() -> None:
    sheet, n, out_dir, names = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4].split(',')
    im = Image.open(sheet)
    W, H = im.size
    cw, ch = W / n, H / n
    for i, name in enumerate(names):
        if not name:
            continue
        r, c = divmod(i, n)
        cell = im.crop((int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)))
        icon = remove_bg(cell)
        box = icon.getbbox()
        if box is None:
            print('empty', name)
            continue
        icon = icon.crop(box)
        s = int(max(icon.size) * 1.08)
        sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        sq.paste(icon, ((s - icon.size[0]) // 2, (s - icon.size[1]) // 2))
        sq.resize((256, 256), Image.LANCZOS).save(f'{out_dir}/{name}.png')
        print('ok', name, box)


if __name__ == '__main__':
    main()
