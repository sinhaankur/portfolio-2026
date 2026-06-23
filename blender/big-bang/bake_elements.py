"""
Bake the Big Bang scene's visual ELEMENTS in Blender (headless).

Renders, with Cycles, to public/img/space/bigbang/:
  - star.webp        a soft glowing star sprite (bright core, smooth glow falloff)
  - nebula.webp      a wispy dust/gas cloud (for the cooling/structure epochs)
  - cmb.webp         an equirectangular CMB-style mottled sky (the first light)

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/big-bang/bake_elements.py

Pure Blender output — these become the in-scene elements the real-time R3F field
uses (like the Universe Engine's Blender textures), honoring 'every element
rendered in Blender' while the scene stays interactive.
"""

import bpy
import os
import math
import mathutils

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                   "public", "img", "space", "bigbang")
OUT = os.path.abspath(OUT)
os.makedirs(OUT, exist_ok=True)


# ---------- helpers ----------
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    # Apple-silicon GPU if available, else CPU — keep it robust headless.
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = "GPU"
    except Exception:
        sc.cycles.device = "CPU"
    sc.cycles.samples = 128
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.quality = 92


def cam_ortho(size=2.2):
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = size
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0, 0, 6)
    cam.rotation_euler = (0, 0, 0)
    bpy.context.scene.camera = cam
    return cam


def render(name, w=1024, h=1024):
    sc = bpy.context.scene
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print("rendered", os.path.join(OUT, name))


def centered_coord(nt):
    """Return a Vector socket where the plane CENTRE is the origin (0,0,0) and the
    edges reach ±1. (TexCoord 'Generated' is 0..1, so a Spherical gradient on it
    peaks in a CORNER — this remaps (uv-0.5)*2 so radial textures centre properly.)"""
    tex = nt.nodes.new("ShaderNodeTexCoord")
    sub = nt.nodes.new("ShaderNodeVectorMath"); sub.operation = "SUBTRACT"
    sub.inputs[1].default_value = (0.5, 0.5, 0.5)
    nt.links.new(tex.outputs["Generated"], sub.inputs[0])
    mul = nt.nodes.new("ShaderNodeVectorMath"); mul.operation = "SCALE"
    mul.inputs["Scale"].default_value = 2.0
    nt.links.new(sub.outputs["Vector"], mul.inputs[0])
    return mul.outputs["Vector"]


def emission_plane(name, build_nodes):
    """A camera-facing plane whose emission shader is built by build_nodes(nt)."""
    bpy.ops.mesh.primitive_plane_add(size=2.0)
    obj = bpy.context.active_object
    obj.name = name
    mat = bpy.data.materials.new(name + "_mat")
    mat.use_nodes = True
    mat.blend_method = "BLEND"
    nt = mat.node_tree
    nt.nodes.clear()
    build_nodes(nt)
    obj.data.materials.append(mat)
    return obj


# ---------- 1. star sprite ----------
def build_star(nt):
    """Tight hot core with a wide soft glow falloff. The radial distance drives
    BOTH the emission brightness AND the alpha, so the sprite genuinely fades to
    transparent at the rim (no square edge) and has a bright believable core."""
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    coord = centered_coord(nt)
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"          # 1 at centre → 0 at rim
    nt.links.new(coord, grad.inputs["Vector"])

    # glow profile: pow() to make a tight bright core with a long soft tail
    glow = nt.nodes.new("ShaderNodeMath"); glow.operation = "POWER"
    glow.inputs[1].default_value = 2.2
    nt.links.new(grad.outputs["Fac"], glow.inputs[0])

    # colour ramp: white-hot core → warm gold → deep transparent edge
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position = 0.0; e[0].color = (0.05, 0.02, 0.0, 1)    # rim: near black (low glow)
    e[1].position = 1.0; e[1].color = (1.0, 1.0, 1.0, 1)      # core: white hot
    m1 = ramp.color_ramp.elements.new(0.5); m1.color = (1.0, 0.8, 0.5, 1)  # gold
    nt.links.new(glow.outputs["Value"], ramp.inputs["Fac"])

    emit.inputs["Strength"].default_value = 14.0
    nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])

    # alpha = the glow profile too, so the disc fades smoothly to nothing
    nt.links.new(glow.outputs["Value"], mix.inputs["Fac"])
    nt.links.new(transp.outputs["BSDF"], mix.inputs[1])
    nt.links.new(emit.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])


