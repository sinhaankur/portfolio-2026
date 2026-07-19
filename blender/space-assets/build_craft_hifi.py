# Copyright (c) 2026 Ankur Sinha. All rights reserved.
#
# build_craft_hifi.py — HIGH-FIDELITY Starlink v1 + GPS III for /lab/celestial.
#
# Same detail bar as build_iridium_hifi.py (bevels, PBR, real cell-grid solar
# panels, connected geometry). Proven lessons applied:
#   - build each solar wing at the ORIGIN as a cell grid, then translate as a unit
#   - booms/masts BRIDGE bus-edge to wing-inner-edge (nothing floats)
#   - raise base colors so hulls don't go black on the void
#
# Real proportions (1 unit = 1 m):
#   Starlink v1  flat chassis ~2.8x1.4 m + ONE long solar wing → ~30 m span (deployed)
#   GPS III      ~2.5 m box bus + TWO solar wings + nadir L-band antenna farm → ~17 m
#
# Prints <NAME>_DIMS for the archetype nativeSpan.
#
# Run headless:
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
#     --python blender/space-assets/build_craft_hifi.py

import os
import math
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "models")


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        sc.cycles.samples = 96
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x = 900
    sc.render.resolution_y = 900


MATS = {}


def make_materials():
    def mat(name, base, metallic=0.5, rough=0.5, emit=None, es=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value = (*base, 1.0)
        b.inputs["Metallic"].default_value = metallic
        b.inputs["Roughness"].default_value = rough
        if emit is not None:
            b.inputs["Emission Color"].default_value = (*emit, 1.0)
            b.inputs["Emission Strength"].default_value = es
        return m
    MATS["BUS"] = mat("c_bus", (0.78, 0.76, 0.70), 0.45, 0.45)
    MATS["WHITE"] = mat("c_white", (0.88, 0.89, 0.92), 0.30, 0.45)
    MATS["FOIL"] = mat("c_foil", (0.88, 0.62, 0.20), 0.8, 0.30)
    MATS["CELL"] = mat("c_cell", (0.07, 0.11, 0.28), 0.30, 0.30, emit=(0.03, 0.06, 0.16), es=0.4)
    MATS["STRUCT"] = mat("c_struct", (0.60, 0.60, 0.64), 0.35, 0.6)
    MATS["DARK"] = mat("c_dark", (0.18, 0.18, 0.21), 0.5, 0.55)
    MATS["METAL"] = mat("c_metal", (0.86, 0.88, 0.92), 0.9, 0.25)
    MATS["ANT"] = mat("c_ant", (0.82, 0.83, 0.86), 0.55, 0.35)


def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), material=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        m = o.modifiers.new("bev", "BEVEL")
        m.width = bevel
        m.segments = 2
        m.limit_method = "ANGLE"
    if material:
        o.data.materials.append(material)
    return o


def cyl(name, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), material=None, verts=18):
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
    return obj


def solar_wing(name, w, h, loc, cols=4, rows=8):
    """Cell-grid wing built at the ORIGIN in the XY plane, then translated to loc
    as a rigid unit (the technique that keeps the grid tiling)."""
    parts = [box(f"{name}_back", (w, h, 0.03), (0, 0, 0), material=MATS["STRUCT"])]
    gap = 0.03
    cw = (w - gap * (cols + 1)) / cols
    ch = (h - gap * (rows + 1)) / rows
    x0 = -w / 2 + gap + cw / 2
    y0 = -h / 2 + gap + ch / 2
    for i in range(cols):
        for j in range(rows):
            parts.append(box(f"{name}_c{i}_{j}", (cw, ch, 0.05),
                             (x0 + i * (cw + gap), y0 + j * (ch + gap), 0.03),
                             material=MATS["CELL"]))
    wing = join(parts, name)
    wing.location = loc
    bpy.ops.object.transform_apply(location=True)
    return wing


def finalize(obj):
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj.location = (0, 0, 0)
    bpy.ops.object.shade_smooth()
    try:
        obj.data.use_auto_smooth = True
        obj.data.auto_smooth_angle = math.radians(35)
    except Exception:
        pass
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


