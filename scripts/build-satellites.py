"""
build-satellites.py — headless Blender builder for human-built satellites/
spacecraft and real named small bodies, exported as web-optimized GLBs for the
/lab/celestial explorer.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python scripts/build-satellites.py

Outputs GLBs to public/models/sat-<name>.glb and public/models/body-<name>.glb
(committed via Git LFS). Geometry is simple-but-recognisable and metallic; the
goal is silhouette legibility at small scale, not engineering accuracy.
"""
import bpy, math, os

OUT = "/Users/sinhaankur/Documents/Portfolio/public/models"
os.makedirs(OUT, exist_ok=True)

def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)

def mat(name, rgba, metal=0.8, rough=0.4, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = emit
        b.inputs["Emission Strength"].default_value = 1.0
    nt.links.new(b.outputs[0], out.inputs[0])
    return m

# ---- material palette ----
M_BODY = lambda: mat("body", (0.72, 0.72, 0.78, 1), metal=0.9, rough=0.35)
M_GOLD = lambda: mat("gold", (0.85, 0.62, 0.18, 1), metal=1.0, rough=0.3)
M_PANEL = lambda: mat("panel", (0.10, 0.13, 0.32, 1), metal=0.6, rough=0.3, emit=(0.04,0.06,0.18,1))
M_DISH = lambda: mat("dish", (0.88, 0.88, 0.9, 1), metal=0.5, rough=0.5)
M_DARK = lambda: mat("dark", (0.12, 0.12, 0.13, 1), metal=0.7, rough=0.6)
M_ROCK = lambda c: mat("rock", c, metal=0.0, rough=0.95)
M_SILVER = lambda: mat("silver", (0.80,0.82,0.86,1), metal=1.0, rough=0.25)

def cube(loc, scale, material, name="p"):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = scale
    o.data.materials.append(material); return o

def cyl(loc, r, depth, material, rot=(0,0,0), name="c", verts=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object; o.name = name; o.rotation_euler = rot
    o.data.materials.append(material); return o

def sphere(loc, r, material, name="s", seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=seg//2)
    o = bpy.context.active_object; o.name = name
    for f in o.data.polygons: f.use_smooth = True
    o.data.materials.append(material); return o

def export(name):
    bpy.ops.object.select_all(action='SELECT')
    g = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=g, export_format='GLB', use_selection=True, export_apply=True)
    print("EXPORTED", name, os.path.getsize(g)//1024, "KB")

# ============================ SATELLITES ============================

def sputnik():
    clear()
    sphere((0,0,0), 0.5, M_SILVER(), "bus")
    # 4 swept whip antennas
    for a in range(4):
        ang = math.radians(35); rot_z = a*math.pi/2
        c = cyl((0,0,0), 0.012, 1.6, M_DARK(), name=f"ant{a}")
        c.rotation_euler = (ang, 0, rot_z)
        c.location = (math.sin(ang)*math.cos(rot_z)*0.7, math.sin(ang)*math.sin(rot_z)*0.7, -0.7)
    export("sat-sputnik")

def hubble():
    clear()
    cyl((0,0,0), 0.45, 2.2, M_SILVER(), rot=(math.radians(90),0,0), name="tube")
    # aperture ring
    cyl((0,1.1,0), 0.46, 0.12, M_DARK(), rot=(math.radians(90),0,0), name="ap")
    # two solar panels
    for s in (-1, 1):
        cube((s*0.95, -0.2, 0), (0.9, 0.02, 0.7), M_PANEL(), f"panel{s}")
        cyl((s*0.5, -0.2, 0), 0.02, 0.9, M_DARK(), rot=(0,0,math.radians(90)), name=f"arm{s}")
    export("sat-hubble")

def iss():
    clear()
    # central truss
    cube((0,0,0), (3.2, 0.18, 0.18), M_SILVER(), "truss")
    # modules along the truss centre
    for i,x in enumerate((-0.6, 0, 0.6)):
        cyl((x,0,0.0), 0.22, 0.9, M_BODY(), rot=(math.radians(90),0,0), name=f"mod{i}")
    # 4 big solar array pairs at the truss ends
    for sx in (-1,1):
        for sz in (-1,1):
            cube((sx*2.4, 0, sz*0.95), (1.1, 0.02, 0.5), M_PANEL(), f"array{sx}{sz}")
    # radiators
    cube((0,0.0,0.0),(0.02,0.7,0.5), M_DISH(), "rad")
    export("sat-iss")

def gps():
    clear()
    cube((0,0,0),(0.5,0.5,0.6), M_BODY(), "bus")
    for s in (-1,1):
        cube((s*1.4,0,0),(0.9,0.02,0.5), M_PANEL(), f"wing{s}")
        cyl((s*0.7,0,0),0.03,1.0, M_DARK(), rot=(0,0,math.radians(90)), name=f"arm{s}")
    # antenna array (earth-facing)
    for dx in (-0.2,0,0.2):
        cyl((dx,0,-0.55),0.05,0.25, M_DARK(), name=f"hx{dx}")
    export("sat-gps")

def voyager():
    clear()
    # high-gain dish
    bpy.ops.mesh.primitive_cone_add(radius1=0.9, radius2=0.0, depth=0.4, location=(0,0,0.5))
    d = bpy.context.active_object; d.name="dish"; d.rotation_euler=(math.radians(180),0,0)
    d.data.materials.append(M_DISH())
    # bus
    cyl((0,0,0),0.28,0.3, M_BODY(), rot=(math.radians(90),0,0), name="bus")
    # RTG + science booms
    cyl((-1.4,0,-0.1),0.06,2.4, M_DARK(), rot=(0,0,math.radians(90)), name="rtgboom")
    cyl((0,-1.6,-0.1),0.04,2.8, M_DARK(), rot=(math.radians(90),0,0), name="magboom")
    export("sat-voyager")

def jwst():
    clear()
    # 5-layer sunshield (stacked diamonds)
    for i in range(5):
        cube((0,0,-0.5 - i*0.08), (2.1 - i*0.05, 1.4 - i*0.03, 0.01), M_GOLD() if i==0 else M_DISH(), f"shield{i}")
    # hexagonal primary mirror (approx with a flattened cylinder, 6 sides)
    cyl((0,0,0.35), 0.95, 0.06, M_GOLD(), rot=(0,0,0), name="mirror", verts=6)
    # secondary mirror tripod
    cyl((0,0,0.9),0.12,0.05, M_DISH(), name="secondary")
    export("sat-jwst")

# -------- more bespoke satellites (distinct silhouettes) --------

def explorer1():
    """First US satellite — a slim pencil-shaped body with whip antennas."""
    clear()
    cyl((0,0,0), 0.12, 2.0, M_SILVER(), rot=(math.radians(90),0,0), name="body")
    bpy.ops.mesh.primitive_cone_add(radius1=0.12, radius2=0.0, depth=0.4, location=(0,1.2,0))
    n = bpy.context.active_object; n.rotation_euler=(math.radians(-90),0,0); n.data.materials.append(M_SILVER())
    for a in range(4):
        rot_z = a*math.pi/2
        c = cyl((0,-0.6,0), 0.01, 1.1, M_DARK(), name=f"ant{a}")
        c.rotation_euler = (math.radians(70), 0, rot_z)
    export("sat-explorer1")

def vostok():
    """Gagarin's capsule — a sphere with a conical instrument module."""
    clear()
    sphere((0,0.4,0), 0.55, M_SILVER(), "capsule")
    bpy.ops.mesh.primitive_cone_add(radius1=0.5, radius2=0.3, depth=0.8, location=(0,-0.5,0))
    m = bpy.context.active_object; m.rotation_euler=(math.radians(90),0,0); m.data.materials.append(M_DARK())
    export("sat-vostok")

def telstar():
    """First comms satellite — a faceted sphere studded with solar cells."""
    clear()
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.6, subdivisions=2, location=(0,0,0))
    g = bpy.context.active_object; g.name="bus"; g.data.materials.append(M_PANEL())
    # equatorial band of antennas
    band = cyl((0,0,0), 0.62, 0.18, M_SILVER(), rot=(math.radians(90),0,0), name="band")
    export("sat-telstar")

def landsat():
    """Earth-observation bus — boxy body, one big solar wing, downward sensor."""
    clear()
    cube((0,0,0),(0.6,0.6,0.9), M_BODY(), "bus")
    cube((1.4,0,0),(1.6,0.02,0.7), M_PANEL(), "wing")
    cyl((0.7,0,0),0.03,1.2, M_DARK(), rot=(0,0,math.radians(90)), name="arm")
    cyl((0,0,-0.6),0.18,0.3, M_DARK(), name="sensor")  # nadir-pointing imager
    export("sat-landsat")

def iridium():
    """Comms sat — triangular bus with 3 flat phased-array panels (the famous flares)."""
    clear()
    cube((0,0,0),(0.4,0.4,0.9), M_BODY(), "bus")
    for a in range(3):
        ang = a*2*math.pi/3
        p = cube((math.cos(ang)*0.6, math.sin(ang)*0.6, 0.3),(0.55,0.55,0.02), M_SILVER(), f"maa{a}")
        p.rotation_euler = (math.radians(35), 0, ang)
    for s in (-1,1):
        cube((s*1.1,0,-0.2),(0.8,0.02,0.4), M_PANEL(), f"wing{s}")
    export("sat-iridium")

def starlink():
    """Flat-pack sat — a thin slab with a single long solar panel."""
    clear()
    cube((0,0,0),(0.9,0.06,0.6), M_BODY(), "chassis")
    cube((0,0,1.4),(0.85,0.02,2.0), M_PANEL(), "panel")
    export("sat-starlink")

# ============================ NAMED SMALL BODIES ============================

def small_body(name, color, dims, lumps, out):
    clear()
    bpy.ops.mesh.primitive_ico_sphere_add(radius=1.0, subdivisions=4)
    g = bpy.context.active_object; g.name=name
    for i,(scl,strn) in enumerate(lumps):
        tx = bpy.data.textures.new(f"n{i}", 'CLOUDS'); tx.noise_scale = scl
        dm = g.modifiers.new(f"D{i}", 'DISPLACE'); dm.texture=tx; dm.texture_coords='OBJECT'; dm.strength=strn
    g.scale = dims
    bpy.ops.object.transform_apply(scale=True)
    for m in list(g.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    dec=g.modifiers.new("Dec",'DECIMATE'); dec.ratio=0.4; bpy.ops.object.modifier_apply(modifier="Dec")
    g.data.polygons.foreach_set("use_smooth",[True]*len(g.data.polygons)); g.data.update()
    g.data.materials.append(M_ROCK(color))
    export(out)

# ============================ DETAILED MOONS ============================

def moon_mat(name, base, accent, *, scale1=4.0, scale2=12.0, mix=0.5, rough=0.9, emit=0.0, bump=0.25):
    """Procedural moon surface: a noise-driven mix of two colours (base terrain
    + accent feature: lava, ice cracks, maria), plus a bump for relief."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Roughness"].default_value = rough
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = scale1; n1.inputs["Detail"].default_value = 8
    n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = scale2; n2.inputs["Detail"].default_value = 10
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = mix - 0.12; ramp.color_ramp.elements[0].color = (*base, 1)
    ramp.color_ramp.elements[1].position = mix + 0.12; ramp.color_ramp.elements[1].color = (*accent, 1)
    nt.links.new(tc.outputs["Object"], n1.inputs["Vector"])
    nt.links.new(n1.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    if emit and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = (*accent, 1); b.inputs["Emission Strength"].default_value = emit
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump
    nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])
    nt.links.new(n2.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return m

def moon(name, material_fn, out, *, irregular=None):
    clear()
    material = material_fn()  # build AFTER clear() so it isn't wiped
    if irregular:
        bpy.ops.mesh.primitive_ico_sphere_add(radius=1.0, subdivisions=4)
        g = bpy.context.active_object
        tx = bpy.data.textures.new("d", 'CLOUDS'); tx.noise_scale = 1.6
        dm = g.modifiers.new("D", 'DISPLACE'); dm.texture=tx; dm.texture_coords='OBJECT'; dm.strength=0.3
        g.scale = irregular; bpy.ops.object.transform_apply(scale=True)
        bpy.ops.object.modifier_apply(modifier="D")
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=96, ring_count=48)
        g = bpy.context.active_object
    g.name = name
    for f in g.data.polygons: f.use_smooth = True
    g.data.materials.append(material)
    export(out)

# build all — satellites
sputnik(); hubble(); iss(); gps(); voyager(); jwst()
explorer1(); vostok(); telstar(); landsat(); iridium(); starlink()
# real named bodies (shape approximations from mission data)
small_body("Halley", (0.10,0.10,0.12,1), (1.0,0.55,0.5), [(1.4,0.4),(3.5,0.18)], "body-halley")   # dark peanut nucleus
small_body("Eros",   (0.42,0.38,0.33,1), (1.0,0.34,0.32), [(1.3,0.35),(3.0,0.16)], "body-eros")    # elongated potato
small_body("Bennu",  (0.20,0.19,0.20,1), (0.9,0.9,0.78),  [(1.6,0.22),(4.0,0.12)], "body-bennu")   # spinning-top
small_body("Apophis",(0.40,0.36,0.32,1), (1.0,0.5,0.46),  [(1.5,0.3),(3.4,0.15)], "body-apophis")  # peanut

# detailed moons — procedural surfaces keyed to each moon's real character
moon("Io",       lambda: moon_mat("io",       (0.86,0.74,0.30), (0.95,0.35,0.18), scale1=5, scale2=14, mix=0.55, emit=0.15), "moon-io")        # volcanic yellow + sulphur reds
moon("Europa",   lambda: moon_mat("europa",   (0.86,0.84,0.78), (0.62,0.36,0.24), scale1=3, scale2=20, mix=0.62, rough=0.5), "moon-europa")    # ice white + tan cracks
moon("Ganymede", lambda: moon_mat("ganymede", (0.55,0.52,0.50), (0.38,0.36,0.36), scale1=6, scale2=16, mix=0.5), "moon-ganymede")              # grooved grey
moon("Callisto", lambda: moon_mat("callisto", (0.34,0.31,0.29), (0.62,0.60,0.55), scale1=8, scale2=22, mix=0.6, bump=0.4), "moon-callisto")    # dark, heavily cratered
moon("Titan",    lambda: moon_mat("titan",    (0.80,0.55,0.18), (0.62,0.40,0.12), scale1=3, scale2=8, mix=0.5, rough=0.95), "moon-titan")       # orange haze
moon("Triton",   lambda: moon_mat("triton",   (0.80,0.74,0.74), (0.74,0.62,0.66), scale1=6, scale2=16, mix=0.5), "moon-triton")                # pinkish cantaloupe
moon("Enceladus",lambda: moon_mat("enceladus",(0.94,0.95,0.98), (0.78,0.84,0.92), scale1=4, scale2=24, mix=0.55, rough=0.3, bump=0.35), "moon-enceladus")  # bright ice + tiger stripes
moon("Phobos",   lambda: M_ROCK((0.34,0.30,0.27,1)), "moon-phobos", irregular=(1.0,0.82,0.78))   # irregular cratered rock
moon("Deimos",   lambda: M_ROCK((0.38,0.34,0.30,1)), "moon-deimos", irregular=(1.0,0.86,0.84))   # smaller irregular rock
print("ALL SATELLITES + BODIES DONE")