# ---------- 2. nebula / dust cloud ----------
def build_nebula(nt):
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    tex = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.6
    noise.inputs["Detail"].default_value = 10.0
    noise.inputs["Roughness"].default_value = 0.62
    # contrast the noise so we get distinct dense filaments vs voids (not a flat haze)
    dens = nt.nodes.new("ShaderNodeMath"); dens.operation = "POWER"
    dens.inputs[1].default_value = 2.2
    nt.links.new(noise.outputs["Fac"], dens.inputs[0])

    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    falloff = nt.nodes.new("ShaderNodeMath"); falloff.operation = "POWER"
    falloff.inputs[1].default_value = 1.4
    inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    # boost overall opacity so it actually reads
    boost = nt.nodes.new("ShaderNodeMath"); boost.operation = "MULTIPLY"
    boost.inputs[1].default_value = 1.8
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position = 0.0; e[0].color = (0.25, 0.05, 0.5, 1)    # deep violet voids
    e[1].position = 1.0; e[1].color = (1.0, 0.55, 0.35, 1)    # hot pink/orange cores
    mid = ramp.color_ramp.elements.new(0.5); mid.color = (0.75, 0.25, 0.85, 1)  # magenta
    nt.links.new(tex.outputs["Generated"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], falloff.inputs[0])
    nt.links.new(falloff.outputs["Value"], inv.inputs[1])
    nt.links.new(dens.outputs["Value"], mul.inputs[0])
    nt.links.new(inv.outputs["Value"], mul.inputs[1])
    nt.links.new(mul.outputs["Value"], boost.inputs[0])
    nt.links.new(noise.outputs["Color"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])
    emit.inputs["Strength"].default_value = 3.2
    nt.links.new(boost.outputs["Value"], mix.inputs["Fac"])
    nt.links.new(transp.outputs["BSDF"], mix.inputs[1])
    nt.links.new(emit.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])


# ---------- 3. CMB sky (mottled, the first light) ----------
def build_cmb_world():
    sc = bpy.context.scene
    world = bpy.data.worlds.new("CMB")
    sc.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 18.0
    noise.inputs["Detail"].default_value = 6.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "LINEAR"
    e = ramp.color_ramp.elements
    # CMB false-colour-ish: cool blue → warm red anisotropies
    e[0].position = 0.42; e[0].color = (0.1, 0.2, 0.6, 1)
    e[1].position = 0.58; e[1].color = (0.8, 0.2, 0.1, 1)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def render_cmb():
    reset_scene()
    bpy.context.scene.render.film_transparent = False
    build_cmb_world()
    # equirectangular camera to capture the whole sky
    cam_data = bpy.data.cameras.new("Pano")
    cam_data.type = "PANO"
    try:
        cam_data.panorama_type = "EQUIRECTANGULAR"
    except Exception:
        pass
    cam = bpy.data.objects.new("Pano", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.camera = cam
    render("cmb.webp", 2048, 1024)


# ---------- main ----------
def main():
    # star
    reset_scene(); cam_ortho(2.2); emission_plane("star", build_star); render("star.webp", 512, 512)
    # nebula
    reset_scene(); cam_ortho(2.2); emission_plane("nebula", build_nebula); render("nebula.webp", 1024, 1024)
    # cmb sky
    render_cmb()
    print("ALL BIG-BANG ELEMENTS RENDERED →", OUT)


if __name__ == "__main__":
    main()
