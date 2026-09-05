"""
render_beach_daycycle.py — render the APPROVED WavesOcean scene as a 16K day-cycle.

Opens blender/waves-ocean.blend (which already holds the good ocean the user
signed off on: Ocean/OceanWater + 7 craggy Boulders + Shore/WetSand +
geo-node PebbleScatter + WaveCam + WaveSun), hides the unrelated MungerLand
collection, then drives the sun / sky / stars through five times of day and
renders each at 16K.

Run headless:
  blender -b blender/waves-ocean.blend -P blender/render_beach_daycycle.py

Env: BEACH_RES (default 15360), BEACH_SAMPLES (default 700),
     BEACH_PHASES (comma list), BEACH_OUT (default /tmp/beach16k).

The wave math (Phillips spectrum, choppiness, foam) is untouched — this only
adds the sky/light/star day-cycle on top and dials exposure per phase so
every shade from dawn pink to deep-night blue is on the film, eye-visible.
"""

import bpy
import os
import math

RES = int(os.environ.get("BEACH_RES", "15360"))
SAMPLES = int(os.environ.get("BEACH_SAMPLES", "700"))
OUT = os.environ.get("BEACH_OUT", "/tmp/beach16k")
os.makedirs(OUT, exist_ok=True)

scene = bpy.context.scene

# ------------------------------------------------ isolate the ocean scene
# Hide everything not in WavesOcean from the render (kills the Munger house/trees).
waves = bpy.data.collections.get("WavesOcean")
keep = set()
if waves:
    keep = {o.name for o in waves.all_objects}
for o in bpy.data.objects:
    if o.type in {"CAMERA", "LIGHT"}:
        continue
    o.hide_render = (o.name not in keep) if keep else o.hide_render

# Camera = the wave camera.
wavecam = bpy.data.objects.get("WaveCam")
if wavecam:
    scene.camera = wavecam

# Tint the boulders toward real reddish-grey granite (the footage rocks are
# not black — they're wet red/brown granite).
bmat = bpy.data.materials.get("Boulder")
if bmat and bmat.use_nodes:
    p = bmat.node_tree.nodes.get("Principled BSDF")
    if p:
        p.inputs["Base Color"].default_value = (0.10, 0.065, 0.055, 1.0)  # reddish granite
        p.inputs["Roughness"].default_value = 0.72

# ------------------------------------------------ render settings
scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
    print("Cycles: GPU (Metal)")
except Exception as e:
    scene.cycles.device = "CPU"
    print("Cycles: CPU —", e)

scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.008
scene.cycles.max_bounces = 12
scene.cycles.transmission_bounces = 12
scene.cycles.transparent_max_bounces = 16

scene.render.resolution_x = RES
scene.render.resolution_y = int(RES * 9 / 16)
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_depth = "16"
scene.view_settings.view_transform = "AgX"
try:
    scene.view_settings.look = "AgX - Medium High Contrast"
except Exception:
    pass

# ------------------------------------------------ world / sky (physical sun)
if not scene.world:
    scene.world = bpy.data.worlds.new("Sky")
world = scene.world
world.use_nodes = True
wnt = world.node_tree
wnt.nodes.clear()
wout = wnt.nodes.new("ShaderNodeOutputWorld")
sky = wnt.nodes.new("ShaderNodeTexSky")
sky.sky_type = "MULTIPLE_SCATTERING"
sky.air_density = 1.0
sky.aerosol_density = 1.4        # richer horizon haze -> more color
sky.ozone_density = 1.2
sky.sun_disc = True
sky.sun_size = math.radians(0.55)
# Soft cloud cover — the real footage sky is hazy/overcast, not a clear dome.
# A noise-driven white overlay mixed into the sky by view direction (up).
tcoord = wnt.nodes.new("ShaderNodeTexCoord")
cloud_noise = wnt.nodes.new("ShaderNodeTexNoise")
cloud_noise.inputs["Scale"].default_value = 2.2
cloud_noise.inputs["Detail"].default_value = 6.0
cloud_noise.inputs["Roughness"].default_value = 0.6
cloud_ramp = wnt.nodes.new("ShaderNodeValToRGB")
cloud_ramp.color_ramp.elements[0].position = 0.45   # gaps between clouds
cloud_ramp.color_ramp.elements[1].position = 0.72
wnt.links.new(tcoord.outputs["Generated"], cloud_noise.inputs["Vector"])
wnt.links.new(cloud_noise.outputs["Fac"], cloud_ramp.inputs["Fac"])
# Mix clouds (white) over the atmospheric sky.
cloud_col = wnt.nodes.new("ShaderNodeMixRGB")
cloud_col.blend_type = "MIX"
cloud_col.inputs["Color2"].default_value = (0.85, 0.87, 0.9, 1.0)  # cloud grey-white
wnt.links.new(sky.outputs["Color"], cloud_col.inputs["Color1"])
wnt.links.new(cloud_ramp.outputs["Color"], cloud_col.inputs["Fac"])

