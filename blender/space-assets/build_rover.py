"""
Build a Mars rover GLB for the /lab/celestial coverage map — headless, reproducible.

A recognizable six-wheel rocker-bogie rover (Perseverance / Curiosity class): a
flat warm-metal chassis, six wheels on suspension struts, a camera mast with a
sensor head, and a stowed robotic arm. Original, clean geometry — small enough to
roam the Mars globe smoothly.

Modelled +Y-forward (drive direction), exported with export_yup=True so it
arrives nose -Z / up +Y in three-space.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_rover.py

Outputs:
  /tmp/rover-hero.png                    hero render (read back to verify)
  <repo>/public/models/mars-rover.glb    the game-ready GLB
  <repo>/blender/space-assets/mars-rover.glb  source-of-truth copy
"""

import bpy
import bmesh
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PUBLIC_GLB = os.path.join(REPO, "public", "models", "mars-rover.glb")
SRC_GLB = os.path.join(REPO, "blender", "space-assets", "mars-rover.glb")
HERO_PNG = "/tmp/rover-hero.png"


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        sc.cycles.samples = 64
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x = 1024
    sc.render.resolution_y = 768
    sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.02, 0.015, 0.02, 1.0)
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
    MATS["BODY"] = mat("Body", (0.72, 0.68, 0.60), metallic=0.7, rough=0.4)   # warm metal
    MATS["DARK"] = mat("Dark", (0.10, 0.10, 0.12), metallic=0.5, rough=0.6)   # struts/wheels
    MATS["GOLD"] = mat("Gold", (0.80, 0.60, 0.20), metallic=0.9, rough=0.35)  # foil accents
    MATS["LENS"] = mat("Lens", (0.15, 0.55, 0.75), rough=0.1, emit=(0.2, 0.6, 0.9), es=2.0)


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


def cyl(name, r, depth, loc, rot=(0, 0, 0), material=None, verts=20):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if material:
        o.data.materials.append(material)
    return o


def build():
    BODY, DARK, GOLD, LENS = MATS["BODY"], MATS["DARK"], MATS["GOLD"], MATS["LENS"]
    parts = []

    # chassis — flat box (the "warm-shoebox" body). +Y is forward. Sits low so
    # the wheels tuck right under it and it reads as one machine.
    parts.append(cube("Chassis", (1.1, 1.8, 0.42), (0, 0, 0.55), material=BODY, bevel=0.06))
    # gold foil top deck accent (flush on top of the chassis)
    parts.append(cube("Deck", (0.95, 1.6, 0.06), (0, 0, 0.79), material=GOLD))

    # six wheels — 3 per side, tucked close to the body (x=±0.62) and overlapping
    # the chassis line so struts visibly bridge them. Wheel centre at z=0.30.
    WX = 0.62
    for side in (-1, 1):
        for j, y in enumerate((-0.62, 0.0, 0.62)):
            parts.append(cyl(f"Wheel_{side}_{j}", r=0.30, depth=0.20,
                             loc=(side * WX, y, 0.30), rot=(0, math.radians(90), 0),
                             material=DARK, verts=20))
            # short strut bridging chassis flank → wheel hub (they overlap → connected)
            parts.append(cube(f"Strut_{side}_{j}", (0.10, 0.10, 0.34),
                              (side * 0.5, y, 0.42), material=DARK))
        # rocker-bogie rail running the length, joining the struts
        parts.append(cube(f"Rocker_{side}", (0.08, 1.5, 0.08),
                          (side * 0.5, 0.0, 0.48), material=DARK))

    # camera mast — rises straight from the chassis TOP (base overlaps the deck)
    # to a sensor head. Base at z≈0.79 so it's attached, not floating.
    parts.append(cube("Mast", (0.14, 0.14, 0.95), (0, 0.55, 1.15), material=BODY))
    parts.append(cube("Head", (0.46, 0.20, 0.22), (0, 0.55, 1.68), material=BODY, bevel=0.04))
    for ex in (-0.15, 0.15):
        parts.append(cyl(f"Eye_{ex}", r=0.05, depth=0.08, loc=(ex, 0.66, 1.68),
                         rot=(math.radians(90), 0, 0), material=LENS, verts=14))

    # robotic arm — stowed low along the front, base overlapping the chassis.
    parts.append(cube("Arm1", (0.10, 0.6, 0.10), (0.28, 0.9, 0.7),
                      rot=(math.radians(25), 0, 0), material=DARK))
    parts.append(cube("Arm2", (0.09, 0.42, 0.09), (0.28, 1.28, 0.86),
                      rot=(math.radians(-35), 0, 0), material=DARK))

    # RTG tail box at the rear (overlaps the chassis back edge)
    parts.append(cube("RTG", (0.42, 0.35, 0.35), (0, -1.0, 0.72), material=DARK, bevel=0.04))

    # join all
    for p in parts:
        p.select_set(False)
    bpy.context.view_layer.objects.active = parts[0]
    for p in parts:
        p.select_set(True)
    bpy.ops.object.join()
    rover = bpy.context.active_object
    rover.name = "MarsRover"
    for mod in list(rover.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            pass
    bpy.ops.object.shade_smooth()
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    rover.location = (0, 0, 0)
    return rover


def setup_camera_lights(target):
    from mathutils import Vector
    bpy.ops.object.camera_add(location=(3.4, -3.8, 2.8))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam
    d = target.location - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    key = bpy.data.lights.new("K", "AREA"); key.energy = 600; key.size = 5
    ko = bpy.data.objects.new("K", key); bpy.context.collection.objects.link(ko)
    ko.location = (4, -3, 6); ko.rotation_euler = (math.radians(40), 0, math.radians(35))
    rim = bpy.data.lights.new("R", "AREA"); rim.energy = 400; rim.size = 4
    rim.color = (1.0, 0.7, 0.5)
    ro = bpy.data.objects.new("R", rim); bpy.context.collection.objects.link(ro)
    ro.location = (-4, 4, 3)


def export_glb(rover):
    os.makedirs(os.path.dirname(PUBLIC_GLB), exist_ok=True)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj is rover)
    bpy.context.view_layer.objects.active = rover
    bpy.ops.export_scene.gltf(filepath=PUBLIC_GLB, export_format="GLB",
                              use_selection=True, export_yup=True, export_apply=True)
    import shutil
    shutil.copyfile(PUBLIC_GLB, SRC_GLB)


def main():
    reset_scene()
    make_materials()
    rover = build()
    setup_camera_lights(rover)
    bpy.context.scene.render.filepath = HERO_PNG
    bpy.ops.render.render(write_still=True)
    export_glb(rover)
    print("ROVER_BUILD_OK dims=%s" % (tuple(round(d, 3) for d in rover.dimensions),))


if __name__ == "__main__":
    main()
