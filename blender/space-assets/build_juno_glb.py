"""
Build a faithful JUNO GLB → public/models/craft-juno.glb.

Juno (NASA, at Jupiter since 2016) has an unmistakable silhouette: a compact
hexagonal bus with THREE enormous solar-array wings radiating at 120°, and a
high-gain antenna dish on top. Because Jupiter gets only ~4% of Earth's sunlight,
the arrays are huge — each ~8.9 m long (three panels), giving Juno a ~20 m span,
the widest solar arrays NASA had flown to a planet at the time.

Real structure, faithfully:
  • BUS — a squat hexagonal prism (the six-sided body).
  • THREE SOLAR WINGS — each three flat blue panels end-to-end on a short yoke,
    at 120° around the bus (the three-fold "pinwheel").
  • HIGH-GAIN ANTENNA — a dish on top (+Z), Earth-pointing.
  • magnetometer boom on one wing tip (a thin rod) — Juno's real detail.

Bus axis +Z (antenna up); wings radiate in the XY plane. Web-light: flat metal +
solar-blue, no textures.

Own it headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_juno_glb.py
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
    foil  = mat("Juno_Bus",   (0.80, 0.78, 0.70), 0.9, 0.35, emit=0.10)
    cells = mat("Juno_Cells", (0.10, 0.16, 0.42), 0.2, 0.4)
    yoke  = mat("Juno_Yoke",  (0.4, 0.4, 0.44),  0.8, 0.4)
    dish  = mat("Juno_Dish",  (0.85, 0.85, 0.88), 0.5, 0.4)

    parts = []

    # --- hexagonal bus (squat prism along Z) ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.28, depth=0.34)
    bus = bpy.context.active_object
    bus.name = "Bus"
    bus.data.materials.append(foil)
    parts.append(bus)

    # --- high-gain antenna dish on top (+Z) ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.22, depth=0.03)
    d = bpy.context.active_object
    d.name = "Antenna"
    d.location = (0, 0, 0.3)
    d.data.materials.append(dish)
    parts.append(d)

    # --- three solar wings at 120°, each three panels on a yoke ---
    PANEL_L = 0.62      # each panel length (three per wing → long wing)
    PANEL_W = 0.34
    for w in range(3):
        ang = math.radians(90 + w * 120)   # 120° apart, first one "up"
        ca, sa = math.cos(ang), math.sin(ang)
        # short yoke from the bus edge outward
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.02, depth=0.22)
        y = bpy.context.active_object
        y.name = f"Yoke_{w}"
        y.rotation_euler = (0, math.radians(90), ang)
        yr = 0.30 + 0.11
        y.location = (ca * yr, sa * yr, 0)
        y.data.materials.append(yoke)
        parts.append(y)
        # three panels end-to-end along the wing direction
        for pnl in range(3):
            bpy.ops.mesh.primitive_cube_add(size=1)
            pa = bpy.context.active_object
            pa.name = f"Wing_{w}_{pnl}"
            pa.scale = (PANEL_L / 2, PANEL_W / 2, 0.008)
            bpy.ops.object.transform_apply(scale=True)
            # distance out along the wing for this panel
            r = 0.30 + 0.22 + PANEL_L * (pnl + 0.5)
            pa.location = (ca * r, sa * r, 0)
            pa.rotation_euler = (0, 0, ang)   # long edge along the wing
            pa.data.materials.append(cells)
            parts.append(pa)
        # magnetometer boom on the FIRST wing's tip (Juno's real detail)
        if w == 0:
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.01, depth=0.4)
            mb = bpy.context.active_object
            mb.name = "MagBoom"
            mb.rotation_euler = (0, math.radians(90), ang)
            rr = 0.30 + 0.22 + PANEL_L * 3 + 0.2
            mb.location = (ca * rr, sa * rr, 0)
            mb.data.materials.append(yoke)
            parts.append(mb)

    # --- join, centre, export ---
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    juno = bpy.context.view_layer.objects.active
    juno.name = "Juno"
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    juno.location = (0, 0, 0)

    bpy.ops.object.select_all(action="DESELECT")
    juno.select_set(True)
    path = os.path.join(OUT, "craft-juno.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True)
    tris = sum(len(p.vertices) - 2 for p in juno.data.polygons)
    print("WROTE", path, "| tris≈", tris, "| dims", [round(d, 2) for d in juno.dimensions])


build()
