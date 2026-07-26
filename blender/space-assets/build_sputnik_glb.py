"""
Build a faithful SPUTNIK 1 GLB → public/models/craft-sputnik.glb.

Sputnik 1 (USSR, 4 Oct 1957) — the first artificial satellite, and the object
that opened the Space Age. Its whole design is iconic and simple:

  • a POLISHED SPHERE, 58 cm across, of aluminium-magnesium-titanium alloy,
    buffed to a MIRROR finish on purpose — so it caught sunlight and could be
    seen + tracked from the ground. (The old model was matte black; the real
    thing was bright, almost chrome.)
  • FOUR whip antennas trailing from one hemisphere: two ~2.4 m and two ~2.9 m,
    swept BACK at ~35° from the body in a symmetric arrangement (they broadcast
    the famous "beep").

We build exactly that: a smooth reflective sphere + four swept whip rods. Long
axis of the antennas trails along -X. Web-light, no textures.

Own it headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_sputnik_glb.py
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
    # polished aluminium — high metallic, low roughness, a faint emissive floor so
    # it never reads as a dark ball in shadow (it was famously BRIGHT).
    chrome = mat("Sputnik_Body", (0.86, 0.87, 0.90), 1.0, 0.12, emit=0.10)
    rod    = mat("Sputnik_Antenna", (0.75, 0.76, 0.78), 0.9, 0.3)

    parts = []

    # --- polished sphere ---
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=0.5)
    body = bpy.context.active_object
    body.name = "Body"
    bpy.ops.object.shade_smooth()
    body.data.materials.append(chrome)
    parts.append(body)

    # --- four swept-back whip antennas ---
    # Built cleanly: make a rod along +X, shift so its BASE is at the origin, then
    # sweep it back ~35° (tip trails -X) and ROLL it around the X axis in 90°
    # steps so the four fan out symmetrically. Two long (~2.9 m → 1.0) + two short
    # (~2.4 m → 0.83), long pair top/bottom, short pair left/right.
    SWEEP = math.radians(38)      # angle back from the body's rear axis
    antennas = [
        (1.00, 0),      # long, "up"
        (1.00, 180),    # long, "down"
        (0.83, 90),     # short, "right"
        (0.83, 270),    # short, "left"
    ]
    from mathutils import Vector, Quaternion
    for i, (length, roll_deg) in enumerate(antennas):
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.013, depth=length)
        a = bpy.context.active_object
        a.name = f"Antenna_{i}"
        # cylinder is along +Z; shift so its BASE is at the origin, tip at +Z.
        a.location = (0, 0, length / 2)
        bpy.ops.object.transform_apply(location=True)
        # Target DIRECTION for this whip: trailing -X (rear) and fanned out in the
        # YZ plane by `roll_deg`, tilted from the -X axis by SWEEP. Compute the
        # unit vector directly, then align +Z (the rod axis) to it via a single
        # quaternion — no Euler-order ambiguity (the trap that stacked them).
        roll = math.radians(roll_deg)
        # base axis is -X; fan component in YZ; blend by SWEEP
        d = Vector((
            -math.cos(SWEEP),
            math.sin(SWEEP) * math.cos(roll),
            math.sin(SWEEP) * math.sin(roll),
        )).normalized()
        a.rotation_mode = "QUATERNION"
        a.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
        # anchor the base on the rear hemisphere surface, offset along the whip dir
        a.location = d * 0.02 + Vector((-0.30, 0, 0))
        a.data.materials.append(rod)
        parts.append(a)

    # --- join, centre, export ---
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    s = bpy.context.view_layer.objects.active
    s.name = "Sputnik1"
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    s.location = (0, 0, 0)

    bpy.ops.object.select_all(action="DESELECT")
    s.select_set(True)
    path = os.path.join(OUT, "craft-sputnik.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True)
    tris = sum(len(p.vertices) - 2 for p in s.data.polygons)
    print("WROTE", path, "| tris≈", tris, "| dims", [round(d, 2) for d in s.dimensions])


build()
