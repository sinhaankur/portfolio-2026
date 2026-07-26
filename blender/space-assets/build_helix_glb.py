"""
Build the HELIX NEBULA ("Eye of God") as an emissive GLB → public/models/nebula-helix.glb.

The Helix (NGC 7293) is the closest planetary nebula — a Sun-like star that shed
its outer layers ~10,600 yr ago, leaving a white dwarf inside glowing concentric
shells. It is DIFFUSE GAS, not a surface, so we do NOT build a solid donut: we
build layered TRANSLUCENT EMISSIVE shells + its signature radial "cometary knots"
so it reads as light and depth, not plastic. Real, recognisable structure:

  • a bright inner RING (O III teal-green) — the classic annulus,
  • a larger, fainter outer ring / disc (Hα red) tilted slightly to the inner one
    (the real Helix is two roughly-perpendicular disks seen near face-on → the
    "eye" look),
  • thousands of COMETARY KNOTS around the inner rim: dense globules whose heads
    point toward the central star and whose tails stream radially OUTWARD (the
    Hubble-famous "tadpoles"). We fake the population with a ring of small
    radially-oriented droplets,
  • a bright central WHITE DWARF point + a faint blue-white glow.

Authored face-on in the XY plane (ring normal = +Z) so the engine can billboard
it toward the camera. Emissive materials (no textures), alpha-blended, web-light.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_helix_glb.py
"""

