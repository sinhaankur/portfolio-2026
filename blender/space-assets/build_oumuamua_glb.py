"""
Build an INFERRED 'Oumuamua GLB → public/models/oumuamua.glb.

'Oumuamua (1I/2017 U1) is the first known interstellar object. Unlike 67P, it
was NEVER imaged as a resolved disk — it was a single point of light. Everything
we "know" about its shape comes from its light curve: it brightened and dimmed by
a factor of ~10 every ~3.6 h, which means it is extremely elongated. The two
shape models that fit are a long CIGAR (~115 × 111 × 19 m in one solution) or a
flat PANCAKE. We render the iconic cigar — but it is an INFERENCE, not a picture,
and the engine labels it as such (matching how Eris/Makemake/Haumea surfaces are
flagged "inferred"). We must NOT present a guess as fact.

So: a long, irregular, dark-reddish tumbling shard — clearly cigar-like, ~6:1
elongation, cratered/faceted so it reads as a real rock, not a capsule. Long axis
along X. Dark reddish "organic-rich, space-weathered" surface (D-type-ish).
Web-light like the rest of the pipeline; exported as one mesh so the engine can
tumble it end-over-end (its real rotation was a chaotic tumble).

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_oumuamua_glb.py
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


def rocky(name, color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.97
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.2
    return m


def _norm(t):
    l = math.sqrt(sum(c * c for c in t)) or 1.0
    return (t[0] / l, t[1] / l, t[2] / l)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def build():
    reset()
    random.seed(2017)  # discovery year, for a stable shape

    # Start from an icosphere, stretch HARD along X to a ~6:1 cigar.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0)
    ob = bpy.context.active_object
    ob.name = "Oumuamua"
    me = ob.data
    rng = random.Random(2017)

    # 1) elongate: cigar proportion ~6 : 1 : 0.9 (long, and slightly flattened
    #    on one cross-axis — a compromise between the cigar and pancake models)
    for v in me.vertices:
        v.co.x *= 1.0            # long axis (kept, scaled below via taper)
        v.co.y *= 0.34
        v.co.z *= 0.30
    for v in me.vertices:
        v.co.x *= 3.0            # push elongation to ~6:1 overall

    # 2) taper both ends so it's a spindle, not a capsule (ends narrower)
    for v in me.vertices:
        t = min(1.0, abs(v.co.x) / 3.0)
        taper = 1.0 - 0.55 * (t ** 1.6)
        v.co.y *= taper
        v.co.z *= taper

    # 3) large-scale irregularity — low-freq lumps so it's a faceted rock
    fx, fy, fz = (rng.uniform(0, math.tau) for _ in range(3))
    for v in me.vertices:
        n = v.co.normalized()
        lump = (
            0.10 * math.sin(3.1 * n.x + fx) +
            0.08 * math.sin(2.3 * n.y + fy) +
            0.07 * math.sin(2.8 * n.z + fz)
        )
        v.co += n * lump

    # 4) craters — a few concave dents along the body
    craters = []
    for _ in range(rng.randint(5, 7)):
        cdir = _norm((rng.uniform(-1, 1), rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6)))
        craters.append((cdir, rng.uniform(0.22, 0.42), rng.uniform(0.05, 0.10)))
    for v in me.vertices:
        n = v.co.normalized()
        for cdir, radius, depth in craters:
            d = _dot(n, cdir)
            if d > (1.0 - radius):
                s = (d - (1.0 - radius)) / radius
                v.co -= n * depth * (s * s) * (3 - 2 * s)

    # 5) fine grain
    for v in me.vertices:
        v.co += v.co.normalized() * rng.uniform(-0.03, 0.02)

    # clean + light decimate to stay web-light
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.005)
    bm.to_mesh(me)
    bm.free()
    dec = ob.modifiers.new("Decimate", type="DECIMATE")
    dec.ratio = 0.55
    bpy.ops.object.modifier_apply(modifier="Decimate")

    # centre + normalise so the long axis spans ~2 units (engine scales it)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    ob.location = (0, 0, 0)
    long_axis = ob.dimensions.x or 1.0
    s = 2.0 / long_axis
    for v in me.vertices:
        v.co *= s
    me.update()

    # dark reddish, space-weathered organic-rich surface (D-type-ish)
    me.materials.clear()
    me.materials.append(rocky("Oumuamua_Rock", (0.16, 0.09, 0.065)))
    for p in me.polygons:
        p.use_smooth = True

    # export one mesh
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    path = os.path.join(OUT, "oumuamua.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True,
    )
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    print("WROTE", path, "| tris≈", tris, "| verts", len(me.vertices))
    print("BOUNDS", [round(d, 3) for d in ob.dimensions])


build()
