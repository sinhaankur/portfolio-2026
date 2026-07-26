"""
Build MRO + LRO GLBs → public/models/craft-mro.glb, craft-lro.glb.

Two workhorse planetary orbiters that currently have no faithful model
(MRO was borrowing sat-hubble.glb; the Moon had no hero orbiter at all).

MRO — Mars Reconnaissance Orbiter (at Mars since 2006):
  • a bus with TWO large solar-array wings (±),
  • the big 3 m HIGH-GAIN ANTENNA dish (its most prominent feature),
  • the HiRISE telescope tube (the sharpest camera at Mars) on the nadir side.

LRO — Lunar Reconnaissance Orbiter (at the Moon since 2009):
  • a compact boxy bus,
  • ONE solar-array wing on a short arm,
  • a high-gain antenna dish on a boom,
  • the LROC / instrument deck on the nadir face.

Both: bus axis +Z, web-light, flat metal + solar-blue, no textures.

Own it headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_mars_moon_orbiters_glb.py
"""

import bpy
import math
import os

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "..", "..", "public", "models"))
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, metallic, rough, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if emit > 0 and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = (*color, 1.0)
        b.inputs["Emission Strength"].default_value = emit
    return m


def export(obj, name):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print("WROTE", path, "| tris≈", tris, "| dims", [round(d, 2) for d in obj.dimensions])


def solar_wing(name, cx, cy, length, width, ang, mat_cells, mat_yoke):
    parts = []
    ca, sa = math.cos(ang), math.sin(ang)
    # yoke
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.018, depth=0.2)
    y = bpy.context.active_object
    y.rotation_euler = (0, math.radians(90), ang)
    y.location = (cx + ca * 0.05, cy + sa * 0.05, 0)
    y.data.materials.append(mat_yoke)
    parts.append(y)
    # panel
    bpy.ops.mesh.primitive_cube_add(size=1)
    pa = bpy.context.active_object
    pa.scale = (length / 2, width / 2, 0.008)
    bpy.ops.object.transform_apply(scale=True)
    r = 0.2 + length / 2
    pa.location = (cx + ca * r, cy + sa * r, 0)
    pa.rotation_euler = (0, 0, ang)
    pa.data.materials.append(mat_cells)
    parts.append(pa)
    return parts


def join(parts, name):
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    o.location = (0, 0, 0)
    return o


def build_mro():
    reset()
    foil  = mat("MRO_Bus",  (0.80, 0.78, 0.70), 0.9, 0.35, emit=0.10)
    cells = mat("MRO_Cells",(0.10, 0.16, 0.42), 0.2, 0.4)
    dish  = mat("MRO_Dish", (0.85, 0.85, 0.88), 0.5, 0.4)
    metal = mat("MRO_Metal",(0.35, 0.35, 0.4), 0.8, 0.4)
    parts = []
    # bus (box)
    bpy.ops.mesh.primitive_cube_add(size=1)
    bus = bpy.context.active_object; bus.scale = (0.3, 0.3, 0.42)
    bpy.ops.object.transform_apply(scale=True); bus.data.materials.append(foil); parts.append(bus)
    # two solar wings ±X
    parts += solar_wing("w+", 0.3, 0, 0.95, 0.55, math.radians(0), cells, metal)
    parts += solar_wing("w-", -0.3, 0, 0.95, 0.55, math.radians(180), cells, metal)
    # BIG high-gain dish (MRO's signature) offset off one face (+Y)
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.34, depth=0.04)
    d = bpy.context.active_object; d.location = (0, 0.42, 0.1)
    d.rotation_euler = (math.radians(70), 0, 0); d.data.materials.append(dish); parts.append(d)
    # HiRISE telescope tube on nadir (-Z)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.12, depth=0.4)
    t = bpy.context.active_object; t.location = (0, 0, -0.34); t.data.materials.append(metal); parts.append(t)
    export(join(parts, "MRO"), "craft-mro")


def build_lro():
    reset()
    foil  = mat("LRO_Bus",  (0.82, 0.72, 0.45), 0.7, 0.4, emit=0.10)  # gold-foil bus
    cells = mat("LRO_Cells",(0.10, 0.16, 0.42), 0.2, 0.4)
    dish  = mat("LRO_Dish", (0.85, 0.85, 0.88), 0.5, 0.4)
    metal = mat("LRO_Metal",(0.35, 0.35, 0.4), 0.8, 0.4)
    parts = []
    # compact boxy bus
    bpy.ops.mesh.primitive_cube_add(size=1)
    bus = bpy.context.active_object; bus.scale = (0.26, 0.26, 0.34)
    bpy.ops.object.transform_apply(scale=True); bus.data.materials.append(foil); parts.append(bus)
    # ONE solar wing on +X
    parts += solar_wing("w", 0.26, 0, 0.8, 0.5, math.radians(0), cells, metal)
    # high-gain antenna dish on a boom (+Y)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.014, depth=0.4)
    boom = bpy.context.active_object; boom.rotation_euler=(math.radians(90),0,0); boom.location=(0,0.32,0.1); boom.data.materials.append(metal); parts.append(boom)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.16, depth=0.03)
    d = bpy.context.active_object; d.location=(0,0.54,0.1); d.rotation_euler=(math.radians(75),0,0); d.data.materials.append(dish); parts.append(d)
    # instrument deck on nadir (-Z)
    bpy.ops.mesh.primitive_cube_add(size=1)
    deck = bpy.context.active_object; deck.scale=(0.2,0.2,0.05); bpy.ops.object.transform_apply(scale=True)
    deck.location=(0,0,-0.22); deck.data.materials.append(metal); parts.append(deck)
    export(join(parts, "LRO"), "craft-lro")


build_mro()
build_lro()
