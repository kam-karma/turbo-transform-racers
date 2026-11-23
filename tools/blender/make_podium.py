"""The garage / home showroom podium, modelled in Blender.

Two GLBs in showroom units (car length 4, deck top at y = 0):
  podium-base.glb — the static stepped plinth: three tiers, chrome bands, LED strips, eight
                    spotlights aimed at the car, bolts and a light-up skirt.
  podium-top.glb  — the turntable deck: glossy disc, chequered band, chevron rim lights,
                    a raised inner ring and a star emblem.
Materials the game tints per world: 'accent' (world colour), 'glow' (LEDs, world colour).
Others: 'deck', 'dark', 'chrome', 'checker_dark', 'lens'.

Usage: blender -b -P make_podium.py -- <out_dir>
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
from common import args, reset

OUT = args()[0]
os.makedirs(OUT, exist_ok=True)


def material(name, color, rough=0.3, metal=0.0, emit=None, strength=0.0):
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


def M():
    return {
        'deck': material('deck', (0.97, 0.96, 1.0), 0.18, 0.0),
        'dark': material('dark', (0.13, 0.07, 0.32), 0.35, 0.1),
        'accent': material('accent', (1.0, 0.3, 0.75), 0.25, 0.1),
        'chrome': material('chrome', (0.92, 0.93, 0.97), 0.08, 1.0),
        'glow': material('glow', (1.0, 0.4, 0.8), 0.3, 0.0, (1.0, 0.4, 0.8), 5.0),
        'checker_dark': material('checker_dark', (0.1, 0.08, 0.2), 0.3, 0.0),
        'lens': material('lens', (1.0, 0.97, 0.85), 0.1, 0.0, (1.0, 0.95, 0.8), 6.0),
    }


def smooth(o):
    for f in o.data.polygons:
        f.use_smooth = True


def mods(o, bevel=0.0, segs=2):
    if bevel > 0:
        b = o.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = segs; b.limit_method = 'ANGLE'
    o.modifiers.new('wn', 'WEIGHTED_NORMAL').keep_sharp = True
    return o


def cyl(name, mat, r_top, r_bot, h, y, segs=72, bevel=0.03):
    """Cylinder with its top at y (Blender z up = game y)."""
    bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=r_bot, radius2=r_top, depth=h, location=(0, 0, y - h / 2))
    o = bpy.context.active_object; o.name = name; o.data.materials.append(mat)
    smooth(o)
    return mods(o, bevel)


def torus(name, mat, R, r, y, segs=96):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=segs, minor_segments=8, location=(0, 0, y))
    o = bpy.context.active_object; o.name = name; o.data.materials.append(mat)
    smooth(o)
    return o


def ring_segments(name, mats_cycle, r_in, r_out, h, y, n):
    """A flat annulus split into n wedges, alternating materials (chequered band)."""
    bm = bmesh.new()
    me = bpy.data.meshes.new(name)
    sub = 3
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        pts = []
        for k in range(sub + 1):
            a = a0 + (a1 - a0) * k / sub
            pts.append((math.cos(a), math.sin(a)))
        top_in = [bm.verts.new((c * r_in, s * r_in, y)) for c, s in pts]
        top_out = [bm.verts.new((c * r_out, s * r_out, y)) for c, s in pts]
        bot_in = [bm.verts.new((c * r_in, s * r_in, y - h)) for c, s in pts]
        bot_out = [bm.verts.new((c * r_out, s * r_out, y - h)) for c, s in pts]
        faces = []
        for k in range(sub):
            faces.append(bm.faces.new((top_in[k], top_out[k], top_out[k + 1], top_in[k + 1])))
            faces.append(bm.faces.new((bot_in[k + 1], bot_out[k + 1], bot_out[k], bot_in[k])))
            faces.append(bm.faces.new((top_out[k], bot_out[k], bot_out[k + 1], top_out[k + 1])))
            faces.append(bm.faces.new((top_in[k + 1], bot_in[k + 1], bot_in[k], top_in[k])))
        faces.append(bm.faces.new((top_in[0], bot_in[0], bot_out[0], top_out[0])))
        faces.append(bm.faces.new((top_out[-1], bot_out[-1], bot_in[-1], top_in[-1])))
        for f in faces:
            f.material_index = i % len(mats_cycle)
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    for m in mats_cycle:
        me.materials.append(m)
    return mods(o, 0.006, 2)


def star(name, mat, r_out, r_in, h, y, points=5):
    bm = bmesh.new()
    n = points * 2
    pts = [(math.cos(math.pi / 2 + math.pi * i / points) * (r_out if i % 2 == 0 else r_in), math.sin(math.pi / 2 + math.pi * i / points) * (r_out if i % 2 == 0 else r_in)) for i in range(n)]
    top = [bm.verts.new((x, z, y)) for x, z in pts]
    bot = [bm.verts.new((x, z, y - h)) for x, z in pts]
    bm.faces.new(top); bm.faces.new(list(reversed(bot)))
    for i in range(n):
        bm.faces.new((top[i], bot[i], bot[(i + 1) % n], top[(i + 1) % n]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    me.materials.append(mat)
    return mods(o, h * 0.4, 2)


def chevron(name, mat, y, a, r):
    """A small glowing arrow on the deck rim, pointing along the rotation."""
    bm = bmesh.new()
    shape = [(-0.12, -0.1), (0.0, -0.1), (0.14, 0.0), (0.0, 0.1), (-0.12, 0.1), (0.02, 0.0)]
    top = [bm.verts.new((sx, sz, y)) for sx, sz in shape]
    bot = [bm.verts.new((sx, sz, y - 0.02)) for sx, sz in shape]
    bm.faces.new(top); bm.faces.new(list(reversed(bot)))
    for i in range(len(shape)):
        bm.faces.new((top[i], bot[i], bot[(i + 1) % len(shape)], top[(i + 1) % len(shape)]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    me.materials.append(mat)
    o.location = (math.cos(a) * r, math.sin(a) * r, 0)
    o.rotation_euler = (0, 0, a + math.pi / 2)
    return o


def export(name):
    for o in bpy.context.scene.objects:
        o.select_set(o.type == 'MESH')
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True, export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
    print('exported', path)


# --- static base -------------------------------------------------------------------------------
reset()
m = M()
cyl('tier1', m['dark'], 3.55, 3.7, 0.5, -0.18, bevel=0.06)          # under the deck
torus('chrome1', m['chrome'], 3.6, 0.045, -0.2)
cyl('led1', m['glow'], 3.72, 3.72, 0.06, -0.45, bevel=0.0)          # LED strip under tier 1
cyl('tier2', m['deck'], 4.15, 4.3, 0.22, -0.48, bevel=0.06)          # white step
cyl('tier2band', m['accent'], 4.32, 4.32, 0.07, -0.6, bevel=0.01)
torus('chrome2', m['chrome'], 4.24, 0.04, -0.49)
cyl('tier3', m['dark'], 4.95, 5.15, 0.2, -0.66, bevel=0.06)          # wide floor plinth
cyl('led3', m['glow'], 5.17, 5.17, 0.04, -0.8, bevel=0.0)
cyl('tier3lip', m['accent'], 5.0, 5.0, 0.02, -0.455, bevel=0.0)
# bolts around tier 2 and tier 3
for i in range(24):
    a = 2 * math.pi * i / 24
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.05, location=(math.cos(a) * 4.0, math.sin(a) * 4.0, -0.26))
    o = bpy.context.active_object; o.name = f'bolt{i}'; o.data.materials.append(m['chrome']); o.scale.z = 0.5; smooth(o)
# eight spotlights on the floor plinth, aimed up at the car
for i in range(8):
    a = 2 * math.pi * (i + 0.5) / 8
    x, z = math.cos(a) * 4.6, math.sin(a) * 4.6
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.16, depth=0.3, location=(x, z, -0.32))
    body = bpy.context.active_object; body.name = f'spot{i}'; body.data.materials.append(m['dark'])
    tilt = math.radians(40)
    body.rotation_euler = (math.sin(a) * tilt, -math.cos(a) * tilt, 0)
    smooth(body); mods(body, 0.03)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.12, depth=0.04, location=(x - math.cos(a) * 0.1, z - math.sin(a) * 0.1, -0.2))
    lens = bpy.context.active_object; lens.name = f'lens{i}'; lens.data.materials.append(m['lens'])
    lens.rotation_euler = body.rotation_euler
    bpy.ops.mesh.primitive_torus_add(major_radius=0.16, minor_radius=0.025, major_segments=24, minor_segments=6, location=(x - math.cos(a) * 0.1, z - math.sin(a) * 0.1, -0.19))
    rim = bpy.context.active_object; rim.name = f'spotrim{i}'; rim.data.materials.append(m['chrome']); rim.rotation_euler = body.rotation_euler; smooth(rim)
export('podium-base')

# --- turntable deck ------------------------------------------------------------------------------
reset()
m = M()
cyl('deck', m['deck'], 3.3, 3.38, 0.3, 0.0, bevel=0.05)
ring_segments('checker', [m['deck'], m['checker_dark']], 2.72, 3.12, 0.02, 0.012, 48)
torus('deckrim', m['chrome'], 3.33, 0.05, -0.02)
torus('innerring', m['accent'], 2.6, 0.05, 0.02)
for i in range(16):
    chevron(f'chev{i}', m['glow'], 0.022, 2 * math.pi * i / 16, 3.22)
# centre emblem: a soft raised disc with a star (under the car, glimpsed between the wheels)
cyl('emblem', m['accent'], 1.05, 1.1, 0.03, 0.018, segs=64, bevel=0.01)
star('star', m['deck'], 0.85, 0.36, 0.03, 0.04)
export('podium-top')
