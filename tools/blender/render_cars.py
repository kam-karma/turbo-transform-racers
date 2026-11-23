"""Side and rear-3/4 preview renders of every car GLB (for checking fits): out_dir/<name>-side.png, -rear.png"""
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import args, reset, import_glb, world_bbox
import mathutils

files, out = args()[:-1], args()[-1]
os.makedirs(out, exist_ok=True)
for f in files:
    reset()
    objs, meshes = import_glb(f)
    mn, mx = world_bbox(meshes)
    c = (mn + mx) / 2
    size = max(mx - mn)
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.display.shading.color_type = 'TEXTURE'
    scn.render.resolution_x, scn.render.resolution_y = 640, 400
    world = bpy.data.worlds.new('w'); scn.world = world
    world.color = (1, 1, 1)
    cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = size * 1.25
    cam = bpy.data.objects.new('cam', cam_data); scn.collection.objects.link(cam); scn.camera = cam
    name = os.path.splitext(os.path.basename(f))[0]
    for tag, loc in {'side': (c.x + size * 3, c.y, c.z), 'rear': (c.x + size * 1.6, c.y + size * 2.4, c.z + size * 1.2)}.items():
        cam.location = loc
        d = c - mathutils.Vector(loc)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = os.path.join(out, f'{name}-{tag}.png')
        bpy.ops.render.render(write_still=True)
    print('rendered', name, 'bbox', tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))
