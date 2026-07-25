"""
Bake a COMET sprite in Blender (headless, Cycles) → public/textures/comet-sprite.webp.

Ankur flagged the procedural comet as a featureless smudge with no affordance.
This renders a real, readable comet billboard the GLSL engine can use in place of
the stacked additive spheres: a bright compact NUCLEUS + condensed inner COMA,
falling off into a wispy outer coma, with a directional DUST TAIL streaming to one
side (the engine rotates the billboard so the tail points anti-solar).

The sprite is authored tail-pointing +X (to the right); nucleus sits at the left
third so there's room for the tail. Transparent background.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/space-assets/bake_comet.py

Honors the engine's no-GLB rule (Blender bakes TEXTURES only).
"""

import bpy
import os
import math

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "..", "..", "public", "textures"))
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = "GPU"
    except Exception:
        sc.cycles.device = "CPU"
    sc.cycles.samples = 256
    # BLACK background, NOT transparent — the engine blends this sprite ADDITIVELY,
    # where black = fully transparent. This sidesteps all the alpha-compositing
    # plane-edge artifacts that RGBA + BLEND planes produced (the hard boxes).
    sc.render.film_transparent = False
    world = bpy.data.worlds.new("W"); world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.0
    sc.world = world
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.quality = 95
    # wide 2:1 canvas so the tail has room
    sc.render.resolution_x = 1024
    sc.render.resolution_y = 512
    sc.view_settings.view_transform = "Standard"  # crisp sprite, no filmic desat


def cam_ortho(size_x=4.0):
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = size_x
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0, 0, 10)
    cam.rotation_euler = (0, 0, 0)
    bpy.context.scene.camera = cam