bg = wnt.nodes.new("ShaderNodeBackground")
wnt.links.new(cloud_col.outputs["Color"], bg.inputs["Color"])
wnt.links.new(bg.outputs["Background"], wout.inputs["Surface"])
# A driver-free "cloud amount": we scale the ramp per phase via cloud_col Fac cap.
_cloud_nodes = (cloud_noise, cloud_ramp, cloud_col)

# The scene's own key light (WaveSun) casts the crisp shadows / glint.
sun = bpy.data.objects.get("WaveSun")
if sun and sun.type == "LIGHT":
    sun.data.angle = math.radians(0.53)

# ------------------------------------------------ star dome (night only)
star_mesh = bpy.data.meshes.get("StarDomeMesh")
if "StarDome" not in bpy.data.objects:
    bpy.ops.mesh.primitive_uv_sphere_add(radius=900, location=(0, 0, 0))
    stars = bpy.context.active_object
    stars.name = "StarDome"
    stars.scale = (-1, 1, 1)   # normals inward
    sm = bpy.data.materials.new("StarSky")
    sm.use_nodes = True
    snt = sm.node_tree
    snt.nodes.clear()
    so = snt.nodes.new("ShaderNodeOutputMaterial")
    em = snt.nodes.new("ShaderNodeEmission")
    # Sparse point stars: a WHITE-NOISE (voronoi) field, only the rare brightest
    # cells kept -> pin-point stars, not TV static.
    vor = snt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "F1"
    vor.inputs["Scale"].default_value = 240.0
    ramp = snt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    # distance < 0.045 (near a cell centre) -> star; else black.
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.9, 0.93, 1.0, 1.0)   # faint blue-white star
    ramp.color_ramp.elements[1].position = 0.045
    ramp.color_ramp.elements[1].color = (0, 0, 0, 1)            # empty sky
    snt.links.new(vor.outputs["Distance"], ramp.inputs["Fac"])
    snt.links.new(ramp.outputs["Color"], em.inputs["Color"])
    em.inputs["Strength"].default_value = 14.0
    snt.links.new(em.outputs["Emission"], so.inputs["Surface"])
    stars.data.materials.append(sm)
else:
    stars = bpy.data.objects["StarDome"]
stars.hide_render = True

# ------------------------------------------------ real textured MOON (night)
# Uses the real 8K lunar colour map + 4K height. These are gitignored (large);
# copy them in before rendering the night frame:
#   cp ~/Documents/celestial-assets/maps/moon_color.jpg  blender/assets/moon_color_8k.jpg
#   cp ~/Documents/celestial-assets/maps/moon_height.png blender/assets/moon_height_4k.png
# (real mission data — the Moon shows its true maria/craters). If missing, the
# night frame simply renders the star field with no textured moon.
MOON_COLOR = os.path.join(os.path.dirname(bpy.data.filepath), "assets", "moon_color_8k.jpg")
MOON_HEIGHT = os.path.join(os.path.dirname(bpy.data.filepath), "assets", "moon_height_4k.png")
moon = bpy.data.objects.get("RealMoon")
if moon is None and os.path.exists(MOON_COLOR):
    print("building real moon...", flush=True)
    # Build the sphere via bmesh (headless-safe; no context-dependent ops).
    import bmesh
    mesh = bpy.data.meshes.new("RealMoonMesh")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=48, radius=42,
                              calc_uvs=True)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(mesh)
    bm.free()
    moon = bpy.data.objects.new("RealMoon", mesh)
    bpy.context.scene.collection.objects.link(moon)
    mm = bpy.data.materials.new("MoonSurface")
    mm.use_nodes = True
    mnt = mm.node_tree
    bsdf = mnt.nodes.get("Principled BSDF")
    tex = mnt.nodes.new("ShaderNodeTexImage")
    try:
        tex.image = bpy.data.images.load(MOON_COLOR)
    except Exception as e:
        print("moon color load failed:", e)
    mnt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.95     # dusty regolith, no specular
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.05
    # Make the moon self-luminous from its own texture so it always reads as a
    # glowing disc (a real full moon is bright), independent of scene lighting.
    if "Emission Color" in bsdf.inputs:
        mnt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.15  # bright but maria still show
    # subtle real relief from the height map via a bump node
    if os.path.exists(MOON_HEIGHT):
        ht = mnt.nodes.new("ShaderNodeTexImage")
        try:
            ht.image = bpy.data.images.load(MOON_HEIGHT)
            ht.image.colorspace_settings.name = "Non-Color"
            bump = mnt.nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = 0.25
            mnt.links.new(ht.outputs["Color"], bump.inputs["Height"])
            mnt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
        except Exception as e:
            print("moon height load failed:", e)
    moon.data.materials.append(mm)
