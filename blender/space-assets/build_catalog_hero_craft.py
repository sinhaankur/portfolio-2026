"""
Catalog hero-craft realism pass — rebuilds the four weakest models on
/reference/spacecraft with real proportions + the features that make each craft
recognisable in photographs (Ankur: "GLBs are not so good, they need to feel
real"). Still web-light (a few k tris, tens of KB), same conventions as
build_deep_space_craft.py (+Y forward, export_yup=True).

  craft-voyager.glb    3.7 m white HGA with rim + subreflector struts, 10-sided
                       gold MLI bus, finned 3-stack RTG boom, science boom, the
                       13 m magnetometer boom, twin V whip antennas
  craft-cassini.glb    stacked gold MLI bus, 4 m HGA on top, the Huygens probe
                       cone on its side, 3 finned RTGs, 11 m mag boom
                       (replaces the old "mushroom" blob)
  craft-parker.glb     thick white TPS shield FRONT, truss standoffs, hex bus,
                       twin angled solar flaps + radiators behind the shield
  craft-explorer1.glb  NEW — the old page showed a Sputnik sphere for
                       Explorer 1; the real craft is a 2 m pencil: striped
                       cylinder, nose cone, four swept whip antennas

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_catalog_hero_craft.py
"""

import bpy
import math
import os

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


MATS = {}


def mats():
    global MATS
    MATS = {
        "gold": pbr("GoldMLI", (0.82, 0.58, 0.16), metal=0.95, rough=0.28),
        "amber": pbr("AmberMLI", (0.55, 0.33, 0.08), metal=0.9, rough=0.45),
        "white": pbr("WhiteDish", (0.93, 0.93, 0.95), metal=0.05, rough=0.42),
        "shieldw": pbr("ShieldWhite", (0.96, 0.95, 0.93), metal=0.0, rough=0.55),
        "silver": pbr("Silver", (0.75, 0.76, 0.8), metal=0.9, rough=0.3),
        "dark": pbr("DarkBody", (0.08, 0.08, 0.1), metal=0.4, rough=0.6),
        "panel": pbr("SolarCell", (0.07, 0.1, 0.26), metal=0.55, rough=0.25),
        "graph": pbr("Graphite", (0.16, 0.16, 0.18), metal=0.6, rough=0.5),
        "steel": pbr("Steel", (0.55, 0.56, 0.6), metal=0.85, rough=0.35),
    }


