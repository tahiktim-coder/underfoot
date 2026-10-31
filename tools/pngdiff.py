# Compare the PNGs of two folders by name: how many pixels differ, and where. For checking that a change
# left nights 1 to 3 as they were.   python tools/pngdiff.py out/base_n1 out/chk_n1
import sys, os
from PIL import Image, ImageChops

a, b = sys.argv[1], sys.argv[2]
names = sorted(n for n in os.listdir(a) if n.endswith('.png'))
total = 0
for n in names:
    pb = os.path.join(b, n)
    if not os.path.exists(pb):
        print(f'{n}: missing in {b}'); total += 1; continue
    ia, ib = Image.open(os.path.join(a, n)).convert('RGB'), Image.open(pb).convert('RGB')
    if ia.size != ib.size:
        print(f'{n}: size {ia.size} vs {ib.size}'); total += 1; continue
    d = ImageChops.difference(ia, ib)
    bbox = d.getbbox()
    if not bbox:
        print(f'{n}: identical'); continue
    px = sum(1 for p in d.getdata() if p != (0, 0, 0))
    mx = max(max(p) for p in d.getdata())
    total += px
    print(f'{n}: {px} px differ ({100.0 * px / (ia.size[0] * ia.size[1]):.2f}%), max channel diff {mx}, box {bbox}')
print('TOTAL differing pixels:', total)
