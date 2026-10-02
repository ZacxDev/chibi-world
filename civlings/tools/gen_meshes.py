#!/usr/bin/env python3
"""Procedural low-poly glTF generator for the chibi 3D demo world.

Everything is offline stdlib Python. Each primitive is emitted as ONE
*.gltf* file per (shape, color) pair into assets/meshes/.

Mesh layout (what Defold's glTF loader expects):
  attributes: POSITION (VEC3), NORMAL (VEC3), TEXCOORD_0 (VEC2),
              COLOR_0 (VEC4, float32) -- optional but supported by the
  loader; if bob/the loader drops COLOR_0, bake per-face lighting
  into the color anyway -- the shader samples it so a plain single
  color is still shaded by face normal via vertex colors per mesh.

Per-FACE normals: vertices are duplicated per triangle so normals
are exact face normals (flat-shaded faceted look).

Pseudo-lighting is baked into vertex colors:
    brightness = 0.72 + 0.28 * max(0, dot(face_normal, normalize((-0.45,0.8,0.4))))
multiplied into the base color. This guarantees a cute readable
low-poly look even if engine lighting is flat.
"""

import base64
import json
import math
import os
import struct
import sys

OUT_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "assets", "meshes",
)
OUT_DIR = os.path.normpath(OUT_DIR)

LIGHT_DIR = (-0.45, 0.8, 0.4)
_l = math.sqrt(sum(v * v for v in LIGHT_DIR))
LIGHT_DIR = tuple(v / _l for v in LIGHT_DIR)


def face_brightness(n):
    d = max(0.0, sum(a * b for a, b in zip(n, LIGHT_DIR)))
    return 0.72 + 0.28 * d


def shade(color, normal):
    b = face_brightness(normal)
    return tuple(min(1.0, c * b) for c in color)


# ---------------------------------------------------------------- helpers

def norm3(a):
    l = math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2)
    return (a[0] / l, a[1] / l, a[2] / l)


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def face_normal(p0, p1, p2):
    return norm3(cross(sub(p1, p0), sub(p2, p0)))


def emit_mesh(positions, triangles, color, uvs=None):
    """positions: list of xyz tuples; triangles: list of index triples;
    color: rgb tuple in [0,1]; optional uvs: per-position (u, v) pairs,
    carried through the per-face vertex duplication. Default (0, 0)."""
    pos, nor, col, uv = [], [], [], []
    idx = []
    for (i0, i1, i2) in triangles:
        p0, p1, p2 = positions[i0], positions[i1], positions[i2]
        n = face_normal(p0, p1, p2)
        c = shade(color, n)
        for i, p in enumerate((p0, p1, p2)):
            pos.append(p)
            nor.append(n)
            col.append(c)
            uv.append(uvs[(i0, i1, i2)[i]] if uvs else (0.0, 0.0))
            idx.append(len(pos) - 1)

    def pack(fmt, items):
        flat = []
        for it in items:
            if isinstance(it, tuple):
                flat.extend(it)
            else:
                flat.append(it)
        return struct.pack("<%d%s" % (len(flat), fmt), *flat)

    bpos = pack("f", pos)
    bnor = pack("f", nor)
    bcol = pack("f", [(r, g, b, 1.0) for (r, g, b) in col])
    buv = pack("f", uv)
    bidx = pack("I", idx)
    buf = bpos + bnor + bcol + buv + bidx

    def stats4(items):
        cols = list(zip(*items)) if items else [(0.0,)] * 4
        return ([min(c) for c in cols], [max(c) for c in cols])

    pos_min, pos_max = stats4(pos)
    nor_min, nor_max = stats4(nor)
    col4 = [(r, g, b, 1.0) for (r, g, b) in col]
    col_min, col_max = stats4(col4)
    uv_min, uv_max = stats4(uv) if uv else ([0, 0], [0, 0])

    accessors = [
        {"bufferView": 0, "byteOffset": 0, "componentType": 5126, "count": len(pos),
         "type": "VEC3", "min": pos_min, "max": pos_max},
        {"bufferView": 1, "byteOffset": 0, "componentType": 5126, "count": len(pos),
         "type": "VEC3", "min": nor_min, "max": nor_max},
        {"bufferView": 2, "byteOffset": 0, "componentType": 5126, "count": len(pos),
         "type": "VEC4", "min": col_min, "max": col_max},
        {"bufferView": 3, "byteOffset": 0, "componentType": 5126, "count": len(pos),
         "type": "VEC2", "min": uv_min, "max": uv_max},
        {"bufferView": 4, "byteOffset": 0, "componentType": 5125, "count": len(idx),
         "type": "SCALAR"},
    ]
    buffers = [
        {"uri": "data:application/octet-stream;base64,"
                + base64.b64encode(buf).decode(), "byteLength": len(buf)}
    ]
    gltf = {
        "asset": {"version": "2.0", "generator": "gen_meshes.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "mesh"}],
        "meshes": [{"primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2,
                           "TEXCOORD_0": 3},
            "indices": 4, "mode": 4, "material": 0}]}],
        "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1],
                                                "metallicFactor": 0,
                                                "roughnessFactor": 1},
                       "doubleSided": True}],
        "accessors": accessors,
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(bpos), "target": 34962},
            {"buffer": 0, "byteOffset": len(bpos), "byteLength": len(bnor),
             "target": 34962},
            {"buffer": 0, "byteOffset": len(bpos) + len(bnor), "byteLength": len(bcol),
             "target": 34962},
            {"buffer": 0, "byteOffset": len(bpos) + len(bnor) + len(bcol),
             "byteLength": len(buv), "target": 34962},
            {"buffer": 0, "byteOffset": len(bpos) + len(bnor) + len(bcol) + len(buv),
             "byteLength": len(bidx), "target": 34963},
        ],
        "buffers": buffers,
    }
    return gltf


