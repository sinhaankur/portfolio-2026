"""
Build the Star Cleaver player ship — the "Vanguard Mk II" quad-blade interceptor.

An ORIGINAL starfighter design (not derived from any existing/licensed craft):
a tapered delta cockpit pod with four swept blade-wings in an X-stance, twin
emissive engine cores at the tail, wingtip cannon emitters, a chin intake, a
V-tail, and panel greebles across the hull. Hero-grade detail — this is the
model the camera lives behind for the whole game.

Silhouette, rear three-quarter (nose points +Y forward):

        \\    ▲    //       <- upper blade pair, swept back, tips up
         \\  /█\\  //        <- delta pod, glass canopy (HUD glow)
     ◉━━━ ==█████== ━━━◉    <- wingtip cannons (emissive red tips)
         //  \\█//  \\
        //    ●●    \\      <- twin engine cores (emissive cyan, rear)
              V-tail

Modelled +Y-forward and exported with export_yup=True so it arrives nose -Z /
up +Y in three-space (matches games/star-cleaver/engine/player-ship-model.tsx,
which uses SHIP_MODEL_BASIS_ROTATION = [0,0,0]).

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_vanguard.py

Outputs:
  /tmp/vanguard-hero.png                    hero render (read back to verify)
  /tmp/vanguard-top.png                     top-down plan silhouette
  /tmp/vanguard-rear.png                    the in-game chase-camera view
  <repo>/public/models/vanguard.glb         the game-ready GLB
  <repo>/blender/space-assets/vanguard.glb  source-of-truth copy
"""

import bpy
import bmesh
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PUBLIC_GLB = os.path.join(REPO, "public", "models", "vanguard.glb")
SRC_GLB = os.path.join(REPO, "blender", "space-assets", "vanguard.glb")
HERO_PNG = "/tmp/vanguard-hero.png"


# ---------------------------------------------------------------- scene setup
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        sc.cycles.samples = 96
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x = 1024
    sc.render.resolution_y = 768
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.01, 0.015, 0.03, 1.0)
        bg.inputs[1].default_value = 1.0


# ---------------------------------------------------------------- materials
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


# Materials are created inside make_materials() AFTER the scene reset, because
# reset_scene() -> read_factory_settings wipes all datablocks (a material made
# before it would be a dangling StructRNA).
MATS = {}


def make_materials():
    # Two-tone hull: bright worked metal + dark structural panels, so the ship
    # reads with contrast even under the game's flat space lighting (the old
    # single-tone hull rendered as a featureless white slab in-engine).
    MATS["HULL"] = mat("Hull", (0.50, 0.53, 0.58), metallic=0.85, rough=0.32)
    MATS["HULL_DARK"] = mat("HullDark", (0.10, 0.115, 0.145), metallic=0.8, rough=0.42)
    MATS["ACCENT"] = mat("Accent", (0.85, 0.28, 0.18), metallic=0.5, rough=0.4)  # original palette
    # Canopy carries a faint cyan emission — the cockpit HUD glow — so the pod
    # reads alive from the chase camera, not just a dark bump.
    MATS["CANOPY"] = mat("Canopy", (0.03, 0.10, 0.16), metallic=0.1, rough=0.06,
                         emit=(0.15, 0.55, 0.8), emit_strength=1.1)
    MATS["ENGINE"] = mat("Engine", (0.2, 0.7, 1.0), rough=0.3, emit=(0.25, 0.75, 1.0), emit_strength=18.0)
    MATS["CANNON"] = mat("Cannon", (1.0, 0.25, 0.2), rough=0.4, emit=(1.0, 0.2, 0.15), emit_strength=10.0)


def add_mat(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)


# ---------------------------------------------------------------- primitives
def cube(name, size=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0), material=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel > 0:
        bm = o.modifiers.new("bevel", "BEVEL")
        bm.width = bevel
        bm.segments = 3
        bm.limit_method = "ANGLE"
    if material:
        add_mat(o, material)
    return o


