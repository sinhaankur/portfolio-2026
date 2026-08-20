"""
Build dedicated GLBs for planetary orbiters that were reusing a GENERIC craft
mesh in HERO_CRAFT (so several bodies showed the same anonymous dish/spinner):

  craft-maven.glb        MAVEN (Mars) — bus + 2 solar wings with a distinctive
                         bend + long magnetometer booms on the wingtips
  craft-akatsuki.glb     Akatsuki (Venus) — compact box bus + 2 paddle wings +
                         two flat phased-array antennas (no big dish)
  craft-venusexpress.glb Venus Express (ESA Mars-Express bus) — box bus + 2
                         wings + a fixed high-gain dish on one face
  craft-messenger.glb    MESSENGER (Mercury) — the defining sunshade ceramic
                         panel on top, bus below, 2 wings, dish

Same pipeline as build_deep_space_craft.py — low-poly, +Y forward, export_yup,
tens of KB each.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_planetary_orbiters.py
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


HULL = PANEL = GOLD = WHITE = DARK = LENS = None


def mats():
    global HULL, PANEL, GOLD, WHITE, DARK, LENS
    HULL = pbr("Hull", (0.62, 0.63, 0.66), metal=0.7, rough=0.45)
    PANEL = pbr("Panel", (0.09, 0.11, 0.28), metal=0.4, rough=0.35)
    GOLD = pbr("Gold", (0.85, 0.65, 0.22), metal=0.9, rough=0.3)
    WHITE = pbr("White", (0.92, 0.92, 0.94), metal=0.1, rough=0.5)
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


def build_maven():
    # MAVEN: a cubic bus, two gull-wing solar arrays (each with a bent tip), and
    # magnetometer booms sticking off the wingtips. Studies Mars' upper atmosphere.
    clear_scene()
    box("bus", (0.44, 0.44, 0.5), (0, 0, 0), GOLD)
    for s in (-1, 1):
        box("wing" + str(s), (0.8, 0.02, 0.4), (s * 0.66, 0, 0), PANEL)
        box("wingtip" + str(s), (0.4, 0.02, 0.34), (s * 1.15, 0, 0.08), PANEL,
            rot=(0, 0, s * math.radians(-18)))  # the gull-wing bend
        cyl("spar" + str(s), 0.02, 0.8, (s * 0.35, 0, 0), HULL, rot=(0, 0, math.radians(90)))
        # magnetometer boom off the wingtip
        cyl("mag" + str(s), 0.01, 0.3, (s * 1.45, 0, 0.08), HULL, rot=(0, 0, math.radians(90)))
        box("magtip" + str(s), (0.04, 0.04, 0.04), (s * 1.62, 0, 0.08), LENS)
    dish("hga", 0.26, (0, 0.35, 0.15), WHITE, rot=(math.radians(-90), 0, 0))
    box("sensor", (0.06, 0.06, 0.06), (0, -0.36, 0.15), LENS)
    export("craft-maven.glb")


def build_akatsuki():
    # Akatsuki: a small box bus, two rectangular paddle solar wings, and — its
    # signature — two FLAT phased-array antennas on the bus (no big dish).
    clear_scene()
    box("bus", (0.4, 0.4, 0.4), (0, 0, 0), GOLD)
    for s in (-1, 1):
        box("wing" + str(s), (0.55, 0.02, 0.36), (s * 0.52, 0, 0), PANEL)
        cyl("spar" + str(s), 0.018, 0.5, (s * 0.28, 0, 0), HULL, rot=(0, 0, math.radians(90)))
    # two flat phased-array antennas on the +Y face
    for s in (-1, 1):
        box("paa" + str(s), (0.16, 0.03, 0.16), (s * 0.12, 0.24, 0.05), WHITE)
    box("sensor", (0.05, 0.05, 0.05), (0, 0.1, 0.26), LENS)
    export("craft-akatsuki.glb")


def build_venusexpress():
    # Venus Express (Mars-Express bus): a boxy bus, two solar wings, and a fixed
    # high-gain dish on the +Y face pointing forward.
    clear_scene()
    box("bus", (0.5, 0.4, 0.5), (0, 0, 0), GOLD)
    for s in (-1, 1):
        box("wing" + str(s), (0.7, 0.02, 0.4), (s * 0.65, -0.05, 0), PANEL)
        cyl("spar" + str(s), 0.02, 0.7, (s * 0.35, -0.05, 0), HULL, rot=(0, 0, math.radians(90)))
    dish("hga", 0.34, (0, 0.42, 0.1), WHITE, rot=(math.radians(-90), 0, 0))
    cyl("feed", 0.015, 0.25, (0, 0.28, 0.1), HULL, rot=(math.radians(90), 0, 0))
    box("sensor", (0.05, 0.05, 0.05), (0, -0.28, 0.2), LENS)
    export("craft-venusexpress.glb")


def build_messenger():
    # MESSENGER: THE defining feature is the big white ceramic sunshade panel held
    # up on the sunward (+Y) side; the bus hides behind it, with two solar wings
    # and a small dish. Mercury is brutally hot — the sunshade is the identity.
    clear_scene()
    box("sunshade", (0.7, 0.04, 0.62), (0, 0.42, 0), WHITE)   # big flat shade forward
    box("bus", (0.36, 0.34, 0.4), (0, 0, 0), GOLD)            # bus in the shade
    for s in (-1, 1):
        box("wing" + str(s), (0.6, 0.02, 0.3), (s * 0.6, -0.05, 0), PANEL)
        # MESSENGER's wings were half solar cell, half mirror — a lighter strip
        box("mirror" + str(s), (0.6, 0.02, 0.12), (s * 0.6, -0.05, 0.14), WHITE)
        cyl("spar" + str(s), 0.018, 0.6, (s * 0.32, -0.05, 0), HULL, rot=(0, 0, math.radians(90)))
    cyl("mast", 0.02, 0.4, (0, 0.24, 0), HULL, rot=(math.radians(90), 0, 0))  # shade mast
    dish("hga", 0.16, (0, -0.05, 0.28), WHITE, rot=(0, 0, 0))
    box("sensor", (0.05, 0.05, 0.05), (0, -0.3, 0), LENS)
    export("craft-messenger.glb")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats()
    build_maven()
    build_akatsuki()
    build_venusexpress()
    build_messenger()
    print("DONE — 4 planetary-orbiter GLBs")


if __name__ == "__main__":
    main()
