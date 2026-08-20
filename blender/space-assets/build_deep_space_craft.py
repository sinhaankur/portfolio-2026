"""
Build the deep-space probe GLBs the engine was still drawing as procedural boxes.

These 10 named-body spacecraft had only a boxGeometry silhouette in
spacecraft-shapes.tsx (they read as blocky squares up close). This builds a real
low-poly GLB for each, keyed to its ONE identifying feature so it's recognisable
the instant you fly to it:

  craft-voyager.glb    big white HGA dish + long magnetometer boom + RTG boom
                       (Voyager 1 & 2 — the Grand Tour probes)
  craft-pioneer.glb    dish + slim RTG booms + the famous plaque bus
                       (Pioneer 10 & 11)
  craft-newhorizons.glb triangular bus + one big dish, no wings (New Horizons)
  craft-parker.glb     white hexagonal heat shield in FRONT of a tiny bus
                       (Parker Solar Probe — shield always sunward)
  craft-bepi.glb       stacked bus + long ion-engine block + radiators (BepiColombo)
  craft-hayabusa.glb   flat bus + two solar wings + sampler horn underneath
                       (Hayabusa2 — asteroid sample-return)
  craft-osiris.glb     bus + wings + the TAGSAM sampling arm (OSIRIS-APEX)
  craft-lucy.glb       small bus between TWO huge circular solar arrays
                       (Lucy — the Trojan-asteroid tour, giant round panels)

Web-light: low-poly, simple PBR, GLBs stay tens of KB. Modelled +Y forward
(velocity), exported export_yup=True to match the other engine GLBs.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_deep_space_craft.py
"""

import bpy
import os
import math

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "..", "..", "public", "models"))
os.makedirs(OUT, exist_ok=True)


def pbr(name, color, metal=0.6, rough=0.4):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    return m


def emis(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1.0)
    e.inputs["Strength"].default_value = strength
    nt.links.new(e.outputs[0], out.inputs["Surface"])
    return m


HULL = PANEL = GOLD = LENS = WHITE = DARK = None


def mats():
    global HULL, PANEL, GOLD, LENS, WHITE, DARK
    HULL = pbr("Hull", (0.62, 0.63, 0.66), metal=0.7, rough=0.45)
    PANEL = pbr("Panel", (0.09, 0.11, 0.28), metal=0.4, rough=0.35)  # solar cells
    GOLD = pbr("Gold", (0.85, 0.65, 0.22), metal=0.9, rough=0.3)     # MLI foil
    WHITE = pbr("White", (0.92, 0.92, 0.94), metal=0.1, rough=0.5)   # dishes/shields
    DARK = pbr("Dark", (0.10, 0.10, 0.12), metal=0.3, rough=0.7)
    LENS = emis("Lens", (0.55, 0.85, 1.0), 2.0)


