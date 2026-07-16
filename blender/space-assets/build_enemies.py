"""
Build the Star Cleaver enemy fleet — corporate angular language, v2.

Replaces the original box-art enemy GLBs with the picked concept direction:
cold corporate grey, faceted chamfered wedges, glowing red eye slits and
engines. Four classes, each matched to the ORIGINAL model's overall raw
dimensions so the in-game normalisation ((radius / 0.8) * 0.6 in
game-canvas.tsx) and perceived mass stay the same:

  fighter  span 4.0 x len 2.4  (was 4.10 x 2.29 x 2.00)
  sniper   0.7 x len 4.0       (was 0.67 x 3.95 x 0.84) — rail needle
  swarm    ~0.7 dart           (was 0.72 x 0.64 x 0.63)
  boss     2.6 x len 5.4       (was 2.64 x 5.53 x 1.54) — chamfered slab

All modelled +Y-forward (same basis as the player ship — they reuse
SHIP_MODEL_BASIS_ROTATION) and exported origin-centred; the old sniper/boss
GLBs were off-centre, so this pass also improves hitbox/visual alignment.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_enemies.py

Outputs:
  <repo>/public/models/enemy-{fighter,sniper,swarm,boss}.glb
  /tmp/enemy-<class>-quarter.png     per-class verification render
"""

import bpy
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
MODELS = os.path.join(REPO, "public", "models")
FWD = (math.radians(-90), 0, 0)  # +Z primitive axis -> +Y (forward)


# ---------------------------------------------------------------- scene setup
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
    # corporate palette: readable cold grey (never black-on-black against the
    # void — concept-round lesson), darker facet panels, red eyes/engines
    MATS["CORP"] = mat("Corp", (0.22, 0.235, 0.27), metallic=0.6, rough=0.42)
    MATS["CORP_DARK"] = mat("CorpDark", (0.09, 0.10, 0.125), metallic=0.75, rough=0.4)
    MATS["EYE"] = mat("Eye", (0.05, 0.01, 0.01), rough=0.3, emit=(1.0, 0.07, 0.04), emit_strength=9.0)
    MATS["ENGINE"] = mat("EngineR", (0.08, 0.01, 0.01), rough=0.3, emit=(1.0, 0.12, 0.06), emit_strength=14.0)
    MATS["COIL"] = mat("Coil", (0.05, 0.02, 0.02), metallic=0.4, rough=0.35, emit=(1.0, 0.15, 0.08), emit_strength=4.0)


def add_mat(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)


# ---------------------------------------------------------------- primitives
def cube(name, size=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0), material=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel > 0:
        bm = o.modifiers.new("bevel", "BEVEL")
        bm.width = bevel
        bm.segments = 1
        bm.limit_method = "ANGLE"
    if material:
        add_mat(o, material)
    return o


def cyl(name, r=0.5, depth=1.0, loc=(0, 0, 0), rot=(0, 0, 0), material=None, verts=18):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if material:
        add_mat(o, material)
    return o


def cone(name, r1=0.5, r2=0.0, depth=1.0, loc=(0, 0, 0), rot=(0, 0, 0), material=None, verts=18, squash=1.0):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if squash != 1.0:
        # flatten vertically AFTER the rotation — turns the 4-vert diamond
        # cross-section into a proper flat ship wedge instead of a kite
        o.scale = (1.0, 1.0, squash)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        add_mat(o, material)
    return o


def torus(name, major, minor, loc, rot=(0, 0, 0), material=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc,
                                     rotation=rot, major_segments=20, minor_segments=8)
    o = bpy.context.active_object
    o.name = name
    if material:
        add_mat(o, material)
    return o