def cyl(name, r=0.5, depth=1.0, loc=(0, 0, 0), rot=(0, 0, 0), material=None, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if material:
        add_mat(o, material)
    return o


def cone(name, r1=0.5, r2=0.0, depth=1.0, loc=(0, 0, 0), rot=(0, 0, 0), material=None, verts=20):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if material:
        add_mat(o, material)
    return o


# ---------------------------------------------------------------- build ship
def build():
    HULL, HULL_DARK, ACCENT = MATS["HULL"], MATS["HULL_DARK"], MATS["ACCENT"]
    CANOPY, ENGINE, CANNON = MATS["CANOPY"], MATS["ENGINE"], MATS["CANNON"]
    parts = []

    # --- central cockpit pod: a slim tapered delta. Nose = +Y.
    # Subdivided along its length so the FRONT half tapers to a true point
    # within the same mesh — no separate (floating) nose cone.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.15, 0))
    pod = bpy.context.active_object
    pod.name = "Pod"
    pod.scale = (0.34, 1.7, 0.26)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    me = pod.data
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=8, use_grid_fill=True)
    for v in bm.verts:
        f = (v.co.y - (-1.7)) / 3.4        # 0 at tail, 1 at nose (local space)
        if f > 0.5:
            t = (f - 0.5) / 0.5            # 0..1 across the front half
            taper = 1.0 - t * 0.94         # narrow to ~6% at the very nose
            v.co.x *= taper
            v.co.z *= (1.0 - t * 0.55)
        elif f < 0.15:                     # tail slight narrow
            v.co.x *= 0.85
    bm.to_mesh(me); bm.free()
    add_mat(pod, HULL)
    bmod = pod.modifiers.new("bevel", "BEVEL"); bmod.width = 0.03; bmod.segments = 2; bmod.limit_method = "ANGLE"
    parts.append(pod)

    # canopy — dark glass blister with HUD glow, sloped toward the nose
    canopy = cube("Canopy", size=(0.30, 0.78, 0.24), loc=(0, 0.55, 0.24), material=CANOPY, bevel=0.06)
    me = canopy.data
    bm = bmesh.new(); bm.from_mesh(me)
    for v in bm.verts:
        if v.co.y > 0.18:
            v.co.z *= 0.35         # slope the canopy down toward the nose
    bm.to_mesh(me); bm.free()
    parts.append(canopy)

    # dorsal spine — dark structural ridge running the aft deck
    parts.append(cube("Spine", size=(0.15, 1.25, 0.10), loc=(0, -0.55, 0.22),
                      material=HULL_DARK, bevel=0.03))
    # dorsal accent stripe over the spine
    parts.append(cube("Stripe", size=(0.07, 1.6, 0.018), loc=(0, -0.35, 0.285), material=ACCENT))

    # chin intake under the nose — breaks up the belly line
    parts.append(cube("Chin", size=(0.22, 0.55, 0.11), loc=(0, 0.62, -0.17),
                      material=HULL_DARK, bevel=0.03))

    # nose sensor probe
    parts.append(cone("Sensor", r1=0.045, r2=0.0, depth=0.34, loc=(0, 1.98, 0.0),
                      rot=(math.radians(-90), 0, 0), material=HULL_DARK, verts=12))

    # --- FOUR blade wings in an X-stance. Each blade sweeps back and out;
    # upper pair tips up, lower pair tips down. Chord and thickness taper
    # toward the tip so they read as blades, not planks.
    for s in (-1, 1):            # side: left / right
        for u in (-1, 1):        # vertical: lower / upper
            blade = cube(
                f"Wing_{s}_{u}",
                size=(1.5, 0.8, 0.07),
                loc=(s * 0.92, -0.42, u * 0.26),
                rot=(0, -s * u * math.radians(17), -s * math.radians(11)),
                material=HULL, bevel=0.03,
            )
            me = blade.data
            bm = bmesh.new(); bm.from_mesh(me)
            for v in bm.verts:
                xo = (s * v.co.x + 0.75) / 1.5     # 0 at root .. 1 at tip
                v.co.y *= (1.0 - xo * 0.42)        # chord narrows outboard
                v.co.z *= (1.0 - xo * 0.5)         # blade thins outboard
                if xo > 0.35:
                    v.co.y -= (xo - 0.35) * 0.28   # extra leading-edge rake
            bm.to_mesh(me); bm.free()
            parts.append(blade)

            # root fairing — dark wedge bedding the blade into the pod flank
            parts.append(cube(f"Fair_{s}_{u}", size=(0.34, 0.6, 0.13),
                              loc=(s * 0.36, -0.42, u * 0.16),
                              rot=(0, -s * u * math.radians(15), 0),
                              material=HULL_DARK, bevel=0.03))

            # wingtip cannon: barrel + emissive tip, anchored THROUGH the blade
            # tip. The mount point is derived from the blade's REAL geometry
            # (mean of its most-outboard verts) — hand-computing it from the
            # sweep/dihedral kept drifting and left the guns floating in space.
            # cube() applies rotation+scale but not location, so world position
            # = object loc + local vert co.
            outboard = sorted(blade.data.vertices, key=lambda vt: -s * vt.co.x)[:8]
            n_tip = len(outboard)
            tip_x = sum(vt.co.x for vt in outboard) / n_tip + blade.location.x
            tip_y = sum(vt.co.y for vt in outboard) / n_tip + blade.location.y
            tip_z = sum(vt.co.z for vt in outboard) / n_tip + blade.location.z
            # pull the barrel a touch inboard so it embeds in the tip chord
            cx, cz = tip_x - s * 0.03, tip_z - u * 0.02
            parts.append(cyl(f"Cannon_{s}_{u}", r=0.045, depth=1.0,
                             loc=(cx, tip_y + 0.16, cz),
                             rot=(math.radians(90), 0, 0), material=HULL_DARK, verts=14))
            parts.append(cyl(f"CannonTip_{s}_{u}", r=0.062, depth=0.14,
                             loc=(cx, tip_y + 0.70, cz),
                             rot=(math.radians(90), 0, 0), material=CANNON, verts=14))
            # small accent band where the barrel crosses the blade tip
            parts.append(cyl(f"CannonRing_{s}_{u}", r=0.06, depth=0.07,
                             loc=(cx, tip_y - 0.12, cz),
                             rot=(math.radians(90), 0, 0), material=ACCENT, verts=14))

    # --- twin engines at the pod tail: nozzle housings + emissive cores +
    # bright nozzle rims. Close-set on the centerline (the booms are gone).
    for s in (-1, 1):
        ex = s * 0.185
        parts.append(cyl(f"Nozzle_{s}", r=0.17, depth=0.6, loc=(ex, -1.62, 0),
                         rot=(math.radians(90), 0, 0), material=HULL_DARK, verts=24))
        parts.append(cyl(f"NozzleRim_{s}", r=0.195, depth=0.09, loc=(ex, -1.86, 0),
                         rot=(math.radians(90), 0, 0), material=HULL, verts=24))
        parts.append(cyl(f"Core_{s}", r=0.125, depth=0.16, loc=(ex, -1.90, 0),
                         rot=(math.radians(90), 0, 0), material=ENGINE, verts=24))

    # --- V-tail: two small fins leaning outward from the aft deck
    for s in (-1, 1):
        parts.append(cube(f"Fin_{s}", size=(0.05, 0.52, 0.44),
                          loc=(s * 0.16, -1.18, 0.32),
                          rot=(0, s * math.radians(30), 0),
                          material=ACCENT, bevel=0.02))

    # --- panel greebles: deterministic small plates over the mid/aft hull
    # (the front half tapers, so plates stay where the deck is flat). Fixed
    # list, not random — the build must be reproducible.
    plates = [
        (0.14, -0.15, 0.255, 0.13, 0.34, "D"), (-0.16, -0.50, 0.255, 0.15, 0.28, "D"),
        (0.10, -0.95, 0.245, 0.12, 0.30, "D"), (-0.09, -1.20, 0.235, 0.10, 0.22, "A"),
        (0.20, -0.75, 0.245, 0.09, 0.40, "D"), (-0.21, -0.10, 0.250, 0.08, 0.26, "D"),
        (0.00, -1.45, 0.220, 0.16, 0.18, "D"),
    ]
    for i, (px, py, pz, w, l, kind) in enumerate(plates):
        parts.append(cube(f"Plate_{i}", size=(w, l, 0.022), loc=(px, py, pz),
                          material=ACCENT if kind == "A" else HULL_DARK))
    # flank plates — one per side, low on the pod wall
    for s in (-1, 1):
        parts.append(cube(f"FlankPlate_{s}", size=(0.02, 0.7, 0.12),
                          loc=(s * 0.33, -0.6, 0.02), material=HULL_DARK))

    # join everything into one mesh
    for p in parts:
        p.select_set(False)
    bpy.context.view_layer.objects.active = parts[0]
    for p in parts:
        p.select_set(True)
    bpy.ops.object.join()
    ship = bpy.context.active_object
    ship.name = "Vanguard"

    # apply modifiers (bevels) so the export is clean geometry
    bpy.context.view_layer.objects.active = ship
    for mod in list(ship.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            pass

    # smooth-shade the whole hull, then re-mark sharp edges via auto-smooth
    bpy.ops.object.shade_smooth()
    try:
        ship.data.use_auto_smooth = True
        ship.data.auto_smooth_angle = math.radians(35)
    except Exception:
        pass

    # centre origin, drop to floor-neutral so the game pivots around the ship
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    ship.location = (0, 0, 0)
    return ship


# ---------------------------------------------------------------- camera + light
def setup_camera_lights(target):
    bpy.ops.object.camera_add(location=(4.2, -5.5, 3.4))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam
    # aim at ship
    dir_vec = target.location - cam.location
    cam.rotation_euler = dir_vec.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 55

    key = bpy.data.lights.new("Key", "AREA"); key.energy = 900; key.size = 6
    ko = bpy.data.objects.new("Key", key); bpy.context.collection.objects.link(ko)
    ko.location = (5, -4, 7); ko.rotation_euler = (math.radians(40), 0, math.radians(35))

    rim = bpy.data.lights.new("Rim", "AREA"); rim.energy = 700; rim.size = 5
    rim.color = (0.4, 0.6, 1.0)
    ro = bpy.data.objects.new("Rim", rim); bpy.context.collection.objects.link(ro)
    ro.location = (-6, 5, 3); ro.rotation_euler = (math.radians(60), 0, math.radians(210))

    fill = bpy.data.lights.new("Fill", "AREA"); fill.energy = 260; fill.size = 8
    fo = bpy.data.objects.new("Fill", fill); bpy.context.collection.objects.link(fo)
    fo.location = (-3, -5, 2); fo.rotation_euler = (math.radians(65), 0, math.radians(-40))


# ---------------------------------------------------------------- export
def export_glb(ship):
    os.makedirs(os.path.dirname(PUBLIC_GLB), exist_ok=True)
    os.makedirs(os.path.dirname(SRC_GLB), exist_ok=True)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj is ship)
    bpy.context.view_layer.objects.active = ship
    bpy.ops.export_scene.gltf(
        filepath=PUBLIC_GLB,
        export_format="GLB",
        use_selection=True,
        export_yup=True,          # +Y-forward Blender → nose -Z, up +Y three-space
        export_apply=True,
    )
    # source-of-truth copy
    import shutil
    shutil.copyfile(PUBLIC_GLB, SRC_GLB)