# ---------------------------------------------------------------- Starlink v1
def build_starlink():
    make_materials()
    parts = []
    # Flat chassis (the "flat-pack" bus) — wide, thin, in the XY plane.
    chassis = box("chassis", (2.8, 1.4, 0.22), (0, 0, 0), material=MATS["BUS"], bevel=0.03)
    parts.append(chassis)
    # Phased-array user/downlink panels on the nadir face (Starlink's signature
    # flat antennas — four tiles).
    for ix in (-0.65, 0.65):
        for iy in (-0.35, 0.35):
            parts.append(box(f"pa_{ix}_{iy}", (1.2, 0.6, 0.06), (ix, iy, -0.16),
                             material=MATS["ANT"]))
    # Krypton Hall thruster + fuel line hint (aft)
    parts.append(cyl("thr", 0.12, 0.3, (-1.2, 0, 0.05), rot=(0, math.radians(90), 0),
                     material=MATS["DARK"], verts=14))
    # ONE long solar wing on a short mast off the +Y edge — deployed to ~30 m.
    # bus +Y edge at 0.7; mast bridges to wing inner edge; wing is 3.2 wide,
    # very long (the real Starlink single-wing look), tip → ~15 → span ~30.
    parts.append(cyl("mast", 0.05, 1.2, (0, 1.3, 0.05), rot=(math.radians(90), 0, 0),
                     material=MATS["DARK"], verts=10))
    # wing centre so outer tip ≈ 15 m: wing 3.2 wide × 12 long? Keep it a long
    # strip: width across (X) 3.0, length (Y) 24 → centred at y = 0.7+1.2+12 = 13.9,
    # tip at 25.9 — too long. Use a scaled single wing to ~14.5 tip (span ~29).
    wing = solar_wing("sl_wing", 3.0, 25.0, (0, 14.3, 0.05), cols=5, rows=20)
    parts.append(wing)
    obj = finalize(join(parts, "starlink"))
    return obj


# ---------------------------------------------------------------- GPS III
def build_gps():
    make_materials()
    parts = []
    # Box bus (~2.5 m), bevelled, foil-wrapped lower half.
    parts.append(box("bus", (2.2, 2.2, 2.6), (0, 0, 0), material=MATS["BUS"], bevel=0.06))
    parts.append(box("foil", (2.26, 2.26, 0.9), (0, 0, -0.9), material=MATS["FOIL"], bevel=0.03))
    # Nadir L-band antenna FARM — helical/patch elements on a plate (GPS signature).
    plate = box("ant_plate", (1.9, 1.9, 0.12), (0, 0, -1.42), material=MATS["ANT"], bevel=0.02)
    parts.append(plate)
    for gx in (-0.55, 0, 0.55):
        for gy in (-0.55, 0, 0.55):
            parts.append(cyl(f"helix_{gx}_{gy}", 0.16, 0.5, (gx, gy, -1.72),
                             material=MATS["METAL"], verts=10))
    # Two solar wings on booms — span ~17 m: bus edge 1.1, boom bridges to wing
    # inner edge, wing centred so tip ≈ 8.5.
    for side in (-1, 1):
        # boom from bus edge (1.1) to wing inner edge; wing 3.0 wide centred at 6.2
        # → inner edge 4.7, tip 7.7 → span 15.4; nudge to 6.7 centre → tip 8.2, span 16.4
        wing_c = 6.7
        wing_w = 3.0
        inner = wing_c - wing_w / 2
        boom_len = inner - 1.1
        boom_c = (1.1 + inner) / 2
        parts.append(cyl(f"boom_{side}", 0.05, boom_len, (side * boom_c, 0, 0.4),
                         rot=(0, math.radians(90), 0), material=MATS["DARK"], verts=10))
        parts.append(solar_wing(f"gps_wing_{side}", wing_w, 3.4, (side * wing_c, 0, 0.4),
                                cols=4, rows=10))
    # Apogee/station-keeping thruster nozzle (anti-nadir)
    parts.append(cyl("akm", 0.2, 0.4, (0, 0, 1.55), material=MATS["DARK"], verts=16))
    obj = finalize(join(parts, "gps3"))
    return obj


def main():
    for fn, out in [(build_starlink, "satellite-starlink.glb"),
                    (build_gps, "satellite-gps.glb")]:
        reset_scene()
        obj = fn()
        export(obj, out)
    print("CRAFT_HIFI_OK")


if __name__ == "__main__":
    main()
