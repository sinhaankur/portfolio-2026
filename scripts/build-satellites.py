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

# build all
sputnik(); hubble(); iss(); gps(); voyager(); jwst()
# real named bodies (shape approximations from mission data)
small_body("Halley", (0.10,0.10,0.12,1), (1.0,0.55,0.5), [(1.4,0.4),(3.5,0.18)], "body-halley")   # dark peanut nucleus
small_body("Eros",   (0.42,0.38,0.33,1), (1.0,0.34,0.32), [(1.3,0.35),(3.0,0.16)], "body-eros")    # elongated potato
small_body("Bennu",  (0.20,0.19,0.20,1), (0.9,0.9,0.78),  [(1.6,0.22),(4.0,0.12)], "body-bennu")   # spinning-top
small_body("Apophis",(0.40,0.36,0.32,1), (1.0,0.5,0.46),  [(1.5,0.3),(3.4,0.15)], "body-apophis")  # peanut
print("ALL SATELLITES + BODIES DONE")
