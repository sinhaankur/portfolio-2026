"""
Build the two NEW selectable player ships — falcon family with the Peregrine:

  KESTREL    forward-swept interceptor. Slim needle fuselage, swept-forward
             wings + canards, twin canted tails, quad micro-nozzle cluster.
             Fast + fragile.
  GYRFALCON  twin-hull gunship. Two parallel hulls with 4-vert wedge noses,
             centre spine cockpit, chin guns + dorsal turret, four engines
             (vertical pair per hull). Slow + heavy-hitting.

Same fleet palette + conventions as build_peregrine.py: +Y-forward, origin
recentred, export_yup=True (arrives nose -Z in three-space, basis rotation
[0,0,0]). Prints <NAME>_BUILD_OK with dims and exhaust positions in FINAL GLB
space — wire SHIP_THRUSTER_PRESETS from those numbers, never hand-guessed.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_new_ships.py

Outputs:
  <repo>/public/models/{kestrel,gyrfalcon}.glb
  /tmp/{kestrel,gyrfalcon}-hero.png + -rear.png
"""

import bpy
import bmesh
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
MODELS = os.path.join(REPO, "public", "models")
FWD = (math.radians(90), 0, 0)  # cylinder +Z -> body along Y


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
        bg.inputs[0].default_value = (0.022, 0.028, 0.045, 1.0)


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
    MATS["HULL"] = mat("Hull", (0.52, 0.55, 0.60), metallic=0.65, rough=0.38)
    MATS["HULL_DARK"] = mat("HullDark", (0.10, 0.115, 0.145), metallic=0.8, rough=0.42)
    MATS["ACCENT"] = mat("Accent", (0.85, 0.28, 0.18), metallic=0.5, rough=0.4)
    MATS["CANOPY"] = mat("Canopy", (0.03, 0.10, 0.16), metallic=0.1, rough=0.06,
                         emit=(0.15, 0.55, 0.8), emit_strength=1.1)
    MATS["ENGINE"] = mat("Engine", (0.2, 0.7, 1.0), rough=0.3, emit=(0.25, 0.75, 1.0), emit_strength=18.0)
    MATS["NAV_PORT"] = mat("NavPort", (0.3, 0.02, 0.02), rough=0.3, emit=(1.0, 0.08, 0.05), emit_strength=6.0)
    MATS["NAV_STBD"] = mat("NavStbd", (0.02, 0.3, 0.05), rough=0.3, emit=(0.1, 1.0, 0.25), emit_strength=6.0)


def add_mat(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)


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
        bm.segments = 2
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


def cone(name, r1=0.5, r2=0.0, depth=1.0, loc=(0, 0, 0), rot=(0, 0, 0), material=None, verts=18, squash=1.0, spin=0.0):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    if spin:
        # spin about the cone's OWN axis first (Blender euler XYZ applies Z
        # last, so folding this into `rot` tilts the axis instead)
        o.rotation_euler = (0, 0, spin)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if squash != 1.0:
        o.scale = (1.0, 1.0, squash)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        add_mat(o, material)
    return o


def tapered_fuselage(name, half_w, half_h, length, cy, taper_start, taper_x, taper_z, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, cy, 0))
    fus = bpy.context.active_object
    fus.name = name
    fus.scale = (half_w * 2, length, half_h * 2)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    me = fus.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=7, use_grid_fill=True)
    for v in bm.verts:
        f = (v.co.y + length / 2) / length
        if f > taper_start:
            t = (f - taper_start) / (1.0 - taper_start)
            v.co.x *= 1.0 - t * taper_x
            v.co.z *= 1.0 - t * taper_z
        elif f < 0.12:
            v.co.x *= 0.90
            v.co.z *= 0.92
    bm.to_mesh(me)
    bm.free()
    add_mat(fus, material)
    bmod = fus.modifiers.new("bevel", "BEVEL")
    bmod.width = 0.03
    bmod.segments = 1
    bmod.limit_method = "ANGLE"
    return fus


EXHAUSTS = []