def emission_plane(name, loc, scale, node_builder):
    """A camera-facing plane with an emission/alpha material driven by node_builder."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    mat = bpy.data.materials.new(name + "_mat")
    mat.use_nodes = True
    mat.blend_method = "OPAQUE"
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    node_builder(nt, out)
    ob.data.materials.append(mat)
    return ob


def radial(nt, cx=0.5, cy=0.5):
    """Return a 0..1 radial gradient value node centered at (cx,cy)."""
    texco = nt.nodes.new("ShaderNodeTexCoord")
    sub = nt.nodes.new("ShaderNodeVectorMath"); sub.operation = "SUBTRACT"
    sub.inputs[1].default_value = (cx, cy, 0)
    nt.links.new(texco.outputs["UV"], sub.inputs[0])
    length = nt.nodes.new("ShaderNodeVectorMath"); length.operation = "LENGTH"
    nt.links.new(sub.outputs["Vector"], length.inputs[0])
    return length.outputs["Value"]


def glow_material(nt, out, color, strength, falloff, cx=0.5, cy=0.5, power=2.0):
    """Emission with a radial alpha falloff → a soft glowing blob."""
    dist = radial(nt, cx, cy)
    # alpha = clamp(1 - (dist*falloff)^power)
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = falloff
    nt.links.new(dist, mul.inputs[0])
    pw = nt.nodes.new("ShaderNodeMath"); pw.operation = "POWER"
    pw.inputs[1].default_value = power
    nt.links.new(mul.outputs[0], pw.inputs[0])
    inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(pw.outputs[0], inv.inputs[1])
    clamp = nt.nodes.new("ShaderNodeClamp")
    nt.links.new(inv.outputs[0], clamp.inputs[0])

    # Additive style: emission strength MODULATED by the mask, so low-mask areas
    # emit black (= transparent under additive blend). No transparent BSDF, so no
    # plane-edge alpha artifacts.
    smul = nt.nodes.new("ShaderNodeMath"); smul.operation = "MULTIPLY"
    smul.inputs[1].default_value = strength
    nt.links.new(clamp.outputs[0], smul.inputs[0])
    emis = nt.nodes.new("ShaderNodeEmission")
    emis.inputs["Color"].default_value = (*color, 1.0)
    nt.links.new(smul.outputs[0], emis.inputs["Strength"])
    nt.links.new(emis.outputs[0], out.inputs["Surface"])


def build_comet():
    reset()
    cam_ortho(4.0)

    # Nucleus sits left-of-center so the tail streams right.
    NX = -1.15

    # --- Dust tail: a long soft wedge streaming to +X, warm cream, additive-ish.
    # Author as an elongated glow whose alpha fades along +X and across the width.
    def tail_builder(nt, out):
        texco = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(texco.outputs["UV"], sep.inputs[0])
        # along-tail fade: gone at the tip (u~1) AND ramped up from the near edge
        # (u~0) so the plane's left border doesn't show as a hard box.
        far = nt.nodes.new("ShaderNodeMath"); far.operation = "SUBTRACT"
        far.inputs[0].default_value = 1.0
        nt.links.new(sep.outputs["X"], far.inputs[1])
        near = nt.nodes.new("ShaderNodeMath"); near.operation = "MULTIPLY"
        near.inputs[1].default_value = 9.0  # ramp 0→1 over the first ~11% of X
        nt.links.new(sep.outputs["X"], near.inputs[0])
        nearc = nt.nodes.new("ShaderNodeClamp")
        nt.links.new(near.outputs[0], nearc.inputs[0])
        along = nt.nodes.new("ShaderNodeMath"); along.operation = "MULTIPLY"
        nt.links.new(far.outputs[0], along.inputs[0])
        nt.links.new(nearc.outputs[0], along.inputs[1])
        # across-tail fade: narrow (v centered)
        vc = nt.nodes.new("ShaderNodeMath"); vc.operation = "SUBTRACT"
        vc.inputs[1].default_value = 0.5
        nt.links.new(sep.outputs["Y"], vc.inputs[0])
        vab = nt.nodes.new("ShaderNodeMath"); vab.operation = "ABSOLUTE"
        nt.links.new(vc.outputs[0], vab.inputs[0])
        # widen toward the tip: allowed half-width grows with X
        width = nt.nodes.new("ShaderNodeMath"); width.operation = "MULTIPLY_ADD"
        width.inputs[1].default_value = 0.28   # slope
        width.inputs[2].default_value = 0.06   # base half-width at nucleus
        nt.links.new(sep.outputs["X"], width.inputs[0])
        acrossf = nt.nodes.new("ShaderNodeMath"); acrossf.operation = "DIVIDE"
        nt.links.new(vab.outputs[0], acrossf.inputs[0])
        nt.links.new(width.outputs[0], acrossf.inputs[1])
        acrossfade = nt.nodes.new("ShaderNodeMath"); acrossfade.operation = "SUBTRACT"
        acrossfade.inputs[0].default_value = 1.0
        nt.links.new(acrossf.outputs[0], acrossfade.inputs[1])
        a = nt.nodes.new("ShaderNodeMath"); a.operation = "MULTIPLY"
        nt.links.new(along.outputs[0], a.inputs[0])
        nt.links.new(acrossfade.outputs[0], a.inputs[1])
        clamp = nt.nodes.new("ShaderNodeClamp")
        nt.links.new(a.outputs[0], clamp.inputs[0])
        sm = nt.nodes.new("ShaderNodeMath"); sm.operation = "MULTIPLY"; sm.inputs[1].default_value = 1.1
        nt.links.new(clamp.outputs[0], sm.inputs[0])
        emis = nt.nodes.new("ShaderNodeEmission")
        emis.inputs["Color"].default_value = (1.0, 0.86, 0.62, 1.0)  # warm cream dust
        nt.links.new(sm.outputs[0], emis.inputs["Strength"])
        nt.links.new(emis.outputs[0], out.inputs["Surface"])

    # tail plane spans from nucleus rightward
    tail = emission_plane("tail", (NX + 1.35, 0, -0.1), (2.9, 1.0, 1.0), tail_builder)

    # thin bright ION tail — straighter, cooler, slightly above
    def ion_builder(nt, out):
        texco = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(texco.outputs["UV"], sep.inputs[0])
        far = nt.nodes.new("ShaderNodeMath"); far.operation = "SUBTRACT"
        far.inputs[0].default_value = 1.0
        nt.links.new(sep.outputs["X"], far.inputs[1])
        near = nt.nodes.new("ShaderNodeMath"); near.operation = "MULTIPLY"
        near.inputs[1].default_value = 9.0
        nt.links.new(sep.outputs["X"], near.inputs[0])
        nearc = nt.nodes.new("ShaderNodeClamp")
        nt.links.new(near.outputs[0], nearc.inputs[0])
        along = nt.nodes.new("ShaderNodeMath"); along.operation = "MULTIPLY"
        nt.links.new(far.outputs[0], along.inputs[0])
        nt.links.new(nearc.outputs[0], along.inputs[1])
        vc = nt.nodes.new("ShaderNodeMath"); vc.operation = "SUBTRACT"
        vc.inputs[1].default_value = 0.5
        nt.links.new(sep.outputs["Y"], vc.inputs[0])
        vab = nt.nodes.new("ShaderNodeMath"); vab.operation = "ABSOLUTE"
        nt.links.new(vc.outputs[0], vab.inputs[0])
        narrow = nt.nodes.new("ShaderNodeMath"); narrow.operation = "MULTIPLY"
        narrow.inputs[1].default_value = 14.0
        nt.links.new(vab.outputs[0], narrow.inputs[0])
        nf = nt.nodes.new("ShaderNodeMath"); nf.operation = "SUBTRACT"
        nf.inputs[0].default_value = 1.0
        nt.links.new(narrow.outputs[0], nf.inputs[1])
        a = nt.nodes.new("ShaderNodeMath"); a.operation = "MULTIPLY"
        nt.links.new(along.outputs[0], a.inputs[0])
        nt.links.new(nf.outputs[0], a.inputs[1])
        clamp = nt.nodes.new("ShaderNodeClamp")
        nt.links.new(a.outputs[0], clamp.inputs[0])
        sm = nt.nodes.new("ShaderNodeMath"); sm.operation = "MULTIPLY"; sm.inputs[1].default_value = 1.4
        nt.links.new(clamp.outputs[0], sm.inputs[0])
        emis = nt.nodes.new("ShaderNodeEmission")
        emis.inputs["Color"].default_value = (0.5, 0.75, 1.0, 1.0)  # electric blue ion
        nt.links.new(sm.outputs[0], emis.inputs["Strength"])
        nt.links.new(emis.outputs[0], out.inputs["Surface"])

    ion = emission_plane("ion", (NX + 1.5, 0.18, -0.05), (3.2, 0.7, 1.0), ion_builder)

    # --- Coma layers (radial glows) at the nucleus. Strengths kept LOW so the
    #     layers read as translucent glow, not a white-out. Sizes stepped so the
    #     falloff is visible: big faint outer → tight brighter inner. ---
    outer = emission_plane("coma_outer", (NX, 0, -0.05), (2.2, 2.2, 1.0),
                           lambda nt, o: glow_material(nt, o, (0.30, 0.62, 0.72), 0.28, 2.1, power=2.4))
    mid = emission_plane("coma_mid", (NX, 0, 0.0), (1.25, 1.25, 1.0),
                         lambda nt, o: glow_material(nt, o, (0.42, 0.82, 0.72), 0.55, 2.2, power=2.1))
    inner = emission_plane("coma_inner", (NX, 0, 0.05), (0.62, 0.62, 1.0),
                           lambda nt, o: glow_material(nt, o, (0.62, 0.95, 0.80), 1.0, 2.1, power=1.9))

    # --- Nucleus — small, warm-gold core. Distinct + bright but NOT blown out,
    #     so there's a clear compact body to aim at against the coma. ---
    core = emission_plane("nucleus", (NX, 0, 0.1), (0.22, 0.22, 1.0),
                          lambda nt, o: glow_material(nt, o, (1.0, 0.90, 0.68), 2.6, 3.2, power=2.8))

    bpy.context.scene.render.filepath = os.path.join(OUT, "comet-sprite.webp")
    bpy.ops.render.render(write_still=True)
    print("WROTE", bpy.context.scene.render.filepath)


build_comet()
