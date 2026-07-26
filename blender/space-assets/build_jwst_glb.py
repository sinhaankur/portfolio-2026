"""
Build a real JAMES WEBB SPACE TELESCOPE GLB → public/models/craft-jwst.glb.

The deep-space named-body JWST in the engine used a procedural shape with a
SINGLE hex mirror (the code even flagged it: "Real JWST has 18 segments"). Webb's
whole identity is the 18-segment gold honeycomb mirror + the five-layer diamond
sunshield, so it earns a real model.

Real structure, faithfully:
  • PRIMARY MIRROR — 18 hexagonal gold-coated beryllium segments in the real
    honeycomb layout: a central hex ring of 6, an outer ring of 12, with the
    centre segment omitted (Webb's centre is open — the secondary sits above it).
    Gold, highly reflective.
  • SECONDARY MIRROR — a small round mirror held above the primary on a 3-strut
    tripod.
  • SUNSHIELD — five stacked kite/diamond membrane layers below the mirror
    (~21×14 m, the "tennis court"), silvery, tilted.
  • BUS — the spacecraft body between mirror and sunshield.

Orientation matches the procedural shape it replaces: mirror faces +Y (up),
sunshield below. Kept web-light (flat gold/silver materials, no textures).

Own it headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_jwst_glb.py
"""

import bpy
import bmesh
import math
import os

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "..", "..", "public", "models"))
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, metallic, roughness, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    if emit > 0 and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = (*color, 1.0)
        b.inputs["Emission Strength"].default_value = emit
    return m


def hex_prism(radius, thick, name, material):
    """A flat hexagonal segment (6-gon cylinder) lying in the XZ plane, thin in Y."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=radius, depth=thick)
    ob = bpy.context.active_object
    ob.name = name
    ob.rotation_euler = (math.radians(90), 0, 0)  # lay flat, face +Y
    bpy.ops.object.transform_apply(rotation=True)
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


def build():
    reset()
    gold   = mat("JWST_Gold",   (1.0, 0.78, 0.28), 1.0, 0.16, emit=0.15)
    silver = mat("JWST_Shield", (0.75, 0.78, 0.86), 0.7, 0.35)
    body   = mat("JWST_Bus",    (0.18, 0.18, 0.2),  0.6, 0.5)
    strut  = mat("JWST_Strut",  (0.1, 0.1, 0.12),   0.4, 0.6)

    segs = []

    # --- PRIMARY MIRROR: 18 pointy-top hex segments in Webb's real honeycomb ---
    # Webb's mirror is a hex made of hexes: a centre + 2 rings, MINUS the centre
    # (open — the secondary sits above it). Pointy-top hexes tile with pixel
    # spacing:  x = R*sqrt(3)*(q + r/2),  y = R*1.5*r  over axial coords (q,r).
    R = 0.17                    # segment centre→corner
    GAP = 1.04                  # small seam between segments
    # all axial cells within radius 2 of centre = 19 cells; drop (0,0) → 18.
    coords = []
    for q in range(-2, 3):
        for r in range(-2, 3):
            if -q - r < -2 or -q - r > 2:
                continue
            if q == 0 and r == 0:
                continue  # open centre
            coords.append((q, r))
    for i, (q, r) in enumerate(coords):
        x = R * math.sqrt(3) * (q + r / 2) * GAP
        z = R * 1.5 * r * GAP
        seg = hex_prism(R * 0.96, 0.02, f"Mirror_{i}", gold)
        # pointy-top: rotate each hex 30° about its face normal (Y after the flat lay)
        seg.rotation_euler = (math.radians(90), math.radians(30), 0)
        bpy.ops.object.transform_apply(rotation=True)
        seg.location = (x, 0.0, z)
        # gentle paraboloid cup: recess outer segments slightly in -Y
        rr = math.hypot(x, z)
        seg.location.y = -rr * 0.05
        segs.append(seg)

    # --- SECONDARY MIRROR on a tripod, above the primary (+Y) ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.05, depth=0.014)
    sec = bpy.context.active_object
    sec.name = "SecondaryMirror"
    sec.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    sec.location = (0, 0.42, 0)
    sec.data.materials.append(gold)
    segs.append(sec)
    for i in range(3):
        a = (i / 3) * math.tau
        x, z = math.cos(a) * 0.34, math.sin(a) * 0.34
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.008, depth=0.55)
        st = bpy.context.active_object
        st.name = f"Strut_{i}"
        # aim from primary edge up to the secondary
        mid = ((x) / 2, 0.21, (z) / 2)
        st.location = mid
        st.rotation_euler = (math.atan2(z, 0.42), 0, math.atan2(-x, 0.42))
        st.data.materials.append(strut)
        segs.append(st)

    # --- BUS between mirror and sunshield ---
    bpy.ops.mesh.primitive_cube_add(size=1)
    bus = bpy.context.active_object
    bus.name = "Bus"
    bus.scale = (0.12, 0.09, 0.12)
    bus.location = (0, -0.16, 0)
    bpy.ops.object.transform_apply(scale=True)
    bus.data.materials.append(body)
    segs.append(bus)

    # --- SUNSHIELD: five stacked diamond membranes below, tilted ---
    for i in range(5):
        bpy.ops.mesh.primitive_plane_add(size=1)
        pl = bpy.context.active_object
        pl.name = f"Shield_{i}"
        # diamond: scale to a kite + rotate 45° about Y
        pl.scale = (0.62, 1.0, 0.40)
        pl.rotation_euler = (math.radians(74), 0, math.radians(45))
        pl.location = (0, -0.30 - i * 0.02, 0)
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        pl.data.materials.append(silver)
        segs.append(pl)

    # --- join all into one object for a single-draw GLB ---
    bpy.ops.object.select_all(action="DESELECT")
    for s in segs:
        s.select_set(True)
    bpy.context.view_layer.objects.active = segs[0]
    bpy.ops.object.join()
    jwst = bpy.context.view_layer.objects.active
    jwst.name = "JWST"
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    jwst.location = (0, 0, 0)

    # export
    bpy.ops.object.select_all(action="DESELECT")
    jwst.select_set(True)
    path = os.path.join(OUT, "craft-jwst.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True)
    tris = sum(len(p.vertices) - 2 for p in jwst.data.polygons)
    print("WROTE", path, "| tris≈", tris, "| dims", [round(d, 2) for d in jwst.dimensions])


build()
