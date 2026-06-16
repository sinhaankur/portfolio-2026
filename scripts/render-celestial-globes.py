import bpy, math, os

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def make_globe(name, color_path, height_path, out_path, *,
               disp_scale=0.045, color_is_height=False, atmo=None,
               tilt=18.0, spin=-20.0, sun_angle=35.0, sun_elev=12.0):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)

    # --- base sphere (ico, no UV pole seam) ---
    bpy.ops.mesh.primitive_ico_sphere_add(radius=1.0, subdivisions=5)
    globe = bpy.context.active_object
    globe.name = name
    for f in globe.data.polygons:
        f.use_smooth = True
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.sphere_project(direction='ALIGN_TO_OBJECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    globe.rotation_euler = (math.radians(tilt), 0, math.radians(spin))

    # --- adaptive subdivision for REAL displaced geometry (Cycles) ---
    sub = globe.modifiers.new("Subsurf", 'SUBSURF')
    sub.subdivision_type = 'SIMPLE'   # simple = keep sphere, just add density
    sub.levels = 2
    sub.render_levels = 2
    try:
        globe.cycles.use_adaptive_subdivision = True
        globe.cycles.dicing_rate = 1.0
    except Exception:
        pass

    # --- material: albedo + displacement from height map ---
    mat = bpy.data.materials.new(name + "_mat"); mat.use_nodes = True
    # Blender 4.x+/5.x: displacement_method is on the material directly.
    try:
        mat.displacement_method = 'DISPLACEMENT'
    except Exception:
        try: mat.cycles.displacement_method = 'DISPLACEMENT'
        except Exception: pass
    nt = mat.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.95
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.1

    col = nt.nodes.new("ShaderNodeTexImage")
    col.image = bpy.data.images.load(color_path)
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    # height -> displacement
    h = nt.nodes.new("ShaderNodeTexImage")
    himg = bpy.data.images.load(height_path)
    himg.colorspace_settings.name = 'Non-Color'
    h.image = himg
    disp = nt.nodes.new("ShaderNodeDisplacement")
    disp.inputs["Scale"].default_value = disp_scale
    disp.inputs["Midlevel"].default_value = 0.5
    # use luminance of the height map (handles both grayscale DEM and the
    # MOLA hypsometric map's brightness-as-elevation approximation)
    if color_is_height:
        bw = nt.nodes.new("ShaderNodeRGBToBW")
        nt.links.new(h.outputs["Color"], bw.inputs["Color"])
        nt.links.new(bw.outputs["Val"], disp.inputs["Height"])
    else:
        nt.links.new(h.outputs["Color"], disp.inputs["Height"])
    nt.links.new(disp.outputs["Displacement"], out.inputs["Displacement"])

    globe.data.materials.append(mat)

    # --- optional atmosphere shell (Mars) ---
    if atmo:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.06, segments=64, ring_count=32)
        a = bpy.context.active_object; a.name = name + "_atmo"
        for f in a.data.polygons: f.use_smooth = True
        am = bpy.data.materials.new(name + "_atmo"); am.use_nodes = True
        ant = am.node_tree; ant.nodes.clear()
        ao = ant.nodes.new("ShaderNodeOutputMaterial")
        emi = ant.nodes.new("ShaderNodeEmission")
        emi.inputs["Color"].default_value = (*atmo, 1.0)
        emi.inputs["Strength"].default_value = 0.6
        fres = ant.nodes.new("ShaderNodeFresnel"); fres.inputs["IOR"].default_value = 1.15
        transp = ant.nodes.new("ShaderNodeBsdfTransparent")
        mix = ant.nodes.new("ShaderNodeMixShader")
        ant.links.new(fres.outputs["Fac"], mix.inputs["Fac"])
        ant.links.new(transp.outputs["BSDF"], mix.inputs[1])
        ant.links.new(emi.outputs["Emission"], mix.inputs[2])
        ant.links.new(mix.outputs["Shader"], ao.inputs["Surface"])
        am.use_backface_culling = True
        a.data.materials.append(am)

    # --- lighting: low-angle sun for dramatic terrain shadows ---
    sd = bpy.data.lights.new("Sun", 'SUN'); sd.energy = 4.0; sd.angle = math.radians(0.53)
    sun = bpy.data.objects.new("Sun", sd); scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(90 - sun_elev), 0, math.radians(sun_angle))

    fill = bpy.data.lights.new("Fill", 'AREA'); fill.energy = 4; fill.size = 10
    fo = bpy.data.objects.new("Fill", fill); fo.location = (-5, -3, 2)
    scene.collection.objects.link(fo)

    # --- camera ---
    cd = bpy.data.cameras.new("Cam"); cd.lens = 90
    cam = bpy.data.objects.new("Cam", cd)
    cam.location = (0, -4.0, 0); cam.rotation_euler = (math.radians(90), 0, 0)
    scene.collection.objects.link(cam); scene.camera = cam

    # --- Cycles render settings ---
    scene.render.engine = 'CYCLES'
    try:
        scene.cycles.device = 'GPU'
    except Exception:
        pass
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    try: scene.view_settings.view_transform = 'Standard'
    except Exception: pass
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1600
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    print("RENDERED", name, os.path.exists(out_path))

    # save editable .blend
    bd = "/Users/sinhaankur/Documents/Portfolio/blender/space-assets/celestial"
    os.makedirs(bd, exist_ok=True)
    try: bpy.ops.file.pack_all()
    except Exception: pass
    bp = os.path.join(bd, name.lower() + "-globe.blend")
    bpy.ops.wm.save_as_mainfile(filepath=bp)
    print("SAVED", bp)

# Mars: the MOLA "height" source is a hypsometric COLOUR map with hard colour
# bands, so direct displacement spikes. Use the 8K COLOUR map's own luminance
# for gentle, smooth relief instead, at a low scale. Higher sun so it's not
# half in shadow.
make_globe(
    "Mars",
    "/tmp/space_tex/mars_color.png", "/tmp/space_tex/mars_color.png",
    "/Users/sinhaankur/Documents/Portfolio/public/img/space/mars-globe.png",
    disp_scale=0.012, color_is_height=True, atmo=(0.95, 0.55, 0.4),
    tilt=25.0, spin=90.0, sun_angle=35.0, sun_elev=28.0,
)
print("DONE")
