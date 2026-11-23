"""Shared Blender helpers for the car tools (run inside Blender: blender -b -P script.py -- args)."""
import bpy
import sys


def args():
    return sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in objs if o.type == 'MESH']
    return objs, meshes


def world_bbox(meshes):
    import mathutils
    mn = mathutils.Vector((1e9, 1e9, 1e9))
    mx = mathutils.Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            mn = mathutils.Vector(map(min, mn, p))
            mx = mathutils.Vector(map(max, mx, p))
    return mn, mx
