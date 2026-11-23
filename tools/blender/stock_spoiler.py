"""Find a car's stock rear spoiler (loose parts in the rear-top region) and either render a
check image (mode 'check') or export the car with the spoiler as its own mesh named
'stock_spoiler' (mode 'split'), so the game can hide it when a spoiler mod is fitted.

Usage: blender -b -P stock_spoiler.py -- check|split in.glb out(.png|.glb) rearFrac minHeightFrac
"""
import bpy, bmesh, os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from common import args, reset, import_glb, world_bbox
import mathutils

mode, src, dst, rear_frac, min_h = args()[:5]
rear_frac, min_h = float(rear_frac), float(min_h)
reset()
_, meshes = import_glb(src)
obj = meshes[0]
mn, mx = world_bbox(meshes)
L, H = mx.y - mn.y, mx.z - mn.z
bm = bmesh.new(); bm.from_mesh(obj.data)
bm.verts.ensure_lookup_table()
seen, comps = set(), []
for v in bm.verts:
    if v.index in seen: continue
    stack, comp = [v], []
    seen.add(v.index)
    while stack:
        u = stack.pop(); comp.append(u.index)
        for e in u.link_edges:
            w = e.other_vert(u)
            if w.index not in seen:
                seen.add(w.index); stack.append(w)
    comps.append(comp)
M = obj.matrix_world
pick = set()
for comp in comps:
    ps = [M @ bm.verts[i].co for i in comp]
    cy = sum(p.y for p in ps) / len(ps); cz = sum(p.z for p in ps) / len(ps)
    zmin = min(p.z for p in ps)
    # rear = Blender +Y (the nose is -Y); spoiler parts sit high at the back
    if cy > mx.y - rear_frac * L and zmin > mn.z + min_h * H:
        pick.update(comp)
print('picked verts', len(pick), 'of', len(bm.verts))
if mode == 'check':
    mat_r = bpy.data.materials.new('red'); mat_r.diffuse_color = (1, 0, 0, 1)
    obj.data.materials.append(mat_r)
    idx = len(obj.data.materials) - 1
    for f in bm.faces:
        if all(v.index in pick for v in f.verts): f.material_index = idx
    bm.to_mesh(obj.data)
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'; scn.display.shading.color_type = 'MATERIAL'
    scn.render.resolution_x, scn.render.resolution_y = 480, 320
    size = max(mx - mn); c = (mn + mx) / 2
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); cam.data.type = 'ORTHO'; cam.data.ortho_scale = size * 1.3
    scn.collection.objects.link(cam); scn.camera = cam
    cam.location = (c.x + size * 1.6, c.y + size * 2.4, c.z + size * 1.2)
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scn.render.filepath = dst
    bpy.ops.render.render(write_still=True)
else:
    # split the picked faces into their own object
    for f in bm.faces: f.select = all(v.index in pick for v in f.verts)
    bm.to_mesh(obj.data)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    parts = [o for o in bpy.data.objects if o.type == 'MESH' and o is not obj]
    for p in parts: p.name = 'stock_spoiler'; p.data.name = 'stock_spoiler'
    obj.name = 'body'
    bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='AUTO', use_selection=False)
    print('split written', dst)
