"""
calm_shore_rebuild.py — retune the WavesOcean scene to MATCH the real footage:
a calm, glassy shore with angular granite and a dense pebble beach.

Reads the real reference (IMG_2492 @ ~12s): very calm water, small ripples,
pale overcast sky, blocky ANGULAR granite going into the water, and a foreground
packed with rounded multicolour cobbles.

Run (modifies + saves the blend, then renders one preview):
  blender -b blender/waves-ocean.blend -P blender/calm_shore_rebuild.py

Env: CS_RES (default 1600 preview), CS_SAMPLES (default 200),
     CS_OUT (default /tmp/calmshore), CS_SAVE=1 to save the blend.
"""

import bpy, bmesh, os, math, random
from mathutils import Matrix, Euler

RES = int(os.environ.get("CS_RES", "1600"))
SAMPLES = int(os.environ.get("CS_SAMPLES", "200"))
OUT = os.environ.get("CS_OUT", "/tmp/calmshore")
os.makedirs(OUT, exist_ok=True)
random.seed(7)
scene = bpy.context.scene

# ----------------------------------------------------------------- isolate
waves = bpy.data.collections.get("WavesOcean")
keep = {o.name for o in waves.all_objects} if waves else set()
for o in bpy.data.objects:
    if o.type in {"CAMERA", "LIGHT"}:
        continue
    o.hide_render = (o.name not in keep) if keep else o.hide_render

# ================================================================ 1. CALM WATER
ocean = bpy.data.objects.get("Ocean")
om = ocean.modifiers.get("Ocean")
# Very calm lakeshore: near-glassy, tiny ripples, essentially no open-water foam.
om.wind_velocity = 2.2        # was 12 — barely a breeze
om.choppiness = 0.08         # was 1.3 — smooth, rounded ripples, no sharp crests
om.wave_scale = 0.14         # small, low waves
om.wave_alignment = 0.1
om.spatial_size = 180        # large patch -> gentle, small relative waves
om.foam_coverage = 0.98      # foam threshold very high -> almost none on open water
try:
    om.wave_scale_min = 0.004   # keep the fine ripple shimmer
except Exception:
    pass
om.time = 6.0
# Lower the sea slightly so the near beach rises out of the water (waterline
# sits further out, leaving a pebble foreground between camera and water).
ocean.location = (0.0, 0.0, -0.35)

# Water material: calm, slightly glossy (not a pure mirror), greenish-grey.
wat = bpy.data.materials.get("OceanWater")
if wat and wat.use_nodes:
    wnt_ = wat.node_tree
    p = wnt_.nodes.get("Principled BSDF")   # the water BSDF (input 1 of mix)
    if p:
        p.inputs["Base Color"].default_value = (0.015, 0.045, 0.05, 1.0)  # muted grey-green
        p.inputs["Roughness"].default_value = 0.12     # soft sheen, not a hard mirror
        if "Transmission Weight" in p.inputs:
            p.inputs["Transmission Weight"].default_value = 0.4
        p.inputs["IOR"].default_value = 1.333
    # Tighten the foam ramp so foam only shows at genuinely steep crests (rare
    # when calm) — otherwise calm water reads white. Move both stops high.
    fr = wnt_.nodes.get("Color Ramp")
    if fr:
        fr.color_ramp.elements[0].position = 0.72
        fr.color_ramp.elements[1].position = 0.95

# ================================================================ 2. ANGULAR GRANITE
# Replace the blobby boulders with hard-edged, flat-faced angular rock:
# start from a cube, do a few bevel/inset-ish cuts + sharp voronoi displace,
# NO smoothing subsurf that rounds it off.
def make_angular_rock(name, size, seed):
    random.seed(seed)
    me = bpy.data.meshes.new(name + "Mesh")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=size)
    # random per-vertex jitter -> irregular block
    for v in bm.verts:
        v.co.x += random.uniform(-size*0.28, size*0.28)
        v.co.y += random.uniform(-size*0.28, size*0.28)
        v.co.z += random.uniform(-size*0.22, size*0.22)
    # cut a couple of angled slices to create flat facets (like fractured granite)
    for _ in range(3):
        no = (random.uniform(-1,1), random.uniform(-1,1), random.uniform(-0.5,1))
        bmesh.ops.bisect_plane(
            bm, geom=bm.verts[:]+bm.edges[:]+bm.faces[:],
            plane_co=(random.uniform(-size*0.3,size*0.3),
                      random.uniform(-size*0.3,size*0.3),
                      random.uniform(-size*0.2,size*0.3)),
            plane_no=no, clear_outer=False, clear_inner=False)
    # subdivide once for displacement to have somewhere to bite, keep it faceted
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    # sharp rocky surface detail via displace (voronoi = faceted, not lumpy)
    d = ob.modifiers.new("rockdisp", type="DISPLACE")
    tex = bpy.data.textures.new(name+"tex", type="VORONOI")
    tex.noise_scale = 0.35
    tex.noise_intensity = 1.0
    d.texture = tex
    d.strength = size * 0.10
    d.mid_level = 0.4
    # a second finer grain
    d2 = ob.modifiers.new("grain", type="DISPLACE")
    t2 = bpy.data.textures.new(name+"grain", type="STUCCI")
    t2.noise_scale = 0.12
    d2.texture = t2
    d2.strength = size * 0.03
    # flat shading -> hard faceted edges (the granite look)
    for f in me.polygons:
        f.use_smooth = False
    return ob

