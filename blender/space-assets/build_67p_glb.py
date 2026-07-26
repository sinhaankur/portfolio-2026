"""
Build a Rosetta-accurate COMET 67P nucleus GLB → public/models/comet-67p.glb.

The first *per-comet* asset of the Blender-GLB plan. Every other comet in the
engine shares the generic irregular rock (comet-nucleus-hi.glb) — the honest
choice, because no other comet nucleus in our list has ever been imaged in 3D.
67P/Churyumov–Gerasimenko is the exception: ESA's Rosetta mission (2014–16)
mapped it in detail, so we know its real, unmistakable shape.

That shape is the famous bilobed "rubber duck":
  • a LARGE lobe (the "body")   ~4.1 × 3.3 × 1.8 km
  • a SMALL lobe (the "head")   ~2.6 × 2.3 × 1.8 km
  • joined by a smooth, CONCAVE neck (the Hapi region) — the dust-covered
    saddle that makes the two lobes read as one continuous body.
Overall extent ~4.3 km along the long axis; blacker than coal (albedo ~0.06).

APPROACH: metaballs. Two overlapping metaball ellipsoids naturally fuse into a
single smooth surface with a waisted neck between them — exactly the 67P
silhouette (a boolean-union of two spheres leaves a hard seam; metaballs give
the real saddle for free). We convert to mesh, add large-scale irregularity +
craters so it isn't a smooth ball, decimate to stay web-light, then export
nucleus-only (engine lights it + keeps its procedural coma/ion+dust tails/jets).

Long axis along X. Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_67p_glb.py
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
    bsdf.inputs["Roughness"].default_value = 0.98
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.15
    return m


def _norm(t):
    l = math.sqrt(sum(c * c for c in t)) or 1.0
    return (t[0] / l, t[1] / l, t[2] / l)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def build():
    reset()
    random.seed(67)

    # Real 67P proportions (long axis = X). K scales km → Blender units so the
    # joined nucleus spans ~2 units along X (engine applies its own visualRadius).
    K = 0.232

    # --- Metaball object: two fused ellipsoids = the bilobed duck ---
    mb = bpy.data.metaballs.new("Comet67P_MB")
    mb.resolution = 0.12       # finer surface detail of the metaball tessellation
    mb.threshold = 0.9         # LOWER wall → lobes reach further + fuse through neck
    mbobj = bpy.data.objects.new("Comet67P_MB", mb)
    bpy.context.collection.objects.link(mbobj)

    # BODY (large lobe) on -X, sitting low. Lobes pulled CLOSER so the field
    # overlaps through the neck and the surface stays continuous (one duck).
    e_body = mb.elements.new(type="ELLIPSOID")
    e_body.co = (-1.9 * K, 0.0, -0.10 * K)
    e_body.size_x = 4.1 * K * 0.55
    e_body.size_y = 3.3 * K * 0.58
    e_body.size_z = 1.9 * K * 0.62
    e_body.radius = 2.2

    # HEAD (small lobe) on +X, riding higher (the duck's head/bill)
    e_head = mb.elements.new(type="ELLIPSOID")
    e_head.co = (2.0 * K, 0.05 * K, 0.34 * K)
    e_head.size_x = 2.6 * K * 0.55
    e_head.size_y = 2.3 * K * 0.58
    e_head.size_z = 1.9 * K * 0.62
    e_head.radius = 1.8

    # NECK bridge — a fatter, thin-in-Z ellipsoid straddling the join so the two
    # lobes ALWAYS connect through a waisted, dust-covered saddle (Hapi region).
    e_neck = mb.elements.new(type="ELLIPSOID")
    e_neck.co = (0.05 * K, 0.0, 0.05 * K)
    e_neck.size_x = 1.8 * K * 0.55
    e_neck.size_y = 1.6 * K * 0.58
    e_neck.size_z = 0.8 * K * 0.62
    e_neck.radius = 1.7

    # Convert metaball → mesh (a single, smoothly-fused surface)
    bpy.context.view_layer.objects.active = mbobj
    mbobj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    nucleus = bpy.context.view_layer.objects.active
    nucleus.name = "Comet67P"
    me = nucleus.data

    # --- Sculpt real irregularity onto the fused surface -------------------
    rng = random.Random(67)
    fx, fy, fz = (rng.uniform(0, math.tau) for _ in range(3))

    # 1) large-scale lumps so it's faceted, not a smooth balloon
    for v in me.vertices:
        n = v.co.normalized()
        lump = (
            0.11 * math.sin(2.3 * n.x + fx) +
            0.09 * math.sin(1.9 * n.y + fy) +
            0.08 * math.sin(2.6 * n.z + fz)
        )
        v.co += n * lump * K * 3.0

    # 2) craters — concave dents (67P: Ash, Seth, Ma'at, Imhotep regions)
    craters = []
    for _ in range(rng.randint(5, 7)):
        cdir = _norm((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        craters.append((cdir, rng.uniform(0.28, 0.5), rng.uniform(0.06, 0.12)))
    for v in me.vertices:
        n = v.co.normalized()
        for cdir, radius, depth in craters:
            d = _dot(n, cdir)
            if d > (1.0 - radius):
                t = (d - (1.0 - radius)) / radius
                v.co -= n * depth * (t * t) * (3 - 2 * t)

    # 3) fine grain
    for v in me.vertices:
        v.co += v.co.normalized() * rng.uniform(-0.02, 0.012)

    # --- Clean + decimate to stay web-light --------------------------------
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.006)
    bm.to_mesh(me)
    bm.free()

    dec = nucleus.modifiers.new("Decimate", type="DECIMATE")
    dec.ratio = 0.6
    bpy.ops.object.modifier_apply(modifier="Decimate")

    # centre origin so the engine spins it about its middle
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    nucleus.location = (0, 0, 0)

    # dark matte cometary regolith
    me.materials.clear()
    me.materials.append(rocky("Comet67P_Rock", (0.085, 0.078, 0.068)))
    for p in me.polygons:
        p.use_smooth = True

    # --- Export nucleus-only GLB -------------------------------------------
    bpy.ops.object.select_all(action="DESELECT")
    nucleus.select_set(True)
    bpy.context.view_layer.objects.active = nucleus
    path = os.path.join(OUT, "comet-67p.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True,
    )
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    print("WROTE", path, "| tris≈", tris, "| verts", len(me.vertices))
    print("BOUNDS", [round(d, 3) for d in nucleus.dimensions])


build()