# ---------------------------------------------------------------- primitives

def pxz(plane="xy"):
    """No-op marker for readability."""
    return plane


def cube(w=1.0, h=1.0, d=1.0, cy=0.0):
    x, y, z = w / 2, h / 2, d / 2
    p = [
        (-x, cy - y, -z), (x, cy - y, -z), (x, cy + y, -z), (-x, cy + y, -z),
        (-x, cy - y, z), (x, cy - y, z), (x, cy + y, z), (-x, cy + y, z),
    ]
    t = [
        (0, 1, 2), (0, 2, 3),  # -Z
        (4, 6, 5), (4, 7, 6),  # +Z
        (0, 3, 7), (0, 7, 4),  # -X
        (1, 5, 6), (1, 6, 2),  # +X
        (3, 2, 6), (3, 6, 7),  # +Y
        (0, 4, 5), (0, 5, 1),  # -Y
    ]
    return p, t


def tilebox(w=1.9, h=0.12, d=1.9, cy=None):
    """Thin slab with OUTWARD winding. The shared cube() helper winds every
    face inward; that reads fine on chunky boxes but turns thin slabs
    inside-out under backface culling, so tiles get this dedicated box."""
    if cy is None:
        cy = h / 2
    x, y, z = w / 2, h / 2, d / 2
    p = [
        (-x, cy - y, -z), (x, cy - y, -z), (x, cy + y, -z), (-x, cy + y, -z),
        (-x, cy - y, z), (x, cy - y, z), (x, cy + y, z), (-x, cy + y, z),
    ]
    t = [
        (3, 6, 2), (3, 7, 6),  # +Y top
        (0, 5, 4), (0, 1, 5),  # -Y bottom
        (0, 2, 1), (0, 3, 2),  # -Z
        (4, 5, 6), (4, 6, 7),  # +Z
        (0, 4, 7), (0, 7, 3),  # -X
        (1, 2, 6), (1, 6, 5),  # +X
    ]
    return p, t



def card_geo():
    """Vertical display card for generated art: 1.5x1.5, front face +Z,
    real 0..1 UVs (the only mesh that carries them)."""
    p = [(-0.75, 0.55, 0.06), (0.75, 0.55, 0.06),
         (0.75, 2.05, 0.06), (-0.75, 2.05, 0.06)]
    t = [(0, 1, 2), (0, 2, 3)]
    uvs = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    return p, t, uvs


