"""
Build a recognizable Hubble Space Telescope — headless, reproducible.

Hubble's iconic silhouette: a silver/foil-wrapped cylinder (the tube), an open
aperture door at the front, two flat rectangular solar-array wings on side masts,
a high-gain antenna dish on a boom, and the aft equipment bay. Original clean
geometry, sized to read the moment it's selected.

Modelled +Y-forward (aperture direction), exported export_yup=True.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_hubble.py

Outputs:
  /tmp/hubble-hero.png                          hero render
  <repo>/public/models/satellite-telescope.glb  game-ready GLB (replaces old)
  <repo>/blender/space-assets/satellite-telescope.glb  source copy
"""

import bpy
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PUBLIC_GLB = os.path.join(REPO, "public", "models", "satellite-telescope.glb")
SRC_GLB = os.path.join(REPO, "blender", "space-assets", "satellite-telescope.glb")
HERO_PNG = "/tmp/hubble-hero.png"


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
    MATS["FOIL"] = mat("Foil", (0.78, 0.75, 0.62), metallic=0.9, rough=0.28)     # silver/gold foil tube
    MATS["ARRAY"] = mat("Array", (0.18, 0.22, 0.45), metallic=0.4, rough=0.3, emit=(0.10, 0.14, 0.35), es=0.5)  # blue panels
    MATS["DARK"] = mat("Dark", (0.08, 0.08, 0.10), metallic=0.4, rough=0.6)      # aperture interior
    MATS["METAL"] = mat("Metal", (0.7, 0.7, 0.72), metallic=0.85, rough=0.35)
    MATS["DISH"] = mat("Dish", (0.85, 0.85, 0.85), metallic=0.5, rough=0.4)


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


def cyl(name, r, depth, loc, rot=(0, 0, 0), material=None, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if material:
        o.data.materials.append(material)
    return o


def build():
    FOIL, ARRAY, DARK, METAL, DISH = MATS["FOIL"], MATS["ARRAY"], MATS["DARK"], MATS["METAL"], MATS["DISH"]
    parts = []

    # --- main tube: a long cylinder along Y (aperture at +Y front). Hubble is
    # ~13 m long, 4 m wide → keep that ~3:1 ratio.
    parts.append(cyl("Tube", 1.0, 5.4, (0, 0, 0), rot=(math.radians(90), 0, 0), material=FOIL, verts=40))
    # aperture ring + open door at the front
    parts.append(cyl("ApertureRing", 1.02, 0.3, (0, 2.6, 0), rot=(math.radians(90), 0, 0), material=METAL, verts=40))
    parts.append(cyl("ApertureHole", 0.85, 0.5, (0, 2.75, 0), rot=(math.radians(90), 0, 0), material=DARK, verts=40))
    # the hinged aperture door (a flat disc angled open above the aperture)
    door = cube("Door", (1.9, 0.06, 1.9), (0, 3.3, 1.1), rot=(math.radians(35), 0, 0), material=FOIL, bevel=0.02)
    parts.append(door)
    # aft equipment bay (slightly wider ring at the back)
    parts.append(cyl("AftBay", 1.08, 0.6, (0, -2.5, 0), rot=(math.radians(90), 0, 0), material=METAL, verts=40))

    # --- two solar-array wings: flat blue rectangles on short side masts (along X).
    for side in (-1, 1):
        parts.append(cyl(f"Mast_{side}", 0.08, 1.4, (side * 1.5, -0.2, 0), rot=(0, math.radians(90), 0), material=METAL, verts=12))
        panel = cube(f"Array_{side}", (2.6, 1.7, 0.05), (side * 3.1, -0.2, 0), material=ARRAY)
        parts.append(panel)
        # a couple of grid ribs on each panel
        for ry in (-0.5, 0.5):
            parts.append(cube(f"Rib_{side}_{ry}", (2.6, 0.04, 0.06), (side * 3.1, -0.2 + ry, 0), material=DARK))

    # --- high-gain antenna dish on a boom off the aft
    parts.append(cyl("AntBoom", 0.05, 1.6, (0.4, -1.6, 1.0), rot=(math.radians(20), 0, math.radians(15)), material=METAL, verts=10))
    dish = cyl("Dish", 0.55, 0.12, (0.7, -1.9, 1.7), rot=(math.radians(70), 0, 0), material=DISH, verts=28)
    parts.append(dish)

    # --- join
    for p in parts:
        p.select_set(False)
    bpy.context.view_layer.objects.active = parts[0]
    for p in parts:
        p.select_set(True)
    bpy.ops.object.join()
    hst = bpy.context.active_object
    hst.name = "Hubble"
    for mod in list(hst.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            pass
    bpy.ops.object.shade_smooth()
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    hst.location = (0, 0, 0)
    return hst


def setup_camera_lights(target):
    bpy.ops.object.camera_add(location=(6.5, -6.5, 3.5))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam
    d = target.location - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    key = bpy.data.lights.new("K", "AREA"); key.energy = 1300; key.size = 8
    ko = bpy.data.objects.new("K", key); bpy.context.collection.objects.link(ko)
    ko.location = (7, -5, 8); ko.rotation_euler = (math.radians(42), 0, math.radians(38))
    rim = bpy.data.lights.new("R", "AREA"); rim.energy = 650; rim.size = 6
    rim.color = (0.5, 0.65, 1.0)
    ro = bpy.data.objects.new("R", rim); bpy.context.collection.objects.link(ro)
    ro.location = (-7, 6, 4)


def export_glb(hst):
    os.makedirs(os.path.dirname(PUBLIC_GLB), exist_ok=True)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj is hst)
    bpy.context.view_layer.objects.active = hst
    bpy.ops.export_scene.gltf(filepath=PUBLIC_GLB, export_format="GLB",
                              use_selection=True, export_yup=True, export_apply=True)
    import shutil
    shutil.copyfile(PUBLIC_GLB, SRC_GLB)


def main():
    reset_scene()
    make_materials()
    hst = build()
    setup_camera_lights(hst)
    bpy.context.scene.render.filepath = HERO_PNG
    bpy.ops.render.render(write_still=True)
    export_glb(hst)
    print("HUBBLE_BUILD_OK dims=%s" % (tuple(round(d, 3) for d in hst.dimensions),))


if __name__ == "__main__":
    main()