# Reddish-grey granite material (wet-dark at base done via the scene light).
gmat = bpy.data.materials.get("Boulder")
if gmat and gmat.use_nodes:
    gp = gmat.node_tree.nodes.get("Principled BSDF")
    if gp:
        gp.inputs["Base Color"].default_value = (0.075, 0.05, 0.045, 1.0)  # reddish granite
        gp.inputs["Roughness"].default_value = 0.7

# Remove old blobby boulders, build a breakwater of angular blocks on the right,
# marching from shore down into the water (matching the footage composition).
old = [o for o in bpy.data.objects if o.name.startswith("Boulder")]
for o in old:
    bpy.data.objects.remove(o, do_unlink=True)

# Positions: a diagonal pile from near-shore (right) out toward the water.
rock_specs = [
    # (x, y, z, size)
    (11, -13, 0.6, 6.5),
    (13, -16, 0.4, 7.5),
    (10, -18, 0.3, 6.0),
    (14, -20, 0.2, 8.0),
    (12, -23, 0.0, 7.0),
    (16, -18, 0.5, 6.5),
    (15, -25, -0.2, 6.5),
    (9, -15, 0.5, 5.0),
    (17, -22, 0.1, 7.0),
]
for i, (x, y, z, s) in enumerate(rock_specs):
    r = make_angular_rock(f"Boulder{i}", s, seed=100+i)
    r.location = (x, y, z)
    r.rotation_euler = (random.uniform(0, 0.4), random.uniform(0, 0.4), random.uniform(0, 6.28))
    if gmat:
        r.data.materials.append(gmat)

# ================================================================ 3. PEBBLE BEACH
# A dense foreground field of rounded multicolour cobbles, built as a SINGLE
# merged mesh (one object = light for Cycles, no per-object crash) with a random
# cobble colour baked per pebble into a vertex-colour layer.
# multicolour cobble material — a per-pebble random colour baked into a vertex
# colour layer as we build the single merged mesh (cheap; one object for Cycles).
pmat = bpy.data.materials.new("PebbleField")
pmat.use_nodes = True
pnt = pmat.node_tree
pb = pnt.nodes.get("Principled BSDF")
vcol = pnt.nodes.new("ShaderNodeVertexColor")
vcol.layer_name = "Col"
pnt.links.new(vcol.outputs["Color"], pb.inputs["Base Color"])
pb.inputs["Roughness"].default_value = 0.55

# Build ALL pebbles into ONE bmesh (a single object = light for Cycles, no crash).
PALETTE = [
    (0.05, 0.05, 0.05),  # dark grey
    (0.11, 0.06, 0.05),  # red-brown
    (0.20, 0.14, 0.10),  # brown
    (0.24, 0.22, 0.18),  # cream-grey
    (0.09, 0.10, 0.11),  # blue-grey
]
peb_bm = bmesh.new()
col_layer = peb_bm.loops.layers.color.new("Col")
count = 2200
for i in range(count):
    x = random.uniform(-34, 34)
    y = random.uniform(-34, -14)
    beach_t = (y + 34) / 20.0                 # 0 near cam, 1 at waterline
    z = 0.15 - beach_t * 0.55 + random.uniform(-0.04, 0.04)
    sc = random.uniform(0.22, 0.6)
    col = random.choice(PALETTE)
    # temp bmesh for one pebble, transform, then append into the big bmesh
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=0.5)
    mat = (
        Matrix.Translation((x, y, z)) @
        Euler((random.uniform(0,6.28),)*3, "XYZ").to_matrix().to_4x4() @
        Matrix.Diagonal((sc, sc, sc*random.uniform(0.55,0.85), 1.0))
    )
    bmesh.ops.transform(tmp, matrix=mat, verts=tmp.verts)
    for f in tmp.faces:
        f.smooth = True
    # copy into peb_bm with colour
    vmap = {}
    for v in tmp.verts:
        vmap[v] = peb_bm.verts.new(v.co)
    peb_bm.verts.index_update()
    for f in tmp.faces:
        try:
            nf = peb_bm.faces.new([vmap[v] for v in f.verts])
            nf.smooth = True
            for loop in nf.loops:
                loop[col_layer] = (col[0], col[1], col[2], 1.0)
        except ValueError:
            pass
    tmp.free()