def prism(w=4.4, h=1.6, d=3.9, cy=0.0):
    """Roof prism: ridge along Z, apex at (0, cy+h), bases at z=+-d/2."""
    x, z = w / 2, d / 2
    p = [
        (-x, cy, -z), (x, cy, -z), (0, cy + h, -z),
        (-x, cy, z), (x, cy, z), (0, cy + h, z),
    ]
    t = [
        (0, 2, 1),  # back end (-Z)
        (3, 4, 5),  # front end (+Z)
        (2, 5, 4), (2, 4, 1),  # +X slope
        (0, 3, 5), (0, 5, 2),  # -X slope
        (3, 0, 1), (3, 1, 4),  # underside
    ]
    return p, t


def sphere(r=1.0, wseg=10, hseg=8, cy=0.0, squash=1.0):
    p = [(0, cy - r, 0), (0, cy + r, 0)]
    rings = []
    for j in range(1, hseg):
        phi = math.pi * j / hseg
        ring = []
        for i in range(wseg):
            th = 2 * math.pi * i / wseg
            x = r * math.sin(phi) * math.cos(th)
            y = cy + r * math.cos(phi) * squash
            z = r * math.sin(phi) * math.sin(th)
            ring.append(len(p))
            p.append((x, y, z))
        rings.append(ring)
    t = []
    top, bottom = 0, 1
    first = rings[0]
    for i in range(wseg):
        t.append((bottom, first[(i + 1) % wseg], first[i]))
        t.append((top, first[i], first[(i + 1) % wseg]))
    for j in range(len(rings) - 1):
        a, b = rings[j], rings[j + 1]
        for i in range(wseg):
            nxt = (i + 1) % wseg
            t.append((a[i], a[nxt], b[i]))
            t.append((b[i], a[nxt], b[nxt]))
    last = rings[-1]
    for i in range(wseg):
        t.append((bottom, last[i], last[(i + 1) % wseg]))
    return p, t


def cylinder(r=0.3, h=1.0, seg=10, cy=0.0):
    p = [(0, cy - h / 2, 0), (0, cy + h / 2, 0)]
    idxb, idxt = [], []
    for i in range(seg):
        th = 2 * math.pi * i / seg
        x, z = r * math.cos(th), r * math.sin(th)
        idxb.append(len(p)); p.append((x, cy - h / 2, z))
        idxt.append(len(p)); p.append((x, cy + h / 2, z))
    bottom, top = 0, 1
    t = []
    for i in range(seg):
        n = (i + 1) % seg
        t.append((idxb[i], idxb[n], idxt[i]))
        t.append((idxt[i], idxb[n], idxt[n]))
        t.append((bottom, idxt[n], idxt[i]))
        t.append((top, idxb[i], idxb[n]))
    return p, t


def disc(r=3.0, h=0.06, seg=24, cy=0.0):
    p, t = cylinder(r, h, seg, cy)
    return p, t


def plane(s=34.0):
    p = [(-s / 2, 0, -s / 2), (s / 2, 0, -s / 2),
         (s / 2, 0, s / 2), (-s / 2, 0, s / 2)]
    t = [(0, 2, 1), (0, 3, 2)]  # wound so the face normal points +Y (up)
    return p, t


def cone(r=0.5, h=1.0, seg=10, cy=0.0):
    base_y = cy
    apex = (0, cy + h, 0)
    p = [(0, base_y, 0), apex]
    ring = []
    for i in range(seg):
        th = 2 * math.pi * i / seg
        ring.append(len(p))
        p.append((r * math.cos(th), base_y, r * math.sin(th)))
    base, apex_i = 0, 1
    t = []
    for i in range(seg):
        n = (i + 1) % seg
        t.append((ring[i], ring[n], apex_i))
        t.append((base, ring[n], ring[i]))
    return p, t


# ---------------------------------------------------------------- palette

