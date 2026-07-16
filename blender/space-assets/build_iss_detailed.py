"""
Build the FAITHFUL International Space Station — flagship of the one-satellite-
at-a-time program. Dedicated /models/iss.glb (satellite-station.glb stays for
Tiangong).

Real configuration, real proportions (1 unit = 10 m):
  - Integrated Truss ~94 m port-starboard, 109 m tip-to-tip incl. arrays
  - EIGHT solar array wings in four pairs (P6/P4 port, S4/S6 starboard),
    each wing 34 x 12 m extending fore/aft from a mast, tips spanning ~73 m
  - SARJ rotary joints (gold rings) where the outboard truss meets midships
  - Module stack ~59 m along the velocity axis: Zvezda - Zarya - Unity -
    Destiny - Harmony; Columbus starboard + Kibo port off Harmony;
    Tranquility + Cupola off Unity; Zvezda keeps its own small array pair
  - Two triple-panel white radiator banks off P1/S1, angled nadir
  - Docked Soyuz (aft) + Dragon (forward), Canadarm2 hint on the truss

Modelled +Y-forward (velocity), exported export_yup=True like every engine GLB.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_iss_detailed.py
"""

import bpy
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PUBLIC_GLB = os.path.join(REPO, "public", "models", "iss.glb")
SRC_GLB = os.path.join(REPO, "blender", "space-assets", "iss.glb")


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
    MATS["ARRAY"] = mat("Array", (0.52, 0.36, 0.11), metallic=0.35, rough=0.38, emit=(0.30, 0.22, 0.08), es=0.5)
    MATS["TRUSS"] = mat("Truss", (0.70, 0.70, 0.68), metallic=0.85, rough=0.42)
    MATS["MODULE"] = mat("Module", (0.86, 0.86, 0.83), metallic=0.45, rough=0.5)
    MATS["RAD"] = mat("Radiator", (0.91, 0.91, 0.94), metallic=0.6, rough=0.28)
    MATS["DARK"] = mat("Dark", (0.10, 0.10, 0.12), metallic=0.5, rough=0.6)
    MATS["GOLD"] = mat("Gold", (0.80, 0.62, 0.20), metallic=0.9, rough=0.35)


