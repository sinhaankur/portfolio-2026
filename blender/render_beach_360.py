"""
render_beach_360.py — render the beach scene as a 360 equirectangular panorama
(Insta360-style). A panoramic camera sits at eye level on the shore and sees the
whole sphere: water ahead, beach + land behind, sky above, pebbles below. The
web page shows it in a drag-to-look 360 viewer.

Run:
  blender -b blender/waves-ocean.blend -P blender/render_beach_360.py

Env: P360_RES (width, default 8192 -> 8192x4096 equirect), P360_SAMPLES (300),
     P360_OUT (/tmp/beach360).
"""
import bpy, os, math
from mathutils import Euler

RES = int(os.environ.get("P360_RES", "8192"))
SAMPLES = int(os.environ.get("P360_SAMPLES", "300"))
OUT = os.environ.get("P360_OUT", "/tmp/beach360")
os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene

# ---------------- isolate the ocean scene (hide MungerLand etc.)
waves = bpy.data.collections.get("WavesOcean")
keep = {o.name for o in waves.all_objects} if waves else set()
for o in bpy.data.objects:
    if o.type in {"CAMERA", "LIGHT"}:
        continue
    o.hide_render = (o.name not in keep) if keep else o.hide_render

# ---------------- engine + equirectangular pano camera
scene.render.engine = "CYCLES"
# NOTE: panoramic/equirectangular rendering crashes on the Cycles METAL backend
# (Blender 5.1). Force CPU for the 360 pano — slower but stable. Override with
# P360_GPU=1 if a future Blender fixes Metal panorama.
if os.environ.get("P360_GPU") == "1":
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"; prefs.get_devices()
        for d in prefs.devices: d.use = True
        scene.cycles.device = "GPU"
        print("Cycles: GPU (Metal)", flush=True)
    except Exception as e:
        scene.cycles.device = "CPU"; print("CPU fallback:", e, flush=True)
else:
    scene.cycles.device = "CPU"
    print("Cycles: CPU (stable for panorama)", flush=True)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True

scene.render.resolution_x = RES
scene.render.resolution_y = RES // 2          # 2:1 equirectangular
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"

# A dedicated panoramic camera at eye level, in the middle of the shore so you
# see water on one side and beach/land on the other when you look around.
pano = bpy.data.objects.get("Pano360")
if pano is None:
    cam_data = bpy.data.cameras.new("Pano360Cam")
    pano = bpy.data.objects.new("Pano360", cam_data)
    scene.collection.objects.link(pano)
pano.data.type = "PANO"
# Blender 5.x: panorama_type on the camera data
try:
    pano.data.panorama_type = "EQUIRECTANGULAR"
except Exception as e:
    print("panorama_type set failed:", e, flush=True)
# Eye level on the beach, a bit back from the waterline so beach is behind you
# and water ahead. z ~ 1.6m (human eye height above the sand).
pano.location = (0.0, -30.0, 1.6)
# Equirect cameras look along +Y by default in Blender when rotated upright;
# stand it up (X=90) so the horizon is at the vertical centre of the pano.
pano.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
scene.camera = pano

# ---------------- sky (overcast, matches the footage), sun, world
world = scene.world or bpy.data.worlds.new("W"); scene.world = world
world.use_nodes = True
wnt = world.node_tree; wnt.nodes.clear()
wout = wnt.nodes.new("ShaderNodeOutputWorld")
sky = wnt.nodes.new("ShaderNodeTexSky")
sky.sky_type = "MULTIPLE_SCATTERING"
sky.sun_elevation = math.radians(32)
sky.sun_rotation = math.radians(150)
sky.sun_intensity = 0.2
sky.aerosol_density = 2.4
bg = wnt.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 0.35
# soft cloud cover
cn = wnt.nodes.new("ShaderNodeTexNoise"); cn.inputs["Scale"].default_value = 2.0; cn.inputs["Detail"].default_value = 6.0
cr = wnt.nodes.new("ShaderNodeValToRGB"); cr.color_ramp.elements[0].position = 0.4; cr.color_ramp.elements[1].position = 0.68
mix = wnt.nodes.new("ShaderNodeMixRGB"); mix.inputs["Color2"].default_value = (0.82, 0.84, 0.87, 1)
wnt.links.new(cn.outputs["Fac"], cr.inputs["Fac"])
wnt.links.new(sky.outputs["Color"], mix.inputs["Color1"])
wnt.links.new(cr.outputs["Color"], mix.inputs["Fac"])
wnt.links.new(mix.outputs["Color"], bg.inputs["Color"])
wnt.links.new(bg.outputs["Background"], wout.inputs["Surface"])

sun = bpy.data.objects.get("WaveSun")
if sun and sun.type == "LIGHT":
    sun.data.energy = 1.6
    sun.data.color = (1.0, 0.98, 0.93)
    sun.rotation_euler = (math.radians(58), 0, math.radians(150))

scene.view_settings.exposure = -1.0

scene.render.filepath = os.path.join(OUT, "beach_pano.png")
print(f"rendering 360 pano {RES}x{RES//2} {SAMPLES}spp ...", flush=True)
bpy.ops.render.render(write_still=True)
print("wrote", scene.render.filepath, flush=True)