import bpy
import bmesh
import os
import math
import random

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "..", "..", "public", "models"))
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def emissive(name, color, strength, alpha=1.0):
    """Emissive material; when alpha<1 it's mixed with transparency for glow."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emis = nt.nodes.new("ShaderNodeEmission")
    emis.inputs["Color"].default_value = (*color, 1.0)
    emis.inputs["Strength"].default_value = strength
    if alpha < 1.0:
        transp = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        mix.inputs["Fac"].default_value = alpha
        nt.links.new(transp.outputs[0], mix.inputs[1])
        nt.links.new(emis.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
        m.blend_method = "BLEND"
        m.use_backface_culling = False
    else:
        nt.links.new(emis.outputs[0], out.inputs["Surface"])
    return m


def torus(name, major, minor, mat, rot=(0, 0, 0), squash_z=1.0, seg=48, ring=14):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor,
        major_segments=seg, minor_segments=ring,
    )
    ob = bpy.context.active_object
    ob.name = name
    ob.rotation_euler = rot
    if squash_z != 1.0:
        for v in ob.data.vertices:
            v.co.z *= squash_z
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def disc(name, radius, mat, z=0.0, squash_z=0.10):
    """A thin lens/disc of emissive gas — a SMOOTH high-segment UV-sphere
    flattened in Z (no faceted edges), so it reads as a soft glow shell rather
    than a low-poly plate. Rendered additively in-engine, so its alpha stacks
    into light, not a solid surface."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=radius)
    ob = bpy.context.active_object
    ob.name = name
    for v in ob.data.vertices:
        v.co.z *= squash_z
    ob.location.z = z
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def build():
    reset()
    random.seed(7293)

    # Palette (astrophoto-accurate): inner O III teal, outer Hα red, blue core.
    # NOTE strengths are LOW: the engine renders these ADDITIVELY, where emission
    # stacks fast — values that look right in Blender's BLEND preview blow out to
    # white additively. Tuned for the additive composite (glowing gas, not a lamp).
    m_oiii   = emissive("Helix_OIII",  (0.30, 0.85, 0.80), 0.85, alpha=0.55)  # inner teal ring
    m_ha     = emissive("Helix_Halpha",(0.95, 0.26, 0.30), 0.55, alpha=0.32)  # outer red ring
    m_haze   = emissive("Helix_Haze",  (0.45, 0.55, 0.95), 0.20, alpha=0.05)  # faint blue disc fill (whisper)
    m_knot   = emissive("Helix_Knot",  (0.72, 0.98, 0.80), 0.9,  alpha=0.75)  # cometary knots
    m_core   = emissive("Helix_Core",  (0.85, 0.92, 1.0),  1.6,  alpha=1.0)   # white dwarf (small + modest)
    m_halo   = emissive("Helix_Halo",  (0.90, 0.40, 0.45), 0.14, alpha=0.05)  # faint outer halo

    # --- Inner O III ring — the bright teal annulus (the "iris") ---
    torus("Helix_InnerRing", major=1.0, minor=0.20, mat=m_oiii, squash_z=0.42)

    # --- Outer Hα ring — larger, thinner, tilted a touch off the inner one (the
    #     two-disk geometry that gives the Helix its layered "eye" look) ---
    torus("Helix_OuterRing", major=1.55, minor=0.22, mat=m_ha,
          rot=(math.radians(14), math.radians(6), 0), squash_z=0.5)

    # --- Faint blue haze disc filling the pupil so the centre isn't a hole ---
    disc("Helix_Haze", radius=0.72, mat=m_haze, squash_z=0.05)

    # --- Faint outer red halo (very soft, whisper alpha) ---
    disc("Helix_Halo", radius=2.2, mat=m_halo, squash_z=0.04)

    # --- Cometary knots — a ring of small radially-oriented droplets on the inner
    #     rim. Heads toward the star, tails stream outward: we model each as a tiny
    #     stretched ico-sphere pointing radially. Merge into ONE mesh (instances of
    #     the same material) so it stays a single cheap object. ---
    knot_bm = bmesh.new()
    N = 150
    for i in range(N):
        ang = (i / N) * math.tau + random.uniform(-0.03, 0.03)
        # sit them ON the inner teal rim (r≈1.0), a fringe of tadpoles
        r = 1.05 + random.uniform(-0.05, 0.14)
        cx, cy = math.cos(ang) * r, math.sin(ang) * r
        cz = random.uniform(-0.06, 0.06)
        # a tiny elongated droplet: build a small ico-sphere in a temp bmesh,
        # stretch it radially (tail outward), rotate to the angle, place it.
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=random.uniform(0.05, 0.085))
        # stretch along local X into a teardrop, taper the tail (points inward,
        # tail streams radially outward — the real cometary-knot geometry)
        for v in tmp.verts:
            v.co.x *= 3.0
            if v.co.x < 0:                       # tail side
                v.co.y *= 0.4
                v.co.z *= 0.4
        rot = mathutils_z_rot(ang)
        for v in tmp.verts:
            x, y = v.co.x, v.co.y
            v.co.x = x * math.cos(ang) - y * math.sin(ang) + cx
            v.co.y = x * math.sin(ang) + y * math.cos(ang) + cy
            v.co.z = v.co.z + cz
        # append tmp into knot_bm
        me_tmp = bpy.data.meshes.new("k")
        tmp.to_mesh(me_tmp); tmp.free()
        knot_bm.from_mesh(me_tmp)
        bpy.data.meshes.remove(me_tmp)
    knot_me = bpy.data.meshes.new("Helix_Knots")
    knot_bm.to_mesh(knot_me); knot_bm.free()
    knots = bpy.data.objects.new("Helix_Knots", knot_me)
    bpy.context.collection.objects.link(knots)
    knots.data.materials.append(m_knot)
    for p in knots.data.polygons:
        p.use_smooth = True

    # --- Central white dwarf point (tiny, modest — a pinprick, not a beam).
    #     Kept small + low strength so it never throws an additive column. ---
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.03)
    core = bpy.context.active_object
    core.name = "Helix_WhiteDwarf"
    core.data.materials.append(m_core)
    for p in core.data.polygons:
        p.use_smooth = True

    # Rings were authored flat in the XY plane (normal +Z). We DON'T pre-rotate:
    # the engine orients the nebula at runtime (billboard toward camera), and the
    # glTF y-up export is accounted for there. Keeping the authored frame makes
    # the runtime orientation math predictable (ring face = local +Z in Blender →
    # local +Y after y-up import; the component rotates for that).

    # --- Export everything as one GLB ---
    bpy.ops.object.select_all(action="DESELECT")
    for ob in bpy.data.objects:
        ob.select_set(True)
    path = os.path.join(OUT, "nebula-helix.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True,
    )
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in bpy.data.objects if o.type == "MESH")
    print("WROTE", path, "| total tris≈", tris)


def mathutils_z_rot(a):
    return a  # placeholder (rotation applied inline above)


build()
