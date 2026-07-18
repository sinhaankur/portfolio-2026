# Copyright (c) 2026 Ankur Sinha. All rights reserved.
#
# build_constellation_sats.py — the craft that dominate the conjunction list.
#
# Builds four archetype GLBs for the /lab/celestial select-swap program, real
# proportions from published references (spans in metres = model units):
#
#   satellite-oneweb.glb   OneWeb: ~1×1×1.3 m box bus, two panels on short
#                          masts in a shallow V (~5.6 m deployed span)
#   satellite-kuiper.glb   Kuiper: flat phased-array slab + single large solar
#                          wing. Public imagery is limited — modelled as the
#                          known envelope, archetype label says "approx."
#   satellite-iridium.glb  Iridium NEXT: 3.1 m bus, the signature large L-band
#                          panel tilted ~40° off nadir, two side solar wings
#                          (~9.4 m span)
#   satellite-debris.glb   Fragment cluster: three irregular torn-metal shards
#                          (replaces the placeholder shard)
#
# Run headless:
#   /Applications/Blender.app/Contents/MacOS/Blender --background \
#     --python blender/space-assets/build_constellation_sats.py
#
# Prints <NAME>_DIMS=(x,y,z) per asset — the .x span feeds the archetype
# table's nativeSpan so true-scale rendering stays honest.

import os
import math
import random

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "models")


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, metallic=0.4, rough=0.6, emit=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 0.6
    return m


# Shared palette — matches the existing archetype GLBs' read.
def palette():
    return {
        "bus": mat("bus", (0.75, 0.73, 0.68), 0.6, 0.45),          # MLI-ish grey-gold
        "foil": mat("foil", (0.85, 0.62, 0.18), 0.9, 0.35),        # kapton foil
        "panel": mat("panel", (0.05, 0.09, 0.22), 0.3, 0.35),      # solar cells
        "panelback": mat("panelback", (0.55, 0.55, 0.58), 0.2, 0.7),
        "antenna": mat("antenna", (0.82, 0.84, 0.88), 0.7, 0.3),   # phased array
        "dark": mat("dark", (0.12, 0.12, 0.13), 0.4, 0.6),
        "shard": mat("shard", (0.35, 0.34, 0.33), 0.8, 0.5),
    }


def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), material=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if material:
        o.data.materials.append(material)
    return o


def cyl(name, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), material=None, verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if material:
        o.data.materials.append(material)
    return o


def join(parts, name):
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


def export(obj, filename):
    path = os.path.join(OUT, filename)
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB",
                              use_selection=True, export_yup=True, export_apply=True)
    d = tuple(round(v, 3) for v in obj.dimensions)
    print(f"{filename.upper()}_DIMS={d}")


# ---------------------------------------------------------------- OneWeb
def build_oneweb(p):
    parts = []
    parts.append(box("bus", (1.0, 1.0, 1.3), (0, 0, 0), material=p["bus"]))
    # Nadir antenna plate
    parts.append(box("ant", (0.9, 0.9, 0.08), (0, 0, -0.72), material=p["antenna"]))
    # Two solar wings on short masts, shallow V above the bus
    for side in (-1, 1):
        parts.append(cyl("mast", 0.03, 0.9, (side * 0.35, 0, 1.05),
                         rot=(0, side * math.radians(20), 0), material=p["dark"], verts=8))
        parts.append(box("wing", (1.05, 2.6, 0.05), (side * 0.72, 0, 1.55),
                         rot=(0, side * math.radians(20), 0), material=p["panel"]))
    return join(parts, "oneweb")


# ---------------------------------------------------------------- Kuiper (approx.)
def build_kuiper(p):
    parts = []
    # Flat phased-array slab — the known envelope
    parts.append(box("slab", (2.0, 1.6, 0.22), (0, 0, 0), material=p["antenna"]))
    parts.append(box("spine", (1.8, 1.3, 0.16), (0, 0, 0.19), material=p["bus"]))
    # Single large solar wing off one edge
    parts.append(cyl("boom", 0.035, 0.7, (0, 1.05, 0.1), rot=(math.radians(90), 0, 0), material=p["dark"], verts=8))
    parts.append(box("wing", (2.9, 3.1, 0.05), (0, 2.95, 0.1), material=p["panel"]))
    # Thruster block
    parts.append(box("thr", (0.5, 0.4, 0.3), (-0.6, -0.65, 0.28), material=p["dark"]))
    return join(parts, "kuiper")


# ---------------------------------------------------------------- Iridium NEXT
def build_iridium(p):
    parts = []
    parts.append(box("bus", (2.4, 1.5, 3.1), (0, 0, 0), material=p["bus"]))
    parts.append(box("foil", (2.42, 1.52, 0.9), (0, 0, -0.9), material=p["foil"]))
    # Signature L-band phased-array panel, tilted ~40° off the nadir face
    parts.append(box("lband", (2.2, 3.0, 0.12), (0, 1.75, -1.35),
                     rot=(math.radians(40), 0, 0), material=p["antenna"]))
    # Two solar wings on side booms
    for side in (-1, 1):
        parts.append(cyl("boom", 0.04, 1.0, (side * 1.6, 0, 0.9),
                         rot=(0, math.radians(90), 0), material=p["dark"], verts=8))
        parts.append(box("wing", (2.9, 2.0, 0.05), (side * 3.3, 0, 0.9), material=p["panel"]))
    return join(parts, "iridium")


# ---------------------------------------------------------------- Debris shards
def build_debris(p):
    random.seed(7)
    parts = []
    specs = [(0.34, (0, 0, 0), p["shard"]), (0.22, (0.55, 0.2, 0.15), p["foil"]),
             (0.16, (-0.45, -0.25, 0.2), p["dark"])]
    for i, (r, loc, m) in enumerate(specs):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r, location=loc)
        o = bpy.context.active_object
        o.name = f"shard{i}"
        # Tear it up: random per-vertex displacement + squash — irregular
        # torn-metal silhouettes, no two faces coplanar.
        for v in o.data.vertices:
            v.co.x *= 1 + random.uniform(-0.55, 0.55)
            v.co.y *= 1 + random.uniform(-0.55, 0.55)
            v.co.z *= 1 + random.uniform(-0.55, 0.55)
        o.scale = (1.0, 0.75 + random.uniform(-0.2, 0.2), 0.45 + random.uniform(-0.15, 0.15))
        bpy.ops.object.transform_apply(scale=True)
        o.data.materials.append(m)
        parts.append(o)
    return join(parts, "debris")


def main():
    builders = [
        (build_oneweb, "satellite-oneweb.glb"),
        (build_kuiper, "satellite-kuiper.glb"),
        (build_iridium, "satellite-iridium.glb"),
        (build_debris, "satellite-debris.glb"),
    ]
    for fn, out in builders:
        reset_scene()
        p = palette()
        obj = fn(p)
        export(obj, out)
    print("CONSTELLATION_BUILD_OK")


if __name__ == "__main__":
    main()