moon = bpy.data.objects.get("RealMoon")
if moon:
    moon.hide_render = True

# ------------------------------------------------ the day cycle
# name, sun_elev, sun_az, sun_energy, warm(0..1), exposure, cloud(0..1), night
# "day" is tuned to MATCH the real footage: hazy overcast, muted grey-green sea.
# dawn/golden/sunset/night extend the range into the dramatic hours.
PHASES = [
    ("dawn",       3.0,   92.0,  2.0,  1.00, -0.35, 0.25, False),
    ("golden",    11.0,  110.0,  3.4,  0.90, -0.55, 0.30, False),
    ("day",       42.0,  150.0,  2.6,  0.20, -0.55, 0.85, False),  # footage-matched overcast
    ("noon",      66.0,  180.0,  4.6,  0.12, -0.75, 0.20, False),
    ("sunset",     2.0,  264.0,  2.2,  1.00, -0.40, 0.35, False),
    ("night",    -12.0,  270.0,  0.0,  0.00,  1.40, 0.10, True),
]
_want = os.environ.get("BEACH_PHASES")
if _want:
    keep_p = {p.strip() for p in _want.split(",")}
    PHASES = [p for p in PHASES if p[0] in keep_p]


def render_phase(name, elev, az, energy, warm, exposure, cloud, night):
    er, azr = math.radians(elev), math.radians(az)
    sky.sun_elevation = er
    sky.sun_rotation = azr
    sky.sun_intensity = 0.0 if night else (0.7 + 0.6 * warm)
    # Cloud cover: shift the cloud ramp so more/less of the noise reads as cloud.
    cloud_noise, cloud_ramp, cloud_col = _cloud_nodes
    lo = 0.75 - 0.55 * cloud     # more cloud -> lower threshold -> more white
    cloud_ramp.color_ramp.elements[0].position = max(0.0, lo)
    cloud_ramp.color_ramp.elements[1].position = min(1.0, lo + 0.28)
    if sun:
        sun.rotation_euler = (math.radians(90 - elev), 0, azr)
        if night:
            sun.data.energy = 3.2                    # strong moonlight -> sea readable
            sun.data.color = (0.6, 0.68, 0.95)     # cool moonlight
            # light comes FROM the moon's direction (+Y, up) toward the scene
            sun.rotation_euler = (math.radians(72), 0, math.radians(2))
        else:
            sun.data.energy = energy
            # warm at the horizon, neutral overhead
            sun.data.color = (1.0, 0.6 + 0.35 * (1 - warm), 0.35 + 0.55 * (1 - warm))
    if night:
        bg.inputs["Strength"].default_value = 0.04   # faint blue night air-glow
        stars.hide_render = False
        # Show the real moon, placed high in the sky above the sea, in view.
        if moon:
            moon.hide_render = False
            # WaveCam sits at ~(-1,-35,4) looking +Y and slightly down. Put the
            # moon well ahead in +Y, up in the sky, so it hangs over the sea in
            # the upper third of frame.
            moon.location = (16, 300, 78)
    else:
        bg.inputs["Strength"].default_value = 0.30 + 0.12 * (elev / 90.0)
        stars.hide_render = True
        if moon:
            moon.hide_render = True
    scene.view_settings.exposure = exposure

    scene.render.filepath = os.path.join(OUT, f"beach_{name}.png")
    print(f"\n=== {name}  {RES}px {SAMPLES}spp  elev={elev} az={az} exp={exposure} ===")
    bpy.ops.render.render(write_still=True)
    print(f"=== wrote {scene.render.filepath} ===")


for p in PHASES:
    render_phase(*p)

print("\nALL PHASES DONE")