def render_hero():
    bpy.context.scene.render.filepath = HERO_PNG
    bpy.ops.render.render(write_still=True)


def render_top(ship):
    """Top-down ortho render — the plan-view silhouette the player sees most."""
    cam = bpy.context.scene.camera
    prev_loc = tuple(cam.location)
    prev_rot = tuple(cam.rotation_euler)
    prev_type = cam.data.type
    cam.location = (0, 0, 9)
    cam.rotation_euler = (0, 0, 0)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 5.5
    bpy.context.scene.render.filepath = "/tmp/vanguard-top.png"
    bpy.ops.render.render(write_still=True)
    cam.location = prev_loc
    cam.rotation_euler = prev_rot
    cam.data.type = prev_type


def render_rear(ship):
    """Rear three-quarter — what the chase camera actually frames in-game."""
    cam = bpy.context.scene.camera
    prev_loc = tuple(cam.location)
    prev_rot = tuple(cam.rotation_euler)
    cam.location = (2.4, -6.4, 2.2)
    dir_vec = ship.location - cam.location
    cam.rotation_euler = dir_vec.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.render.filepath = "/tmp/vanguard-rear.png"
    bpy.ops.render.render(write_still=True)
    cam.location = prev_loc
    cam.rotation_euler = prev_rot


# ---------------------------------------------------------------- main
def main():
    reset_scene()
    make_materials()
    ship = build()
    setup_camera_lights(ship)
    render_hero()
    render_top(ship)
    render_rear(ship)
    export_glb(ship)
    print("VANGUARD_BUILD_OK dims=%s" % (tuple(round(d, 3) for d in ship.dimensions),))


if __name__ == "__main__":
    main()