def box(name, size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    o.data.materials.append(mat)
    return o


def cyl(name, r, depth, loc, mat, verts=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def dish(name, r, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r, radius2=r * 0.15, depth=r * 0.5,
                                    location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def ngon(name, r, depth, loc, mat, verts=6, rot=(0, 0, 0)):
    # flat n-gon prism — Parker's hex shield, Lucy's round arrays, etc.
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    return o


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def export(fname):
    for o in bpy.data.objects:
        o.select_set(True)
    path = os.path.join(OUT, fname)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True)
    print("WROTE", path)


# ---------------------------------------------------------------------------
# The craft. +Y is forward (velocity); +Z is "up" on the bus.
# ---------------------------------------------------------------------------

def build_voyager():
    # Voyager's identity: a large 3.7 m white parabolic HGA dish, a slender bus
    # behind it, a long magnetometer boom out one side, and an RTG boom + science
    # boom out the others. No solar panels (RTG-powered, too far from the Sun).
    clear_scene()
    box("bus", (0.34, 0.34, 0.3), (0, 0, 0), GOLD)          # decagonal bus (foil)
    dish("hga", 0.72, (0, 0.5, 0), WHITE, rot=(math.radians(-90), 0, 0))  # big dish forward
    cyl("feed", 0.015, 0.4, (0, 0.32, 0), HULL, rot=(math.radians(90), 0, 0))
    # magnetometer boom — very long, +X
    cyl("magboom", 0.012, 2.2, (1.15, 0, 0), HULL, rot=(0, 0, math.radians(90)))
    box("magtip", (0.05, 0.05, 0.05), (2.25, 0, 0), LENS)
    # RTG boom — -X, with three RTG canisters
    cyl("rtgboom", 0.02, 0.9, (-0.55, 0, -0.05), HULL, rot=(0, 0, math.radians(90)))
    for i in range(3):
        cyl("rtg" + str(i), 0.06, 0.16, (-0.7 - i * 0.2, 0, -0.05), DARK, rot=(0, 0, math.radians(90)))
    # science boom — -Z, with instrument boxes (ISS/IRIS scan platform)
    cyl("sciboom", 0.02, 0.7, (0.0, -0.1, -0.5), HULL, rot=(math.radians(0), 0, 0))
    box("scanplat", (0.16, 0.12, 0.1), (0, -0.15, -0.85), HULL)
    box("sensor", (0.05, 0.05, 0.05), (0.1, -0.2, -0.9), LENS)
    export("craft-voyager.glb")


def build_pioneer():
    # Pioneer 10/11: a 2.7 m dish, a compact hex bus behind it, two long thin RTG
    # booms trailing back, and the magnetometer boom. Spin-stabilised.
    clear_scene()
    dish("hga", 0.62, (0, 0.35, 0), WHITE, rot=(math.radians(-90), 0, 0))
    ngon("bus", 0.26, 0.22, (0, 0, 0), GOLD, verts=6, rot=(math.radians(90), 0, 0))
    # two RTG booms trailing -Y, angled out
    for s in (-1, 1):
        cyl("rtgboom" + str(s), 0.015, 1.2, (s * 0.35, -0.55, 0), HULL,
            rot=(math.radians(70), 0, s * math.radians(20)))
        box("rtg" + str(s), (0.09, 0.09, 0.22), (s * 0.6, -1.1, 0), DARK)
    # magnetometer boom out +X
    cyl("magboom", 0.012, 1.4, (0.8, -0.1, 0), HULL, rot=(0, 0, math.radians(90)))
    box("magtip", (0.04, 0.04, 0.04), (1.55, -0.1, 0), LENS)
    export("craft-pioneer.glb")


def build_newhorizons():
    # New Horizons: a triangular/wedge bus with ONE big 2.1 m dish on top, a small
    # RTG cylinder out the back. Piano-sized, no wings.
    clear_scene()
    # triangular bus (3-gon prism)
    ngon("bus", 0.4, 0.34, (0, 0, 0), GOLD, verts=3, rot=(math.radians(90), 0, 0))
    dish("hga", 0.6, (0, 0.1, 0.42), WHITE, rot=(0, 0, 0))  # dish on top (+Z)
    cyl("feed", 0.015, 0.3, (0, 0.1, 0.28), HULL)
    # RTG out the back (-Y), the single most prominent cylinder
    cyl("rtg", 0.11, 0.5, (0.3, -0.4, -0.05), DARK, rot=(math.radians(70), 0, 0))
    box("sensor", (0.06, 0.06, 0.06), (-0.25, 0.3, -0.1), LENS)  # LORRI-ish
    export("craft-newhorizons.glb")


def build_parker():
    # Parker Solar Probe: THE defining feature is the white hexagonal heat shield
    # (TPS) held out FRONT (sunward), with a tiny bus tucked in its shadow behind.
    clear_scene()
    ngon("shield", 0.65, 0.06, (0, 0.55, 0), WHITE, verts=6, rot=(math.radians(90), 0, 0))
    ngon("shield_edge", 0.66, 0.02, (0, 0.6, 0), HULL, verts=6, rot=(math.radians(90), 0, 0))
    box("bus", (0.26, 0.3, 0.26), (0, 0, 0), GOLD)  # small bus in the shadow
    # two small solar wings folded close to the bus (they retract near the Sun)
    for s in (-1, 1):
        box("wing" + str(s), (0.34, 0.02, 0.2), (s * 0.32, -0.05, 0), PANEL)
    cyl("mast", 0.02, 0.5, (0, 0.28, 0), HULL, rot=(math.radians(90), 0, 0))  # shield mast
    box("sensor", (0.05, 0.05, 0.05), (0, -0.28, 0), LENS)
    export("craft-parker.glb")


def build_bepi():
    # BepiColombo (the MPO stack): a tall stacked bus, a long ion-engine module at
    # the back with glowing thruster nozzles, and radiator panels. Distinctive
    # electric-propulsion look.
    clear_scene()
    box("bus", (0.4, 0.5, 0.42), (0, 0, 0), GOLD)
    box("mtm", (0.36, 0.5, 0.36), (0, -0.5, 0), HULL)  # transfer module behind
    # ion thrusters (glowing) out the back -Y
    for s in (-1, 1):
        cyl("ion" + str(s), 0.07, 0.12, (s * 0.14, -0.82, 0), LENS, rot=(math.radians(90), 0, 0))
    # one long solar wing (the MTM's single big array) + radiators
    box("wing", (1.4, 0.02, 0.4), (0.95, -0.2, 0), PANEL)
    cyl("spar", 0.02, 1.2, (0.4, -0.2, 0), HULL, rot=(0, 0, math.radians(90)))
    box("radiator", (0.42, 0.3, 0.02), (-0.35, 0.1, 0.25), WHITE, rot=(math.radians(20), 0, 0))
    dish("hga", 0.3, (0, 0.4, 0.2), WHITE, rot=(math.radians(-90), 0, 0))
    export("craft-bepi.glb")


def build_hayabusa():
    # Hayabusa2: a flat boxy bus, two solar wings, a downward sampler horn, and the
    # flat high-gain antenna panels on top. Asteroid sample-return.
    clear_scene()
    box("bus", (0.5, 0.5, 0.3), (0, 0, 0), GOLD)
    for s in (-1, 1):
        box("wing" + str(s), (0.7, 0.02, 0.44), (s * 0.62, 0, 0), PANEL)
    # sampler horn pointing -Z (down, toward the asteroid)
    cyl("horn", 0.04, 0.5, (0, 0, -0.4), HULL, rot=(0, 0, 0))
    ngon("hornmouth", 0.09, 0.03, (0, 0, -0.64), DARK, verts=12)
    # flat phased-array HGAs on top (+Z) — Hayabusa's signature flat squares
    for s in (-1, 1):
        box("hga" + str(s), (0.18, 0.18, 0.03), (s * 0.16, 0.1, 0.18), WHITE)
    box("sensor", (0.05, 0.05, 0.05), (0, 0.3, 0.05), LENS)
    export("craft-hayabusa.glb")


def build_osiris():
    # OSIRIS-APEX (ex-OSIRIS-REx): bus + two solar wings in a distinctive Y/angled
    # set, and the long TAGSAM sampling arm folded along the body.
    clear_scene()
    box("bus", (0.44, 0.5, 0.4), (0, 0, 0), GOLD)
    for s in (-1, 1):
        box("wing" + str(s), (0.85, 0.02, 0.4), (s * 0.7, 0.05, 0.1), PANEL,
            rot=(0, 0, s * math.radians(-15)))
        cyl("spar" + str(s), 0.02, 0.85, (s * 0.35, 0.05, 0.1), HULL, rot=(0, 0, math.radians(90)))
    # TAGSAM arm folded down the -Z front
    cyl("arm1", 0.03, 0.4, (0, 0.15, -0.35), HULL, rot=(math.radians(70), 0, 0))
    cyl("arm2", 0.03, 0.3, (0, 0.35, -0.55), HULL, rot=(math.radians(30), 0, 0))
    ngon("tagsam", 0.11, 0.05, (0, 0.5, -0.62), DARK, verts=12, rot=(math.radians(90), 0, 0))
    dish("hga", 0.26, (0, 0.4, 0.2), WHITE, rot=(math.radians(-90), 0, 0))
    export("craft-osiris.glb")


def build_lucy():
    # Lucy: the unmistakable feature is TWO enormous CIRCULAR solar arrays (7.3 m
    # across) flanking a small bus — round, not rectangular. Trojan-asteroid tour.
    clear_scene()
    box("bus", (0.34, 0.4, 0.34), (0, 0, 0), GOLD)
    dish("hga", 0.34, (0, 0.35, 0.1), WHITE, rot=(math.radians(-90), 0, 0))
    for s in (-1, 1):
        # big round array
        ngon("array" + str(s), 0.85, 0.02, (s * 1.15, 0, 0), PANEL, verts=28, rot=(0, math.radians(90), 0))
        ngon("arrayrim" + str(s), 0.86, 0.015, (s * 1.15, 0, 0), HULL, verts=28, rot=(0, math.radians(90), 0))
        cyl("spar" + str(s), 0.02, 0.5, (s * 0.55, 0, 0), HULL, rot=(0, 0, math.radians(90)))
    box("sensor", (0.05, 0.05, 0.05), (0, -0.3, 0), LENS)
    export("craft-lucy.glb")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats()
    build_voyager()
    build_pioneer()
    build_newhorizons()
    build_parker()
    build_bepi()
    build_hayabusa()
    build_osiris()
    build_lucy()
    print("DONE — 8 deep-space craft GLBs")


if __name__ == "__main__":
    main()
