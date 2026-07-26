"""
Build a real HUBBLE SPACE TELESCOPE GLB → public/models/craft-hubble.glb.

Hubble (id 20580) was sharing the generic "telescope" archetype — a featureless
940-tri tube with two tiny blue tabs, nothing like the real thing (Ankur: "they
don't look real"). Hubble has a very specific, recognisable silhouette:

  • BODY — a silvery graphite-epoxy cylinder, ~13.2 m long × 4.2 m diameter,
    wrapped in reflective foil (MLI blanket).
  • APERTURE DOOR — a round door at the FORWARD end that swings open on a hinge;
    the light-shield opening is the "business end" pointing at the sky.
  • SOLAR ARRAYS — two long, flat rectangular wings on short masts, one each side
    (the current rigid arrays: ~7.1 m long, deep blue cells).
  • HIGH-GAIN ANTENNAS — two dish antennas on booms, one top-forward, one
    bottom-aft, pointing back at Earth's relay satellites.
  • AFT bulkhead with the FGS/handrail details (kept simple).

Long axis along X (aperture at +X). Web-light: foil silver + dark-blue cells,
no textures.

Own it headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_hubble_glb.py
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


def build():
    reset()
    foil   = mat("HST_Foil",   (0.82, 0.80, 0.72), 0.9, 0.35, emit=0.12)  # silvery MLI
    dark   = mat("HST_Dark",   (0.10, 0.10, 0.12), 0.3, 0.6)              # aperture cavity / shadow
    cells  = mat("HST_Cells",  (0.10, 0.16, 0.42), 0.2, 0.4)             # solar-cell blue
    metal  = mat("HST_Metal",  (0.4, 0.4, 0.44),  0.8, 0.4)              # masts/booms
    dish   = mat("HST_Dish",   (0.85, 0.85, 0.88), 0.5, 0.4)             # antenna dishes

    parts = []

    # --- BODY: main cylinder along X (aperture at +X) ---
    L = 2.0  # normalized length
    Rb = 0.34
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=Rb, depth=L)
    body = bpy.context.active_object
    body.name = "Body"
    body.rotation_euler = (0, math.radians(90), 0)  # lay along X
    bpy.ops.object.transform_apply(rotation=True)
    body.data.materials.append(foil)
    for p in body.data.polygons:
        p.use_smooth = True
    parts.append(body)

    # --- LIGHT SHIELD: a slightly narrower ring extending the forward end ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=Rb * 0.98, depth=0.5)
    shield = bpy.context.active_object
    shield.name = "LightShield"
    shield.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(rotation=True)
    shield.location = (L * 0.5 + 0.24, 0, 0)
    shield.data.materials.append(foil)
    for p in shield.data.polygons:
        p.use_smooth = True
    parts.append(shield)

    # --- APERTURE: dark disc recessed in the forward opening (the "eye") ---
    bpy.ops.mesh.primitive_circle_add(vertices=32, radius=Rb * 0.9, fill_type="NGON")
    ap = bpy.context.active_object
    ap.name = "Aperture"
    ap.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(rotation=True)
    ap.location = (L * 0.5 + 0.46, 0, 0)
    ap.data.materials.append(dark)
    parts.append(ap)

    # --- APERTURE DOOR: a round lid hinged open above the opening ---
    bpy.ops.mesh.primitive_circle_add(vertices=32, radius=Rb * 1.02, fill_type="NGON")
    door = bpy.context.active_object
    door.name = "ApertureDoor"
    # hinge it open ~120° so it reads as an open lid tilted up-forward
    door.rotation_euler = (0, math.radians(35), 0)
    bpy.ops.object.transform_apply(rotation=True)
    door.location = (L * 0.5 + 0.6, 0, Rb * 0.9)
    door.data.materials.append(foil)
    parts.append(door)

    # --- AFT bulkhead cap ---
    bpy.ops.mesh.primitive_circle_add(vertices=32, radius=Rb, fill_type="NGON")
    aft = bpy.context.active_object
    aft.name = "Aft"
    aft.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(rotation=True)
    aft.location = (-L * 0.5, 0, 0)
    aft.data.materials.append(dark)
    parts.append(aft)

    # --- SOLAR ARRAYS: two long flat wings on short masts, ±Y ---
    for side in (1, -1):
        # mast
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.02, depth=0.3)
        mast = bpy.context.active_object
        mast.name = f"Mast_{side}"
        mast.rotation_euler = (math.radians(90), 0, 0)
        bpy.ops.object.transform_apply(rotation=True)
        mast.location = (0, side * (Rb + 0.15), 0)
        mast.data.materials.append(metal)
        parts.append(mast)
        # array panel — long rectangle in the XY plane, thin in Z
        bpy.ops.mesh.primitive_cube_add(size=1)
        arr = bpy.context.active_object
        arr.name = f"Array_{side}"
        arr.scale = (1.7, 0.5, 0.01)   # long along X, like the real wings
        arr.location = (0, side * (Rb + 0.15 + 0.55), 0)
        bpy.ops.object.transform_apply(scale=True)
        arr.data.materials.append(cells)
        parts.append(arr)

    # --- HIGH-GAIN ANTENNAS: two dishes on booms (top-fwd, bottom-aft) ---
    for (bx, bz, sgn) in [(0.5, 1, 1), (-0.5, -1, -1)]:
        # boom
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.015, depth=0.5)
        boom = bpy.context.active_object
        boom.name = f"Boom_{sgn}"
        boom.location = (L * 0.25 * (1 if bx > 0 else -1), 0, bz * (Rb + 0.1))
        boom.data.materials.append(metal)
        parts.append(boom)
        # dish
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.14, depth=0.02)
        d = bpy.context.active_object
        d.name = f"Dish_{sgn}"
        d.location = (L * 0.25 * (1 if bx > 0 else -1), 0, bz * (Rb + 0.36))
        d.rotation_euler = (math.radians(20 * sgn), 0, 0)
        d.data.materials.append(dish)
        parts.append(d)

    # --- join, centre, export ---
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    hst = bpy.context.view_layer.objects.active
    hst.name = "Hubble"
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    hst.location = (0, 0, 0)

    bpy.ops.object.select_all(action="DESELECT")
    hst.select_set(True)
    path = os.path.join(OUT, "craft-hubble.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True)
    tris = sum(len(p.vertices) - 2 for p in hst.data.polygons)
    print("WROTE", path, "| tris≈", tris, "| dims", [round(d, 2) for d in hst.dimensions])


build()
