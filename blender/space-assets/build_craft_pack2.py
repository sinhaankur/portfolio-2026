# Copyright (c) 2026 Ankur Sinha. All rights reserved.
#
# build_craft_pack2.py — the remaining fidelity-queue craft, real proportions:
#
#   satellite-rocketbody.glb  Falcon 9 second stage — the most common rocket
#                             body class: 3.7 m Ø × ~12.6 m white cylinder,
#                             MVac nozzle bell, interstage-black band
#   satellite-gps.glb         GPS III — boxy nav bus, twin 4-panel wings,
#                             nadir antenna farm
#   satellite-eobus.glb       Sentinel-class EO bus — rectangular bus, single
#                             wing, telescope baffle (covers the many
#                             sun-sync earth observers)
#
# Previews render to /tmp/<name>-preview.png before export.
# Run: /Applications/Blender.app/Contents/MacOS/Blender --background \
#        --python blender/space-assets/build_craft_pack2.py

import os
import math

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "models")


def mat(name, color, metallic=0.4, rough=0.6):
    m = bpy.data.materials.get(name)
    if m:
        return m
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


def cyl(name, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), material=None, verts=24, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if material:
        o.data.materials.append(material)
    return o


def finish(parts, name):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj.location = (0, 0, 0)
    return obj


def preview_and_export(obj, glb_name, cam_dist):
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (cam_dist, -cam_dist, cam_dist * 0.6)
    cam.rotation_euler = (math.radians(60), 0, math.radians(45))
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
    scene.render.filepath = f"/tmp/{glb_name.replace('.glb', '')}-preview.png"
    bpy.ops.render.render(write_still=True)

    path = os.path.join(OUT, glb_name)
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB",
                              use_selection=True, export_yup=True, export_apply=True)
    print(f"{glb_name.upper()}_DIMS={tuple(round(v, 3) for v in obj.dimensions)}")


def build_falcon9_s2():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m_white = mat("f9white", (0.88, 0.88, 0.87), 0.2, 0.5)
    m_black = mat("f9black", (0.07, 0.07, 0.08), 0.3, 0.6)
    m_bell = mat("f9bell", (0.25, 0.22, 0.2), 0.7, 0.45)
    parts = []
    # Main tank cylinder — 3.7 m Ø × ~11 m (in half-scale model units like
    # the rest of the pack; nativeSpan measurement absorbs it).
    parts.append(cyl("tank", 1.85, 11.0, (0, 0, 0), material=m_white))
    # Interstage-black band at the top.
    parts.append(cyl("band", 1.87, 1.6, (0, 0, 5.0), material=m_black))
    # MVac nozzle — big expansion bell below.
    parts.append(cyl("bell", 1.65, 2.6, (0, 0, -6.5), material=m_bell, r2=0.55))
    parts.append(cyl("throat", 0.55, 0.8, (0, 0, -5.2), material=m_black))
    obj = finish(parts, "falcon9s2")
    preview_and_export(obj, "satellite-rocketbody.glb", 16)


def build_gps3():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m_bus = mat("gbus", (0.72, 0.7, 0.66), 0.5, 0.5)
    m_dark = mat("gdark", (0.12, 0.12, 0.13), 0.4, 0.6)
    m_panel = mat("gpanel", (0.05, 0.09, 0.22), 0.3, 0.35)
    m_dish = mat("gdish", (0.85, 0.86, 0.88), 0.6, 0.35)
    parts = []
    parts.append(box("bus", (2.5, 2.0, 3.4), material=m_bus))
    # Nadir antenna farm — the L-band helix array plate + horns.
    parts.append(box("antplate", (2.0, 1.6, 0.15), (0, 0, -1.78), material=m_dish))
    for ix, iy in [(-0.6, -0.4), (0.6, -0.4), (-0.6, 0.4), (0.6, 0.4), (0, 0)]:
        parts.append(cyl("horn", 0.16, 0.5, (ix, iy, -2.1), material=m_dark, verts=10))
    # Twin wings, 4 panels each read as seams via thin separators.
    for side in (-1, 1):
        parts.append(cyl("boom", 0.05, 1.2, (side * 1.85, 0, 0.6), rot=(0, math.radians(90), 0), material=m_dark, verts=8))
        parts.append(box("wing", (4.6, 2.2, 0.06), (side * 4.8, 0, 0.6), material=m_panel))
    obj = finish(parts, "gps3")
    preview_and_export(obj, "satellite-gps.glb", 12)


def build_eobus():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m_bus = mat("ebus", (0.75, 0.74, 0.7), 0.5, 0.5)
    m_foil = mat("efoil", (0.8, 0.6, 0.2), 0.9, 0.35)
    m_dark = mat("edark", (0.1, 0.1, 0.11), 0.4, 0.6)
    m_panel = mat("epanel", (0.05, 0.09, 0.22), 0.3, 0.35)
    parts = []
    # Rectangular bus, partially foil-wrapped.
    parts.append(box("bus", (3.0, 1.9, 1.9), material=m_bus))
    parts.append(box("foil", (1.4, 1.92, 1.92), (-0.8, 0, 0), material=m_foil))
    # Telescope baffle looking nadir.
    parts.append(cyl("baffle", 0.55, 1.4, (0.7, 0, -1.4), material=m_dark))
    # Single solar wing aft.
    parts.append(cyl("boom", 0.05, 1.0, (-1.9, 0, 0.4), rot=(0, math.radians(90), 0), material=m_dark, verts=8))
    parts.append(box("wing", (5.2, 2.4, 0.06), (-4.9, 0, 0.4), material=m_panel))
    obj = finish(parts, "eobus")
    preview_and_export(obj, "satellite-eobus.glb", 10)


def main():
    build_falcon9_s2()
    build_gps3()
    build_eobus()
    print("PACK2_OK")


if __name__ == "__main__":
    main()