COLORS = {
    "skin": (1.0, 0.85, 0.71),
    "hair": (0.45, 0.30, 0.55),
    "shirt": (0.95, 0.55, 0.65),
    "pants": (0.45, 0.55, 0.95),
    "arm": (0.95, 0.55, 0.65),
    "leg": (0.45, 0.55, 0.95),
    "eye": (0.14, 0.14, 0.18),
    "blush": (1.0, 0.62, 0.62),
    "white": (1.0, 1.0, 1.0),
    "ground": (0.45, 0.83, 0.45),
    "path": (0.92, 0.80, 0.62),
    "wall": (1.0, 0.94, 0.82),
    "roof": (0.92, 0.48, 0.38),
    "chimney": (0.62, 0.62, 0.66),
    "door": (0.48, 0.33, 0.20),
    "window": (0.75, 0.92, 1.0),
    "frame": (0.92, 0.85, 0.70),
    "step": (0.80, 0.72, 0.58),
    "trunk": (0.52, 0.36, 0.24),
    "leaf": (0.36, 0.78, 0.42),
    "leaf_pink": (1.0, 0.68, 0.78),
    "leaf_orange": (0.98, 0.62, 0.28),
    "grass": (0.34, 0.75, 0.36),
    "water": (0.42, 0.75, 0.98),
    "water_inner": (0.62, 0.88, 1.0),
    "rock": (0.70, 0.72, 0.78),
    "cloud": (1.0, 1.0, 1.0),
    "flower_pink": (1.0, 0.45, 0.62),
    "flower_yellow": (1.0, 0.85, 0.36),
    "flower_lav": (0.72, 0.60, 0.98),
    "stem": (0.30, 0.62, 0.32),
    "mountain": (0.62, 0.68, 0.82),
    "mountain_snow": (0.94, 0.96, 1.0),
    "tile_plaza": (0.95, 0.86, 0.64),
    "tile_core": (0.58, 0.86, 0.62),
    "tile_outer": (0.60, 0.72, 0.88),
    "tile_edge": (0.74, 0.80, 0.58),
    "scaffold": (0.82, 0.83, 0.87),
    "card": (1.0, 1.0, 1.0),
}

# aliases for baked-scale mesh variants (same colors, geometry pre-scaled)
COLORS.update({
    "cloud_a": COLORS["cloud"],
    "cloud_b": COLORS["cloud"],
    "cloud_c": COLORS["cloud"],
    "path_slim": COLORS["path"],
})


def rgba(v):
    return (v[0], v[1], v[2])


# ---------------------------------------------------------------- manifest

