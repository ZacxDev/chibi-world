-- Isometric grid + camera math for Civlings (shared: spawner, civling).
local M = {}

M.TILE = 2.0          -- world units per cell
M.SIZE = 10           -- 10x10 Genesis City grid

-- Fixed isometric camera on the (+1,+1,+1) diagonal looking at the origin.
M.CAM_POS = { x = 19.62, y = 19.62, z = 19.62 }
M.CAM_F = { x = -0.57735, y = -0.57735, z = -0.57735 }  -- forward
M.CAM_R = { x = 0.70711, y = 0.0, z = -0.70711 }        -- screen right
M.CAM_U = { x = -0.40825, y = 0.81650, z = -0.40825 }   -- screen up
M.CAM_ZOOM = 28.0  -- must match orthographic_zoom on the camera component

-- Tile-top heights (match the baked mesh heights in gen_meshes.py).
M.TIER_TOP = { plaza = 0.16, core = 0.12, outer = 0.09, edge = 0.06 }

-- cell (c, r) in 0..9 -> world x, z of the cell centre
function M.cell_to_world(c, r)
    return (c - 4.5) * M.TILE, (r - 4.5) * M.TILE
end

function M.tier(c, r)
    local d = math.max(math.abs(c - 4.5), math.abs(r - 4.5))
    if d < 1.0 then return "plaza" end
    if d < 2.0 then return "core" end
    if d < 4.0 then return "outer" end
    return "edge"
end

-- Screen point -> grid cell. sx/sy are Defold input coords (origin
-- bottom-left); win_w/win_h the window size in the same units.
function M.pick(sx, sy, win_w, win_h)
    local ndc_x = (sx / win_w) * 2 - 1
    local ndc_y = (sy / win_h) * 2 - 1
    local half_h = (win_h / M.CAM_ZOOM) * 0.5
    local half_w = (win_w / M.CAM_ZOOM) * 0.5
    local ox = M.CAM_POS.x + M.CAM_R.x * ndc_x * half_w + M.CAM_U.x * ndc_y * half_h
    local oy = M.CAM_POS.y + M.CAM_R.y * ndc_x * half_w + M.CAM_U.y * ndc_y * half_h
    local oz = M.CAM_POS.z + M.CAM_R.z * ndc_x * half_w + M.CAM_U.z * ndc_y * half_h
    local t = -oy / M.CAM_F.y
    local hx, hz = ox + M.CAM_F.x * t, oz + M.CAM_F.z * t
    local c = math.floor(hx / M.TILE + 5)
    local r = math.floor(hz / M.TILE + 5)
    if c < 0 then c = 0 elseif c > 9 then c = 9 end
    if r < 0 then r = 0 elseif r > 9 then r = 9 end
    return c, r
end

-- BFS shortest path on the (currently fully walkable) grid. Returns a list
-- of { c, r } excluding the start cell; empty if already there.
function M.find_path(sc, sr, tc, tr)
    if sc == tc and sr == tr then return {} end
    local function key(c, r) return r * 16 + c end
    local prev = { [key(sc, sr)] = false }
    local q = { { sc, sr } }
    local head = 1
    while head <= #q do
        local c, r = q[head][1], q[head][2]
        head = head + 1
        if c == tc and r == tr then break end
        local nb = { { c + 1, r }, { c - 1, r }, { c, r + 1 }, { c, r - 1 } }
        for _, n in ipairs(nb) do
            local nc, nr = n[1], n[2]
            if nc >= 0 and nc <= 9 and nr >= 0 and nr <= 9 and prev[key(nc, nr)] == nil then
                prev[key(nc, nr)] = key(c, r)
                q[#q + 1] = { nc, nr }
            end
        end
    end
    if prev[key(tc, tr)] == nil then return {} end
    local path, k = {}, key(tc, tr)
    while k do
        local c, r = k % 16, math.floor(k / 16)
        table.insert(path, 1, { c = c, r = r })
        k = prev[k]
    end
    table.remove(path, 1) -- drop the start cell
    return path
end

return M