def build_kestrel():
    HULL, D, A, CAN, EN = MATS["HULL"], MATS["HULL_DARK"], MATS["ACCENT"], MATS["CANOPY"], MATS["ENGINE"]
    parts = [tapered_fuselage("Fuselage", 0.17, 0.15, 3.8, 0.15, 0.50, 0.88, 0.55, HULL)]
    # canopy well forward — interceptor sightlines
    canopy = cube("Canopy", size=(0.24, 0.7, 0.20), loc=(0, 0.75, 0.16), material=CAN, bevel=0.05)
    me = canopy.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for v in bm.verts:
        if v.co.y > 0.15:
            v.co.z *= 0.35
    bm.to_mesh(me)
    bm.free()
    parts.append(canopy)
    parts.append(cube("Spine", (0.14, 1.4, 0.08), (0, -0.5, 0.14), material=D, bevel=0.02))
    parts.append(cube("Stripe", (0.12, 1.6, 0.03), (0, 0.1, 0.155), material=A, bevel=0.01))
    parts.append(cone("Probe", r1=0.03, r2=0.0, depth=0.3, loc=(0, 2.2, 0),
                      rot=(math.radians(-90), 0, 0), material=D, verts=10))
    # forward-swept wings: thin boxes, tips ahead of roots, chord tapers outboard
    for s in (-1, 1):
        wing = cube(f"Wing_{s}", (1.7, 0.62, 0.05), (s * 0.95, -0.55, 0),
                    rot=(0, 0, s * math.radians(24)), material=HULL, bevel=0.02)
        me = wing.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=3, use_grid_fill=True)
        for v in bm.verts:
            xo = max(0.0, min(1.0, (s * v.co.x + 0.85) / 1.7))
            v.co.y *= (1.0 - xo * 0.35)
            v.co.z *= (1.0 - xo * 0.30)
        bm.to_mesh(me)
        bm.free()
        parts.append(wing)
        parts.append(cube(f"WingBand_{s}", (0.09, 0.4, 0.06), (s * 1.35, -0.30, 0),
                          rot=(0, 0, s * math.radians(24)), material=A))
        parts.append(cube(f"Canard_{s}", (0.55, 0.24, 0.035), (s * 0.35, 1.3, 0.02),
                          rot=(0, 0, s * math.radians(18)), material=HULL, bevel=0.015))
        parts.append(cyl(f"TipGun_{s}", r=0.035, depth=0.9, loc=(s * 1.62, 0.35, 0.0),
                         rot=FWD, material=D, verts=12))
        # canted twin tails
        parts.append(cube(f"Tail_{s}", (0.05, 0.5, 0.42), (s * 0.22, -1.55, 0.26),
                          rot=(0, s * math.radians(-22), 0), material=HULL, bevel=0.015))
        parts.append(cyl(f"NavLight_{s}", r=0.028, depth=0.04, loc=(s * 1.68, 0.0, 0.03),
                         material=MATS["NAV_PORT"] if s < 0 else MATS["NAV_STBD"], verts=10))
    # quad micro-nozzle cluster in a housing block at the tail
    parts.append(cube("NozzleBlock", (0.42, 0.5, 0.38), (0, -1.75, 0), material=D, bevel=0.06))
    for sx in (-1, 1):
        for sz in (-1, 1):
            parts.append(cyl(f"Nozzle_{sx}_{sz}", r=0.075, depth=0.22,
                             loc=(sx * 0.14, -2.02, sz * 0.10), rot=FWD, material=D, verts=14))
            core_y = -2.13
            parts.append(cyl(f"Core_{sx}_{sz}", r=0.055, depth=0.06,
                             loc=(sx * 0.14, core_y, sz * 0.10), rot=FWD, material=EN, verts=14))
            EXHAUSTS.append([sx * 0.14, core_y, sz * 0.10])
    return parts


def build_gyrfalcon():
    HULL, D, A, CAN, EN = MATS["HULL"], MATS["HULL_DARK"], MATS["ACCENT"], MATS["CANOPY"], MATS["ENGINE"]
    parts = []
    for s in (-1, 1):
        parts.append(cube(f"Hull_{s}", (0.52, 3.1, 0.6), (s * 0.62, -0.1, 0), material=HULL, bevel=0.09))
        parts.append(cone(f"Nose_{s}", r1=0.40, r2=0.05, depth=0.9, loc=(s * 0.62, 1.85, 0),
                          rot=(math.radians(-90), 0, 0), spin=math.radians(45),
                          material=HULL, verts=4, squash=0.6))
        parts.append(cube(f"HullPlate_{s}", (0.30, 1.6, 0.07), (s * 0.62, -0.4, 0.29), material=D, bevel=0.02))
        parts.append(cyl(f"ChinGun_{s}", r=0.07, depth=1.4, loc=(s * 0.48, 2.15, -0.16),
                         rot=FWD, material=D, verts=12))
        # four engines: vertical pair per hull — matches the quad thruster FX
        for sz in (-1, 1):
            parts.append(cyl(f"Engine_{s}_{sz}", r=0.15, depth=0.55, loc=(s * 0.62, -1.75, sz * 0.14),
                             rot=FWD, material=D, verts=14))
            core_y = -2.06
            parts.append(cyl(f"Core_{s}_{sz}", r=0.105, depth=0.07, loc=(s * 0.62, core_y, sz * 0.14),
                             rot=FWD, material=EN, verts=14))
            EXHAUSTS.append([s * 0.62, core_y, sz * 0.14])
        parts.append(cyl(f"NavLight_{s}", r=0.03, depth=0.045, loc=(s * 0.90, 0.4, 0.31),
                         material=MATS["NAV_PORT"] if s < 0 else MATS["NAV_STBD"], verts=10))
    # centre spine + forward cockpit
    parts.append(cube("Spine", (0.52, 2.0, 0.38), (0, 0.0, 0.28), material=HULL, bevel=0.07))
    parts.append(cube("Cockpit", (0.44, 0.62, 0.30), (0, 1.15, 0.36), material=HULL, bevel=0.06))
    canopy = cube("Canopy", size=(0.30, 0.55, 0.22), loc=(0, 1.35, 0.52), material=CAN, bevel=0.05)
    me = canopy.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for v in bm.verts:
        if v.co.y > 0.1:
            v.co.z *= 0.4
    bm.to_mesh(me)
    bm.free()
    parts.append(canopy)
    parts.append(cube("Stripe", (0.4, 1.2, 0.03), (0, -0.35, 0.485), material=A, bevel=0.01))
    # cross struts tying the hulls
    parts.append(cube("Strut_A", (1.75, 0.38, 0.18), (0, -1.05, 0.10), material=D, bevel=0.03))
    parts.append(cube("Strut_B", (1.75, 0.38, 0.18), (0, 0.75, 0.10), material=D, bevel=0.03))
    # dorsal turret on the spine
    parts.append(cyl("Turret", r=0.17, depth=0.16, loc=(0, -0.7, 0.52), material=D, verts=14))
    parts.append(cyl("TurretGun", r=0.045, depth=0.8, loc=(0, -0.3, 0.56), rot=FWD, material=D, verts=10))
    # belly keel
    parts.append(cube("Keel", (0.3, 1.6, 0.08), (0, -0.4, -0.33), material=D, bevel=0.02))
    return parts


