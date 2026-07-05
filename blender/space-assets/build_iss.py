"""
Build a recognizable International Space Station model — headless, reproducible.

The ISS's iconic silhouette: a long lateral integrated truss, four huge solar-
array wings (the gold panels) at the truss ends, a line of pressurized modules
along the central core (perpendicular to the truss), radiator panels, and the
Canadarm/docked-vehicle details left implicit. Original clean geometry, sized to
read the moment it's selected in the engine.

Modelled +Y-forward (velocity direction), exported export_yup=True so it arrives
nose -Z / up +Y in three-space (matches the other engine GLBs).

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_iss.py

Outputs:
  /tmp/iss-hero.png                      hero render (read back to verify)
  <repo>/public/models/satellite-station.glb   the game-ready GLB (replaces the old one)
  <repo>/blender/space-assets/satellite-station.glb  source-of-truth copy
"""

import bpy
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PUBLIC_GLB = os.path.join(REPO, "public", "models", "satellite-station.glb")
SRC_GLB = os.path.join(REPO, "blender", "space-assets", "satellite-station.glb")
HERO_PNG = "/tmp/iss-hero.png"


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        sc.cycles.samples = 72
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x = 1024
    sc.render.resolution_y = 768
    sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.01, 0.012, 0.02, 1.0)
        bg.inputs[1].default_value = 1.0


MATS = {}


def make_materials():
    def mat(name, base, metallic=0.6, rough=0.5, emit=None, es=0.0):
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
    # Solar arrays: the ISS panels are a distinctive amber/gold with a bluish tint.
    MATS["ARRAY"] = mat("Array", (0.55, 0.40, 0.12), metallic=0.3, rough=0.35, emit=(0.35, 0.28, 0.10), es=0.6)
    MATS["TRUSS"] = mat("Truss", (0.72, 0.72, 0.70), metallic=0.85, rough=0.4)   # aluminium truss
    MATS["MODULE"] = mat("Module", (0.86, 0.86, 0.83), metallic=0.5, rough=0.5)  # white modules
    MATS["RAD"] = mat("Radiator", (0.90, 0.90, 0.92), metallic=0.7, rough=0.25)  # white radiators
    MATS["DARK"] = mat("Dark", (0.10, 0.10, 0.12), metallic=0.5, rough=0.6)
    MATS["GOLD"] = mat("Gold", (0.80, 0.62, 0.20), metallic=0.9, rough=0.35)     # foil


