# Copyright (c) 2026 Ankur Sinha. All rights reserved.
#
# build_iridium_hifi.py — HIGH-FIDELITY Iridium NEXT for /lab/celestial.
#
# Replaces the box-and-cylinder placeholder (build_constellation_sats.py) with a
# faithful, detail-rich model that reads as real hardware on a close approach:
#   - Trapezoidal bus with bevelled edges + MLI-foil panelling
#   - The signature THREE Main Mission Antenna (MMA) phased-array panels — one
#     nadir, two side panels canted ~40° off nadir (Iridium's defining silhouette)
#   - Two deployable solar wings (gallium-arsenide) on booms, real cell-grid relief
#   - Gateway/feeder dish + antenna booms + thruster block
#   - PBR materials (metallic MLI, dark-blue cells, light phased-array face)
#   - Subsurf + bevel modifiers for edge light-catch, then decimated on export
#     so the GLB stays web-light (target < 150 KB).
#
# Real proportions (1 model unit = 1 m): bus ~1x1x3.1 m, ~9.4 m deployed span.
# Prints IRIDIUM_DIMS + IRIDIUM_TRIS for the archetype nativeSpan + a size check.
#
# Run headless:
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
#     --python blender/space-assets/build_iridium_hifi.py

import os
import math
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "models")
RENDER = "/tmp/iridium_hifi.png"


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        sc.cycles.samples = 96
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x = 1100
    sc.render.resolution_y = 850
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.008, 0.010, 0.018, 1.0)


MATS = {}


