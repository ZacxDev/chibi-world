#!/usr/bin/env python3
"""Writes the Defold .collection files for the chibi 3D demo."""
import os

BASE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                     "..", "main"))
MAT = "/assets/materials/chibi.material"


def esc(s):
    # protobuf text escape for double-quoted string
    s = s.replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')
    return s


def fmt(v):
    if v == int(v):
        return str(int(v))
    return ("%.4f" % v).rstrip("0").rstrip(".")


def model_comp(cid, mesh, pos=(0, 0, 0), scale=(1, 1, 1)):
    if scale != (1, 1, 1):
        raise SystemExit(
            "model_comp %s: component scale not supported by "
            "EmbeddedComponentDesc (no scale3 field); bake scale into a "
            "mesh variant instead" % cid)
    data = ('embedded_components {\n'
            '  id: "%s"\n'
            '  type: "model"\n'
            '  data: "%s"\n'
            % (cid, esc('mesh: "%s"\nmaterial: "%s"\n' % (mesh, MAT))))
    if pos != (0, 0, 0):
        data += ('  position {\n    x: %s\n    y: %s\n    z: %s\n  }\n'
                 % tuple(fmt(v) for v in pos))
    data += '}\n'
    return data


def script_comp(cid, script):
    return ('components {\n  id: "%s"\n  component: "%s"\n}\n' % (cid, script))


def factory_comp(cid, proto):
    return ('embedded_components {\n'
            '  id: "%s"\n'
            '  type: "collectionfactory"\n'
            '  data: "%s"\n'
            '}\n' % (cid, esc('prototype: "%s"\n' % proto)))


def camera_comp():
    data = ('aspect_ratio: 1.7777778\n'
            'fov: 0.96\n'
            'near_z: 0.1\n'
            'far_z: 200.0\n'
            'auto_aspect_ratio: 1\n')
    return ('embedded_components {\n  id: "camera"\n  type: "camera"\n'
            '  data: "%s"\n}\n' % esc(data))


def pos_block(x, y, z, scale=(1, 1, 1), quat=None):
    s = ('  position {\n    x: %s\n    y: %s\n    z: %s\n  }\n'
         % (fmt(x), fmt(y), fmt(z)))
    if quat is not None:
        s += ('  rotation {\n    x: %s\n    y: %s\n    z: %s\n    w: %s\n  }\n'
              % tuple(fmt(v) for v in quat))
    if scale != (1, 1, 1):
        s += '  scale3 {\n    x: %s\n    y: %s\n    z: %s\n  }\n' % tuple(fmt(v) for v in scale)
    return s


def instance(iid, data, children=None, pos=(0, 0, 0), scale=(1, 1, 1), quat=None):
    out = 'embedded_instances {\n  id: "%s"\n' % iid
    if children:
        for c in children:
            out += '  children: "%s"\n' % c
    out += '  data: "%s"\n' % esc(data or "")
    out += pos_block(*pos, scale=scale, quat=quat)
    out += '}\n'
    return out


def write(name, body):
    path = os.path.join(BASE, name)
    with open(path, "w") as f:
        f.write(body)
    print("wrote", path)


M = "/assets/meshes/"


def models(items):
    """items: list of (cid, meshfile, pos, scale) -> blob of embedded comps."""
    return "".join(model_comp(cid, M + mesh, pos, scale)
                   for (cid, mesh, pos, scale) in items)


# ---------------------------------------------------------------- player

player_body = 'name: "player"\nscale_along_z: 0\n'
# root GO player: script only (the visible head lives on the "head" child)
p_root = script_comp("script", "/main/player.script")
# children defined separately as embedded_instances linked by children list
child_head = models([
        ("head", "sphere_skin.gltf", (0, 0, 0), (1, 1, 1)),
        ("hair", "sphere_hair.gltf", (0, 0.09, -0.05), (1, 1, 1)),
        ("eye_l", "sphere_eye.gltf", (-0.14, 0.03, -0.37), (1, 1, 1)),
        ("eye_r", "sphere_eye.gltf", (0.14, 0.03, -0.37), (1, 1, 1)),
        ("blush_l", "box_blush.gltf", (-0.23, -0.08, -0.38), (1, 1, 1)),
        ("blush_r", "box_blush.gltf", (0.23, -0.08, -0.38), (1, 1, 1)),
    ])
child_body = models([
        ("shirt", "box_shirt.gltf", (0, -0.17, 0), (1, 1, 1)),
        ("pants", "box_pants.gltf", (0, -0.39, 0), (1, 1, 1)),
    ])
