"""
Build the player X-wing for Star Cleaver / Helion Drift — headless, reproducible.

A clean, sharp, properly-proportioned X-wing: tapered fuselage + pointed nose,
cockpit canopy, FOUR split S-foil wings (upper/lower per side, splayed into the
'X'), engine nacelles with emissive cores at the wing roots, and cannon barrels
with faint red emitter tips at the wing ends. Weathered rebel-grey hull with
bevelled edges for light-catch.

Modelled +Y-forward and exported with export_yup=True so it arrives nose -Z /
up +Y in three-space (matches games/star-cleaver/engine/player-ship-model.tsx,
which uses SHIP_MODEL_BASIS_ROTATION = [0,0,0] for this asset).

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_xwing.py

Outputs:
  /tmp/xwing-hero.png                 hero render (read back to verify)
  <repo>/public/models/xwing.glb      the game-ready GLB
  <repo>/blender/space-assets/xwing.glb   source-of-truth copy
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PUBLIC_GLB = os.path.join(REPO, "public", "models", "xwing.glb")
SRC_GLB = os.path.join(REPO, "blender", "space-assets", "xwing.glb")
HERO_PNG = "/tmp/xwing-hero.png"


# ---------------------------------------------------------------- scene setup
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = "GPU"
    except Exception:
        sc.cycles.device = "CPU"
    sc.cycles.samples = 128
    sc.render.film_transparent = True
    sc.render.resolution_x = 1280
    sc.render.resolution_y = 960
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    # dark space world
    w = bpy.data.worlds.new("World")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.01, 0.012, 0.02, 1.0)
    bg.inputs["Strength"].default_value = 1.0
    return sc


def make_collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


# ---------------------------------------------------------------- materials
def new_mat(name, base, rough, metal, emis=(0, 0, 0), emis_str=0.0, coat=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = (*emis, 1.0)
        b.inputs["Emission Strength"].default_value = emis_str
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    return m


def add_grime(mat, base, dark, scale=6.0):
    """Mix a procedural noise grime into a material's base colour + roughness so
    the hull reads as weathered rather than a flat plastic grey."""
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = scale
    tex.inputs["Detail"].default_value = 8.0
    tex.inputs["Roughness"].default_value = 0.7
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (*base, 1.0)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (*dark, 1.0)
    nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    # tie roughness to the same noise so grimy patches are rougher
    rramp = nt.nodes.new("ShaderNodeValToRGB")
    rramp.color_ramp.elements[0].color = (0.5, 0.5, 0.5, 1)
    rramp.color_ramp.elements[1].color = (0.78, 0.78, 0.78, 1)
    nt.links.new(tex.outputs["Fac"], rramp.inputs["Fac"])
    nt.links.new(rramp.outputs["Color"], bsdf.inputs["Roughness"])
    return mat


def build_materials():
    hull = new_mat("XW_Hull", (0.80, 0.79, 0.75), 0.60, 0.15)
    add_grime(hull, (0.82, 0.81, 0.77), (0.46, 0.45, 0.42), scale=7.0)
    return {
        "hull": hull,
        "mech": new_mat("XW_Mech", (0.18, 0.19, 0.21), 0.45, 0.85),
        "engine": new_mat("XW_EngineHousing", (0.11, 0.12, 0.14), 0.30, 0.95),
        "glow": new_mat("XW_EngineGlow", (0.5, 0.85, 1.0), 0.2, 0.0, emis=(0.45, 0.8, 1.0), emis_str=16.0),
        "glass": new_mat("XW_Canopy", (0.04, 0.08, 0.12), 0.06, 0.1, coat=1.0, alpha=0.45),
        "cannon": new_mat("XW_Cannon", (0.14, 0.14, 0.16), 0.35, 0.9),
        "accent": new_mat("XW_Accent", (0.62, 0.13, 0.11), 0.5, 0.2),
        "tip": new_mat("XW_CannonTip", (0.7, 0.2, 0.15), 0.3, 0.1, emis=(0.9, 0.25, 0.18), emis_str=5.0),
    }


# ---------------------------------------------------------------- helpers
COL = None
ROOT = None


def link_only(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    COL.objects.link(obj)


def finalize(obj, mat, smooth=False, bevel=0.0, seg=2, parent=None):
    link_only(obj)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj.parent = parent or ROOT
    if bevel > 0:
        m = obj.modifiers.new("Bevel", "BEVEL")
        m.width = bevel
        m.segments = seg
        m.limit_method = "ANGLE"
        m.angle_limit = math.radians(40)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def add_cube(name, loc, scale):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return o


def add_cyl(name, loc, r, depth, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(rotation=True)
    return o


# ---------------------------------------------------------------- the ship
def build_ship(mats):
    global ROOT
    ROOT = bpy.data.objects.new("XWing_Root", None)
    ROOT.empty_display_size = 0.4
    COL.objects.link(ROOT)

    # ---- fuselage: long tapered body, nose at +Y ----
    fus = add_cube("XW_Fuselage", (0, 0, 0), (0.42, 2.2, 0.40))
    me = fus.data
    bm = bmesh.new()
    bm.from_mesh(me)
    L = 4.4
    for v in bm.verts:
        yf = (v.co.y + 2.2) / L  # 0 tail .. 1 nose
        taper = 1.0 - 0.5 * yf
        v.co.x *= taper
        v.co.z *= (1.0 - 0.4 * yf)
    bm.to_mesh(me)
    bm.free()
    finalize(fus, mats["hull"], bevel=0.04)

    # ---- nose cone ----
    nose = add_cyl("XW_Nose", (0, 2.95, -0.02), 0.40, 1.7, rot=(math.radians(90), 0, 0), verts=14)
    # cylinder -> cone by collapsing the +Y cap
    me = nose.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for v in bm.verts:
        if v.co.y > 0.7:
            v.co.x *= 0.08
            v.co.z *= 0.08
    bm.to_mesh(me)
    bm.free()
    nose.scale = (1.0, 1.0, 0.86)
    bpy.ops.object.transform_apply(scale=True)
    finalize(nose, mats["hull"], smooth=True, bevel=0.012)

    # ---- nose tip sensor (dark) ----
    tip = add_cyl("XW_NoseTip", (0, 3.78, -0.02), 0.05, 0.18, rot=(math.radians(90), 0, 0), verts=10)
    finalize(tip, mats["mech"], smooth=True)

    # ---- cockpit canopy ----
    canopy = add_cube("XW_Canopy", (0, 0.55, 0.34), (0.30, 0.95, 0.26))
    me = canopy.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for v in bm.verts:
        # taper canopy front + round the top
        yf = (v.co.y) / 0.95
        if v.co.y > 0:
            v.co.x *= 0.55
            v.co.z *= 0.7
        if v.co.z > 0:
            v.co.x *= 0.8
    bm.to_mesh(me)
    bm.free()
    finalize(canopy, mats["glass"], smooth=True, bevel=0.02)

    # canopy frame (thin hull lip under the glass)
    frame = add_cube("XW_CanopyFrame", (0, 0.55, 0.2), (0.34, 1.0, 0.12))
    finalize(frame, mats["mech"], bevel=0.02)

    # ---- rear engine deck (raises behind the cockpit) ----
    deck = add_cube("XW_Deck", (0, -1.4, 0.12), (0.5, 1.0, 0.3))
    finalize(deck, mats["hull"], bevel=0.04)

    # ---- droid socket (R2 bump) ----
    droid = add_cyl("XW_Droid", (0, -0.55, 0.42), 0.16, 0.22, rot=(0, 0, 0), verts=14)
    finalize(droid, mats["accent"], smooth=True, bevel=0.01)

    # ---- the four S-foils + engines + cannons ----
    # Each wing: a thin tapered blade splayed up/down & out, an engine nacelle at
    # the root, and a cannon barrel running past the wingtip.
    # Each quadrant is built around a PIVOT EMPTY at the wing root. Geometry is
    # authored in the pivot's local frame (wing runs along local +X, fore-aft is
    # local +Y, thickness local Z), then the whole assembly is rotated by the
    # splay angle and reflected for the left side. Because everything is parented
    # to the pivot, parts can never drift apart — attachment is by construction.
    ENGINE_Y = -1.30          # nacelle centre, fore-aft
    ENGINE_LEN = 1.6
    ENGINE_R = 0.26
    ROOT_X = 0.46             # pivot sits at the fuselage flank
    ROOT_Z = 0.0
    WING_SPAN = 1.95
    SPLAY = math.radians(34)

    def add_local(make, pivot, name, mat, smooth=False, bevel=0.0):
        """make() returns a primitive whose geometry is authored in the pivot's
        LOCAL frame (object transform identity, position baked into the mesh).
        We parent with an identity parent-inverse so local coords == pivot space,
        guaranteeing the part stays rigidly attached to the wing root."""
        o = make()
        o.name = name
        # bake any remaining object transform into the mesh so geometry lives in
        # world coords == intended pivot-local coords, then parent with identity
        # parent-inverse so it rides the pivot rigidly.
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        link_only(o)
        o.parent = pivot
        o.matrix_parent_inverse.identity()
        o.data.materials.clear()
        o.data.materials.append(mat)
        if bevel > 0:
            m = o.modifiers.new("Bevel", "BEVEL")
            m.width = bevel; m.segments = 2
            m.limit_method = "ANGLE"; m.angle_limit = math.radians(40)
        if smooth:
            for p in o.data.polygons:
                p.use_smooth = True
        return o

    def build_quadrant(side, vert):
        sx = side
        sz = vert
        tag = f"{'R' if side>0 else 'L'}{'U' if vert>0 else 'D'}"

        # pivot at the wing root, splayed up/down + mirrored L/R
        piv = bpy.data.objects.new(f"XW_Pivot_{tag}", None)
        piv.empty_display_size = 0.2
        COL.objects.link(piv)
        piv.parent = ROOT
        piv.location = (sx * ROOT_X, ENGINE_Y, ROOT_Z)
        # Geometry is authored for the RIGHT side along local +X (outboard) and
        # local +Y (forward). The left side is a true mirror (reflection), so we
        # use scale.x = -1 — geometry, sweep and cannons all mirror correctly.
        # Splay is a PITCH about the local Y axis (tilts the outboard +X up/down),
        # which the X-mirror preserves; the earlier attempt tilted about X, which
        # the mirror cancelled — that was the bug.
        piv.rotation_euler = (0, -sz * SPLAY, 0)
        piv.scale = (sx, 1, 1)
        bpy.context.view_layer.update()

        # --- engine nacelle (local: cylinder along Y, sitting at inner root) ---
        def mk_nac():
            bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=ENGINE_R,
                                                depth=ENGINE_LEN, location=(0.30, 0.0, 0.0))
            o = bpy.context.active_object
            o.rotation_euler = (math.radians(90), 0, 0)
            bpy.ops.object.transform_apply(rotation=True)
            return o
        add_local(mk_nac, piv, f"XW_Engine_{tag}", mats["engine"], smooth=True, bevel=0.02)

        # emissive core at the rear (-Y) of the nacelle
        def mk_glow():
            bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=ENGINE_R*0.7,
                                                depth=0.1, location=(0.30, -ENGINE_LEN/2, 0.0))
            o = bpy.context.active_object
            o.rotation_euler = (math.radians(90), 0, 0)
            bpy.ops.object.transform_apply(rotation=True)
            return o
        # name carries "engine" so the in-game material styler treats this disc
        # as the glowing exhaust (emissive), keeping the engines lit in-game.
        add_local(mk_glow, piv, f"XW_EngineGlow_{tag}", mats["glow"], smooth=True)

        # intake lip at the front (+Y)
        def mk_intake():
            bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=ENGINE_R*1.02,
                                                depth=0.12, location=(0.30, ENGINE_LEN/2, 0.0))
            o = bpy.context.active_object
            o.rotation_euler = (math.radians(90), 0, 0)
            bpy.ops.object.transform_apply(rotation=True)
            return o
        add_local(mk_intake, piv, f"XW_Intake_{tag}", mats["mech"], smooth=True, bevel=0.01)

        # --- S-foil wing: from the engine outer face out to the cannon ---
        def mk_wing():
            inner = ENGINE_R + 0.30      # starts at engine outer surface
            outer = inner + WING_SPAN
            mid = (inner + outer) / 2
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(mid, 0.0, 0.0))
            o = bpy.context.active_object
            o.scale = (WING_SPAN, 0.9, 0.05)
            bpy.ops.object.transform_apply(scale=True)
            me = o.data
            bm = bmesh.new(); bm.from_mesh(me)
            for v in bm.verts:
                xf = (v.co.x - inner) / WING_SPAN  # 0 inner .. 1 outer
                v.co.y *= (1.0 - 0.42 * xf)        # taper chord
                v.co.y -= xf * 0.30                # back-sweep
            bm.to_mesh(me); bm.free()
            return o
        add_local(mk_wing, piv, f"XW_Wing_{tag}", mats["hull"], bevel=0.02)

        inner = ENGINE_R + 0.30
        outer = inner + WING_SPAN

        # red accent stripe near the tip
        def mk_stripe():
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(inner + WING_SPAN*0.74, 0.10, 0.0))
            o = bpy.context.active_object
            o.scale = (0.42, 0.34, 0.062)
            bpy.ops.object.transform_apply(scale=True)
            return o
        add_local(mk_stripe, piv, f"XW_Stripe_{tag}", mats["accent"], bevel=0.01)

        # cannon barrel at the wingtip (along local Y)
        def mk_cannon():
            bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.05, depth=2.1,
                                                location=(outer, 0.15, 0.0))
            o = bpy.context.active_object
            o.rotation_euler = (math.radians(90), 0, 0)
            bpy.ops.object.transform_apply(rotation=True)
            return o
        add_local(mk_cannon, piv, f"XW_Cannon_{tag}", mats["cannon"], smooth=True)

        # red emitter tip
        def mk_tip():
            bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.055, depth=0.14,
                                                location=(outer, 1.22, 0.0))
            o = bpy.context.active_object
            o.rotation_euler = (math.radians(90), 0, 0)
            bpy.ops.object.transform_apply(rotation=True)
            return o
        add_local(mk_tip, piv, f"XW_CannonTip_{tag}", mats["tip"], smooth=True)

    for side in (1, -1):
        for vert in (1, -1):
            build_quadrant(side, vert)


# ---------------------------------------------------------------- lighting/cam
def build_lighting():
    lc = make_collection("Lighting")

    def add_area(name, loc, energy, size, color, rot):
        d = bpy.data.lights.new(name, "AREA")
        d.energy = energy
        d.size = size
        d.color = color
        o = bpy.data.objects.new(name, d)
        o.location = loc
        o.rotation_euler = rot
        lc.objects.link(o)

    add_area("Key", (4.5, -3.0, 4.5), 2200, 5.0, (1.0, 0.93, 0.82),
             (math.radians(50), 0, math.radians(55)))
    add_area("Fill", (-5.0, -2.0, 1.5), 700, 6.0, (0.7, 0.8, 1.0),
             (math.radians(75), 0, math.radians(-60)))
    add_area("Rim", (-1.5, 5.0, 3.0), 1600, 4.0, (0.85, 0.9, 1.0),
             (math.radians(120), 0, math.radians(190)))

    cam_d = bpy.data.cameras.new("HeroCam")
    cam_d.lens = 65
    cam = bpy.data.objects.new("HeroCam", cam_d)
    cam.location = (5.4, -5.8, 2.8)
    lc.objects.link(cam)
    tgt = bpy.data.objects.new("CamTarget", None)
    tgt.location = (0, -0.2, 0.1)
    lc.objects.link(tgt)
    c = cam.constraints.new("TRACK_TO")
    c.target = tgt
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    bpy.context.scene.camera = cam


# ---------------------------------------------------------------- export
def export_glb():
    os.makedirs(os.path.dirname(PUBLIC_GLB), exist_ok=True)
    # select only the ship collection objects
    bpy.ops.object.select_all(action="DESELECT")
    for o in COL.objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = ROOT
    for path in (PUBLIC_GLB, SRC_GLB):
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_yup=True,
        )
    return [PUBLIC_GLB, SRC_GLB]


def render_from(loc, target, path, lens=65):
    cam = bpy.context.scene.camera
    cam.location = loc
    cam.data.lens = lens
    tgt = bpy.data.objects["CamTarget"]
    tgt.location = target
    bpy.context.view_layer.update()
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path)


def main():
    global COL
    sc = reset_scene()
    COL = make_collection("XWing")
    mats = build_materials()
    build_ship(mats)
    build_lighting()

    # hero 3/4 + a front-quarter + a head-on to check the 'X' silhouette
    render_from((5.4, -5.8, 2.8), (0, -0.2, 0.1), HERO_PNG)
    render_from((2.6, 7.4, 1.4), (0, 0.2, 0.0), "/tmp/xwing-front.png", lens=60)
    render_from((0.0, 9.5, 0.0), (0, 0, 0.0), "/tmp/xwing-headon.png", lens=80)

    if os.environ.get("XW_RENDER_ONLY"):
        print("RENDER ONLY — skipping export")
        return
    paths = export_glb()
    for p in paths:
        sz = os.path.getsize(p) if os.path.exists(p) else 0
        print(f"EXPORTED {p} ({sz} bytes)")
    print("XWING BUILD COMPLETE")


if __name__ == "__main__":
    main()
