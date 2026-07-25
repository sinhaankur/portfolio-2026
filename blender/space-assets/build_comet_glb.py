"""
Build a real COMET GLB in Blender → public/models/comet.glb.

The first asset of the 'all Universe Engine bodies as Blender GLB' plan. Real 3D
geometry solves what the 2D sprite couldn't (stacked emission planes occluded
each other): a proper nucleus mesh, a translucent emissive coma shell, and a
tapered tail — authored with the tail along +Y so the engine can orient the
whole model anti-solar with a single quaternion.

Kept web-light (target < ~120 KB): low-poly, emissive materials (no textures),
GLB with draco off (small enough already).

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/build_comet_glb.py
"""

import bpy
import os
import math

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "..", "..", "public", "models"))
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def emissive(name, color, strength, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emis = nt.nodes.new("ShaderNodeEmission")
    emis.inputs["Color"].default_value = (*color, 1.0)
    emis.inputs["Strength"].default_value = strength
    if alpha < 1.0:
        # translucent glow: mix emission with transparent by alpha
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


def rocky(name, color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.95
    return m


def build():
    reset()
    coll = bpy.context.collection

    # --- 1. Nucleus: an irregular low-poly rock at the origin ---
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.32)
    nucleus = bpy.context.active_object
    nucleus.name = "CometNucleus"
    # displace vertices for an irregular lump
    import random
    random.seed(7)
    me = nucleus.data
    for v in me.vertices:
        v.co *= (1.0 + random.uniform(-0.22, 0.16))
    nucleus.data.materials.append(rocky("Nucleus", (0.10, 0.09, 0.08)))
    # a faint self-emission so it's never pure black against space
    nucleus.data.materials.append(emissive("NucleusGlow", (0.9, 0.85, 0.7), 0.6))
    for p in nucleus.data.polygons:
        p.material_index = 0

    # --- 2. Coma: two translucent emissive shells around the nucleus ---
    for r, col, strg, a, nm in [
        (0.9, (0.62, 0.95, 0.80), 1.4, 0.42, "ComaInner"),
        (1.5, (0.35, 0.72, 0.78), 0.7, 0.22, "ComaOuter"),
    ]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=r)
        shell = bpy.context.active_object
        shell.name = nm
        shell.data.materials.append(emissive(nm + "M", col, strg, alpha=a))
        # shade smooth
        for p in shell.data.polygons:
            p.use_smooth = True

    # --- 3. Tail: a long tapered cone streaming along +Y (anti-solar in-engine) ---
    # Dust tail (broad, warm cream)
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.7, radius2=0.02, depth=4.2,
                                    location=(0, 2.3, 0), rotation=(math.radians(90), 0, 0))
    dust = bpy.context.active_object
    dust.name = "DustTail"
    dust.data.materials.append(emissive("DustTailM", (1.0, 0.86, 0.62), 0.9, alpha=0.3))
    for p in dust.data.polygons:
        p.use_smooth = True

    # Ion tail (narrow, straight, electric blue) — slightly longer
    bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.22, radius2=0.01, depth=5.0,
                                    location=(0, 2.7, 0.12), rotation=(math.radians(90), 0, 0))
    ion = bpy.context.active_object
    ion.name = "IonTail"
    ion.data.materials.append(emissive("IonTailM", (0.5, 0.75, 1.0), 1.4, alpha=0.4))
    for p in ion.data.polygons:
        p.use_smooth = True

    # --- Also export a NUCLEUS-ONLY GLB — the engine keeps its (good) procedural
    #     coma + tail shaders and just swaps the plain icosahedron nucleus for
    #     this detailed irregular rock. Lowest-risk wire-in. ---
    bpy.ops.object.select_all(action="DESELECT")
    nucleus.select_set(True)
    # strip the emissive slot for the standalone nucleus (engine lights it)
    nuc_path = os.path.join(OUT, "comet-nucleus-hi.glb")
    bpy.ops.export_scene.gltf(
        filepath=nuc_path, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True,
    )
    print("WROTE", nuc_path)

    # --- Export the whole comet as one GLB ---
    for ob in bpy.data.objects:
        ob.select_set(True)
    path = os.path.join(OUT, "comet.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )
    print("WROTE", path)


build()
