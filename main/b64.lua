-- Minimal base64 decoder (JS ships raw RGBA texture bytes as base64).
local M = {}
local CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local rev = {}
for i = 1, #CHARS do rev[CHARS:sub(i, i)] = i - 1 end

function M.decode(data)
    local out, buf, bits = {}, 0, 0
    for i = 1, #data do
        local ch = data:sub(i, i)
        local v = rev[ch]
        if v ~= nil then
            buf = buf * 64 + v
            bits = bits + 6
            if bits >= 8 then
                bits = bits - 8
                out[#out + 1] = string.char(math.floor(buf / 2 ^ bits) % 256)
                buf = buf % 2 ^ bits -- keep the accumulator exact on long inputs
            end
        elseif ch == "=" then
            break
        end
    end
    return table.concat(out)
end

return M