child_arm_l = models([("arm", "box_arm.gltf", (0, 0, 0), (1, 1, 1))])
child_arm_r = models([("arm", "box_arm.gltf", (0, 0, 0), (1, 1, 1))])
child_leg_l = models([("leg", "box_leg.gltf", (0, 0, 0), (1, 1, 1))])
child_leg_r = models([("leg", "box_leg.gltf", (0, 0, 0), (1, 1, 1))])
child_camera = camera_comp()

player_body += instance("player", p_root, children=["rig"],
                        pos=(0, 0, 0))
player_body += instance("rig", "", children=["head", "body", "arm_l", "arm_r",
                                             "leg_l", "leg_r", "camera_go"],
                        pos=(0, 0.95, 0))
player_body += instance("head", child_head, pos=(0, 0.28, 0))
player_body += instance("body", child_body, pos=(0, -0.12, 0))
player_body += instance("arm_l", child_arm_l, pos=(-0.35, 0.12, 0))
player_body += instance("arm_r", child_arm_r, pos=(0.35, 0.12, 0))
player_body += instance("leg_l", child_leg_l, pos=(-0.13, -0.55, 0))
player_body += instance("leg_r", child_leg_r, pos=(0.13, -0.55, 0))
# camera: behind/above the player, pitched down ~20 degrees so the chibi
# (feet at y=0, head top ~y=1.65) sits in the lower-center of frame.
# quat for rotation about X by -0.36 rad: (sin(-0.18), 0, 0, cos(0.18))
import math as _math
_cam_pitch = -0.36
CAM_QUAT = (_math.sin(_cam_pitch / 2), 0.0, 0.0, _math.cos(_cam_pitch / 2))
player_body += instance("camera_go", child_camera, pos=(0, 2.4, 6.0),
                        quat=CAM_QUAT)
write("player.collection", player_body)

# ---------------------------------------------------------------- house

house_body = 'name: "house"\nscale_along_z: 0\n'
parts = models([
    ("walls", "box_wall.gltf", (0, 1.3, 0), (1, 1, 1)),
    ("roof", "prism_roof.gltf", (0, 2.6, 0), (1, 1, 1)),
    ("chimney", "box_chimney.gltf", (-1.2, 3.3, 0.6), (1, 1, 1)),
    ("door", "box_door.gltf", (0, 0.75, 1.78), (1, 1, 1)),
    ("step", "box_step.gltf", (0, 0.06, 1.95), (1, 1, 1)),
    ("win_frame_l", "box_frame.gltf", (-1.3, 1.5, 1.80), (1, 1, 1)),
    ("win_l", "box_window.gltf", (-1.3, 1.5, 1.83), (1, 1, 1)),
    ("win_frame_r", "box_frame.gltf", (1.3, 1.5, 1.80), (1, 1, 1)),
    ("win_r", "box_window.gltf", (1.3, 1.5, 1.83), (1, 1, 1)),
    ("win_frame_back", "box_frame.gltf", (0.8, 1.5, -1.80), (1, 1, 1)),
    ("win_back", "box_window.gltf", (0.8, 1.5, -1.83), (1, 1, 1)),
])
house_body += instance("house", parts, pos=(0, 0, 0))
write("house.collection", house_body)

# ---------------------------------------------------------------- trees

for name_file, foliage1, foliage2 in [
    ("tree_green", "sphere_leaf.gltf", "sphere_leaf2.gltf"),
    ("tree_pink", "sphere_leaf_pink.gltf", "sphere_leaf2_pink.gltf"),
    ("tree_orange", "sphere_leaf_orange.gltf", "sphere_leaf2_orange.gltf"),
]:
    body = 'name: "tree"\nscale_along_z: 0\n'
    parts = models([
        ("trunk", "cyl_trunk.gltf", (0, 0.55, 0), (1, 1, 1)),
        ("foliage1", foliage1, (0, 1.85, 0), (1, 1, 1)),
        ("foliage2", foliage2, (0.35, 2.35, 0.1), (1, 1, 1)),
    ])
    body += instance("tree", parts, pos=(0, 0, 0))
    write("%s.collection" % name_file, body)

# foliage2 color variants needed; handled by extra generated files listed below
# ---------------------------------------------------------------- grass

body = 'name: "grass"\nscale_along_z: 0\n'
parts = models([("tuft", "cone_grass.gltf", (0, 0.28, 0), (1, 1, 1))])
body += instance("grass", parts, pos=(0, 0, 0))
write("grass.collection", body)