def cube(name, size, loc, rot=(0, 0, 0), material=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel > 0:
        m = o.modifiers.new("b", "BEVEL"); m.width = bevel; m.segments = 2; m.limit_method = "ANGLE"
    if material:
        o.data.materials.append(material)
    return o


def cyl(name, r, depth, loc, rot=(0, 0, 0), material=None, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if material:
        o.data.materials.append(material)
    return o


def build():
    ARRAY, TRUSS, MODULE, RAD, DARK, GOLD = (
        MATS["ARRAY"], MATS["TRUSS"], MATS["MODULE"], MATS["RAD"], MATS["DARK"], MATS["GOLD"])
    parts = []

    # --- Integrated Truss Structure: one long lateral spine along X (the ISS is
    # widest across its truss/solar wings). ~ full width.
    parts.append(cube("Truss", (7.0, 0.35, 0.35), (0, 0, 0), material=TRUSS, bevel=0.03))
    # truss lattice nodes (segments) for read
    for x in (-2.4, -1.2, 1.2, 2.4):
        parts.append(cube(f"TrussNode_{x}", (0.25, 0.5, 0.5), (x, 0, 0), material=DARK, bevel=0.02))

    # --- Solar-array wings: 4 big panels, 2 at each truss end, splayed slightly.
    # Each pair sits beyond the truss node; long axis along Y so they read as the
    # iconic wings. Thin, wide, amber.
    for side in (-1, 1):
        bx = side * 3.3
        for j, off in enumerate((-1.3, 1.3)):
            panel = cube(f"Array_{side}_{j}", (0.06, 2.4, 1.15), (bx, off, 0), material=ARRAY)
            parts.append(panel)
            # panel grid ribs (a couple of dark lines so it's not a flat slab)
            parts.append(cube(f"ArrayRib_{side}_{j}", (0.08, 2.4, 0.05), (bx, off, 0), material=DARK))
            # mast connecting the wing pair to the truss end
        parts.append(cyl(f"Mast_{side}", 0.06, 2.7, (bx, 0, 0), rot=(math.radians(90), 0, 0), material=TRUSS, verts=10))
        # rotary joint (SARJ) where the wings meet the truss
        parts.append(cyl(f"SARJ_{side}", 0.35, 0.4, (side * 2.7, 0, 0), rot=(0, math.radians(90), 0), material=GOLD, verts=20))

    # --- Pressurised modules: a line of white cylinders along the CORE (Y axis),
    # perpendicular to the truss — the habitable stack (Zarya/Unity/Destiny/Node).
    module_specs = [
        (0.0, 1.4, 0.55),   # core node
        (2.0, 1.6, 0.5),    # forward module
        (-1.9, 1.5, 0.5),   # aft module
        (3.5, 1.2, 0.42),   # far forward (Kibo-ish)
    ]
    for i, (y, length, r) in enumerate(module_specs):
        parts.append(cyl(f"Module_{i}", r, length, (0, y, 0), rot=(math.radians(90), 0, 0), material=MODULE, verts=24))
    # a couple of side modules (docking / airlock) branching off the core
    parts.append(cyl("SideMod_1", 0.4, 0.9, (0.9, 0.6, 0), rot=(0, math.radians(90), 0), material=MODULE, verts=20))
    parts.append(cyl("SideMod_2", 0.35, 0.8, (0, 0.4, 0.85), rot=(0, 0, 0), material=MODULE, verts=20))

    # --- Radiator panels: white heat-rejection panels near the truss centre,
    # angled off the truss (perpendicular-ish, along Z).
    for side in (-1, 1):
        parts.append(cube(f"Radiator_{side}", (1.6, 0.04, 1.1), (side * 0.9, 0, 0.95), material=RAD))
        parts.append(cube(f"RadArm_{side}", (0.08, 0.08, 0.9), (side * 0.9, 0, 0.5), material=TRUSS))

    # --- join everything
    for p in parts:
        p.select_set(False)
    bpy.context.view_layer.objects.active = parts[0]
    for p in parts:
        p.select_set(True)
    bpy.ops.object.join()
    iss = bpy.context.active_object
    iss.name = "ISS"
    for mod in list(iss.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            pass
    bpy.ops.object.shade_smooth()
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    iss.location = (0, 0, 0)
    return iss


def setup_camera_lights(target):
    from mathutils import Vector
    bpy.ops.object.camera_add(location=(6.5, -7.5, 4.5))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam
    d = target.location - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 45
    key = bpy.data.lights.new("K", "AREA"); key.energy = 1400; key.size = 8
    ko = bpy.data.objects.new("K", key); bpy.context.collection.objects.link(ko)
    ko.location = (7, -5, 9); ko.rotation_euler = (math.radians(42), 0, math.radians(38))
    rim = bpy.data.lights.new("R", "AREA"); rim.energy = 700; rim.size = 6
    rim.color = (0.5, 0.65, 1.0)
    ro = bpy.data.objects.new("R", rim); bpy.context.collection.objects.link(ro)
    ro.location = (-7, 6, 4)


def export_glb(iss):
    os.makedirs(os.path.dirname(PUBLIC_GLB), exist_ok=True)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj is iss)
    bpy.context.view_layer.objects.active = iss
    bpy.ops.export_scene.gltf(filepath=PUBLIC_GLB, export_format="GLB",
                              use_selection=True, export_yup=True, export_apply=True)
    import shutil
    shutil.copyfile(PUBLIC_GLB, SRC_GLB)


def main():
    reset_scene()
    make_materials()
    iss = build()
    setup_camera_lights(iss)
    bpy.context.scene.render.filepath = HERO_PNG
    bpy.ops.render.render(write_still=True)
    export_glb(iss)
    print("ISS_BUILD_OK dims=%s" % (tuple(round(d, 3) for d in iss.dimensions),))


if __name__ == "__main__":
    main()