peb_me = bpy.data.meshes.new("PebbleFieldMesh")
peb_bm.to_mesh(peb_me)
peb_bm.free()
peb_obj = bpy.data.objects.new("PebbleField", peb_me)
peb_obj.data.materials.append(pmat)
scene.collection.objects.link(peb_obj)

# A gravel/sand BASE under the pebbles so they read as a packed beach, not
# floating balls. A displaced plane following the same beach slope, dark wet
# gravel colour, tucked just under the pebble layer.
base_me = bpy.data.meshes.new("BeachBaseMesh")
bbm = bmesh.new()
bmesh.ops.create_grid(bbm, x_segments=60, y_segments=40, size=1.0)
for v in bbm.verts:
    v.co.x *= 40; v.co.y *= 12
    # place/slope: centre it over the beach strip (y ~ -24), same slope as pebbles
    wy = v.co.y - 24
    v.co.y = wy
    beach_t = (wy + 34) / 20.0
    v.co.z = 0.12 - beach_t * 0.55 + random.uniform(-0.03, 0.03)  # micro gravel bumps
for f in bbm.faces:
    f.smooth = True
bbm.to_mesh(base_me); bbm.free()
base = bpy.data.objects.new("BeachBase", base_me)
scene.collection.objects.link(base)
basemat = bpy.data.materials.new("BeachGravel")
basemat.use_nodes = True
bmp = basemat.node_tree.nodes.get("Principled BSDF")
# fine gravel colour via noise so it's not flat
bnoise = basemat.node_tree.nodes.new("ShaderNodeTexNoise")
bnoise.inputs["Scale"].default_value = 120.0
bbramp = basemat.node_tree.nodes.new("ShaderNodeValToRGB")
bbramp.color_ramp.elements[0].color = (0.03, 0.028, 0.026, 1)   # dark wet gravel
bbramp.color_ramp.elements[1].color = (0.09, 0.075, 0.06, 1)    # lighter grit
basemat.node_tree.links.new(bnoise.outputs["Fac"], bbramp.inputs["Fac"])
basemat.node_tree.links.new(bbramp.outputs["Color"], bmp.inputs["Base Color"])
bmp.inputs["Roughness"].default_value = 0.85
base.data.materials.append(basemat)

# ================================================================ SKY + RENDER
scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = "GPU"
except Exception:
    scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x = RES
scene.render.resolution_y = int(RES*9/16)
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"

# overcast pale sky
world = scene.world or bpy.data.worlds.new("W"); scene.world = world
world.use_nodes = True
wnt = world.node_tree; wnt.nodes.clear()
wout = wnt.nodes.new("ShaderNodeOutputWorld")
sky = wnt.nodes.new("ShaderNodeTexSky")
sky.sky_type = "MULTIPLE_SCATTERING"
sky.sun_elevation = math.radians(35)
sky.sun_rotation = math.radians(150)
sky.sun_intensity = 0.15        # soft, overcast — sun mostly hidden
sky.aerosol_density = 2.5       # hazy, diffuse
bg = wnt.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 0.28   # dimmer sky so it doesn't clip to white
# clouds
cn = wnt.nodes.new("ShaderNodeTexNoise"); cn.inputs["Scale"].default_value = 2.0; cn.inputs["Detail"].default_value = 6.0
cr = wnt.nodes.new("ShaderNodeValToRGB"); cr.color_ramp.elements[0].position = 0.35; cr.color_ramp.elements[1].position = 0.65
mix = wnt.nodes.new("ShaderNodeMixRGB"); mix.inputs["Color2"].default_value = (0.82,0.84,0.87,1)
wnt.links.new(cn.outputs["Fac"], cr.inputs["Fac"])
wnt.links.new(sky.outputs["Color"], mix.inputs["Color1"])
wnt.links.new(cr.outputs["Color"], mix.inputs["Fac"])
wnt.links.new(mix.outputs["Color"], bg.inputs["Color"])
wnt.links.new(bg.outputs["Background"], wout.inputs["Surface"])

sun = bpy.data.objects.get("WaveSun")
if sun and sun.type == "LIGHT":
    sun.data.energy = 1.3           # softer key (overcast diffuse dominates)
    sun.data.color = (1.0, 0.98, 0.92)
    sun.rotation_euler = (math.radians(55), 0, math.radians(150))

scene.view_settings.exposure = -1.4   # pull the overall exposure well down off white
cam = bpy.data.objects.get("WaveCam")
if cam: scene.camera = cam

if os.environ.get("CS_SAVE") == "1":
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    print("saved blend")

scene.render.filepath = os.path.join(OUT, "calm_preview.png")
print("rendering calm-shore preview...", flush=True)
bpy.ops.render.render(write_still=True)
print("wrote", scene.render.filepath, flush=True)
