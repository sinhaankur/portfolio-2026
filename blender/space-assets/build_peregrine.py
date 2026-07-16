"""
Build the Star Cleaver player ship — the "Peregrine" quad-foil strike fighter.

An ORIGINAL starfighter design in the classic quad-wing silhouette family
(long chisel nose, rear-set cockpit, four flat strike-foils in a shallow X,
an engine nacelle clamped at each wing root, four forward wingtip cannons).
Proportions, nacelles, greebles and markings are our own — this is not a
replica of any licensed craft. Hero-grade detail: the chase camera lives
behind this model for the whole game.

Silhouette, front three-quarter (nose points +Y forward):

      ◉━━━━━\\           //━━━━◉    <- wingtip cannon barrels, muzzles forward
             \\ ▄▄▄▄▄▄▄ //
        (●)═══█████████═══(●)      <- wing-root engine nacelles (intake rings)
             // ▀▀█▀▀▀▀ \\
      ◉━━━━━//    █      \\━━━━◉
                  █████▶            <- long tapered nose, accent stripes
                (canopy sits aft, HUD glow)

Modelled +Y-forward and exported with export_yup=True so it arrives nose -Z /
up +Y in three-space (matches games/star-cleaver/engine/player-ship-model.tsx,
which uses SHIP_MODEL_BASIS_ROTATION = [0,0,0]).

NOTE on sizes: unlike build_vanguard.py, the cube() helper here produces the
FULL labelled size (the Vanguard helper halved every cube — its layout was
tuned around that; this build's is not).

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_peregrine.py

Outputs:
  /tmp/peregrine-hero.png                    hero render (read back to verify)
  /tmp/peregrine-top.png                     top-down plan silhouette
  /tmp/peregrine-rear.png                    the in-game chase-camera view
  /tmp/peregrine-front.png                   front quarter (cannon geometry check)
  <repo>/public/models/peregrine.glb         the game-ready GLB
  <repo>/blender/space-assets/peregrine.glb  source-of-truth copy

The build prints PEREGRINE_BUILD_OK with the measured dims and the exhaust
positions of all four nacelles in FINAL GLB space (post origin-recentre),
both in Blender axes and in three-space — wire the game's thruster FX from
those printed numbers, never hand-guessed ones.
"""

import bpy
import bmesh
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PUBLIC_GLB = os.path.join(REPO, "public", "models", "peregrine.glb")
SRC_GLB = os.path.join(REPO, "blender", "space-assets", "peregrine.glb")
HERO_PNG = "/tmp/peregrine-hero.png"


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
        # a touch of ambient so metal surfaces have something to reflect —
        # pure-black worlds render the hull as a black mirror
        bg.inputs[0].default_value = (0.022, 0.028, 0.045, 1.0)
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
# reset_scene() -> read_factory_settings wipes all datablocks.
MATS = {}


def make_materials():
    # Same fleet palette as the Vanguard so the game keeps one visual language:
    # bright worked metal + dark structural panels + orange-red accent,
    # cyan engines, red cannon tips, HUD-glow canopy.
    MATS["HULL"] = mat("Hull", (0.52, 0.55, 0.60), metallic=0.65, rough=0.38)
    MATS["HULL_DARK"] = mat("HullDark", (0.10, 0.115, 0.145), metallic=0.8, rough=0.42)
    MATS["ACCENT"] = mat("Accent", (0.85, 0.28, 0.18), metallic=0.5, rough=0.4)
    MATS["CANOPY"] = mat("Canopy", (0.03, 0.10, 0.16), metallic=0.1, rough=0.06,
                         emit=(0.15, 0.55, 0.8), emit_strength=1.1)
    MATS["ENGINE"] = mat("Engine", (0.2, 0.7, 1.0), rough=0.3, emit=(0.25, 0.75, 1.0), emit_strength=18.0)
    MATS["INTAKE"] = mat("Intake", (0.05, 0.07, 0.1), metallic=0.6, rough=0.5,
                         emit=(0.1, 0.35, 0.5), emit_strength=1.4)
    MATS["CANNON"] = mat("Cannon", (1.0, 0.25, 0.2), rough=0.4, emit=(1.0, 0.2, 0.15), emit_strength=10.0)
    # navigation lights — real aviation convention: port red, starboard green
    MATS["NAV_PORT"] = mat("NavPort", (0.3, 0.02, 0.02), rough=0.3, emit=(1.0, 0.08, 0.05), emit_strength=6.0)
    MATS["NAV_STBD"] = mat("NavStbd", (0.02, 0.3, 0.05), rough=0.3, emit=(0.1, 1.0, 0.25), emit_strength=6.0)


