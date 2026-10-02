-- Runtime registry so scripts can find each other without hardcoded URLs.
-- bridge.script, main.script and civling.script register at init; senders
-- read the table when they need to route a message.
return {
    bridge_url = nil,  -- bridge.script (the JS boundary)
    game_url = nil,    -- main.script (world spawner / props)
    civling_url = nil, -- the first Civling
}