# (name, fn, kwargs)
MESHES = [
    # player bits
    ("sphere_skin", sphere, dict(r=0.42, wseg=12, hseg=10)),
    ("sphere_hair", sphere, dict(r=0.46, wseg=12, hseg=8, squash=0.82)),
    ("sphere_eye", sphere, dict(r=0.045, wseg=8, hseg=6)),
    ("box_blush", cube, dict(w=0.11, h=0.05, d=0.03)),
    ("box_pants", cube, dict(w=0.50, h=0.22, d=0.33)),
    ("box_shirt", cube, dict(w=0.54, h=0.34, d=0.36)),
    # limbs: geometry extends DOWNWARD from origin (pivot at top)
    ("box_arm", cube, dict(w=0.13, h=0.42, d=0.13, cy=-0.21)),
    ("box_leg", cube, dict(w=0.15, h=0.32, d=0.15, cy=-0.16)),
    # environment
    ("plane_ground", plane, dict(s=34.0)),
    ("box_path", cube, dict(w=1.6, h=0.04, d=5.2)),
    ("box_path_slim", cube, dict(w=1.12, h=0.04, d=5.2)),
    ("disc_water", disc, dict(r=3.0, h=0.08)),
    ("disc_water_inner", disc, dict(r=2.2, h=0.08)),
    ("box_wall", cube, dict(w=4.2, h=2.6, d=3.6)),
    ("prism_roof", prism, dict(w=4.9, h=1.7, d=4.2)),
    ("box_chimney", cube, dict(w=0.5, h=1.1, d=0.5)),
    ("box_door", cube, dict(w=0.8, h=1.5, d=0.1)),
    ("box_step", cube, dict(w=1.0, h=0.12, d=0.5)),
    ("box_window", cube, dict(w=0.8, h=0.8, d=0.1)),
    ("box_frame", cube, dict(w=0.95, h=0.95, d=0.06)),
    ("cyl_trunk", cylinder, dict(r=0.16, h=1.1)),
    ("sphere_leaf", sphere, dict(r=0.85, wseg=10, hseg=8, squash=0.9)),
    ("sphere_leaf2", sphere, dict(r=0.6, wseg=10, hseg=8, squash=0.9)),
    ("sphere_leaf2_pink", sphere, dict(r=0.6, wseg=10, hseg=8, squash=0.9)),
    ("sphere_leaf2_orange", sphere, dict(r=0.6, wseg=10, hseg=8, squash=0.9)),
    ("sphere_leaf_pink", sphere, dict(r=0.85, wseg=10, hseg=8, squash=0.9)),
    ("sphere_leaf_orange", sphere, dict(r=0.85, wseg=10, hseg=8, squash=0.9)),
    ("cone_grass", cone, dict(r=0.28, h=0.55, seg=7)),
    ("cyl_stem", cylinder, dict(r=0.03, h=0.4)),
    ("sphere_flower_pink", sphere, dict(r=0.13, wseg=8, hseg=6)),
    ("sphere_flower_yellow", sphere, dict(r=0.13, wseg=8, hseg=6)),
    ("sphere_flower_lav", sphere, dict(r=0.13, wseg=8, hseg=6)),
    ("sphere_rock", sphere, dict(r=0.45, wseg=9, hseg=7, squash=0.65)),
    ("sphere_cloud", sphere, dict(r=1.0, wseg=10, hseg=7, squash=0.55)),
    ("sphere_cloud_a", sphere, dict(r=1.45, wseg=10, hseg=7, squash=0.42)),
    ("sphere_cloud_b", sphere, dict(r=0.85, wseg=10, hseg=7, squash=0.5)),
    ("sphere_cloud_c", sphere, dict(r=1.0, wseg=10, hseg=7, squash=0.48)),
    ("box_tile_plaza", tilebox, dict(w=1.9, h=0.16, d=1.9, cy=0.08)),
    ("box_tile_core", tilebox, dict(w=1.9, h=0.12, d=1.9, cy=0.06)),
    ("box_tile_outer", tilebox, dict(w=1.9, h=0.09, d=1.9, cy=0.045)),
    ("box_tile_edge", tilebox, dict(w=1.9, h=0.06, d=1.9, cy=0.03)),
    ("box_scaffold", cube, dict(w=1.6, h=1.6, d=0.08, cy=1.3)),
    ("plane_card", None, None),  # special-cased in main() for UVs
    ("cone_mountain", cone, dict(r=7.0, h=9.0, seg=9)),
    ("cone_mountain_snow", cone, dict(r=2.19, h=3.25, seg=9)),
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    written = []
    for name, fn, kw in MESHES:
        color_key = None
        for prefix in ("sphere_", "box_", "cyl_", "disc_", "cone_",
                       "prism_", "plane_"):
            if name.startswith(prefix):
                color_key = name[len(prefix):]
                break
        if color_key and color_key.startswith("leaf2"):
            color_key = "leaf" + color_key[len("leaf2"):]
        if color_key is None or color_key not in COLORS:
            raise SystemExit("No color for " + name)
        base = COLORS[color_key]
        if name == "plane_card":
            pos, tris, uvs = card_geo()
            gltf = emit_mesh(pos, tris, base, uvs)
        else:
            pos, tris = fn(**kw)
            gltf = emit_mesh(pos, tris, base)
        path = os.path.join(OUT_DIR, name + ".gltf")
        with open(path, "w") as f:
            json.dump(gltf, f, separators=(",", ":"))
        written.append(os.path.basename(path))
    print("Generated %d meshes:" % len(written))
    for w in written:
        print(" ", w)


if __name__ == "__main__":
    main()
