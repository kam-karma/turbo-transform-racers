"""Garage mod parts modelled in Blender: spoilers, rims and a fat tyre, exported as GLB.

Conventions (Blender space, exported to glTF Y-up):
  - Spoilers: span along X = 1.0, nose towards -Y, mount points (bottom of the posts) at z = 0.
  - Rims / tyre: face +X (the outside of a right-hand wheel), radius 1.0, centre at the origin.
Material names tell the game what to tint: 'paint' (mod or body colour), 'rim', 'tire',
'trim' (dark satin), 'chrome', 'glow' (emissive accent).

Usage: blender -b -P make_parts.py -- <out_dir>
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(__file__))
from common import args, reset

OUT = args()[0]
os.makedirs(OUT, exist_ok=True)

# --- materials -------------------------------------------------------------------------------

def material(name, color, rough=0.4, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit is not None:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = strength
    return m

def mats():
    return {
        'paint': material('paint', (0.9, 0.2, 0.25), 0.28, 0.15),
        'trim': material('trim', (0.05, 0.05, 0.07), 0.55, 0.2),
        'chrome': material('chrome', (0.9, 0.92, 0.95), 0.12, 1.0),
        'glow': material('glow', (1.0, 0.55, 0.1), 0.3, 0.0, (1.0, 0.45, 0.05), 6.0),
        'rim': material('rim', (0.85, 0.87, 0.9), 0.25, 0.6),
        'tire': material('tire', (0.06, 0.06, 0.07), 0.85, 0.0),
    }

# --- mesh helpers ----------------------------------------------------------------------------

def obj_from_bm(bm, name, mat, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(mat)
    if smooth:
        for f in me.polygons:
            f.use_smooth = True
    return o

def add_mod(o, kind, **kw):
    m = o.modifiers.new(kind, kind)
    for k, v in kw.items():
        setattr(m, k, v)
    return m

def finish(o, bevel=0.0, subsurf=0, wn=True, segments=3):
    if bevel > 0:
        add_mod(o, 'BEVEL', width=bevel, segments=segments, limit_method='ANGLE', angle_limit=math.radians(40))
    if subsurf > 0:
        add_mod(o, 'SUBSURF', levels=subsurf, render_levels=subsurf)
    if wn:
        add_mod(o, 'WEIGHTED_NORMAL', keep_sharp=True)
    return o

def box(name, mat, size, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.02):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = obj_from_bm(bm, name, mat, smooth=False)
    o.location = loc
    o.rotation_euler = rot
    return finish(o, bevel=bevel)

def cylinder(name, mat, r1, r2, depth, segs=24, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=depth)
    o = obj_from_bm(bm, name, mat)
    o.location = loc
    o.rotation_euler = rot
    return finish(o, bevel=bevel)

def airfoil(t):
    """Rounded cambered airfoil around the chord (y from -0.5 leading to 0.5 trailing)."""
    pts = []
    n = 14
    for i in range(n):
        a = math.pi * i / (n - 1)
        x = 0.5 - 0.5 * math.cos(a)            # 0..1 along the chord
        th = t * (1.4845 * math.sqrt(x) - 0.63 * x - 1.758 * x * x + 1.4215 * x ** 3 - 0.5075 * x ** 4)
        camber = 0.06 * math.sin(math.pi * x)
        pts.append((x - 0.5, camber + th))
    for i in range(n - 2, 0, -1):
        a = math.pi * i / (n - 1)
        x = 0.5 - 0.5 * math.cos(a)
        th = t * (1.4845 * math.sqrt(x) - 0.63 * x - 1.758 * x * x + 1.4215 * x ** 3 - 0.5075 * x ** 4)
        camber = 0.06 * math.sin(math.pi * x)
        pts.append((x - 0.5, camber - th))
    return pts

def wing(name, mat, span=1.0, chord=0.22, thick=0.16, sweep=0.0, taper=0.85, dihedral=0.0, pitch=-0.12,
         z=0.0, y=0.0, tips_up=0.0, sections=16):
    """Airfoil wing spanning X; leading edge towards -Y; pitched nose-down slightly."""
    prof = airfoil(thick)
    bm = bmesh.new()
    rings = []
    for s in range(sections + 1):
        u = s / sections * 2 - 1                       # -1..1 across the span
        x = u * span / 2
        k = 1 - (1 - taper) * abs(u) ** 2
        c = chord * k
        off_y = sweep * abs(u) * span / 2
        off_z = dihedral * abs(u) * span / 2 + tips_up * abs(u) ** 6 * chord
        ring = []
        for (py, pz) in prof:
            yy, zz = py * c, pz * c
            yy, zz = yy * math.cos(pitch) - zz * math.sin(pitch), yy * math.sin(pitch) + zz * math.cos(pitch)
            ring.append(bm.verts.new((x, y + yy + off_y, z + zz + off_z)))
        rings.append(ring)
    m = len(prof)
    for s in range(sections):
        a, b = rings[s], rings[s + 1]
        for i in range(m):
            bm.faces.new((a[i], a[(i + 1) % m], b[(i + 1) % m], b[i]))
    for ring in (rings[0], rings[-1]):
        f = bm.faces.new(ring if ring is rings[-1] else list(reversed(ring)))
        bmesh.ops.poke(bm, faces=[f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(bm, name, mat)
    return finish(o, subsurf=1)

def plate(name, mat, h, l, t, loc, round_=0.35):
    """Rounded endplate in the YZ plane (thickness t along X)."""
    bm = bmesh.new()
    n = 28
    verts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        cy, cz = math.cos(a), math.sin(a)
        # superellipse for a rounded-rectangle outline
        e = 2 / (1 + 6 * round_)
        sy = math.copysign(abs(cy) ** e, cy) * l / 2
        sz = math.copysign(abs(cz) ** e, cz) * h / 2
        verts.append((sy, sz))
    top = [bm.verts.new((t / 2, y, z)) for (y, z) in verts]
    bot = [bm.verts.new((-t / 2, y, z)) for (y, z) in verts]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    for i in range(n):
        bm.faces.new((top[i], bot[i], bot[(i + 1) % n], top[(i + 1) % n]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(bm, name, mat, smooth=False)
    o.location = loc
    return finish(o, bevel=t * 0.45, segments=3)

def post(name, mat, top_z, y=0.0, x=0.0, w=0.05, d=0.09, swan=False):
    """Tapered blade post from z=0 up to top_z (swan neck bends forward and over)."""
    bm = bmesh.new()
    steps = 8
    rings = []
    for i in range(steps + 1):
        t = i / steps
        z = top_z * t
        yy = y + (0.06 * math.sin(t * math.pi * 0.9) if swan else 0) - (0.03 * t if not swan else 0)
        ww, dd = w * (1 - 0.25 * t), d * (1 - 0.35 * t)
        rings.append([bm.verts.new((x + sx * ww / 2, yy + sy * dd / 2, z)) for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for i in range(steps):
        a, b = rings[i], rings[i + 1]
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    o = obj_from_bm(bm, name, mat, smooth=False)
    return finish(o, bevel=w * 0.3)

def base_pad(name, mat, x, y):
    return cylinder(name, mat, 0.045, 0.035, 0.02, 16, loc=(x, y, 0.01), bevel=0.006)

def export(name):
    path = os.path.join(OUT, f'{name}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True, export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
    print('exported', path)

# --- spoilers --------------------------------------------------------------------------------

def spoiler(kind):
    reset()
    M = mats()
    P, T, C, G = M['paint'], M['trim'], M['chrome'], M['glow']
    if kind == 'ordek':
        # Ducktail: a sculpted lip that sweeps up off the trunk edge, no posts.
        bm = bmesh.new()
        n_s, prof = 18, [(-0.11, 0.0), (0.0, 0.0), (0.085, 0.0), (0.1, 0.03), (0.105, 0.085), (0.09, 0.1), (0.04, 0.075), (-0.04, 0.035), (-0.11, 0.01)]
        rings = []
        for s in range(n_s + 1):
            u = s / n_s * 2 - 1
            k = 1 - 0.35 * abs(u) ** 3
            rings.append([bm.verts.new((u * 0.5, py * 1.6, pz * k * 1.6)) for (py, pz) in prof])
        m = len(prof)
        for s in range(n_s):
            a, b = rings[s], rings[s + 1]
            for i in range(m):
                bm.faces.new((a[i], a[(i + 1) % m], b[(i + 1) % m], b[i]))
        bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        finish(obj_from_bm(bm, 'lip', P), subsurf=2)
        box('lip_line', T, (0.84, 0.02, 0.02), loc=(0, 0.15, 0.158), bevel=0.008)
        return export('spoiler-ordek')
    spec = {
        # top height, chord, thickness, plates (h, l), twin deck, swan posts, sweep, taper
        'kanatcik': (0.13, 0.17, 0.16, None, False, False, 0.0, 0.8),
        'spor': (0.19, 0.22, 0.15, (0.15, 0.30), False, False, 0.0, 0.92),
        'cift': (0.2, 0.2, 0.14, (0.24, 0.30), True, False, 0.0, 0.95),
        'roket': (0.2, 0.22, 0.15, (0.14, 0.3), False, False, 0.1, 0.9),
        'yarasa': (0.22, 0.2, 0.13, None, False, True, 0.18, 0.55),
        'jet': (0.24, 0.26, 0.13, (0.18, 0.36), False, True, 0.25, 0.75),
        'dev': (0.3, 0.3, 0.15, (0.32, 0.42), True, False, 0.0, 1.0),
    }[kind]
    top, chord, thick, plates, twin, swan, sweep, taper = spec
    chord, thick = chord * 1.15, thick * 1.35
    wing('wing', P if kind in ('kanatcik', 'cift', 'yarasa', 'dev') else T, span=1.0, chord=chord, thick=thick,
         sweep=sweep, taper=taper, z=top, tips_up=(0.9 if kind == 'yarasa' else 0.25), dihedral=(0.06 if kind == 'yarasa' else 0.0))
    if twin:
        wing('wing2', T if kind == 'cift' else P, span=0.96, chord=chord * 0.62, thick=thick * 0.9, taper=taper, z=top + chord * 0.55, y=chord * 0.3, pitch=-0.3)
    if plates is not None:
        h, l = plates
        for sx in (-1, 1):
            plate(f'plate{sx}', P if kind in ('spor', 'roket', 'jet') else T, h, l, 0.022, (sx * 0.51, 0.02, top + h * 0.18))
    post_x = 0.26 if kind != 'dev' else 0.3
    for sx in (-1, 1):
        post(f'post{sx}', T if not swan else P, top, y=0.04 if swan else 0.0, x=sx * post_x, w=0.045, d=0.11 if not swan else 0.07, swan=swan)
        base_pad(f'pad{sx}', C, sx * post_x, 0.0)
    if kind == 'roket':
        for sx in (-1, 1):
            body = cylinder(f'thr{sx}', C, 0.07, 0.065, 0.24, 24, loc=(sx * 0.36, 0.05, top + 0.045), rot=(math.radians(90), 0, 0), bevel=0.01)
            cylinder(f'noz{sx}', T, 0.05, 0.07, 0.07, 24, loc=(sx * 0.36, 0.19, top + 0.045), rot=(math.radians(90), 0, 0), bevel=0.008)
            cylinder(f'fire{sx}', G, 0.052, 0.052, 0.012, 24, loc=(sx * 0.36, 0.226, top + 0.045), rot=(math.radians(90), 0, 0))
            cylinder(f'cone{sx}', M['paint'], 0.0, 0.055, 0.09, 24, loc=(sx * 0.36, -0.105, top + 0.045), rot=(math.radians(90), 0, 0))
    if kind == 'jet':
        fin = box('fin', P, (0.022, 0.22, 0.17), loc=(0, 0.07, top + 0.09), bevel=0.009)
    if kind == 'dev':
        box('gurney', C, (0.98, 0.02, 0.03), loc=(0, chord * 0.48, top + 0.02), bevel=0.006)
    export(f'spoiler-{kind}')

# --- rims and tyre ---------------------------------------------------------------------------

def disc(name, mat, r, depth, x=0.0, segs=48, bevel=0.03):
    return cylinder(name, mat, r, r, depth, segs, loc=(x, 0, 0), rot=(0, math.radians(90), 0), bevel=bevel)

def star_prism(name, mat, points, r_out, r_in, depth, x, rot0=0.0):
    bm = bmesh.new()
    n = points * 2
    ring = [(math.cos(rot0 + math.pi * i / points) * (r_out if i % 2 == 0 else r_in), math.sin(rot0 + math.pi * i / points) * (r_out if i % 2 == 0 else r_in)) for i in range(n)]
    a = [bm.verts.new((x + depth / 2, y, z)) for (y, z) in ring]
    b = [bm.verts.new((x - depth / 2, y, z)) for (y, z) in ring]
    bm.faces.new(a); bm.faces.new(list(reversed(b)))
    for i in range(n):
        bm.faces.new((a[i], b[i], b[(i + 1) % n], a[(i + 1) % n]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(bm, name, mat, smooth=False)
    return finish(o, bevel=depth * 0.35)

def spoke(name, mat, angle, r0, r1, w, depth, x):
    mid = (r0 + r1) / 2
    o = box(name, mat, (depth, w, r1 - r0), loc=(x, math.cos(angle) * mid, math.sin(angle) * mid), bevel=min(w, depth) * 0.35)
    o.rotation_euler = (angle - math.pi / 2, 0, 0)
    return o

def lugs(mat, n, r, x):
    for i in range(n):
        a = 2 * math.pi * i / n
        cylinder(f'lug{i}', mat, 0.045, 0.04, 0.05, 6, loc=(x, math.cos(a) * r, math.sin(a) * r), rot=(0, math.radians(90), 0), bevel=0.008)

def hub(mat, x, r=0.2):
    o = cylinder('hub', mat, r, r * 0.8, 0.12, 32, loc=(x, 0, 0), rot=(0, math.radians(90), 0), bevel=0.03)
    return o

def rim(kind):
    reset()
    M = mats()
    R, C, T, G, P = M['rim'], M['chrome'], M['trim'], M['glow'], M['paint']
    # Every rim: an outer lip ring and a recessed dish, then its own face.
    lip = bpy.ops.mesh.primitive_torus_add(major_radius=0.93, minor_radius=0.07, major_segments=64, minor_segments=12, location=(0.02, 0, 0), rotation=(0, math.radians(90), 0))
    lip_o = bpy.context.active_object; lip_o.name = 'lip'; lip_o.data.materials.append(C if kind not in ('sekerleme', 'neon') else R)
    for f in lip_o.data.polygons: f.use_smooth = True
    disc('dish', T, 0.9, 0.06, x=-0.06, bevel=0.01)
    if kind == 'yildiz' or kind == 'altin':
        star_prism('star', R, 5, 0.86, 0.36, 0.12, 0.02, rot0=math.pi / 2)
        hub(C if kind == 'yildiz' else R, 0.07, 0.18)
        lugs(C, 5, 0.26, 0.1)
    elif kind == 'papatya':
        for i in range(7):
            a = 2 * math.pi * i / 7
            bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1.0, location=(0.0, math.cos(a) * 0.52, math.sin(a) * 0.52), rotation=(a - math.pi / 2, 0, 0), scale=(0.07, 0.17, 0.3))
            o = bpy.context.active_object; o.name = f'petal{i}'; o.data.materials.append(R)
            for f in o.data.polygons: f.use_smooth = True
        center = hub(material('yolk', (1.0, 0.78, 0.15), 0.35, 0.0), 0.06, 0.26)
    elif kind == 'disli':
        star_prism('gear', R, 12, 0.86, 0.74, 0.1, 0.0)
        disc('gearhole', T, 0.55, 0.12, x=0.01, bevel=0.01)
        for i in range(6):
            spoke(f'sp{i}', R, 2 * math.pi * i / 6, 0.2, 0.6, 0.12, 0.08, 0.02)
        hub(C, 0.06, 0.2)
    elif kind == 'spor':
        for i in range(10):
            spoke(f'sp{i}', R, 2 * math.pi * i / 10, 0.18, 0.86, 0.07, 0.07, 0.0)
        hub(C, 0.05, 0.18)
        cylinder('badge', material('badge', (0.95, 0.2, 0.25), 0.3, 0.2), 0.08, 0.08, 0.02, 24, loc=(0.12, 0, 0), rot=(0, math.radians(90), 0), bevel=0.006)
    elif kind == 'tombul':
        disc('face', R, 0.84, 0.14, x=0.0, bevel=0.05)
        for i in range(8):
            a = 2 * math.pi * i / 8
            cylinder(f'hole{i}', T, 0.1, 0.1, 0.18, 20, loc=(0.0, math.cos(a) * 0.56, math.sin(a) * 0.56), rot=(0, math.radians(90), 0), bevel=0.02)
        hub(C, 0.07, 0.22)
    elif kind == 'sekerleme':
        disc('face', material('cream', (1, 1, 1), 0.35, 0.0), 0.86, 0.1, x=0.0, bevel=0.04)
        for i in range(5):
            a0 = 2 * math.pi * i / 5
            pts = []
            for k in range(14):
                t = k / 13
                a = a0 + t * 2.2
                rr = 0.12 + t * 0.7
                o = cylinder(f'swirl{i}_{k}', R, 0.06 + 0.03 * t, 0.06 + 0.03 * t, 0.06, 14, loc=(0.06, math.cos(a) * rr, math.sin(a) * rr), rot=(0, math.radians(90), 0))
        hub(R, 0.08, 0.16)
    elif kind == 'krom':
        for i in range(5):
            a = 2 * math.pi * i / 5
            spoke(f'sp{i}', R, a - 0.08, 0.18, 0.86, 0.14, 0.09, 0.0)
            spoke(f'spb{i}', R, a + 0.08, 0.18, 0.86, 0.14, 0.09, 0.0)
        hub(C, 0.06, 0.2)
        lugs(C, 5, 0.27, 0.09)
    elif kind == 'neon':
        for i in range(7):
            a = 2 * math.pi * i / 7
            o = spoke(f'blade{i}', T, a, 0.2, 0.84, 0.16, 0.05, 0.0)
            o.rotation_euler = (a - math.pi / 2, math.radians(25), 0)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.78, minor_radius=0.035, major_segments=64, minor_segments=8, location=(0.06, 0, 0), rotation=(0, math.radians(90), 0))
        g = bpy.context.active_object; g.name = 'glowring'; g.data.materials.append(material('glow', (0.2, 0.95, 1.0), 0.3, 0.0, (0.2, 0.95, 1.0), 8.0))
        hub(R, 0.06, 0.2)
    elif kind == 'dev':
        disc('face', R, 0.86, 0.12, x=0.0, bevel=0.03)
        for i in range(6):
            a = 2 * math.pi * i / 6
            cylinder(f'hole{i}', T, 0.13, 0.13, 0.16, 20, loc=(0.0, math.cos(a) * 0.52, math.sin(a) * 0.52), rot=(0, math.radians(90), 0), bevel=0.02)
        for i in range(16):
            a = 2 * math.pi * i / 16
            cylinder(f'bolt{i}', C, 0.035, 0.03, 0.06, 8, loc=(0.07, math.cos(a) * 0.8, math.sin(a) * 0.8), rot=(0, math.radians(90), 0), bevel=0.006)
        hub(C, 0.07, 0.24)
    export(f'rim-{kind}')

def tyre():
    """A fat tyre with chunky tread lugs, for the size > 1 wheels (wraps the stock tyre)."""
    reset()
    M = mats()
    bpy.ops.mesh.primitive_torus_add(major_radius=0.78, minor_radius=0.26, major_segments=48, minor_segments=12, rotation=(0, math.radians(90), 0))
    t = bpy.context.active_object; t.name = 'tyre'; t.data.materials.append(M['tire'])
    t.scale = (1.35, 1, 1)
    for f in t.data.polygons: f.use_smooth = True
    for i in range(24):
        a = 2 * math.pi * i / 24
        for side in (-1, 1):
            o = box(f'tread{i}{side}', M['tire'], (0.2, 0.16, 0.1), bevel=0.0, loc=(side * 0.13, math.cos(a + side * 0.07) * 1.03, math.sin(a + side * 0.07) * 1.03))
            o.rotation_euler = (a + side * 0.07 - math.pi / 2, 0, 0)
    export('tyre-fat')

for k in ('kanatcik', 'ordek', 'spor', 'cift', 'roket', 'yarasa', 'jet', 'dev'):
    spoiler(k)
for k in ('yildiz', 'papatya', 'disli', 'spor', 'tombul', 'sekerleme', 'krom', 'neon', 'dev', 'altin'):
    rim(k)
tyre()
