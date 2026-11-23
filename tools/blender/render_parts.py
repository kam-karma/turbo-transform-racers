"""Preview renders of part GLBs (Eevee): out_dir/<name>.png"""
import bpy, os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from common import args, reset, import_glb, world_bbox
from mathutils import Vector
a = args(); out = a[-1]; files = a[:-1]
os.makedirs(out, exist_ok=True)
for f in files:
    reset()
    _, meshes = import_glb(f)
    mn, mx = world_bbox(meshes); c = (mn + mx) / 2; size = max(mx - mn)
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_EEVEE_NEXT'
    scn.render.resolution_x = scn.render.resolution_y = 360
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.5, 0.75, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.2
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 4; sun.rotation_euler = (0.7, 0.2, 0.6); scn.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = size * 1.25
    name = os.path.splitext(os.path.basename(f))[0]
    d = Vector((1.3, 1.6, 0.9)) if name.startswith('spoiler') else Vector((2.2, 0.9, 0.6))
    cam.location = c + d * size * 2
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scn.render.filepath = os.path.join(out, name + '.png')
    bpy.ops.render.render(write_still=True)
