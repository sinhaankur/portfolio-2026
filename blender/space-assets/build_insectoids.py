"""
Build the INSECTOID faction — second enemy visual language (concept b).

Segmented gunmetal bodies, red eye clusters, mandible tusks, blade legs.
Not yet wired into the game (enemies.ts still spawns the corporate fleet);
these GLBs land in public/models/ ready for faction wiring.

  insectoid-drone   ~2.1 long — fighter-scale segmented hunter
  insectoid-queen   ~5.5 long — boss-scale, spiked carapace, 8 legs

+Y-forward, origin-centred, export_yup=True (same basis as the fleet).

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_insectoids.py
"""

import bpy
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
MODELS = os.path.join(REPO, "public", "models")
FWD = (math.radians(-90), 0, 0)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        sc.render.engine = "BLENDER_EEVEE"
    if hasattr(sc, "eevee"):
        sc.eevee.taa_render_samples = 32
    sc.render.resolution_x = 900
    sc.render.resolution_y = 700
    sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.02, 0.022, 0.03, 1.0)


MATS = {}


def mat(name, base, metallic=0.0, rough=0.5, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return m


def make_materials():
    MATS["SHELL"] = mat("Shell", (0.16, 0.17, 0.185), metallic=0.45, rough=0.38)
    MATS["SHELL_DARK"] = mat("ShellDark", (0.08, 0.085, 0.10), metallic=0.6, rough=0.42)
    MATS["EYE"] = mat("Eye", (0.05, 0.01, 0.01), rough=0.3, emit=(1.0, 0.07, 0.04), emit_strength=9.0)
    MATS["VENT"] = mat("Vent", (0.08, 0.01, 0.01), rough=0.3, emit=(1.0, 0.15, 0.07), emit_strength=10.0)


def add_mat(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)


def sph(name, r, loc, m, scale=None, seg=22):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=seg // 2)
    o = bpy.context.active_object
    o.name = name
    if scale:
        o.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in o.data.polygons:
        p.use_smooth = True
    add_mat(o, m)
    return o


def cone(name, r1, r2, depth, loc, rot=(0, 0, 0), m=None, verts=12):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    for p in o.data.polygons:
        p.use_smooth = True
    if m:
        add_mat(o, m)
    return o


def cyl(name, r, depth, loc, rot=(0, 0, 0), m=None, verts=14):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    for p in o.data.polygons:
        p.use_smooth = True
    if m:
        add_mat(o, m)
    return o


def build_drone():
    S, D, E, V = MATS["SHELL"], MATS["SHELL_DARK"], MATS["EYE"], MATS["VENT"]
    sph("Head", 0.32, (0, 0.62, 0), S, scale=(1, 1.15, 0.9))
    sph("Thorax", 0.40, (0, 0.05, 0), S, scale=(1, 1.2, 0.85))
    sph("Abdomen", 0.34, (0, -0.55, 0.02), S, scale=(1, 1.35, 0.8))
    sph("Tail", 0.20, (0, -1.0, 0.05), D)
    sph("EyeC", 0.08, (0, 0.95, 0.06), E, seg=12)
    for s in (-1, 1):
        sph(f"Eye_{s}", 0.065, (s * 0.15, 0.90, 0.0), E, seg=12)
        cone(f"Mandible_{s}", 0.075, 0.01, 0.5, (s * 0.20, 1.0, -0.10),
             rot=(math.radians(-65), 0, -s * 0.35), m=D)
        for i, y in enumerate((0.35, 0.0, -0.35)):
            cone(f"Leg_{s}_{i}", 0.06, 0.01, 0.75, (s * 0.35, y, -0.18),
                 rot=(0, s * math.radians(112), 0), m=D)
        sph(f"WingCase_{s}", 0.16, (s * 0.28, -0.35, 0.20), D, scale=(0.6, 1.6, 0.4))
    cyl("Vent", 0.09, 0.06, (0, -1.13, 0.05), rot=FWD, m=V)
    return "insectoid-drone"


def build_queen():
    S, D, E, V = MATS["SHELL"], MATS["SHELL_DARK"], MATS["EYE"], MATS["VENT"]
    sph("Head", 0.68, (0, 1.85, 0), S, scale=(1, 1.1, 0.85))
    sph("Thorax", 1.02, (0, 0.75, 0.05), S, scale=(1, 1.15, 0.8))
    sph("Abdomen", 1.30, (0, -1.05, 0.12), S, scale=(1, 1.35, 0.85))
    sph("TailTip", 0.45, (0, -2.45, 0.15), D)
    sph("EyeC", 0.14, (0, 2.48, 0.12), E, seg=12)
    for s in (-1, 1):
        sph(f"EyeA_{s}", 0.115, (s * 0.26, 2.42, 0.04), E, seg=12)
        sph(f"EyeB_{s}", 0.09, (s * 0.44, 2.30, -0.04), E, seg=12)
        cone(f"Tusk_{s}", 0.13, 0.02, 1.1, (s * 0.42, 2.55, -0.22),
             rot=(math.radians(-62), 0, -s * 0.28), m=D)
        for i, y in enumerate((1.45, 0.85, 0.25, -0.5)):
            cone(f"Leg_{s}_{i}", 0.15, 0.015, 1.9, (s * 0.85, y, -0.32),
                 rot=(0, s * math.radians(112), 0), m=D)
        sph(f"Carapace_{s}", 0.5, (s * 0.55, -0.9, 0.55), D, scale=(0.7, 1.8, 0.35))
    for y, z in ((1.35, 0.75), (0.75, 0.92), (0.0, 1.0), (-0.9, 1.25), (-1.8, 1.05)):
        cone(f"Spike_{y}", 0.15, 0.015, 0.8, (0, y, z), m=D)
    for s in (-1, 1):
        cyl(f"Vent_{s}", 0.16, 0.08, (s * 0.45, -2.6, 0.1), rot=FWD, m=V)
    return "insectoid-queen"


def finish_and_export(name):
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    for o in objs:
        o.select_set(False)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        o.select_set(True)
    bpy.ops.object.join()
    ship = bpy.context.active_object
    ship.name = name
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    ship.location = (0, 0, 0)
    path = os.path.join(MODELS, f"{name}.glb")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj is ship)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_yup=True, export_apply=True)
    print(f"INSECTOID_BUILD_OK {name} dims={tuple(round(d, 2) for d in ship.dimensions)} bytes={os.path.getsize(path)}")
    return ship