# ---------------------------------------------------------------- classes
def build_fighter():
    """Faceted attack wedge — span 4.0, length 2.4. The workhorse hostile."""
    C, D, E, EN = MATS["CORP"], MATS["CORP_DARK"], MATS["EYE"], MATS["ENGINE"]
    parts = [cube("Hull", (1.0, 1.9, 0.5), (0, -0.15, 0), material=C, bevel=0.14)]
    parts.append(cone("Nose", r1=0.50, r2=0.06, depth=0.85, loc=(0, 1.1, 0),
                      rot=(math.radians(-90), 0, math.radians(45)), material=C, verts=4, squash=0.5))
    parts.append(cube("EyeSlit", (0.44, 0.06, 0.09), (0, 0.66, 0.22), material=E, bevel=0.01))
    parts.append(cube("DorsalPlate", (0.55, 0.9, 0.08), (0, -0.35, 0.26), material=D, bevel=0.03))
    parts.append(cube("GunPod", (0.28, 0.8, 0.20), (0, 0.35, -0.28), material=D, bevel=0.05))
    parts.append(cyl("Gun", r=0.05, depth=0.9, loc=(0, 0.95, -0.28), rot=FWD, material=D, verts=10))
    parts.append(cube("VentralFin", (0.06, 0.5, 0.30), (0, -0.75, -0.35), material=C, bevel=0.02))
    for s in (-1, 1):
        parts.append(cube(f"Wing_{s}", (1.65, 0.95, 0.07), (s * 1.15, -0.35, 0),
                          rot=(0, s * math.radians(8), -s * math.radians(18)), material=C, bevel=0.03))
        parts.append(cube(f"WingEdge_{s}", (1.5, 0.16, 0.085), (s * 1.2, -0.72, -0.16),
                          rot=(0, s * math.radians(8), -s * math.radians(18)), material=D))
        parts.append(cube(f"Fin_{s}", (0.06, 0.5, 0.42), (s * 1.82, -0.62, -0.06), material=C, bevel=0.02))
        parts.append(cube(f"FinTip_{s}", (0.07, 0.14, 0.10), (s * 1.82, -0.55, 0.16), material=E))
        parts.append(cyl(f"Engine_{s}", r=0.16, depth=0.5, loc=(s * 0.35, -1.05, 0), rot=FWD, material=D))
        parts.append(cyl(f"Glow_{s}", r=0.11, depth=0.07, loc=(s * 0.35, -1.32, 0), rot=FWD, material=EN, verts=14))
    return parts


def build_sniper():
    """Rail needle — 0.7 wide, 4.0 long. All barrel, red charging coils."""
    C, D, E, EN, CO = MATS["CORP"], MATS["CORP_DARK"], MATS["EYE"], MATS["ENGINE"], MATS["COIL"]
    parts = [cube("Spine", (0.30, 2.5, 0.30), (0, -0.45, 0), material=C, bevel=0.08)]
    parts.append(cyl("Rail", r=0.075, depth=1.6, loc=(0, 1.1, 0.02), rot=FWD, material=D, verts=12))
    parts.append(cone("Muzzle", r1=0.10, r2=0.03, depth=0.25, loc=(0, 2.0, 0.02), rot=FWD, material=D, verts=10))
    for i, y in enumerate((0.5, 0.95, 1.4)):
        parts.append(torus(f"Coil_{i}", 0.14, 0.032, (0, y, 0.02), rot=(math.radians(90), 0, 0), material=CO))
    parts.append(cube("Head", (0.55, 0.85, 0.55), (0, -1.3, 0.05), material=C, bevel=0.12))
    parts.append(cube("EyeSlit", (0.34, 0.06, 0.09), (0, -0.87, 0.20), material=E, bevel=0.01))
    for s in (-1, 1):
        parts.append(cube(f"Fin_{s}", (0.24, 0.45, 0.05), (s * 0.26, -1.25, -0.1),
                          rot=(0, -s * math.radians(20), 0), material=C, bevel=0.02))
    parts.append(cyl("Engine", r=0.14, depth=0.3, loc=(0, -1.8, 0.05), rot=FWD, material=D))
    parts.append(cyl("Glow", r=0.10, depth=0.06, loc=(0, -1.97, 0.05), rot=FWD, material=EN, verts=14))
    return parts


def build_swarm():
    """Tiny faceted dart, ~0.7. Reads as an angry red-eyed chip of metal."""
    C, D, E, EN = MATS["CORP"], MATS["CORP_DARK"], MATS["EYE"], MATS["ENGINE"]
    parts = [cone("Body", r1=0.22, r2=0.03, depth=0.38, loc=(0, 0.15, 0),
                  rot=(math.radians(-90), 0, math.radians(45)), material=C, verts=4, squash=0.85)]
    parts.append(cone("BodyAft", r1=0.19, r2=0.06, depth=0.26, loc=(0, -0.17, 0),
                      rot=(math.radians(90), 0, math.radians(45)), material=D, verts=4, squash=0.85))
    parts.append(cube("Core", (0.24, 0.22, 0.20), (0, -0.02, 0), material=D, bevel=0.04))
    parts.append(cube("TopFin", (0.025, 0.15, 0.13), (0, -0.10, 0.16), material=C))
    parts.append(cube("Eye", (0.07, 0.05, 0.05), (0, 0.21, 0.06), material=E))
    for s in (-1, 1):
        parts.append(cube(f"Fin_{s}", (0.15, 0.16, 0.025), (s * 0.23, -0.10, 0),
                          rot=(0, 0, -s * math.radians(22)), material=C))
    parts.append(cyl("Glow", r=0.05, depth=0.05, loc=(0, -0.33, 0), rot=FWD, material=EN, verts=12))
    return parts