def cube(name, size, loc, rot=(0, 0, 0), material=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel > 0:
        m = o.modifiers.new("b", "BEVEL")
        m.width = bevel
        m.segments = 2
        m.limit_method = "ANGLE"
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


def cone(name, r1, r2, depth, loc, rot=(0, 0, 0), material=None, verts=18):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if material:
        o.data.materials.append(material)
    return o


ALONG_Y = (math.radians(90), 0, 0)
ALONG_X = (0, math.radians(90), 0)


def wing_pair(parts, mount_x, tag):
    """One solar array wing pair: central mast along Y + fore/aft 34x12 m wings
    (amber, blanket-gap stripe + guide-wire ribs)."""
    ARRAY, DARK, TRUSS = MATS["ARRAY"], MATS["DARK"], MATS["TRUSS"]
    parts.append(cyl(f"Mast_{tag}", 0.045, 7.5, (mount_x, 0, 0), rot=ALONG_Y, material=TRUSS, verts=10))
    for fwd in (1, -1):
        yc = fwd * (0.25 + 1.71)
        parts.append(cube(f"Wing_{tag}_{fwd}", (1.19, 3.42, 0.026), (mount_x, yc, 0), material=ARRAY))
        # blanket gap down the wing centreline + two rib lines
        parts.append(cube(f"WingGap_{tag}_{fwd}", (0.10, 3.42, 0.032), (mount_x, yc, 0), material=DARK))
        for rx in (-0.38, 0.38):
            parts.append(cube(f"WingRib_{tag}_{fwd}_{rx}", (0.02, 3.42, 0.030), (mount_x + rx, yc, 0), material=DARK))


def build():
    ARRAY, TRUSS, MODULE, RAD, DARK, GOLD = (
        MATS["ARRAY"], MATS["TRUSS"], MATS["MODULE"], MATS["RAD"], MATS["DARK"], MATS["GOLD"])
    parts = []

    # --- Integrated Truss Structure along X (port -, starboard +): runs all the
    # way out to carry the P6/S6 outboard array mounts ---
    parts.append(cube("Truss", (11.0, 0.40, 0.40), (0, 0, 0), material=TRUSS, bevel=0.02))
    for x in (-4.6, -3.0, -2.0, -1.0, 1.0, 2.0, 3.0, 4.6):
        parts.append(cube(f"TrussNode_{x}", (0.22, 0.52, 0.52), (x, 0, 0), material=DARK, bevel=0.015))

    # --- SARJ rotary joints (gold) between mid and outboard truss ---
    for s in (-1, 1):
        parts.append(cyl(f"SARJ_{s}", 0.30, 0.35, (s * 3.45, 0, 0), rot=ALONG_X, material=GOLD, verts=20))

    # --- EIGHT solar wings: inboard pair (P4/S4) + outboard pair (P6/S6) ---
    for s in (-1, 1):
        wing_pair(parts, s * 3.95, f"{'S' if s > 0 else 'P'}4")
        wing_pair(parts, s * 5.25, f"{'S' if s > 0 else 'P'}6")
        # small PV thermal radiator just inboard of each outer mast, up +Z
        parts.append(cube(f"PVRad_{s}", (0.04, 0.55, 0.85), (s * 4.6, 0, 0.55), material=RAD))

    # --- Module stack along Y (velocity axis): aft (-Y) to forward (+Y) ---
    # Zvezda (aft, with its own small array pair) - Zarya - Unity - Destiny - Harmony
    parts.append(cyl("Zvezda", 0.205, 1.30, (0, -2.45, 0), rot=ALONG_Y, material=MODULE))
    for s in (-1, 1):
        parts.append(cube(f"ZvezdaArray_{s}", (0.95, 0.32, 0.02), (s * 0.75, -2.45, 0), material=ARRAY))
    parts.append(cyl("Zarya", 0.205, 1.25, (0, -1.15, 0), rot=ALONG_Y, material=MODULE))
    parts.append(cyl("Unity", 0.23, 0.55, (0, -0.28, 0), rot=ALONG_Y, material=MODULE, verts=20))
    parts.append(cyl("Destiny", 0.22, 0.87, (0, 0.45, 0), rot=ALONG_Y, material=MODULE))
    parts.append(cyl("Harmony", 0.22, 0.74, (0, 1.28, 0), rot=ALONG_Y, material=MODULE, verts=20))

    # --- Laterals: Columbus starboard + Kibo port off Harmony; Tranquility+Cupola off Unity ---
    parts.append(cyl("Columbus", 0.215, 0.69, (0.56, 1.28, 0), rot=ALONG_X, material=MODULE, verts=20))
    parts.append(cyl("Kibo", 0.22, 1.12, (-0.78, 1.28, 0), rot=ALONG_X, material=MODULE))
    parts.append(cyl("KiboLogistics", 0.17, 0.42, (-0.78, 1.28, 0.38), material=MODULE, verts=16))
    parts.append(cube("KiboExposed", (0.55, 0.5, 0.06), (-1.6, 1.28, -0.12), material=DARK, bevel=0.02))
    parts.append(cyl("Tranquility", 0.21, 0.65, (-0.52, -0.28, 0), rot=ALONG_X, material=MODULE, verts=20))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, location=(-0.52, -0.28, -0.22), segments=16, ring_count=8)
    cupola = bpy.context.active_object
    cupola.name = "Cupola"
    cupola.data.materials.append(DARK)
    parts.append(cupola)

    # --- Docked vehicles: Soyuz aft of Zvezda, Dragon forward of Harmony ---
    parts.append(cyl("SoyuzBody", 0.11, 0.30, (0, -3.28, 0), rot=ALONG_Y, material=MODULE, verts=14))
    parts.append(cone("SoyuzNose", 0.11, 0.04, 0.18, (0, -3.52, 0), rot=(math.radians(90), 0, 0), material=DARK, verts=14))
    for s in (-1, 1):
        parts.append(cube(f"SoyuzArray_{s}", (0.5, 0.2, 0.015), (s * 0.4, -3.28, 0), material=ARRAY))
    parts.append(cone("Dragon", 0.13, 0.07, 0.42, (0, 1.90, 0), rot=(math.radians(-90), 0, 0), material=MODULE, verts=16))

    # --- Radiator banks: three white panels each off P1/S1, angled nadir (-Z) ---
    for s in (-1, 1):
        parts.append(cube(f"RadArm_{s}", (0.07, 0.07, 0.75), (s * 1.55, 0, -0.45), material=TRUSS))
        for j, yo in enumerate((-0.42, 0.0, 0.42)):
            parts.append(cube(
                f"Radiator_{s}_{j}", (0.55, 0.035, 1.15), (s * 1.55, yo, -1.15),
                rot=(math.radians(8 * (j - 1)), 0, 0), material=RAD,
            ))

    # --- Canadarm2 hint: two thin segments articulated at an elbow on the truss ---
    parts.append(cyl("Arm_A", 0.028, 0.85, (0.75, 0.35, 0.28), rot=(0, math.radians(55), math.radians(20)), material=MODULE, verts=10))
    parts.append(cyl("Arm_B", 0.028, 0.85, (1.35, 0.62, 0.52), rot=(0, math.radians(115), math.radians(30)), material=MODULE, verts=10))

    # --- join + finish ---
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
    bpy.ops.object.camera_add(location=(9.5, -11, 6.5))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam
    d = target.location - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 45
    key = bpy.data.lights.new("K", "AREA")
    key.energy = 3200
    key.size = 12
    ko = bpy.data.objects.new("K", key)
    bpy.context.collection.objects.link(ko)
    ko.location = (9, -7, 12)
    ko.rotation_euler = (math.radians(42), 0, math.radians(38))
    rim = bpy.data.lights.new("R", "AREA")
    rim.energy = 1600
    rim.size = 9
    rim.color = (0.5, 0.65, 1.0)
    ro = bpy.data.objects.new("R", rim)
    bpy.context.collection.objects.link(ro)
    ro.location = (-10, 8, 5)
    ro.rotation_euler = (math.radians(-50), 0, math.radians(-130))
    return cam


def main():
    reset_scene()
    make_materials()
    iss = build()
    cam = setup_camera_lights(iss)
    bpy.context.scene.render.filepath = "/tmp/iss-v2-hero.png"
    bpy.ops.render.render(write_still=True)
    # top plan view — checks the 8-wing layout + module stack proportions
    cam.location = (0, 0, 16)
    cam.rotation_euler = (0, 0, 0)
    bpy.context.scene.render.filepath = "/tmp/iss-v2-top.png"
    bpy.ops.render.render(write_still=True)
    os.makedirs(os.path.dirname(PUBLIC_GLB), exist_ok=True)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj is iss)
    bpy.context.view_layer.objects.active = iss
    bpy.ops.export_scene.gltf(filepath=PUBLIC_GLB, export_format="GLB",
                              use_selection=True, export_yup=True, export_apply=True)
    import shutil
    shutil.copyfile(PUBLIC_GLB, SRC_GLB)
    print("ISS_BUILD_OK dims=%s bytes=%d" % (
        tuple(round(d, 2) for d in iss.dimensions), os.path.getsize(PUBLIC_GLB)))


if __name__ == "__main__":
    main()
