"""Split a 2x2 orthographic reference sheet into front/back/left/right square PNGs."""
import sys
from PIL import Image

sheet, prefix = sys.argv[1], sys.argv[2]
im = Image.open(sheet).convert('RGB')
W, H = im.size
for k, b in {'front': (0, 0, W // 2, H // 2), 'back': (W // 2, 0, W, H // 2), 'left': (0, H // 2, W // 2, H), 'right': (W // 2, H // 2, W, H)}.items():
    c = im.crop(b)
    s = max(c.size)
    sq = Image.new('RGB', (s, s), (255, 255, 255))
    sq.paste(c, ((s - c.size[0]) // 2, (s - c.size[1]) // 2))
    sq.save(f'{prefix}-{k}.png')
print('ok', prefix)