def render_quarter(ship, name):
    size = max(ship.dimensions)
    dist = size * 1.9
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (dist * 0.7, dist * 0.7, dist * 0.4)
    con = cam.constraints.new("TRACK_TO")
    con.target = ship
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    key = bpy.data.lights.new("key", "SUN")
    key.energy = 6.0
    key.color = (1.0, 0.95, 0.85)
    ko = bpy.data.objects.new("key", key)
    ko.location = (dist, dist, dist)
    bpy.context.collection.objects.link(ko)
    kc = ko.constraints.new("TRACK_TO")
    kc.target = ship
    kc.track_axis = "TRACK_NEGATIVE_Z"
    kc.up_axis = "UP_Y"
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 700 * size
    fill.size = size * 2
    fill.color = (0.7, 0.8, 1.0)
    fo = bpy.data.objects.new("fill", fill)
    fo.location = (-dist, dist * 0.5, dist * 0.5)
    bpy.context.collection.objects.link(fo)
    fc = fo.constraints.new("TRACK_TO")
    fc.target = ship
    fc.track_axis = "TRACK_NEGATIVE_Z"
    fc.up_axis = "UP_Y"
    bpy.context.scene.render.filepath = f"/tmp/{name}-quarter.png"
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED /tmp/{name}-quarter.png")


def main():
    for builder in (build_drone, build_queen):
        reset_scene()
        make_materials()
        name = builder()
        ship = finish_and_export(name)
        render_quarter(ship, name)
    print("INSECTOIDS_DONE")


if __name__ == "__main__":
    main()