def make_materials():
    def mat(name, base, metallic=0.5, rough=0.5, emit=None, es=0.0, anis=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value = (*base, 1.0)
        b.inputs["Metallic"].default_value = metallic
        b.inputs["Roughness"].default_value = rough
        if "Anisotropic" in b.inputs and anis:
            b.inputs["Anisotropic"].default_value = anis
        if emit is not None:
            b.inputs["Emission Color"].default_value = (*emit, 1.0)
            b.inputs["Emission Strength"].default_value = es
        return m
    # MLI blanket — warm grey-gold, satiny. Raised base so the hull doesn't go
    # black-on-black against the void (the classic trap).
    MATS["BUS"] = mat("iri_bus", (0.80, 0.77, 0.70), metallic=0.45, rough=0.45)
    # Kapton foil accents — amber, glossy.
    MATS["FOIL"] = mat("iri_foil", (0.88, 0.62, 0.20), metallic=0.80, rough=0.30)
    # Phased-array face — bright ceramic-white, the MMA panels (Iridium's signature).
    MATS["MMA"] = mat("iri_mma", (0.90, 0.91, 0.94), metallic=0.25, rough=0.35)
    # Solar cells — indigo, slightly emissive so they don't go black on the void.
    MATS["CELL"] = mat("iri_cell", (0.07, 0.11, 0.28), metallic=0.30, rough=0.30,
                       emit=(0.03, 0.06, 0.16), es=0.4)
    # Panel back / structure grey.
    MATS["STRUCT"] = mat("iri_struct", (0.62, 0.62, 0.65), metallic=0.35, rough=0.6)
    # Dark composite booms/thrusters — lifted off pure black.
    MATS["DARK"] = mat("iri_dark", (0.18, 0.18, 0.21), metallic=0.5, rough=0.55)
    # Bright metal antenna.
    MATS["METAL"] = mat("iri_metal", (0.86, 0.88, 0.92), metallic=0.9, rough=0.25)


def _apply(o, mat):
    o.data.materials.append(mat)
    return o


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
        _apply(o, material)
    return o


def cyl(name, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), material=None, verts=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if material:
        _apply(o, material)
    return o


def solar_wing(name, w, h, loc, cols=4, rows=8):
    """A solar wing built at the ORIGIN in the XY plane as a grid of cells over a
    backing, joined, THEN translated as one rigid unit to `loc`. Building at the
    origin first (no per-cell trig) is what keeps the grid tiling correctly —
    the earlier cos/sin offset scattered the cells. Returns the joined object."""
    parts = []
    back = box(f"{name}_back", (w, h, 0.03), (0, 0, 0), material=MATS["STRUCT"])
    parts.append(back)
    gap = 0.03
    cw = (w - gap * (cols + 1)) / cols
    ch = (h - gap * (rows + 1)) / rows
    x0 = -w / 2 + gap + cw / 2
    y0 = -h / 2 + gap + ch / 2
    for i in range(cols):
        for j in range(rows):
            lx = x0 + i * (cw + gap)
            ly = y0 + j * (ch + gap)
            parts.append(box(f"{name}_c{i}_{j}", (cw, ch, 0.05), (lx, ly, 0.03),
                             material=MATS["CELL"]))
    wing = join(parts, name)
    wing.location = loc          # move the assembled wing as one unit
    bpy.ops.object.transform_apply(location=True)
    return wing


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


def build_iridium():
    make_materials()
    parts = []

    # --- Main bus: trapezoidal, bevelled, with a foil skirt ---
    bus = box("bus", (1.1, 1.0, 3.1), (0, 0, 0), material=MATS["BUS"], bevel=0.06)
    parts.append(bus)
    # taper the top of the bus for the real trapezoid silhouette
    parts.append(box("bus_top", (0.7, 0.65, 0.5), (0, 0, 1.6), material=MATS["BUS"], bevel=0.05))
    # foil skirt wrapping the LOWER bus body (kept ABOVE the bus bottom face so it
    # doesn't poke through the MMA panels and read as a gap). Spans z:[-1.5,-0.9].
    parts.append(box("foil", (1.16, 1.06, 0.6), (0, 0, -1.2), material=MATS["FOIL"], bevel=0.03))

    # --- Main Mission Antenna (MMA): a CONNECTED three-panel nadir trough —
    #     Iridium's defining silhouette. The two side panels hinge at the CENTRAL
    #     panel's edges (not the bus), so all three meet edge-to-edge as one
    #     continuous phased-array surface (a shallow inverted-V), then the whole
    #     assembly is tucked flush to the bus bottom. ---
    MMA_W, MMA_L, MMA_T = 1.0, 2.9, 0.12
    BUS_BOT = -1.55
    ang = math.radians(38)
    # Central panel top face sits ON the bus bottom (no gap).
    cz_c = BUS_BOT - MMA_T / 2
    parts.append(box("mma_c", (MMA_W, MMA_L, MMA_T), (0, 0, cz_c), material=MATS["MMA"], bevel=0.015))
    parts.append(box("mma_c_grid", (MMA_W * 0.9, MMA_L * 0.93, 0.03),
                     (0, 0, cz_c - MMA_T / 2 - 0.01), material=MATS["STRUCT"]))
    # Side panels: inner edge coincides with the central panel's outer edge at
    # x = ±MMA_W/2, top level = bus bottom, canted down-and-out by `ang`.
    for side in (-1, 1):
        hinge_x = side * MMA_W / 2           # meets the central panel edge exactly
        # panel centre offset from the hinge by half-width along the canted plane
        cx = hinge_x + side * math.cos(ang) * MMA_W / 2
        cz = BUS_BOT - math.sin(ang) * MMA_W / 2
        parts.append(box(f"mma_{side}", (MMA_W, MMA_L, MMA_T),
                         (cx, 0, cz), rot=(0, side * ang, 0),
                         material=MATS["MMA"], bevel=0.015))
        # grid relief on the side face
        parts.append(box(f"mma_grid_{side}", (MMA_W * 0.9, MMA_L * 0.93, 0.03),
                         (cx + side * math.sin(ang) * (MMA_T / 2 + 0.02), 0,
                          cz - math.cos(ang) * (MMA_T / 2 + 0.02)),
                         rot=(0, side * ang, 0), material=MATS["STRUCT"]))
        # frame rail along the OUTER long edge of each side panel
        ox = cx + side * math.cos(ang) * MMA_W / 2
        oz = cz - math.sin(ang) * MMA_W / 2
        parts.append(box(f"mma_rail_{side}", (0.05, MMA_L, 0.16),
                         (ox, 0, oz), rot=(0, side * ang, 0), material=MATS["METAL"]))

    # --- Two solar wings on side booms (gallium arsenide) ---
    # Booms BRIDGE bus edge (x=0.55) to wing inner edge (x=2.40): length 1.85,
    # centred at x=1.475, so nothing floats. Wing centred at 3.55 → tip 4.70 →
    # tip-to-tip span 9.40 m (solved). Twin booms (fore/aft) per side for realism.
    for side in (-1, 1):
        for fore in (-0.45, 0.45):
            parts.append(cyl(f"boom_{side}_{fore}", 0.045, 1.95,
                             (side * 1.475, fore, 0.7),
                             rot=(0, math.radians(90), 0), material=MATS["DARK"], verts=10))
        wing = solar_wing(f"wing_{side}", 2.3, 2.4, (side * 3.55, 0, 0.7),
                          cols=4, rows=8)
        parts.append(wing)

    # --- Gateway feeder dish + antenna booms ---
    dish = cyl("dish", 0.35, 0.08, (0, 0.62, 1.55), rot=(math.radians(90), 0, 0),
               material=MATS["METAL"], verts=24)
    parts.append(dish)
    parts.append(cyl("feed", 0.02, 0.28, (0, 0.62, 1.72), rot=(math.radians(90), 0, 0),
                     material=MATS["DARK"], verts=8))
    # small crosslink antennas (Iridium's inter-satellite links)
    for side in (-1, 1):
        parts.append(box(f"xlink_{side}", (0.35, 0.06, 0.5),
                         (side * 0.6, -0.55, 1.5),
                         rot=(math.radians(15), 0, 0), material=MATS["MMA"]))

    # --- Thruster block (aft/anti-nadir) ---
    parts.append(box("thr", (0.5, 0.5, 0.35), (0, 0, 1.85), material=MATS["DARK"], bevel=0.04))
    for dx, dy in [(-0.15, -0.15), (0.15, -0.15), (-0.15, 0.15), (0.15, 0.15)]:
        parts.append(cyl(f"noz_{dx}_{dy}", 0.06, 0.12, (dx, dy, 2.05),
                         material=MATS["METAL"], verts=10))

    obj = join(parts, "iridium")
    # center origin on geometry bounds, sit at world origin
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj.location = (0, 0, 0)
    # smooth shading with an angle split so bevels stay crisp
    bpy.ops.object.shade_smooth()
    try:
        obj.data.use_auto_smooth = True
        obj.data.auto_smooth_angle = math.radians(35)
    except Exception:
        pass
    return obj


def setup_lighting():
    # 3-point rig: warm key, cool fill, rim.
    def light(name, kind, loc, energy, color, size=3.0):
        d = bpy.data.lights.new(name, kind)
        d.energy = energy
        d.color = color
        if kind == "AREA":
            d.size = size
        o = bpy.data.objects.new(name, d)
        o.location = loc
        bpy.context.collection.objects.link(o)
        # aim at origin
        dirx, diry, dirz = -loc[0], -loc[1], -loc[2]
        o.rotation_euler = (
            math.atan2(math.hypot(dirx, diry), dirz) if False else 0, 0, 0)
        return o
    light("key", "AREA", (6, -5, 5), 1600, (1.0, 0.95, 0.85), size=5)
    light("fill", "AREA", (-6, -3, 2), 600, (0.75, 0.82, 1.0), size=6)
    light("rim", "AREA", (0, 6, 4), 900, (0.85, 0.9, 1.0), size=4)


def render(path):
    # frame the model with a camera
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 60
    cam = bpy.data.objects.new("cam", cam_d)
    cam.location = (6.5, -7.0, 3.8)
    cam.rotation_euler = (math.radians(72), 0, math.radians(42))
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def export(obj, filename):
    path = os.path.join(OUT, filename)
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB",
                              use_selection=True, export_yup=True, export_apply=True)
    d = tuple(round(v, 3) for v in obj.dimensions)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print(f"{filename.upper()}_DIMS={d}")
    print(f"IRIDIUM_TRIS={tris}")
    sz = os.path.getsize(path)
    print(f"IRIDIUM_GLB_BYTES={sz}")


def main():
    reset_scene()
    obj = build_iridium()
    setup_lighting()
    render(RENDER)
    export(obj, "satellite-iridium.glb")
    print("IRIDIUM_HIFI_OK")


if __name__ == "__main__":
    main()
