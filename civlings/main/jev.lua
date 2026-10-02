-- The Jev (task) system: state machine IDLE -> MOVING -> WORKING -> COOLDOWN.
-- Civling stats + the spec yield formula live here; movement stays in
-- civling.script, which calls arrived() when the path completes.
local M = {}

M.TASKS = {
    harvest    = { base = 12, secs = 6,  label = "Harvesting" },
    craft      = { base = 20, secs = 10, label = "Crafting" },
    service    = { base = 8,  secs = 8,  label = "Service/Retail" },
    expedition = { base = 45, secs = 16, label = "Expedition" },
}
M.COOLDOWN_SECS = 3
M.STAMINA_MAX = 100
M.STAMINA_DRAIN = 2.5 -- per second while WORKING
M.STAMINA_REGEN = 2.5 -- per second while IDLE only (no regen on the move/cooldown)

-- Yield = Base x (1 + BiomeAffinityBonus) x CivlingStatModifier
function M.yield_for(stats, task_id, city_biome)
    local task = M.TASKS[task_id]
    local bonus = (stats.affinity_biome == city_biome) and 0.25 or 0
    local modifier = 0.5 + stats.proficiency / 10
    return math.floor(task.base * (1 + bonus) * modifier + 0.5)
end

function M.new(stats, city_biome)
    return {
        state = "IDLE", task = nil, target = nil, t = 0,
        stats = stats, city_biome = city_biome, stamina = M.STAMINA_MAX,
    }
end

-- Returns true, or nil + reason ("busy" / "tired" / "unknown-task").
function M.assign(j, task_id, c, r)
    local task = M.TASKS[task_id]
    if not task then return nil, "unknown-task" end
    if j.state ~= "IDLE" then return nil, "busy" end
    if j.stamina < task.secs * M.STAMINA_DRAIN then return nil, "tired" end
    j.task, j.target, j.t = task_id, { c = c, r = r }, 0
    j.state = "MOVING"
    return true
end

function M.set_stamina(j, v)
    j.stamina = math.max(0, math.min(M.STAMINA_MAX, v or j.stamina))
end

-- 0..1 completion fraction of the current WORKING task (0 otherwise).
function M.progress(j)
    if j.state ~= "WORKING" then return 0 end
    local task = M.TASKS[j.task]
    if not task then return 0 end
    return math.min(1, j.t / task.secs)
end

function M.arrived(j)
    if j.state == "MOVING" then
        j.state, j.t = "WORKING", 0
    end
end

-- Advances timers; returns an event table when something completes:
-- { kind = "yield", task = ..., amount = ... } or { kind = "idle" }.
function M.update(j, dt)
    if j.state == "WORKING" then
        j.t = j.t + dt
        j.stamina = math.max(0, j.stamina - M.STAMINA_DRAIN * dt)
        if j.t >= M.TASKS[j.task].secs then
            local amount = M.yield_for(j.stats, j.task, j.city_biome)
            local task = j.task
            j.state, j.t = "COOLDOWN", 0
            return { kind = "yield", task = task, amount = amount }
        end
    elseif j.state == "COOLDOWN" then
        j.t = j.t + dt
        if j.t >= M.COOLDOWN_SECS then
            j.state, j.task, j.target = "IDLE", nil, nil
            return { kind = "idle" }
        end
    elseif j.state == "IDLE" then
        j.stamina = math.min(M.STAMINA_MAX, j.stamina + M.STAMINA_REGEN * dt)
    end
    return nil
end

return M
