"""Measure each car GLB for the garage mods and report loose parts.

Writes JSON (game space: x right, y up, z = nose) with values as fractions of the car's
bounding box, so they hold at any scale: wheels (centre, radius, outer x) and the roof-rear
spoiler mount. Usage: blender -b -P analyze_cars.py -- out.json car1.glb car2.glb ...
"""
import bpy, bmesh, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import args, reset, import_glb, world_bbox

a = args()
out, files = a[0], a[1:]
# Cars without wheels (hover pads): no rims or tyres are fitted.
HOVER = {'nane'}
result = {}
for f in files:
    reset()
    _, meshes = import_glb(f)
    mn, mx = world_bbox(meshes)
    size = mx - mn
    pts = []
    for o in meshes:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            # Blender (x, y, z-up) -> game (x, y-up, z=-y): nose is Blender -Y.
            pts.append((p.x, p.z, -p.y))
    # game-space box
    gx0, gx1 = mn.x, mx.x
    gy0, gy1 = mn.z, mx.z
    gz0, gz1 = -mx.y, -mn.y
    W, H, L = gx1 - gx0, gy1 - gy0, gz1 - gz0
    cx, cz = (gx0 + gx1) / 2, (gz0 + gz1) / 2
    wheels = []
    for sx in (-1, 1):
        for sz in (-1, 1):
            q = [p for p in pts if (p[0] - cx) * sx > 0 and (p[2] - cz) * sz > 0]
            ground = [p for p in q if p[1] < gy0 + 0.03 * H]
            if len(ground) < 3:
                wheels.append(None)
                continue
            zc = sum(p[2] for p in ground) / len(ground)
            outer = max(abs(p[0] - cx) for p in q if p[1] < gy0 + 0.5 * H and abs(p[2] - zc) < 0.2 * L)
            band = [p for p in q if abs(p[0] - cx) > outer - 0.06 * W and p[1] < gy0 + 0.55 * H and abs(p[2] - zc) < 0.25 * L]
            z0 = min(p[2] for p in band); z1 = max(p[2] for p in band)
            r = (z1 - z0) / 2
            top = max(p[1] for p in band)
            r = min(r, (top - gy0) / 2) if top - gy0 > 0 else r
            wheels.append({
                'x': round(sx * outer / W, 4), 'y': round(r / H, 4), 'z': round(((z0 + z1) / 2 - gz0) / L, 4), 'r': round(r / L, 4),
            })
    # spoiler mount: highest point of the rear 22 % near the centre line (trunk lid / tail)
    rear = [p for p in pts if p[2] < gz0 + 0.22 * L and abs(p[0] - cx) < 0.25 * W]
    hi = max(rear, key=lambda p: p[1]) if rear else (cx, gy1, gz0)
    # lip mount: the tail edge (highest point of the rear 9 %, lower half of the car's height band)
    tail_pts = [p for p in pts if p[2] < gz0 + 0.09 * L and abs(p[0] - cx) < 0.3 * W and p[1] < gy0 + 0.75 * H]
    tl = max(tail_pts, key=lambda p: p[1]) if tail_pts else hi
    name = os.path.splitext(os.path.basename(f))[0].replace('car-', '')
    if name in HOVER:
        wheels = []
    result['kivilcim' if name == 'hero' else name] = {
        'box': [round(W, 4), round(H, 4), round(L, 4)],
        'wheels': wheels,
        'rearTop': {'y': round((hi[1] - gy0) / H, 4), 'z': round((hi[2] - gz0) / L, 4)},
        'tail': {'y': round((tl[1] - gy0) / H, 4), 'z': round((tl[2] - gz0) / L, 4)},
    }
    # loose parts
    o = meshes[0]
    bm = bmesh.new(); bm.from_mesh(o.data)
    seen, parts = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        stack, comp = [v], []
        seen.add(v.index)
        while stack:
            u = stack.pop(); comp.append(u)
            for e in u.link_edges:
                w = e.other_vert(u)
                if w.index not in seen:
                    seen.add(w.index); stack.append(w)
        parts.append(len(comp))
    if False:
        print('CAR', name, 'meshes', len(meshes), 'loose parts', sorted(parts, reverse=True)[:6], 'wheels', wheels)
with open(out, 'w') as fh:
    json.dump(result, fh, indent=1)
