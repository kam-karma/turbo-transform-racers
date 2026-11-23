"""Garage card thumbnails from the cars' side-view reference images (white background removed).

Usage: python tools/icons/car_thumbs.py  ->  public/ui/cars/<car-id>.png (256 x 160, transparent)
"""
import os
import sys
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from cut_sheet import remove_bg  # noqa: E402

REF = 'assets/ref'
OUT = 'public/ui/cars'
# car id -> side view facing right (cards read left-to-right).
SOURCES = {
    'kivilcim': 'car-hero-right.png',
    'kumbocegi': 'car-kumbocegi-right.png',
    'pitircik': 'car-pitircik-right.png',
    'roket': 'car-roket-right.png',
    'tosbik': 'car-tosbik-right.png',
    'nane': 'car-nane-right.png',
    'firtina': 'car-firtina-right.png',
    'cakal': 'car-cakal-right.png',
    'buzul': 'car-buzul-right.png',
    'simsek': 'car-simsek-right.png',
    'magma': 'car-magma-right.png',
    'kartal': 'car-kartal-right.png',
}
W, H = 256, 160


def thumb(src: str) -> Image.Image:
    im = remove_bg(Image.open(src).convert('RGB'))
    box = im.getbbox()
    if box is not None:
        im = im.crop(box)
    im.thumbnail((W - 16, H - 16), Image.LANCZOS)
    # Soft dark outline so the car reads on any card colour.
    a = im.split()[3].filter(ImageFilter.MaxFilter(5))
    shadow = Image.new('RGBA', im.size, (59, 31, 122, 0))
    shadow.putalpha(a.point(lambda v: min(255, v)))
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x, y = (W - im.width) // 2, (H - im.height) // 2
    canvas.alpha_composite(shadow, (x, y))
    canvas.alpha_composite(im, (x, y))
    return canvas


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for car, name in SOURCES.items():
        src = os.path.join(REF, name)
        if not os.path.exists(src):
            print('missing', src)
            continue
        thumb(src).save(os.path.join(OUT, f'{car}.png'), optimize=True)
        print('ok', car)


if __name__ == '__main__':
    main()