def add_mat(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)


# ---------------------------------------------------------------- primitives
def cube(name, size=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0), material=None, bevel=0.0):
    # primitive_cube_add(size=1) yields a unit cube (verts ±0.5), so scaling by
    # the labelled size gives TRUE full dimensions.
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


# ------------------------------------------------------- fuselage taper maths
# Shared by the fuselage AND anything that must hug its skin (accent stripes).
FUS_LEN = 3.9          # fuselage length
FUS_CY = 0.25          # fuselage centre y
FUS_HW = 0.22          # half width
FUS_HH = 0.17          # half height
TAPER_START = 0.45     # fraction along (tail→nose) where the nose taper begins
TAPER_X = 0.90         # x narrows by this much at the tip
TAPER_Z = 0.60         # z narrows by this much at the tip
DROOP = 0.05           # nose droops down by t² · this


def taper_t(world_y):
    """0 before the taper starts, →1 at the nose tip."""
    f = (world_y - FUS_CY + FUS_LEN / 2) / FUS_LEN
    return max(0.0, min(1.0, (f - TAPER_START) / (1.0 - TAPER_START)))


# ---------------------------------------------------------------- build ship
NACELLE_EXHAUSTS = []  # filled during build; recentred + printed for wiring


def build():
    HULL, HULL_DARK, ACCENT = MATS["HULL"], MATS["HULL_DARK"], MATS["ACCENT"]
    CANOPY, ENGINE, INTAKE, CANNON = MATS["CANOPY"], MATS["ENGINE"], MATS["INTAKE"], MATS["CANNON"]
    parts = []

    # --- fuselage: long chisel nose, full aft deck. Nose = +Y.
    # A single subdivided box: front 55% tapers to a narrow wedge tip (the
    # signature long nose), tail narrows slightly. Wider than tall so the
    # cross-section reads as a strike craft, not a rocket.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, FUS_CY, 0))
    fus = bpy.context.active_object
    fus.name = "Fuselage"
    fus.scale = (FUS_HW * 2, FUS_LEN, FUS_HH * 2)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    me = fus.data
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=7, use_grid_fill=True)
    for v in bm.verts:
        f = (v.co.y + FUS_LEN / 2) / FUS_LEN   # 0 at tail, 1 at nose (local)
        if f > TAPER_START:
            t = (f - TAPER_START) / (1.0 - TAPER_START)
            v.co.x *= 1.0 - t * TAPER_X        # narrow to a chisel tip
            v.co.z *= 1.0 - t * TAPER_Z
            v.co.z -= t * t * DROOP            # nose droops a touch — reads fast
        elif f < 0.12:
            v.co.x *= 0.90                     # tail slight narrow
            v.co.z *= 0.92
    bm.to_mesh(me); bm.free()
    add_mat(fus, HULL)
    bmod = fus.modifiers.new("bevel", "BEVEL"); bmod.width = 0.035; bmod.segments = 1; bmod.limit_method = "ANGLE"
    parts.append(fus)

    # canopy — rear-set dark glass with HUD glow, long windshield slope
    canopy = cube("Canopy", size=(0.30, 0.85, 0.26), loc=(0, -0.28, 0.24), material=CANOPY, bevel=0.05)
    me = canopy.data
    bm = bmesh.new(); bm.from_mesh(me)
    for v in bm.verts:
        if v.co.y > 0.2:
            v.co.z *= 0.30                 # long windshield slope
        elif v.co.y < -0.3:
            v.co.z *= 0.75                 # fastback into the spine
    bm.to_mesh(me); bm.free()
    parts.append(canopy)

    # headrest / avionics hump flowing aft of the canopy
    parts.append(cube("Hump", size=(0.22, 0.55, 0.14), loc=(0, -0.95, 0.20),
                      material=HULL_DARK, bevel=0.04))

    # nose accent stripes — one per flank, hugging the tapering hull wall.
    # Built as thin subdivided boxes whose verts are POSITIONED from the same
    # taper maths as the fuselage (eyeballed offsets left them floating).
    for s in (-1, 1):
        y0, y1 = 0.02, 1.85
        stripe = cube(f"Stripe_{s}", size=(0.05, y1 - y0, 0.075),
                      loc=(s * FUS_HW, (y0 + y1) / 2, 0.02), material=ACCENT)
        me = stripe.data
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=8, use_grid_fill=True)
        for v in bm.verts:
            wy = v.co.y + (y0 + y1) / 2
            t = taper_t(wy)
            hull_x = FUS_HW * (1.0 - t * TAPER_X)
            v.co.x = s * (hull_x + (0.012 if v.co.x * s > 0 else -0.012)) - stripe.location.x
            v.co.z *= 1.0 - t * TAPER_Z
            v.co.z -= t * t * DROOP
        bm.to_mesh(me); bm.free()
        parts.append(stripe)

    # chin sensor fairing under the nose
    parts.append(cube("Chin", size=(0.20, 0.6, 0.10), loc=(0, 1.15, -0.13),
                      material=HULL_DARK, bevel=0.03))
    # nose probe
    parts.append(cone("Sensor", r1=0.04, r2=0.0, depth=0.35, loc=(0, 2.32, -0.04),
                      rot=(math.radians(-90), 0, 0), material=HULL_DARK, verts=12))

    # aft bulkhead cap between the wings
    parts.append(cube("Bulkhead", size=(0.42, 0.14, 0.30), loc=(0, -1.72, 0),
                      material=HULL_DARK, bevel=0.03))
    # short dorsal antenna at the tail
    parts.append(cyl("Antenna", r=0.018, depth=0.34, loc=(0.10, -1.55, 0.28),
                     material=HULL_DARK, verts=8))
    # dorsal spine ridge — the avionics hump flowing aft into the bulkhead
    parts.append(cube("SpineRidge", size=(0.10, 0.62, 0.05), loc=(0, -1.38, 0.185),
                      material=HULL_DARK, bevel=0.015))
    # nose RCS thruster nubs — two per flank at the taper, matching the game's
    # rcsNose puff FX; positioned from the same taper maths as the stripes
    t_rcs = taper_t(1.60)
    rcs_x = FUS_HW * (1.0 - t_rcs * TAPER_X) + 0.012
    rcs_zc = -t_rcs * t_rcs * DROOP
    for s in (-1, 1):
        for dz in (0.045, -0.045):
            parts.append(cyl(f"RCS_{s}_{1 if dz > 0 else 0}", r=0.022, depth=0.05,
                             loc=(s * rcs_x, 1.60, rcs_zc + dz),
                             rot=(0, math.radians(90), 0), material=HULL_DARK, verts=10))
    # belly vent pair on the aft flanks
    for s in (-1, 1):
        parts.append(cube(f"Vent_{s}", size=(0.10, 0.30, 0.03), loc=(s * 0.13, -1.45, -0.175),
                          material=HULL_DARK, bevel=0.01))

    # --- FOUR strike-foils in a shallow X. Flat tapered panels whose roots
    # converge at the fuselage flanks; slight leading-edge rake outboard.
    DIHEDRAL = math.radians(14)
    wings = {}
    for s in (-1, 1):            # side: left / right
        for u in (-1, 1):        # vertical: lower / upper
            wing = cube(
                f"Wing_{s}_{u}",
                size=(1.95, 0.88, 0.055),
                loc=(s * 1.10, -1.18, u * 0.26),
                rot=(0, -s * u * DIHEDRAL, 0),
                material=HULL, bevel=0.02,
            )
            me = wing.data
            bm = bmesh.new(); bm.from_mesh(me)
            bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=3, use_grid_fill=True)
            for v in bm.verts:
                xo = (s * v.co.x + 0.975) / 1.95   # 0 at root .. 1 at tip
                xo = max(0.0, min(1.0, xo))
                v.co.y *= (1.0 - xo * 0.30)        # chord narrows outboard
                v.co.z *= (1.0 - xo * 0.35)        # panel thins outboard
                v.co.y -= xo * 0.16                # gentle leading-edge rake
            bm.to_mesh(me); bm.free()
            parts.append(wing)
            wings[(s, u)] = wing

            # spanwise accent band at ~62% span — wraps the (thin) chord so it
            # shows on both faces; keeps the big flat panel from reading plain
            band_x = s * (1.10 - 0.975 + 0.62 * 1.95) * math.cos(DIHEDRAL)
            band_z = u * (0.26 + (0.62 * 1.95 - 0.975) * math.tan(DIHEDRAL) * math.cos(DIHEDRAL))
            band_chord = 0.88 * (1.0 - 0.62 * 0.30)
            parts.append(cube(f"WingBand_{s}_{u}", size=(0.10, band_chord * 0.96, 0.075),
                              loc=(band_x, -1.18 - 0.62 * 0.16, band_z),
                              rot=(0, -s * u * DIHEDRAL, 0), material=ACCENT))
            # panel-joint lines at 38% + 85% span — same hug-the-wing maths as
            # the accent band; keeps the flat foils from reading untextured
            for pf, pw in ((0.38, 0.055), (0.85, 0.045)):
                px = s * (1.10 - 0.975 + pf * 1.95) * math.cos(DIHEDRAL)
                pz = u * (0.26 + (pf * 1.95 - 0.975) * math.tan(DIHEDRAL) * math.cos(DIHEDRAL))
                pchord = 0.88 * (1.0 - pf * 0.30)
                parts.append(cube(f"WingJoint_{s}_{u}_{int(pf * 100)}",
                                  size=(pw, pchord * 0.90, 0.068),
                                  loc=(px, -1.18 - pf * 0.16, pz),
                                  rot=(0, -s * u * DIHEDRAL, 0), material=HULL_DARK))

    # --- engine nacelles + wingtip cannons, both derived from the REAL wing
    # geometry (hand-computed mounts kept drifting on the Vanguard build).
    # cube() applies rotation+scale but not location, so world position
    # = object loc + local vert co.
    for (s, u), wing in wings.items():
        verts_sorted = sorted(wing.data.vertices, key=lambda vt: s * vt.co.x)
        inboard = verts_sorted[:8]
        outboard = verts_sorted[-8:]

        def centre(vs):
            n = len(vs)
            return (
                sum(vt.co.x for vt in vs) / n + wing.location.x,
                sum(vt.co.y for vt in vs) / n + wing.location.y,
                sum(vt.co.z for vt in vs) / n + wing.location.z,
            )

        rx, ry, rz = centre(inboard)     # wing root centre (world)
        tx, ty, tz = centre(outboard)    # wing tip centre (world)

        # -- nacelle: clamped around the wing at ~28% span, body along +Y.
        frac = 0.28
        nx = rx + (tx - rx) * frac
        nz = rz + (tz - rz) * frac
        ny = -1.06                        # intake ahead of the wing box
        parts.append(cyl(f"Nacelle_{s}_{u}", r=0.145, depth=1.05, loc=(nx, ny, nz),
                         rot=(math.radians(90), 0, 0), material=HULL, verts=18))
        # intake ring (front) — dark throat + faint cool glow ring
        parts.append(cyl(f"IntakeRim_{s}_{u}", r=0.165, depth=0.08, loc=(nx, ny + 0.53, nz),
                         rot=(math.radians(90), 0, 0), material=HULL_DARK, verts=18))
        parts.append(cyl(f"Intake_{s}_{u}", r=0.125, depth=0.05, loc=(nx, ny + 0.56, nz),
                         rot=(math.radians(90), 0, 0), material=INTAKE, verts=18))
        # exhaust (rear) — dark nozzle + emissive cyan core
        parts.append(cyl(f"NozzleRim_{s}_{u}", r=0.155, depth=0.10, loc=(nx, ny - 0.55, nz),
                         rot=(math.radians(90), 0, 0), material=HULL_DARK, verts=18))
        core_y = ny - 0.585
        parts.append(cyl(f"Core_{s}_{u}", r=0.105, depth=0.10, loc=(nx, core_y, nz),
                         rot=(math.radians(90), 0, 0), material=ENGINE, verts=18))
        NACELLE_EXHAUSTS.append([nx, core_y, nz])
        # accent collar where the nacelle meets the wing
        parts.append(cyl(f"Collar_{s}_{u}", r=0.152, depth=0.06, loc=(nx, ny - 0.18, nz),
                         rot=(math.radians(90), 0, 0), material=ACCENT, verts=18))

        # -- wingtip cannon: housing at the tip, long barrel running FORWARD,
        # thinner front section, emissive muzzle. Embedded through the tip.
        cx = tx - s * 0.04
        cz = tz - (1 if u > 0 else -1) * 0.01
        parts.append(cyl(f"CannonBase_{s}_{u}", r=0.065, depth=0.55, loc=(cx, ty + 0.10, cz),
                         rot=(math.radians(90), 0, 0), material=HULL_DARK, verts=14))
        parts.append(cyl(f"CannonBarrel_{s}_{u}", r=0.042, depth=1.70, loc=(cx, ty + 1.15, cz),
                         rot=(math.radians(90), 0, 0), material=HULL_DARK, verts=14))
        parts.append(cyl(f"CannonFore_{s}_{u}", r=0.028, depth=0.60, loc=(cx, ty + 2.25, cz),
                         rot=(math.radians(90), 0, 0), material=HULL, verts=12))
        parts.append(cyl(f"CannonTip_{s}_{u}", r=0.044, depth=0.12, loc=(cx, ty + 2.58, cz),
                         rot=(math.radians(90), 0, 0), material=CANNON, verts=12))
        # accent ring at the housing mouth
        parts.append(cyl(f"CannonRing_{s}_{u}", r=0.052, depth=0.06, loc=(cx, ty + 0.45, cz),
                         rot=(math.radians(90), 0, 0), material=ACCENT, verts=14))
        # wingtip accent chevron plate
        parts.append(cube(f"TipPlate_{s}_{u}", size=(0.30, 0.16, 0.075), loc=(tx - s * 0.18, ty, cz),
                          rot=(0, -s * u * DIHEDRAL, 0), material=ACCENT))
        # nav light on the upper foils — port red / starboard green
        if u > 0:
            parts.append(cyl(f"NavLight_{s}", r=0.032, depth=0.045,
                             loc=(tx - s * 0.07, ty - 0.12, cz + 0.045),
                             material=MATS["NAV_PORT"] if s < 0 else MATS["NAV_STBD"],
                             verts=10))

    # --- panel greebles: deterministic plates on the mid/aft deck + flanks.
    # Fixed list, not random — the build must be reproducible.
    plates = [
        (0.10, -0.60, 0.176, 0.13, 0.36, "D"), (-0.12, -0.90, 0.176, 0.15, 0.30, "D"),
        (0.08, -1.35, 0.176, 0.12, 0.28, "D"), (-0.07, -1.55, 0.176, 0.10, 0.20, "A"),
        (0.15, -1.10, 0.176, 0.09, 0.42, "D"), (-0.16, -0.55, 0.176, 0.08, 0.26, "D"),
        (0.00, 0.30, 0.160, 0.14, 0.45, "D"),
    ]
    for i, (px, py, pz, w, l, kind) in enumerate(plates):
        parts.append(cube(f"Plate_{i}", size=(w, l, 0.022), loc=(px, py, pz),
                          material=ACCENT if kind == "A" else HULL_DARK))
    # flank plates — one per side, low on the aft fuselage wall
    for s in (-1, 1):
        parts.append(cube(f"FlankPlate_{s}", size=(0.02, 0.9, 0.14),
                          loc=(s * 0.215, -0.9, 0.0), material=HULL_DARK))
    # belly keel plate
    parts.append(cube("Keel", size=(0.20, 1.3, 0.05), loc=(0, -0.9, -0.185),
                      material=HULL_DARK, bevel=0.02))

    # join everything into one mesh
    for p in parts:
        p.select_set(False)
    bpy.context.view_layer.objects.active = parts[0]
    for p in parts:
        p.select_set(True)
    bpy.ops.object.join()
    ship = bpy.context.active_object
    ship.name = "Peregrine"

    # apply modifiers (bevels) so the export is clean geometry
    bpy.context.view_layer.objects.active = ship
    for mod in list(ship.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            pass

    # smooth-shade, sharp edges via auto-smooth
    bpy.ops.object.shade_smooth()
    try:
        ship.data.use_auto_smooth = True
        ship.data.auto_smooth_angle = math.radians(35)
    except Exception:
        pass

    # centre origin so the game pivots around the ship — and recentre the
    # recorded exhaust positions by the same shift so the printed numbers are
    # true FINAL GLB coordinates.
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    shift = tuple(ship.location)          # bbox centre in old world space
    ship.location = (0, 0, 0)
    for e in NACELLE_EXHAUSTS:
        e[0] -= shift[0]; e[1] -= shift[1]; e[2] -= shift[2]
    return ship


# ---------------------------------------------------------------- camera + light
def setup_camera_lights(target):
    bpy.ops.object.camera_add(location=(5.9, 6.9, 3.6))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam
    dir_vec = target.location - cam.location
    cam.rotation_euler = dir_vec.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 55

    key = bpy.data.lights.new("Key", "AREA"); key.energy = 1600; key.size = 7
    ko = bpy.data.objects.new("Key", key); bpy.context.collection.objects.link(ko)
    ko.location = (5, 4, 7); ko.rotation_euler = (math.radians(-40), 0, math.radians(145))

    rim = bpy.data.lights.new("Rim", "AREA"); rim.energy = 1000; rim.size = 5
    rim.color = (0.4, 0.6, 1.0)
    ro = bpy.data.objects.new("Rim", rim); bpy.context.collection.objects.link(ro)
    ro.location = (-6, -5, 3); ro.rotation_euler = (math.radians(60), 0, math.radians(30))

    fill = bpy.data.lights.new("Fill", "AREA"); fill.energy = 450; fill.size = 8
    fo = bpy.data.objects.new("Fill", fill); bpy.context.collection.objects.link(fo)
    fo.location = (-3, 5, 2); fo.rotation_euler = (math.radians(-65), 0, math.radians(-140))


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
    import shutil
    shutil.copyfile(PUBLIC_GLB, SRC_GLB)


def render_to(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_views(ship):
    cam = bpy.context.scene.camera
    prev_loc = tuple(cam.location)
    prev_rot = tuple(cam.rotation_euler)
    prev_type = cam.data.type

    # hero: front three-quarter (set up in setup_camera_lights)
    render_to(HERO_PNG)

    # top-down ortho plan view
    cam.location = (0, 0, 10)
    cam.rotation_euler = (0, 0, 0)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 6.0
    render_to("/tmp/peregrine-top.png")
    cam.data.type = prev_type

    # rear three-quarter — what the chase camera frames in-game
    cam.location = (2.6, -6.6, 2.2)
    dir_vec = ship.location - cam.location
    cam.rotation_euler = dir_vec.to_track_quat("-Z", "Y").to_euler()
    render_to("/tmp/peregrine-rear.png")

    # low front quarter — checks cannon/nacelle geometry against the nose
    cam.location = (-3.6, 6.2, -1.6)
    dir_vec = ship.location - cam.location
    cam.rotation_euler = dir_vec.to_track_quat("-Z", "Y").to_euler()
    render_to("/tmp/peregrine-front.png")

    cam.location = prev_loc
    cam.rotation_euler = prev_rot


# ---------------------------------------------------------------- main
def main():
    reset_scene()
    make_materials()
    ship = build()
    setup_camera_lights(ship)
    render_views(ship)
    export_glb(ship)
    blender_ex = [tuple(round(c, 3) for c in e) for e in NACELLE_EXHAUSTS]
    # export_yup=True maps Blender (x, y, z) -> three (x, z, -y)
    three_ex = [(round(e[0], 3), round(e[2], 3), round(-e[1], 3)) for e in NACELLE_EXHAUSTS]
    print("PEREGRINE_BUILD_OK dims=%s exhausts_blender=%s exhausts_three=%s" % (
        tuple(round(d, 3) for d in ship.dimensions), blender_ex, three_ex))


if __name__ == "__main__":
    main()
