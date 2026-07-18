# Copyright (c) 2026 Ankur Sinha. All rights reserved.
#
# build_debris_v2.py — debris that reads as WRECKAGE, not asteroid.
#
# Fengyun-1C / Cosmos-2251 / Iridium-33 fragments are pieces of spacecraft:
# torn panel sections with cells still on them, snapped struts, crumpled MLI
# foil, jagged bus skin. Four-fragment cluster, flat-shaded for hard
# silhouettes, ~1.5 m spread. Replaces the displaced-icosphere shards that
# looked like a smooth asteroid at close zoom.
#
# Run:
#   /Applications/Blender.app/Contents/MacOS/Blender --background \
#     --python blender/space-assets/build_debris_v2.py
# Renders a preview to /tmp/debris-preview.png BEFORE exporting, so the look
# is verified by eye, then writes public/models/satellite-debris.glb.

import os
import math
import random

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "models", "satellite-debris.glb")
PREVIEW = "/tmp/debris-preview.png"

random.seed(11)


def mat(name, color, metallic=0.5, rough=0.55):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    return m


def jag_edges(obj, amount=0.06, axis_mask=(1, 1, 1)):
    """Random per-vertex jitter — torn, non-manufactured silhouettes."""
    for v in obj.data.vertices:
        v.co.x += random.uniform(-amount, amount) * axis_mask[0]
        v.co.y += random.uniform(-amount, amount) * axis_mask[1]
        v.co.z += random.uniform(-amount, amount) * axis_mask[2]


def flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m_cell = mat("cells", (0.06, 0.10, 0.24), 0.35, 0.3)
    m_panelback = mat("panelback", (0.62, 0.62, 0.64), 0.25, 0.7)
    m_foil = mat("foil", (0.82, 0.58, 0.16), 0.95, 0.3)
    m_metal = mat("metal", (0.5, 0.5, 0.52), 0.85, 0.4)
    m_char = mat("charred", (0.08, 0.08, 0.08), 0.4, 0.8)

    parts = []

    # ---- 1. Torn solar-panel section — bent in the middle, cells on top.
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=6, y_subdivisions=4, size=1, location=(0, 0, 0))
    panel = bpy.context.active_object
    panel.name = "panel"
    panel.scale = (0.45, 0.3, 1)
    bpy.ops.object.transform_apply(scale=True)
    # bend along x + tear the edges
    for v in panel.data.vertices:
        v.co.z += abs(v.co.x) * 0.35 + random.uniform(-0.015, 0.015)
    jag_edges(panel, 0.03, (1, 1, 0.4))
    # thickness
    sol = panel.modifiers.new("sol", "SOLIDIFY")
    sol.thickness = 0.03
    bpy.ops.object.modifier_apply(modifier="sol")
    panel.data.materials.append(m_cell)
    panel.data.materials.append(m_panelback)
    for i, p in enumerate(panel.data.polygons):
        p.material_index = 0 if p.normal.z > 0.3 else 1
    panel.rotation_euler = (math.radians(24), math.radians(-18), math.radians(40))
    flat(panel)
    parts.append(panel)

    # ---- 2. Snapped strut pair — angled tubes with sheared ends.
    for i, (loc, rot, ln) in enumerate([
        ((0.55, 0.25, 0.12), (0.4, 0.9, 0.2), 0.55),
        ((0.48, 0.12, -0.05), (1.2, -0.4, 0.5), 0.38),
    ]):
        bpy.ops.mesh.primitive_cylinder_add(vertices=7, radius=0.03, depth=ln, location=loc, rotation=rot)
        s = bpy.context.active_object
        s.name = f"strut{i}"
        # shear the end ring — a snapped, not machined, break
        for v in s.data.vertices:
            if v.co.z > ln * 0.42:
                v.co.x += random.uniform(-0.03, 0.03)
                v.co.y += random.uniform(-0.03, 0.03)
                v.co.z += random.uniform(-0.06, 0.02)
        s.data.materials.append(m_metal)
        flat(s)
        parts.append(s)

    # ---- 3. Crumpled MLI foil — hard creases, gold.
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=7, y_subdivisions=7, size=1, location=(-0.5, -0.28, 0.1))
    foil = bpy.context.active_object
    foil.name = "foil"
    foil.scale = (0.28, 0.24, 1)
    bpy.ops.object.transform_apply(scale=True)
    for v in foil.data.vertices:
        v.co.z += random.uniform(-0.09, 0.09)  # deep random creases
    jag_edges(foil, 0.04, (1, 1, 0))
    foil.data.materials.append(m_foil)
    foil.rotation_euler = (math.radians(-30), math.radians(35), math.radians(-15))
    flat(foil)
    parts.append(foil)

    # ---- 4. Jagged bus-skin shard — angular plate, charred edge.
    bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.22, radius2=0.05, depth=0.05,
                                    location=(-0.35, 0.35, -0.12))
    shard = bpy.context.active_object
    shard.name = "shard"
    jag_edges(shard, 0.07)
    shard.data.materials.append(m_metal)
    shard.data.materials.append(m_char)
    for i, p in enumerate(shard.data.polygons):
        p.material_index = 1 if i % 3 == 0 else 0
    shard.rotation_euler = (math.radians(70), math.radians(15), math.radians(120))
    flat(shard)
    parts.append(shard)

    # join
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = "debris"
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj.location = (0, 0, 0)
    return obj


def preview(obj):
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (1.6, -1.6, 1.0)
    cam.rotation_euler = (math.radians(60), 0, math.radians(45))
    bpy.context.scene.camera = cam
    key = bpy.data.lights.new("key", "SUN")
    key.energy = 4
    ko = bpy.data.objects.new("key", key)
    bpy.context.collection.objects.link(ko)
    ko.rotation_euler = (math.radians(50), math.radians(20), 0)
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 60
    fill.size = 4
    fo = bpy.data.objects.new("fill", fill)
    bpy.context.collection.objects.link(fo)
    fo.location = (-2, 1, 1.5)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 480
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)


def export(obj):
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB",
                              use_selection=True, export_yup=True, export_apply=True)
    print("DEBRIS_V2_DIMS=%s" % (tuple(round(v, 3) for v in obj.dimensions),))


def main():
    obj = build()
    preview(obj)
    export(obj)
    print("DEBRIS_V2_OK")


if __name__ == "__main__":
    main()