def build_boss():
    """Chamfered command slab — 2.6 x 5.4. Eye row, turrets, triple engines."""
    C, D, E, EN = MATS["CORP"], MATS["CORP_DARK"], MATS["EYE"], MATS["ENGINE"]
    parts = [cube("Slab", (1.8, 4.0, 0.9), (0, -0.55, 0), material=C, bevel=0.20)]
    parts.append(cone("Prow", r1=0.68, r2=0.10, depth=1.3, loc=(0, 2.0, 0),
                      rot=(math.radians(-90), 0, math.radians(45)), material=C, verts=4, squash=0.55))
    parts.append(cube("Tower", (0.8, 1.0, 0.55), (0, -1.5, 0.65), material=C, bevel=0.10))
    parts.append(cube("TowerEye", (0.5, 0.05, 0.10), (0, -0.99, 0.72), material=E, bevel=0.01))
    for i in range(5):
        x = -0.52 + i * 0.26
        parts.append(cube(f"Eye_{i}", (0.14, 0.06, 0.10), (x, 1.28, 0.42), material=E, bevel=0.01))
    for s in (-1, 1):
        parts.append(cube(f"Sponson_{s}", (0.42, 2.3, 0.5), (s * 1.05, -0.4, -0.08), material=C, bevel=0.10))
        parts.append(cube(f"SponsonEdge_{s}", (0.44, 2.32, 0.06), (s * 1.05, -0.4, 0.20), material=D))
        for y in (0.6, -0.3, -1.2):
            parts.append(cyl(f"Turret_{s}_{y}", r=0.15, depth=0.18, loc=(s * 0.55, y, 0.52), material=D, verts=12))
            parts.append(cyl(f"Barrel_{s}_{y}", r=0.035, depth=0.45, loc=(s * 0.55, y + 0.28, 0.56), rot=FWD, material=D, verts=8))
    parts.append(cube("Keel", (0.6, 2.6, 0.14), (0, -0.5, -0.5), material=D, bevel=0.04))
    for pos in ((0.55, 0.0), (-0.55, 0.0), (0.0, 0.3)):
        parts.append(cyl(f"EngineHous_{pos[0]}_{pos[1]}", r=0.24, depth=0.4, loc=(pos[0], -2.6, pos[1]), rot=FWD, material=D))
        parts.append(cyl(f"Glow_{pos[0]}_{pos[1]}", r=0.17, depth=0.08, loc=(pos[0], -2.83, pos[1]), rot=FWD, material=EN, verts=14))
    return parts


# ---------------------------------------------------------------- pipeline
def finish_and_export(parts, name):
    for p in parts:
        p.select_set(False)
    bpy.context.view_layer.objects.active = parts[0]
    for p in parts:
        p.select_set(True)
    bpy.ops.object.join()
    ship = bpy.context.active_object
    ship.name = name
    for mod in list(ship.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            pass
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    ship.location = (0, 0, 0)
    path = os.path.join(MODELS, f"{name}.glb")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj is ship)
    bpy.context.view_layer.objects.active = ship
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_yup=True, export_apply=True)
    dims = tuple(round(d, 2) for d in ship.dimensions)
    print(f"ENEMY_BUILD_OK {name} dims={dims} bytes={os.path.getsize(path)}")
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
    key.energy = 5.5
    key.color = (1.0, 0.95, 0.85)
    ko = bpy.data.objects.new("key", key)
    ko.location = (dist, dist, dist)
    bpy.context.collection.objects.link(ko)
    kc = ko.constraints.new("TRACK_TO")
    kc.target = ship
    kc.track_axis = "TRACK_NEGATIVE_Z"
    kc.up_axis = "UP_Y"
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 650 * size
    fill.size = size * 2
    fill.color = (0.7, 0.8, 1.0)
    fo = bpy.data.objects.new("fill", fill)
    fo.location = (-dist, dist * 0.5, dist * 0.5)
    bpy.context.collection.objects.link(fo)
    fc = fo.constraints.new("TRACK_TO")
    fc.target = ship
    fc.track_axis = "TRACK_NEGATIVE_Z"
    fc.up_axis = "UP_Y"
    bpy.context.scene.render.filepath = f"/tmp/enemy-{name}-quarter.png"
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED /tmp/enemy-{name}-quarter.png")


CLASSES = {
    "enemy-fighter": build_fighter,
    "enemy-sniper": build_sniper,
    "enemy-swarm": build_swarm,
    "enemy-boss": build_boss,
}


def main():
    for name, builder in CLASSES.items():
        reset_scene()
        make_materials()
        parts = builder()
        ship = finish_and_export(parts, name)
        render_quarter(ship, name.replace("enemy-", ""))
    print("ENEMIES_BUILD_DONE")


if __name__ == "__main__":
    main()
