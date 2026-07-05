"""
Build the Star Cleaver player ship — the "Vanguard" twin-boom interceptor.

An ORIGINAL starfighter design (not derived from any existing/licensed craft):
a slim delta cockpit pod slung between two forward-swept engine booms. The booms
carry emissive engine cores at the rear and cannon emitters at the forward tips.
Aggressive, fast-reading silhouette with its own identity.

Silhouette, top-down (nose points +Y forward):

        //\\        <- cannon tips (forward boom noses)
       ||  ||       <- two forward-swept booms
       || o ||      <- central cockpit pod (canopy `o`)
        \\==//      <- wing bridge joining booms to pod
         [][]       <- twin engine cores (emissive, rear)

Modelled +Y-forward and exported with export_yup=True so it arrives nose -Z /
up +Y in three-space (matches games/star-cleaver/engine/player-ship-model.tsx,
which uses SHIP_MODEL_BASIS_ROTATION = [0,0,0]).

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_vanguard.py

Outputs:
  /tmp/vanguard-hero.png                    hero render (read back to verify)
  <repo>/public/models/vanguard.glb         the game-ready GLB
  <repo>/blender/space-assets/vanguard.glb  source-of-truth copy
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector

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
    MATS["HULL"] = mat("Hull", (0.42, 0.45, 0.5), metallic=0.85, rough=0.35)
    MATS["HULL_DARK"] = mat("HullDark", (0.16, 0.18, 0.22), metallic=0.8, rough=0.45)
    MATS["ACCENT"] = mat("Accent", (0.85, 0.28, 0.18), metallic=0.5, rough=0.4)  # original palette
    MATS["CANOPY"] = mat("Canopy", (0.05, 0.35, 0.55), metallic=0.2, rough=0.08)
    MATS["ENGINE"] = mat("Engine", (0.2, 0.7, 1.0), rough=0.3, emit=(0.25, 0.75, 1.0), emit_strength=14.0)
    MATS["CANNON"] = mat("Cannon", (1.0, 0.25, 0.2), rough=0.4, emit=(1.0, 0.2, 0.15), emit_strength=9.0)


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
    # Build a body cube then taper the nose to a point via a bmesh scale of the
    # +Y verts so it reads as a sharp arrowhead, not a blocky box.
    # Pod is subdivided along its length so we can taper the FRONT to a true
    # point within the same mesh — no separate (floating) nose cone.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.1, 0))
    pod = bpy.context.active_object
    pod.name = "Pod"
    pod.scale = (0.31, 1.5, 0.25)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # cut loop cuts so the taper is smooth, then collapse the front verts to a tip
    me = pod.data
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=6, use_grid_fill=True)
    for v in bm.verts:
        f = (v.co.y - (-1.5)) / 3.0        # 0 at tail, 1 at nose (local space)
        if f > 0.5:
            t = (f - 0.5) / 0.5            # 0..1 across the front half
            taper = 1.0 - t * 0.94         # narrow to ~6% at the very nose
            v.co.x *= taper
            v.co.z *= (1.0 - t * 0.55)
        elif f < 0.15:                     # tail slight narrow
            v.co.x *= 0.8
    bm.to_mesh(me); bm.free()
    add_mat(pod, HULL)
    bmod = pod.modifiers.new("bevel", "BEVEL"); bmod.width = 0.03; bmod.segments = 2; bmod.limit_method = "ANGLE"
    parts.append(pod)

    # canopy — glassy blister on top of the pod, set back from the nose
    canopy = cube("Canopy", size=(0.34, 0.7, 0.26), loc=(0, 0.15, 0.28), material=CANOPY, bevel=0.06)
    me = canopy.data
    bm = bmesh.new(); bm.from_mesh(me)
    for v in bm.verts:
        if v.co.y > 0.15:
            v.co.z *= 0.4          # slope the canopy down toward the nose
    bm.to_mesh(me); bm.free()
    parts.append(canopy)

    # dorsal accent stripe running the pod
    parts.append(cube("Stripe", size=(0.1, 1.9, 0.02), loc=(0, -0.1, 0.26), material=ACCENT))

    # --- twin booms: brought INBOARD so the wing bridge visually spans pod→boom
    # as one continuous body (the earlier build left them floating). Booms sit at
    # x=±0.82; their inner edge (~0.66) nearly touches the pod, and the bridge
    # fills the remaining gap. Slight outward nose-sweep keeps the aggressive line.
    BOOM_X = 0.86
    for side in (-1, 1):
        # wing FIRST — a solid slab, thick enough (0.34) to fully embed the boom
        # cylinders at its mid-height. Spans x≈0.0→1.25 (overlaps pod flank AND
        # the boom line at 0.86). Length 2.6 runs nose-to-tail alongside the pod.
        bridge = cube(f"Bridge_{side}", size=(1.3, 2.6, 0.34),
                      loc=(side * 0.62, -0.1, -0.02),
                      rot=(0, 0, math.radians(2 * side)), material=HULL, bevel=0.04)
        # rake only the OUTBOARD-FRONT tip lightly, and taper the wing in Z toward
        # its outer edge so it reads as an aerofoil, not a brick.
        me = bridge.data
        bm = bmesh.new(); bm.from_mesh(me)
        for v in bm.verts:
            xo = side * v.co.x           # outboard distance in local space
            if v.co.y > 0.6 and xo > 0.4:
                v.co.y -= (xo - 0.4) * 0.7   # light leading-edge rake at the tip
            if xo > 0.2:
                v.co.z *= 1.0 - min(0.55, (xo - 0.2) * 0.45)  # thin the outer edge
        bm.to_mesh(me); bm.free()
        parts.append(bridge)

        # boom — embedded in the thick wing at the same z, running its length.
        boom = cube(f"Boom_{side}", size=(0.30, 2.6, 0.30),
                    loc=(side * BOOM_X, -0.1, -0.02),
                    rot=(0, 0, math.radians(-4 * side)),
                    material=HULL_DARK, bevel=0.05)
        parts.append(boom)

        # cannon barrel + emissive tip, mounted at the boom's forward end
        parts.append(cyl(f"Cannon_{side}", r=0.06, depth=0.7,
                         loc=(side * (BOOM_X + 0.06), 1.35, -0.02),
                         rot=(math.radians(90), 0, 0), material=HULL_DARK, verts=16))
        parts.append(cyl(f"CannonTip_{side}", r=0.08, depth=0.16,
                         loc=(side * (BOOM_X + 0.06), 1.74, -0.02),
                         rot=(math.radians(90), 0, 0), material=CANNON, verts=16))

        # engine nacelle at the boom rear + emissive core ring (overlaps boom tail)
        parts.append(cyl(f"Nacelle_{side}", r=0.23, depth=0.9,
                         loc=(side * BOOM_X, -1.35, -0.02),
                         rot=(math.radians(90), 0, 0), material=HULL_DARK, verts=24))
        parts.append(cyl(f"Core_{side}", r=0.18, depth=0.16,
                         loc=(side * BOOM_X, -1.82, -0.02),
                         rot=(math.radians(90), 0, 0), material=ENGINE, verts=24))

        # accent flash along each wing top
        parts.append(cube(f"WingFlash_{side}", size=(0.5, 0.16, 0.02),
                          loc=(side * 0.5, -0.1, 0.16), material=ACCENT))

    # --- tail fin for readability from the side
    parts.append(cube("Fin", size=(0.06, 0.55, 0.5), loc=(0, -0.95, 0.34), material=ACCENT, bevel=0.03))

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


# ---------------------------------------------------------------- main
def main():
    reset_scene()
    make_materials()
    ship = build()
    setup_camera_lights(ship)
    render_hero()
    render_top(ship)
    export_glb(ship)
    print("VANGUARD_BUILD_OK dims=%s" % (tuple(round(d, 3) for d in ship.dimensions),))


if __name__ == "__main__":
    main()