# ---------------------------------------------------------------- flowers

for name_file, head in [("flower_pink", "sphere_flower_pink.gltf"),
                        ("flower_yellow", "sphere_flower_yellow.gltf"),
                        ("flower_lav", "sphere_flower_lav.gltf")]:
    body = 'name: "flower"\nscale_along_z: 0\n'
    parts = models([
        ("stem", "cyl_stem.gltf", (0, 0.2, 0), (1, 1, 1)),
        ("head", head, (0, 0.45, 0), (1, 1, 1)),
    ])
    body += instance("flower", parts, pos=(0, 0, 0))
    write("%s.collection" % name_file, body)

# ---------------------------------------------------------------- rock

body = 'name: "rock"\nscale_along_z: 0\n'
parts = models([("rockm", "sphere_rock.gltf", (0, 0.1, 0), (1, 1, 1))])
body += instance("rock", parts, pos=(0, 0, 0))
write("rock.collection", body)

# ---------------------------------------------------------------- cloud

body = 'name: "cloud"\nscale_along_z: 0\n'
parts = (script_comp("script", "/main/cloud.script")
         + models([
             ("c1", "sphere_cloud_a.gltf", (0, 0, 0), (1, 1, 1)),
             ("c2", "sphere_cloud_b.gltf", (-1.1, -0.1, 0.15), (1, 1, 1)),
             ("c3", "sphere_cloud_c.gltf", (1.15, -0.12, -0.1), (1, 1, 1)),
             ("c4", "sphere_cloud.gltf", (0.3, 0.25, 0.3), (1, 1, 1)),
         ]))
body += instance("cloud", parts, pos=(0, 10, 0))
write("cloud.collection", body)

# ---------------------------------------------------------------- mountains

def mountain_instance(iid, pos, scale):
    parts = models([
        ("mt", "cone_mountain.gltf", (0, 0, 0), (1, 1, 1)),
        ("snow", "cone_mountain_snow.gltf", (0, 6.4, 0), (1, 1, 1)),
    ])
    return instance(iid, parts, pos=pos, scale=scale)

main_body = 'name: "main"\nscale_along_z: 0\n'
game_data = script_comp("script", "/main/main.script")
for cid, proto in [
    ("playerfactory", "/main/player.collection"),
    ("housefactory", "/main/house.collection"),
    ("tree_green_factory", "/main/tree_green.collection"),
    ("tree_pink_factory", "/main/tree_pink.collection"),
    ("tree_orange_factory", "/main/tree_orange.collection"),
    ("grassfactory", "/main/grass.collection"),
    ("flower_pink_factory", "/main/flower_pink.collection"),
    ("flower_yellow_factory", "/main/flower_yellow.collection"),
    ("flower_lav_factory", "/main/flower_lav.collection"),
    ("rockfactory", "/main/rock.collection"),
    ("cloudfactory", "/main/cloud.collection"),
]:
    game_data += factory_comp(cid, proto)

static_models = models([
    ("ground", "plane_ground.gltf", (0, 0, 0), (1, 1, 1)),
    ("pond", "disc_water.gltf", (7, 0.06, 3), (1, 1, 1)),
    ("pond_in", "disc_water_inner.gltf", (7, 0.09, 3), (1, 1, 1)),
    ("path1", "box_path.gltf", (0, 0.03, 2.6), (1, 1, 1)),
    ("path2", "box_path.gltf", (0, 0.03, -3.4), (1, 1, 1)),
    ("path3", "box_path_slim.gltf", (0.4, 0.03, -3.9), (1, 1, 1)),
])

main_body += instance("game", game_data, pos=(0, 0, 0))
main_body += instance("world", static_models, pos=(0, 0, 0))
# mountains ring (embedded directly, far out)
main_body += mountain_instance("mountain1", (-24, -1.5, -24), (1, 1, 1))
main_body += mountain_instance("mountain2", (10, -1.5, -28), (1.25, 1.1, 1.25))
main_body += mountain_instance("mountain3", (26, -1.5, -16), (0.9, 0.9, 0.9))
main_body += mountain_instance("mountain4", (-28, -1.5, 4), (1.1, 1.0, 1.1))
main_body += mountain_instance("mountain5", (-14, -1.5, 26), (1.0, 0.95, 1.0))
main_body += mountain_instance("mountain6", (16, -1.5, 24), (1.15, 1.05, 1.15))
main_body += mountain_instance("mountain7", (-3, -1.5, -32), (0.85, 0.85, 0.85))
write("main.collection", main_body)

print("Collections written to", BASE)
