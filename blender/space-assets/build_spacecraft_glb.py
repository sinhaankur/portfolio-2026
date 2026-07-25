"""
Build classic-orbiter spacecraft GLBs in Blender → public/models/craft-*.glb.

Step 2 of the 'all Universe Engine bodies as Blender GLB' plan. The 9 shapeless
craft (Mariner 10, Cassini, Galileo, Rosetta, Europa Clipper, JUICE, Psyche,
Solar Orbiter, DART) rendered as featureless spheres. This builds real 3D craft
GLBs, keyed to each one's dominant feature:
  craft-dish.glb     central bus + big forward high-gain dish + solar wings
                     (Mariner 10, Cassini, Solar Orbiter)
  craft-wings.glb    small bus + huge solar arrays (Rosetta, Clipper, JUICE,
                     Psyche, DART)
  craft-spinner.glb  dual-spin drum + dish, RTGs, no wings (Galileo)

Web-light: low-poly, simple PBR (no textures), a few emissive accents. GLBs stay
tens of KB. Built +Y forward-ish; the engine already orients small bodies.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_spacecraft_glb.py
"""

import bpy
import os
import math

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "..", "..", "public", "models"))
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


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


HULL = None
PANEL = None
GOLD = None
LENS = None


def mats():
    global HULL, PANEL, GOLD, LENS
    HULL = pbr("Hull", (0.62, 0.63, 0.66), metal=0.7, rough=0.45)
    PANEL = pbr("Panel", (0.09, 0.11, 0.28), metal=0.4, rough=0.35)  # dark blue solar cells
    GOLD = pbr("Gold", (0.85, 0.65, 0.22), metal=0.9, rough=0.3)     # MLI foil
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
    # a shallow parabolic-ish dish from a cone, open end forward
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


def build_dish():
    clear_scene()
    box("bus", (0.5, 0.5, 0.4), (0, 0, 0), HULL)
    # forward high-gain dish
    dish("dish", 0.55, (0, 0.45, 0), GOLD, rot=(math.radians(-90), 0, 0))
    # solar wings
    for s in (-1, 1):
        box("wing" + str(s), (0.9, 0.02, 0.42), (s * 0.75, 0, 0), PANEL)
    # instrument boom + a lit sensor
    cyl("boom", 0.02, 0.7, (0, -0.45, 0.1), HULL, rot=(math.radians(90), 0, 0))
    box("sensor", (0.08, 0.08, 0.08), (0, -0.8, 0.1), LENS)
    export("craft-dish.glb")


def build_wings():
    clear_scene()
    box("bus", (0.42, 0.42, 0.4), (0, 0, 0), HULL)
    box("bus2", (0.3, 0.3, 0.5), (0, 0, 0.2), GOLD)  # foil-wrapped upper
    # HUGE solar arrays
    for s in (-1, 1):
        box("wing" + str(s), (1.5, 0.02, 0.55), (s * 1.05, 0, 0), PANEL)
        # crossbar spar
        cyl("spar" + str(s), 0.02, 1.5, (s * 0.5, 0, 0), HULL, rot=(0, 0, math.radians(90)))
    dish("dish", 0.28, (0, 0.35, 0.15), GOLD, rot=(math.radians(-90), 0, 0))
    box("sensor", (0.07, 0.07, 0.07), (0, -0.4, 0.15), LENS)
    export("craft-wings.glb")


def build_spinner():
    clear_scene()
    # dual-spin drum body
    cyl("drum", 0.32, 0.5, (0, 0, 0), HULL, verts=20)
    cyl("drum2", 0.34, 0.08, (0, 0, 0.22), GOLD, verts=20)
    # big forward dish (Galileo's stuck-open umbrella style)
    dish("dish", 0.6, (0, 0, 0.5), HULL, rot=(0, 0, 0))
    # RTG + magnetometer booms (no solar wings)
    for s in (-1, 1):
        cyl("boom" + str(s), 0.02, 0.9, (s * 0.55, 0, -0.1), HULL, rot=(0, 0, math.radians(90)))
        box("rtg" + str(s), (0.12, 0.12, 0.18), (s * 0.95, 0, -0.1), GOLD)
    export("craft-spinner.glb")


def build_cassini():
    # Cassini's signature: a big 4 m high-gain dish on top of a tall stacked bus,
    # RTGs (no solar wings — it was too far from the Sun), and a VERY long
    # magnetometer boom out one side + the Huygens probe disk.
    clear_scene()
    cyl("bus", 0.34, 0.9, (0, 0, 0), GOLD, verts=12)   # foil-wrapped stacked bus
    dish("hga", 0.62, (0, 0, 0.7), HULL, rot=(0, 0, 0))  # big dish on top (+Z)
    # 11 m magnetometer boom out +X
    cyl("magboom", 0.015, 1.8, (1.0, 0, -0.1), HULL, rot=(0, 0, math.radians(90)))
    box("magtip", (0.05, 0.05, 0.05), (1.9, 0, -0.1), LENS)
    # RTGs on struts
    for s in (-1, 1):
        box("rtg" + str(s), (0.1, 0.1, 0.4), (s * 0.42, 0.28, -0.25), HULL, rot=(math.radians(20), 0, 0))
    # Huygens probe disk on the side
    cyl("huygens", 0.22, 0.12, (-0.42, -0.28, 0), GOLD, verts=16, rot=(math.radians(90), 0, 0))
    export("craft-cassini.glb")


def main():
    reset()
    mats()
    build_dish()
    build_wings()
    build_spinner()
    build_cassini()


main()
