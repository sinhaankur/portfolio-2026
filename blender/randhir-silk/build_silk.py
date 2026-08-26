# Silk hero for /dr-randhir-sinha — flowing silk threads (gold / cream / ice-blue)
# weaving in warm light on a dark field. A short seamless loop honoring a life in
# sericulture. Rendered in Blender 5.x (EEVEE); the frames are then encoded to
# public/video/randhir-silk.{mp4,webm} with ffmpeg (see the commands at the bottom).
#
# Run headless:  blender --background --python build_silk.py
# then render:   blender --background <this .blend> --render-anim
# (or run interactively via the MCP bridge, which is how it was first built).

import bpy, math, random

def build():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.curves): bpy.data.curves.remove(c)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    random.seed(42)

    def silk_mat(name, base):
        mat = bpy.data.materials.new(name); mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = base
        bsdf.inputs["Roughness"].default_value = 0.28
        if "Sheen Weight" in bsdf.inputs: bsdf.inputs["Sheen Weight"].default_value = 1.0
        if "Sheen Tint" in bsdf.inputs: bsdf.inputs["Sheen Tint"].default_value = (1, 0.85, 0.6, 1)
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = base
            bsdf.inputs["Emission Strength"].default_value = 0.35
        return mat

    gold = silk_mat("Gold", (0.95, 0.68, 0.32, 1))
    blue = silk_mat("IceBlue", (0.45, 0.62, 0.95, 1))
    cream = silk_mat("Cream", (0.95, 0.9, 0.82, 1))
    mats = [gold, gold, cream, blue, gold]

    N = 14
    for i in range(N):
        cu = bpy.data.curves.new(f"silk{i}", 'CURVE')
        cu.dimensions = '3D'; cu.resolution_u = 24
        cu.bevel_depth = random.uniform(0.006, 0.014); cu.bevel_resolution = 3
        sp = cu.splines.new('BEZIER'); npts = 6
        sp.bezier_points.add(npts - 1)
        phase = random.uniform(0, math.tau)
        yoff = (i / N - 0.5) * 2.6
        amp = random.uniform(0.25, 0.7)
        for j, bp in enumerate(sp.bezier_points):
            t = j / (npts - 1)
            bp.co = ((t - 0.5) * 5.0,
                     yoff + math.sin(t * math.pi * 2 + phase) * amp,
                     math.cos(t * math.pi * 1.5 + phase) * random.uniform(0.2, 0.6))
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
        obj = bpy.data.objects.new(f"silk{i}", cu)
        obj.data.materials.append(mats[i % len(mats)])
        scene.collection.objects.link(obj)

    # camera
    cam_data = bpy.data.cameras.new("Cam"); cam_data.lens = 50
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = (0, -5.2, 0.4); cam.rotation_euler = (math.radians(88), 0, 0)
    scene.collection.objects.link(cam); scene.camera = cam

    # lights
    key = bpy.data.lights.new("Key", 'AREA'); key.energy = 320; key.size = 6
    key.color = (1.0, 0.85, 0.62)
    ko = bpy.data.objects.new("Key", key); ko.location = (3, -4, 3)
    ko.rotation_euler = (math.radians(50), 0, math.radians(35)); scene.collection.objects.link(ko)
    rim = bpy.data.lights.new("Rim", 'AREA'); rim.energy = 220; rim.size = 5
    rim.color = (0.55, 0.68, 1.0)
    ro = bpy.data.objects.new("Rim", rim); ro.location = (-4, 3, 2)
    ro.rotation_euler = (math.radians(60), 0, math.radians(-140)); scene.collection.objects.link(ro)

    # world
    world = bpy.data.worlds.new("W"); scene.world = world; world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.012, 0.014, 0.022, 1); bg.inputs[1].default_value = 1.0

    # a 120-frame seamless loop (start pose == end pose)
    scene.frame_start = 1; scene.frame_end = 120
    for obj in bpy.data.objects:
        if obj.name.startswith("silk"):
            for f, rz, zz in [(1, 0.0, 0.0), (60, math.radians(4), 0.15), (120, 0.0, 0.0)]:
                obj.rotation_euler.z = rz; obj.location.z = zz
                obj.keyframe_insert("rotation_euler", index=2, frame=f)
                obj.keyframe_insert("location", index=2, frame=f)

    scene.eevee.taa_render_samples = 24
    scene.render.resolution_x = 1280; scene.render.resolution_y = 720
    scene.render.film_transparent = False

if __name__ == "__main__":
    build()

# --- encode (after rendering PNG frames to frames/f_####.png) ---
#  ffmpeg -y -framerate 30 -i frames/f_%04d.png -c:v libx264 -pix_fmt yuv420p \
#     -crf 24 -movflags +faststart ../../public/video/randhir-silk.mp4
#  ffmpeg -y -framerate 30 -i frames/f_%04d.png -c:v libvpx-vp9 -pix_fmt yuv420p \
#     -crf 34 -b:v 0 ../../public/video/randhir-silk.webm
#  cwebp -q 82 frames/f_0045.png -o ../../public/video/randhir-silk-poster.webp
