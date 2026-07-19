# Copyright (c) 2026 Ankur Sinha. All rights reserved.
#
# build_starlink_v2mini.py — Starlink v2 Mini, the current-generation craft.
#
# Published proportions: flat-pack bus ~4.1 × 2.7 m, TWO solar wings
# (combined span ~30 m — the v1.5's single wing is the older silhouette),
# argon Hall thruster block, nadir phased-array face. This is the most
# common spacecraft in orbit (~7k) and the most frequent actor in the
# conjunction screen — it earns its own model.
#
# Run headless:
#   /Applications/Blender.app/Contents/MacOS/Blender --background \
#     --python blender/space-assets/build_starlink_v2mini.py
# Renders /tmp/starlink2-preview.png before exporting
# public/models/satellite-starlink2.glb.

import os
import math

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "models", "satellite-starlink2.glb")
PREVIEW = "/tmp/starlink2-preview.png"


def mat(name, color, metallic=0.4, rough=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    return m


def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), material=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if material:
        o.data.materials.append(material)
    return o


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m_bus = mat("bus", (0.72, 0.71, 0.7), 0.6, 0.45)
    m_dark = mat("dark", (0.13, 0.13, 0.14), 0.4, 0.6)
    m_panel = mat("panel", (0.05, 0.09, 0.22), 0.3, 0.35)
    m_panelback = mat("panelback", (0.58, 0.58, 0.6), 0.2, 0.7)
    m_array = mat("array", (0.85, 0.86, 0.9), 0.7, 0.3)

    parts = []
    # Flat-pack bus — the launch-stack slab.
    parts.append(box("bus", (4.1, 2.7, 0.25), material=m_bus))
    # Nadir phased-array face — slightly proud panels.
    for ix in (-1.2, 0, 1.2):
        parts.append(box("array", (1.1, 2.3, 0.06), (ix, 0, -0.17), material=m_array))
    # Hall thruster block on one short edge.
    parts.append(box("thr", (0.5, 0.8, 0.35), (2.15, 0.6, 0.12), material=m_dark))
    # TWO solar wings on yokes off the short ends — the v2 Mini signature.
    for side in (-1, 1):
        parts.append(box("yoke", (0.9, 0.25, 0.08), (side * 2.5, 0, 0.12), material=m_dark))
        wing = box("wing", (12.0, 3.0, 0.05), (side * (2.95 + 6.0), 0, 0.14), material=m_panel)
        wing.data.materials.append(m_panelback)
        for p in wing.data.polygons:
            p.material_index = 0 if p.normal.z > 0 else 1
        parts.append(wing)

    for o in bpy.context.scene.objects:
        o.select_set(False)
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = "starlink2"
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj.location = (0, 0, 0)

    # Preview render
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (16, -16, 9)
    cam.rotation_euler = (math.radians(62), 0, math.radians(45))
    bpy.context.scene.camera = cam
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 4
    so = bpy.data.objects.new("sun", sun)
    bpy.context.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), math.radians(15), 0)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 480
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)

    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB",
                              use_selection=True, export_yup=True, export_apply=True)
    print("STARLINK2_DIMS=%s" % (tuple(round(v, 3) for v in obj.dimensions),))
    print("STARLINK2_OK")


if __name__ == "__main__":
    main()
