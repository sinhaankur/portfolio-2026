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
    sc.cycles.samples = 256          # finer micro-detail, less noise
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.quality = 96


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


# ---------- 4. forming-world planet stages ----------
# The late timeline chapters (Earth forms → oceans → life) leave the abstract
# particle field behind and show a real WORLD taking shape. Three lit spheres,
# each a distinct surface, rendered with a soft rim so they read as a globe
# floating in the dark: molten proto-Earth, an ocean world, a living blue marble.

def _planet_scene(build_surface, sun_dir=(-0.6, 0.4, 0.8)):
    """A lit sphere on a transparent film, key-lit from one side so it reads as a
    globe with a terminator. build_surface(nt, coord) returns an emission-ish
    Principled colour for the planet skin."""
    reset_scene()
    # smooth high-poly sphere
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=1.0)
    obj = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    mat = bpy.data.materials.new("planet_mat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    build_surface(nt, coord, out)
    obj.data.materials.append(mat)
    # key light (the young Sun) — a sharp sun lamp for a clean terminator
    lamp_data = bpy.data.lights.new("Sun", type="SUN")
    lamp_data.energy = 4.0
    lamp = bpy.data.objects.new("Sun", lamp_data)
    bpy.context.collection.objects.link(lamp)
    d = mathutils.Vector(sun_dir).normalized()
    lamp.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    # a dim fill so the night side isn't pure black
    fill = bpy.data.lights.new("Fill", type="SUN"); fill.energy = 0.25
    fo = bpy.data.objects.new("Fill", fill); bpy.context.collection.objects.link(fo)
    fo.rotation_euler = mathutils.Vector((0.6, -0.3, -0.8)).to_track_quat("-Z", "Y").to_euler()
    cam_ortho(2.4)
    return obj


def _principled(nt, out):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    return p


def build_molten(nt, coord, out):
    """Proto-Earth: a magma ocean — dark crust cracked with glowing lava veins."""
    p = _principled(nt, out)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 6.0
    noise.inputs["Detail"].default_value = 12.0
    noise.inputs["Roughness"].default_value = 0.7
    nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
    # sharp veins: high-contrast the noise
    veins = nt.nodes.new("ShaderNodeMath"); veins.operation = "POWER"; veins.inputs[1].default_value = 5.0
    nt.links.new(noise.outputs["Fac"], veins.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position = 0.0; e[0].color = (0.05, 0.015, 0.01, 1)     # dark basalt crust
    e[1].position = 1.0; e[1].color = (1.0, 0.75, 0.2, 1)        # bright molten
    mid = ramp.color_ramp.elements.new(0.55); mid.color = (0.9, 0.2, 0.03, 1)  # red-hot lava
    nt.links.new(veins.outputs["Value"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    # emission so the lava actually glows
    nt.links.new(ramp.outputs["Color"], p.inputs["Emission Color"])
    emstr = nt.nodes.new("ShaderNodeMath"); emstr.operation = "MULTIPLY"; emstr.inputs[1].default_value = 2.6
    nt.links.new(veins.outputs["Value"], emstr.inputs[0])
    nt.links.new(emstr.outputs["Value"], p.inputs["Emission Strength"])
    p.inputs["Roughness"].default_value = 0.85


def build_ocean_world(nt, coord, out):
    """The oceans arrive: a mostly-water world, thick storm clouds, little land."""
    p = _principled(nt, out)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.2
    noise.inputs["Detail"].default_value = 10.0
    nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position = 0.30; e[0].color = (0.02, 0.09, 0.25, 1)     # deep ocean
    e[1].position = 0.70; e[1].color = (0.85, 0.9, 0.95, 1)      # storm cloud white
    mid = ramp.color_ramp.elements.new(0.52); mid.color = (0.15, 0.45, 0.6, 1)  # shallow teal
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.35   # wet sheen


def build_living_earth(nt, coord, out):
    """The blue marble: blue oceans, green/brown continents, white clouds."""
    p = _principled(nt, out)
    land = nt.nodes.new("ShaderNodeTexNoise")
    land.inputs["Scale"].default_value = 2.4
    land.inputs["Detail"].default_value = 12.0
    land.inputs["Roughness"].default_value = 0.6
    nt.links.new(coord.outputs["Object"], land.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position = 0.40; e[0].color = (0.03, 0.14, 0.38, 1)     # ocean blue
    e[1].position = 0.66; e[1].color = (0.85, 0.88, 0.85, 1)     # cloud/ice white
    g = ramp.color_ramp.elements.new(0.52); g.color = (0.18, 0.4, 0.13, 1)   # green land
    b = ramp.color_ramp.elements.new(0.6); b.color = (0.45, 0.38, 0.2, 1)    # tan desert
    nt.links.new(land.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.5


# ---------- main ----------
def main():
    # star
    reset_scene(); cam_ortho(2.2); emission_plane("star", build_star); render("star.webp", 512, 512)
    # nebula
    reset_scene(); cam_ortho(2.2); emission_plane("nebula", build_nebula); render("nebula.webp", 1024, 1024)
    # cmb sky
    render_cmb()
    # forming-world planet stages
    _planet_scene(build_molten);       render("world-molten.webp", 768, 768)
    _planet_scene(build_ocean_world);  render("world-ocean.webp", 768, 768)
    _planet_scene(build_living_earth); render("world-life.webp", 768, 768)
    print("ALL BIG-BANG ELEMENTS RENDERED →", OUT)


if __name__ == "__main__":
    main()