def finish(name):
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    for o in objs:
        o.select_set(False)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        o.select_set(True)
    bpy.ops.object.join()
    ship = bpy.context.active_object
    ship.name = name
    for mod in list(ship.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            pass
    bpy.ops.object.shade_smooth()
    try:
        ship.data.use_auto_smooth = True
        ship.data.auto_smooth_angle = math.radians(35)
    except Exception:
        pass
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    shift = tuple(ship.location)
    ship.location = (0, 0, 0)
    for e in EXHAUSTS:
        e[0] -= shift[0]
        e[1] -= shift[1]
        e[2] -= shift[2]
    # recentre x/z on the exhaust-cluster mean so the quad thruster FX preset
    # (symmetric ±lateral/±vertical) lands exactly on the nozzles
    if EXHAUSTS:
        from mathutils import Matrix
        cx = sum(e[0] for e in EXHAUSTS) / len(EXHAUSTS)
        cz = sum(e[2] for e in EXHAUSTS) / len(EXHAUSTS)
        ship.data.transform(Matrix.Translation((-cx, 0, -cz)))
        for e in EXHAUSTS:
            e[0] -= cx
            e[2] -= cz
    path = os.path.join(MODELS, f"{name}.glb")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj is ship)
    bpy.context.view_layer.objects.active = ship
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_yup=True, export_apply=True)
    return ship, path


def render_views(ship, name):
    bpy.ops.object.camera_add(location=(5.9, 6.9, 3.6))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam
    dv = ship.location - cam.location
    cam.rotation_euler = dv.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 55
    key = bpy.data.lights.new("Key", "AREA")
    key.energy = 1600
    key.size = 7
    ko = bpy.data.objects.new("Key", key)
    bpy.context.collection.objects.link(ko)
    ko.location = (5, 4, 7)
    ko.rotation_euler = (math.radians(-40), 0, math.radians(145))
    rim = bpy.data.lights.new("Rim", "AREA")
    rim.energy = 1000
    rim.size = 5
    rim.color = (0.4, 0.6, 1.0)
    ro = bpy.data.objects.new("Rim", rim)
    bpy.context.collection.objects.link(ro)
    ro.location = (-6, -5, 3)
    ro.rotation_euler = (math.radians(60), 0, math.radians(30))
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 450
    fill.size = 8
    fo = bpy.data.objects.new("Fill", fill)
    bpy.context.collection.objects.link(fo)
    fo.location = (-3, 5, 2)
    fo.rotation_euler = (math.radians(-65), 0, math.radians(-140))
    bpy.context.scene.render.filepath = f"/tmp/{name}-hero.png"
    bpy.ops.render.render(write_still=True)
    cam.location = (2.6, -6.6, 2.2)
    dv = ship.location - cam.location
    cam.rotation_euler = dv.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.render.filepath = f"/tmp/{name}-rear.png"
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED /tmp/{name}-hero.png + -rear.png")


def run(name, builder):
    global EXHAUSTS
    EXHAUSTS = []
    reset_scene()
    make_materials()
    builder()
    ship, path = finish(name)
    render_views(ship, name)
    blender_ex = [tuple(round(c, 3) for c in e) for e in EXHAUSTS]
    three_ex = [(round(e[0], 3), round(e[2], 3), round(-e[1], 3)) for e in EXHAUSTS]
    print("%s_BUILD_OK dims=%s bytes=%d exhausts_blender=%s exhausts_three=%s" % (
        name.upper(), tuple(round(d, 3) for d in ship.dimensions),
        os.path.getsize(path), blender_ex, three_ex))


def main():
    run("kestrel", build_kestrel)
    run("gyrfalcon", build_gyrfalcon)
    print("NEW_SHIPS_DONE")


if __name__ == "__main__":
    main()