def box(name, size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    o.data.materials.append(mat)
    return o


def cyl(name, r, depth, loc, mat, verts=24, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    return o


def cone(name, r1, r2, depth, loc, mat, verts=24, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2,
                                    depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    return o


def sph(name, r, loc, mat, seg=24, rings=16, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings,
                                         radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    if scale:
        o.scale = scale
    o.data.materials.append(mat)
    return o


def torus(name, r, tube, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=tube,
                                     location=loc, rotation=rot,
                                     major_segments=32, minor_segments=8)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    return o


def rod(name, p1, p2, r, mat, verts=8):
    """A cylinder BETWEEN two explicit endpoints — the no-floating-parts
    guarantee. Every boom/strut/whip is rooted ON the hull it belongs to
    (Ankur: 'missing parts and missing connections'). """
    import mathutils
    v1, v2 = mathutils.Vector(p1), mathutils.Vector(p2)
    d = v2 - v1
    o = cyl(name, r, d.length, tuple((v1 + v2) / 2), mat, verts=verts)
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return o


def hga_dish(prefix, r, loc, depth_frac=0.24):
    """A real-reading high-gain antenna: parabolic bowl (squashed hemisphere
    shell), rim torus, four feed struts meeting at a subreflector."""
    parts = []
    # Bowl — squashed sphere; the open side faces +Z before rotation.
    parts.append(sph(f"{prefix}-bowl", r, loc, MATS["white"],
                     scale=(1, 1, depth_frac)))
    parts.append(torus(f"{prefix}-rim", r * 0.99, r * 0.035, loc, MATS["silver"]))
    # Feed struts: each rod runs bowl-rim point → subreflector apex, exactly.
    sub_h = r * 0.75
    apex = (loc[0], loc[1], loc[2] + sub_h)
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        rim = (loc[0] + math.cos(a) * r * 0.62, loc[1] + math.sin(a) * r * 0.62,
               loc[2] + r * depth_frac * 0.4)
        parts.append(rod(f"{prefix}-strut{i}", rim, apex, r * 0.018, MATS["steel"]))
    parts.append(cone(f"{prefix}-subref", r * 0.14, 0.0, r * 0.16, apex, MATS["graph"]))
    return parts


def rtg(prefix, loc, rot=(0, 0, 0), scale=1.0):
    """Finned radioisotope generator — cylinder + 8 radial fins."""
    parts = [cyl(f"{prefix}-body", 0.2 * scale, 0.9 * scale, loc, MATS["graph"],
                 verts=16, rot=rot)]
    for i in range(8):
        a = i * math.pi / 4
        fin = box(f"{prefix}-fin{i}", (0.02 * scale, 0.14 * scale, 0.86 * scale),
                  loc, MATS["graph"], rot=rot)
        # push the fin outward along its local orientation by rotating around the body axis
        fin.rotation_euler.rotate_axis("Z", a)
        # move fin outward in its rotated frame: easiest = parent-less manual offset
        fin.location = (loc[0] + math.cos(a) * 0.26 * scale,
                        loc[1] + math.sin(a) * 0.26 * scale,
                        loc[2])
        fin.rotation_euler = (rot[0], rot[1], a)
        parts.append(fin)
    return parts


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for d in list(block):
            if d.users == 0:
                block.remove(d)


def export(fname):
    bpy.ops.object.select_all(action="SELECT")
    path = os.path.join(OUT, fname)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB",
                              use_selection=True, export_yup=True,
                              export_apply=True)
    print("wrote", path, os.path.getsize(path) // 1024, "KB")


# ── Voyager — the Grand Tour probe ──────────────────────────────────────────
def build_voyager():
    clear_scene(); mats()
    # 10-sided bus, gold MLI, under the dish
    cyl("bus", 0.9, 0.5, (0, 0, -0.35), MATS["gold"], verts=10)
    box("bus-electronics", (0.5, 0.5, 0.3), (0, 0, -0.62), MATS["amber"])
    # 3.7 m HGA facing +Z (Earth)
    hga_dish("hga", 1.85, (0, 0, 0.12))
    # RTG boom: bus edge → past the last finned stack. Roots ON the hull.
    rod("rtg-boom", (0.85, 0, -0.45), (3.0, 0, -0.45), 0.03, MATS["steel"])
    for k in range(3):
        rtg(f"rtg{k}", (1.7 + k * 0.5, 0, -0.45), rot=(0, math.pi / 2, 0), scale=0.5)
    # Science boom: bus edge → the scan platform it carries.
    rod("sci-boom", (-0.85, 0.15, -0.35), (-2.75, 0.75, -0.3), 0.03, MATS["steel"])
    box("scan-platform", (0.5, 0.4, 0.35), (-2.75, 0.75, -0.3), MATS["dark"])
    cyl("narrow-cam", 0.09, 0.4, (-2.75, 0.95, -0.12), MATS["silver"], verts=12,
        rot=(math.pi / 2, 0, 0))
    # 13 m magnetometer boom — the signature spindly spine, bus → sensor.
    rod("mag-boom", (0, -0.85, -0.45), (0, -6.6, -0.5), 0.02, MATS["steel"], verts=6)
    sph("mag-sensor", 0.08, (0, -6.6, -0.5), MATS["dark"])
    # Twin PRA whip antennas in a V, rooted on the bus underside.
    for s in (-1, 1):
        rod(f"pra{s}", (s * 0.3, 0.3, -0.6), (s * 1.9, 2.0, -3.4), 0.012,
            MATS["silver"], verts=6)
    export("craft-voyager.glb")


# ── Cassini — the Saturn orbiter + Huygens ──────────────────────────────────
def build_cassini():
    clear_scene(); mats()
    # Stacked cylindrical bus, gold MLI — Cassini was a 6.8 m tower
    cyl("bus-lower", 0.62, 1.0, (0, 0, -0.9), MATS["amber"], verts=16)
    cyl("bus-upper", 0.55, 1.1, (0, 0, 0.15), MATS["gold"], verts=16)
    # 4 m HGA on top
    hga_dish("hga", 2.0, (0, 0, 0.95))
    # Huygens probe — the 2.7 m blunt cone strapped FLUSH to the lower bus
    # (base ring touches the hull at x = bus radius 0.62).
    cone("huygens", 0.95, 0.22, 0.7, (1.0, 0, -0.75), MATS["shieldw"],
         verts=24, rot=(0, math.pi / 2, 0))
    torus("huygens-ring", 0.85, 0.05, (0.68, 0, -0.75), MATS["gold"],
          rot=(0, math.pi / 2, 0))
    # 3 RTGs at the base, 120° apart, mounted against the lower bus wall.
    for i in range(3):
        a = i * 2 * math.pi / 3 + 2.2
        rtg(f"rtg{i}", (math.cos(a) * 0.78, math.sin(a) * 0.78, -1.5),
            rot=(0.35, 0, a), scale=0.55)
    # 11 m magnetometer boom — bus wall → tip sensor.
    rod("mag-boom", (0, 0.6, -0.3), (0, 5.1, -0.1), 0.02, MATS["steel"], verts=6)
    sph("mag-tip", 0.06, (0, 5.1, -0.1), MATS["dark"])
    # Main engine bells below
    for s in (-1, 1):
        cone(f"engine{s}", 0.16, 0.08, 0.35, (s * 0.22, 0, -1.62), MATS["graph"], verts=16)
    export("craft-cassini.glb")


# ── Parker Solar Probe — shield-first sun diver ─────────────────────────────
def build_parker():
    clear_scene(); mats()
    # TPS heat shield: 2.3 m across, 11 cm thick, gently domed sun face (+Y)
    shield = cyl("tps", 1.15, 0.12, (0, 0.9, 0), MATS["shieldw"], verts=32,
                 rot=(math.pi / 2, 0, 0))
    sph("tps-dome", 1.15, (0, 0.97, 0), MATS["shieldw"], scale=(1, 0.08, 1))
    # Truss standoffs shield → bus
    for i in range(6):
        a = i * math.pi / 3
        cyl(f"truss{i}", 0.025, 0.5, (math.cos(a) * 0.45, 0.6, math.sin(a) * 0.45),
            MATS["steel"], verts=8, rot=(math.pi / 2, 0, 0))
    # Hex bus in the shield's shadow
    cyl("bus", 0.55, 0.9, (0, -0.05, 0), MATS["gold"], verts=6, rot=(math.pi / 2, 0, 0))
    # Twin angled solar flaps, mostly retracted behind the shield edge
    for s in (-1, 1):
        box(f"flap{s}", (0.75, 0.5, 0.03), (s * 0.95, 0.15, 0), MATS["panel"],
            rot=(0.35, 0, s * -0.25))
    # Cooling radiators just behind the shield
    for s in (-1, 1):
        box(f"rad{s}", (0.5, 0.06, 0.35), (s * 0.42, 0.52, 0), MATS["silver"])
    # Aft dish + boom
    cyl("boom", 0.02, 1.2, (0, -0.95, 0), MATS["steel"], verts=6, rot=(math.pi / 2, 0, 0))
    sph("aft-sensor", 0.07, (0, -1.55, 0), MATS["dark"])
    del shield
    export("craft-parker.glb")


# ── Explorer 1 — America's first satellite: a 2 m pencil ────────────────────
def build_explorer1():
    clear_scene(); mats()
    # Body: stripes of white + dark (thermal control pattern) along the length
    seg = 0.28
    for k in range(5):
        m = MATS["shieldw"] if k % 2 == 0 else MATS["dark"]
        cyl(f"body{k}", 0.081, seg, (0, 0, -0.55 + k * seg), MATS["silver"] if False else m, verts=20)
    # Nose cone
    cone("nose", 0.081, 0.0, 0.5, (0, 0, 1.1 - 0.25 + 0.0), MATS["shieldw"], verts=20)
    # Aft rocket section (it stayed attached) — slightly wider ring + nozzle
    cyl("aft-ring", 0.085, 0.12, (0, 0, -0.75), MATS["steel"], verts=20)
    cone("nozzle", 0.06, 0.03, 0.18, (0, 0, -0.9), MATS["graph"], verts=16)
    # Four flexible whip antennas, each rooted ON the hull at the mid-body
    # ring, sweeping outward + backward (the real fibreglass turnstiles).
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        base = (math.cos(a) * 0.079, math.sin(a) * 0.079, -0.2)
        tip = (math.cos(a) * 0.85, math.sin(a) * 0.85, -1.05)
        rod(f"whip{i}", base, tip, 0.006, MATS["silver"], verts=6)
    export("craft-explorer1.glb")


def main():
    build_voyager()
    build_cassini()
    build_parker()
    build_explorer1()


main()
