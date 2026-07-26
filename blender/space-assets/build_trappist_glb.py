"""
Build the 7 TRAPPIST-1 rocky worlds as GLBs → public/models/trappist-{b..h}.glb.

TRAPPIST-1 is the most planet-rich nearby system: seven Earth-sized rocky worlds
around an ultra-cool red dwarf, three–four in the habitable zone. None has been
imaged, so these surfaces are INFERRED from each planet's measured radius, insolation
and JWST atmosphere constraints — honest "by type", not invented detail:

  b  hot bare basalt (JWST 2023: no thick atmosphere; dayside ~500 K)
  c  hot bare rock, Venus-like  (JWST: little atmosphere)
  d  warm rocky, just inside the inner HZ edge
  e  temperate, heart of the liquid-water zone — the best habitability candidate
  f  temperate, water-rich possible
  g  cool, outer HZ — likely icy/volatile-rich
  h  cold snowball — outermost, sub-freezing

We render three honest surface archetypes with per-planet tint + polar ice caps
scaled to temperature:
  HOT   → dark basalt, cracked, glowing fissures hint (no ice)
  TEMP  → mixed rock + hints of water/cloud tone, thin caps
  COLD  → bright ice/rock, big polar caps (snowball)

Unit-radius spheres (the engine scales each by its real radiusEarth). Low-poly +
procedural displacement, no textures — web-light (<15 KB each).

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_trappist_glb.py
"""

import bpy
import os
import math
import random

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "..", "..", "public", "models"))
os.makedirs(OUT, exist_ok=True)

# planet letter → (archetype, base color, cap color, cap size 0..1, seed)
PLANETS = {
    "b": ("hot",  (0.16, 0.10, 0.08), (0.30, 0.14, 0.10), 0.00, 11),
    "c": ("hot",  (0.20, 0.13, 0.09), (0.34, 0.18, 0.12), 0.00, 22),
    "d": ("temp", (0.34, 0.24, 0.17), (0.62, 0.62, 0.66), 0.10, 33),
    "e": ("temp", (0.24, 0.28, 0.30), (0.70, 0.74, 0.78), 0.16, 44),  # best HZ candidate — bluer
    "f": ("temp", (0.26, 0.30, 0.29), (0.74, 0.78, 0.82), 0.22, 55),
    "g": ("cold", (0.40, 0.44, 0.50), (0.86, 0.90, 0.96), 0.34, 66),
    "h": ("cold", (0.52, 0.56, 0.62), (0.90, 0.94, 1.0),  0.46, 77),  # snowball
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def rocky_mat(name, base, roughness=0.95, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    if emit is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 0.4
    return m


def build_planet(letter, archetype, base, cap, cap_size, seed):
    reset()
    rng = random.Random(seed)

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0)
    ob = bpy.context.active_object
    ob.name = f"TRAPPIST-1{letter}"
    me = ob.data

    # surface relief: low-freq lumps + craters, magnitude by archetype
    relief = {"hot": 0.05, "temp": 0.04, "cold": 0.035}[archetype]
    fx, fy, fz = (rng.uniform(0, math.tau) for _ in range(3))
    for v in me.vertices:
        n = v.co.normalized()
        d = (math.sin(3.1 * n.x + fx) + math.sin(2.7 * n.y + fy) + math.sin(3.5 * n.z + fz)) / 3
        v.co += n * d * relief

    # a few craters
    for _ in range(rng.randint(4, 7)):
        cd = _norm((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        radius = rng.uniform(0.2, 0.4); depth = rng.uniform(0.02, 0.05)
        for v in me.vertices:
            nn = v.co.normalized()
            dot = nn.x * cd[0] + nn.y * cd[1] + nn.z * cd[2]
            if dot > 1 - radius:
                t = (dot - (1 - radius)) / radius
                v.co -= nn * depth * (t * t) * (3 - 2 * t)

    for p in me.polygons:
        p.use_smooth = True

    # base surface material (hot worlds get a faint warm emissive glow in fissures)
    emit = (0.5, 0.12, 0.05) if archetype == "hot" else None
    base_mat = rocky_mat(f"t1{letter}_surf", base, emit=emit)
    me.materials.append(base_mat)

    # polar ice caps — assign a bright cap material to faces near the poles,
    # sized by cap_size (snowball worlds get big caps; hot worlds get none)
    if cap_size > 0.0:
        cap_mat = rocky_mat(f"t1{letter}_cap", cap, roughness=0.6)
        me.materials.append(cap_mat)
        cap_idx = len(me.materials) - 1
        # face is "polar" if its centroid |z| is high enough (cap_size → threshold)
        thresh = 1.0 - cap_size
        for poly in me.polygons:
            cz = sum(me.vertices[i].co.z for i in poly.vertices) / len(poly.vertices)
            r = math.sqrt(sum((sum(me.vertices[i].co[a] for i in poly.vertices) / len(poly.vertices)) ** 2 for a in range(3))) or 1
            if abs(cz) / r > thresh:
                poly.material_index = cap_idx

    # export
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    path = os.path.join(OUT, f"trappist-{letter}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True,
    )
    size = os.path.getsize(path)
    print(f"WROTE trappist-{letter}.glb ({archetype}) | {size} bytes")


def _norm(t):
    l = math.sqrt(sum(c * c for c in t)) or 1.0
    return (t[0] / l, t[1] / l, t[2] / l)


for letter, (arch, base, cap, cap_size, seed) in PLANETS.items():
    build_planet(letter, arch, base, cap, cap_size, seed)
print("ALL 7 DONE")
