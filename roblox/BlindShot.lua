--!nonstrict
--[[═══════════════════════════════════════════════════════════════════════════

	BlindShot — Roblox port.

	A single LocalScript containing the whole game: config, engine, renderer,
	HUD, tech tree and input. This is a direct transcription of the web build
	(config.js + engine.js + render.js + ui.js + index.html), not a reimagining.

	INSTALL
	  Put this file in ONE place, as a LocalScript:
	      StarterPlayer > StarterPlayerScripts > BlindShot   (LocalScript)
	  Nothing else. No ModuleScripts, no folders, no other setup.

	HOW IT DRAWS
	  The web game paints one pixel per cell into an ImageData and lets the
	  browser upscale it with smoothing off. Roblox has the same primitive:
	  EditableImage + ResamplerMode.Pixelated. The additive glow pass is the
	  same buffer resampled bilinearly on a second layer. Everything else —
	  balls, particles, the player triangle, impact rings — is drawn with
	  pooled Frames in screen space, matching the canvas vector passes.

	  If EditableImage is unavailable on your client, the block layer falls
	  back to a pooled grid of Frames automatically. The window is only about
	  29x19 cells, so that fallback is genuinely playable.

	NOT PORTED
	  localStorage saves. A LocalScript cannot reach DataStoreService; that
	  needs a server Script. Progress lives for the session.

═══════════════════════════════════════════════════════════════════════════]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local GuiService = game:GetService("GuiService")
local AssetService = game:GetService("AssetService")
local HapticService = game:GetService("HapticService")

local PlayerGui = Players.LocalPlayer:WaitForChild("PlayerGui")

--[[ Scale every HUD number by this if the pixel font reads too small on your
     monitor. 1 is pixel-for-pixel with the web build. ]]
local UI_SCALE = 1

local FONT = Enum.Font.Arcade

local floor, ceil, abs, min, max = math.floor, math.ceil, math.abs, math.min, math.max
local sqrt, sin, cos, atan2, exp, pi = math.sqrt, math.sin, math.cos, math.atan2, math.exp, math.pi

--[[ JS Math.round: halves go up, toward +infinity. Luau's math.round sends
     them away from zero, which disagrees on negatives. ]]
local function jsRound(x) return floor(x + 0.5) end
local function hypot(a, b) return sqrt(a * a + b * b) end
local function clamp(v, lo, hi) return v < lo and lo or (v > hi and hi or v) end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  CONFIG — transcription of config.js                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local GRID_W = 100
local GRID_H = 100
local CELL = 16
local CELLS = GRID_W * GRID_H


local TIERS = {
	{ name = "Crust", hp = 3,   color = "#c8ccd0" },
	{ name = "Moss",  hp = 6,   color = "#00c000" },
	{ name = "Clay",  hp = 11,  color = "#a0b000" },
	{ name = "Rust",  hp = 19,  color = "#d05000" },
	{ name = "Ember", hp = 32,  color = "#e00010" },
	{ name = "Slate", hp = 52,  color = "#909aa0" },
	{ name = "Void",  hp = 84,  color = "#ff00ff" },
	{ name = "Core",  hp = 130, color = "#c08000" },
}

--[[ Block appearance. Colour is rolled per block at worldgen and has nothing
     to do with the layer: the map reads as scattered colour while difficulty
     stays radial. Lamps are rare on purpose — they are the only reason any of
     the cave is visible, so making them common flattens the map. ]]
local BLOCKS = {
	{ color = "#c8ccd0", glow = nil,       light = 0,   weight = 13 },
	{ color = "#909aa0", glow = nil,       light = 0,   weight = 12 },
	{ color = "#e00010", glow = nil,       light = 0,   weight = 12 },
	{ color = "#d05000", glow = nil,       light = 0,   weight = 11 },
	{ color = "#a0b000", glow = nil,       light = 0,   weight = 11 },
	{ color = "#00c000", glow = nil,       light = 0,   weight = 11 },
	{ color = "#c08000", glow = nil,       light = 0,   weight = 10 },
	{ color = "#2f6fd0", glow = nil,       light = 0,   weight = 8 },
	{ color = "#7a3fb5", glow = nil,       light = 0,   weight = 7 },
	-- Lamps
	{ color = "#ffffff", glow = "#ffffff", light = 3.4, weight = 1.5 },
	{ color = "#ff00ff", glow = "#ff00ff", light = 3.0, weight = 0.7 },
	{ color = "#00e0d0", glow = "#00e0d0", light = 2.8, weight = 0.5 },
	{ color = "#ffe020", glow = "#ffe020", light = 3.0, weight = 0.35 },
}

local BLOCK_TOKEN   = { color = "#ffffff", glow = "#ffffff", light = 1.6 }
local BLOCK_GOLDEN  = { color = "#ffd23d", glow = "#ffd23d", light = 5.0 }
local BLOCK_BEDROCK = { color = "#20282c", glow = nil,       light = 0 }

--[[ Layers radiate out from the spawn point, they are not rows. Whatever
     corner the run drops you in, the rock touching you is layer 1 / Crust, so
     there is never a spawn you cannot dig out of. ]]
local LAYER_RADIUS = 12

local function tierOfDist(dist)
	local t = floor(dist / LAYER_RADIUS)
	if t < 0 then return 0 end
	if t >= #TIERS then return #TIERS - 1 end
	return t
end

local function distFrom(col, row, fromCol, fromRow)
	local dc, dr = col - fromCol, row - fromRow
	return sqrt(dc * dc + dr * dr)
end

local KIND_TOKEN, KIND_GOLDEN, KIND_BEDROCK = 1, 2, 3

local GOLDEN_DIST_MIN = 70
local GOLDEN_DIST_MAX = 90
local GOLDEN_AURA = 11

local PALETTE = {
	bg = "#102018",
	unseen = "#001008",
	player = "#e8a33d",
	golden = "#ffd23d",
	hud = "#4ade80",
	branch = {
		red = "#ef4444", orange = "#f97316", yellow = "#eab308",
		green = "#22c55e", blue = "#38bdf8", magenta = "#e935c8",
	},
}

--[[ Terraria-style flood light: every emissive cell seeds the map, then four
     directional sweeps smear it outward, losing a fixed fraction per step.
     Air carries light much further than rock, which is what carves the soft
     pools around a lamp instead of a flat disc. ]]

local BALLS = {
	basic = {
		id = "basic", name = "Iron ball", branch = "orange", color = "#f2a65a",
		desc = "No tricks. Ricochets hard and hits reliably.",
		damageMul = 1, splashBonus = 0, pierce = false, chains = false, poisons = false,
		revealBonus = 0, luckMul = 1, speedMul = 1, bounceBonus = 2,
	},
	bomb = {
		id = "bomb", name = "Bomb ball", branch = "orange", color = "#fb7a1e",
		desc = "Detonates on every bounce. Huge splash, slower flight.",
		damageMul = 0.85, splashBonus = 2, pierce = false, chains = false, poisons = false,
		revealBonus = 0, luckMul = 1, speedMul = 0.85, bounceBonus = 0,
	},
	lightning = {
		id = "lightning", name = "Storm ball", branch = "yellow", color = "#f4e04d",
		desc = "Arcs to nearby blocks on every hit. Fast, and it bounces forever.",
		damageMul = 0.8, splashBonus = 0, pierce = false, chains = true, poisons = false,
		revealBonus = 1, luckMul = 1, speedMul = 1.25, bounceBonus = 5,
	},
	poison = {
		id = "poison", name = "Poison ball", branch = "green", color = "#3ddc61",
		desc = "Rots blocks over time. Weak up front, brutal if you wait.",
		damageMul = 0.6, splashBonus = 1, pierce = false, chains = false, poisons = true,
		revealBonus = 0, luckMul = 1, speedMul = 1, bounceBonus = 2,
	},
	ghost = {
		id = "ghost", name = "Ghost ball", branch = "blue", color = "#5ad1f5",
		desc = "The only ball that tunnels instead of bouncing. Dies fast.",
		damageMul = 0.7, splashBonus = 0, pierce = true, chains = false, poisons = false,
		revealBonus = 1, luckMul = 1, speedMul = 1.15, bounceBonus = 0,
	},
	lure = {
		id = "lure", name = "Lure ball", branch = "magenta", color = "#f45ce0",
		desc = "Lights up the dark and shakes tokens loose.",
		damageMul = 0.75, splashBonus = 0, pierce = false, chains = false, poisons = false,
		revealBonus = 4, luckMul = 2.5, speedMul = 0.95, bounceBonus = 3,
	},
}
local BALL_ORDER = { "basic", "bomb", "lightning", "poison", "ghost", "lure" }

--[[ Base stats, i.e. the tree with nothing bought. `reload` is 5s on purpose:
     a shot is a decision, not a twitch. Everything else — the fat bounce
     budget, ricochet-on-break — exists so one shot is worth the wait. ]]
local BASE_STATS = {
	damage = 9,
	damageMul = 1,
	splashRadius = 0,
	splashFactor = 0,
	projectiles = 1,
	spreadAngle = 0.16,
	bounces = 16,
	speed = 380,
	lifetime = 10,
	reload = 5,
	chainTargets = 2,
	chainRange = 5,
	chainDamage = 0.5,
	poisonBase = 0,
	poisonDps = 2,
	poisonTime = 3,
	poisonSpread = 0,
	revealRadius = 2.6,
	luck = 1,
	compass = 0,
}

local TECH = {
	{ id = "core", name = "Slingshot", desc = "Pull back, let go, listen for the crack.",
		branch = "green", col = 0, row = 0, cost = 0, requires = {}, icon = "core",
		apply = function() end },

	-- RED - Force
	{ id = "r1", name = "Honed Tip", desc = "+3 damage on every impact.",
		branch = "red", col = -1, row = 0, cost = 1, requires = { "core" }, icon = "sword",
		apply = function(s) s.damage += 3 end },
	{ id = "r2", name = "Heavy Shot", desc = "+6 damage. The ball hits like a hammer.",
		branch = "red", col = -2, row = 0, cost = 2, requires = { "r1" }, icon = "sword",
		apply = function(s) s.damage += 6 end },
	{ id = "r3", name = "Crushing Blow", desc = "+10 damage.",
		branch = "red", col = -3, row = 0, cost = 4, requires = { "r2" }, icon = "sword",
		apply = function(s) s.damage += 10 end },
	{ id = "r4", name = "Fracture", desc = "All damage multiplied by 1.35.",
		branch = "red", col = -3, row = -1, cost = 5, requires = { "r3" }, icon = "spread",
		apply = function(s) s.damageMul *= 1.35 end },
	{ id = "r5", name = "Overload", desc = "+18 damage, but shots fly 15% slower.",
		branch = "red", col = -4, row = 0, cost = 7, requires = { "r3" }, icon = "sword",
		apply = function(s) s.damage += 18; s.speed *= 0.85 end },

	-- ORANGE - Impact
	{ id = "o1", name = "Shockwave", desc = "Impacts spill 40% damage into neighbours.",
		branch = "orange", col = -1, row = -1, cost = 1, requires = { "core" }, icon = "comet",
		apply = function(s) s.splashRadius = max(s.splashRadius, 1); s.splashFactor += 0.4 end },
	{ id = "o2", name = "Blast Ring", desc = "Splash reaches 2 blocks out.",
		branch = "orange", col = -2, row = -2, cost = 2, requires = { "o1" }, icon = "comet",
		apply = function(s) s.splashRadius = max(s.splashRadius, 2); s.splashFactor += 0.05 end },
	{ id = "o3", name = "Detonator", desc = "Unlocks the Bomb ball.",
		branch = "orange", col = -3, row = -2, cost = 4, requires = { "o2" }, icon = "ball",
		unlocksBall = "bomb", apply = function() end },
	{ id = "o4", name = "Concussion", desc = "Splash damage +25%.",
		branch = "orange", col = -2, row = -3, cost = 5, requires = { "o2" }, icon = "spread",
		apply = function(s) s.splashFactor += 0.25 end },
	{ id = "o5", name = "Cataclysm", desc = "Splash radius +1 and splash damage +30%.",
		branch = "orange", col = -4, row = -2, cost = 7, requires = { "o3" }, icon = "comet",
		apply = function(s) s.splashRadius += 1; s.splashFactor += 0.3 end },

	-- YELLOW - Storm
	{ id = "y1", name = "Static", desc = "Cooldown 18% shorter.",
		branch = "yellow", col = 0, row = -1, cost = 1, requires = { "core" }, icon = "clock",
		apply = function(s) s.reload *= 0.82 end },
	{ id = "y2", name = "Arc", desc = "Unlocks the Storm ball.",
		branch = "yellow", col = 0, row = -2, cost = 2, requires = { "y1" }, icon = "ball",
		unlocksBall = "lightning", apply = function() end },
	{ id = "y3", name = "Conductor", desc = "Lightning hits +1 block and deals 20% more.",
		branch = "yellow", col = 0, row = -3, cost = 4, requires = { "y2" }, icon = "bolt",
		apply = function(s) s.chainTargets += 1; s.chainDamage += 0.2 end },
	{ id = "y4", name = "Quickdraw", desc = "Cooldown 28% shorter.",
		branch = "yellow", col = -1, row = -3, cost = 5, requires = { "y3" }, icon = "clock",
		apply = function(s) s.reload *= 0.72 end },
	{ id = "y5", name = "Tempest", desc = "Lightning hits +2 blocks at 50% more range.",
		branch = "yellow", col = 0, row = -4, cost = 7, requires = { "y3" }, icon = "bolt",
		apply = function(s) s.chainTargets += 2; s.chainRange *= 1.5 end },
	{ id = "y6", name = "Overclock", desc = "Cooldown 30% shorter. Roughly 2 seconds a shot.",
		branch = "yellow", col = -1, row = -4, cost = 9, requires = { "y4" }, icon = "clock",
		apply = function(s) s.reload *= 0.7 end },

	-- GREEN - Toxin
	{ id = "g1", name = "Blight", desc = "Every impact leaves a weak rot behind.",
		branch = "green", col = 1, row = -1, cost = 1, requires = { "core" }, icon = "skull",
		apply = function(s) s.poisonBase += 1 end },
	{ id = "g2", name = "Poison Ball", desc = "Unlocks the Poison ball.",
		branch = "green", col = 2, row = -2, cost = 2, requires = { "g1" }, icon = "ball",
		unlocksBall = "poison", apply = function() end },
	{ id = "g3", name = "Virulence", desc = "Poison ticks for double damage.",
		branch = "green", col = 3, row = -2, cost = 4, requires = { "g2" }, icon = "skull",
		apply = function(s) s.poisonDps *= 2 end },
	{ id = "g4", name = "Contagion", desc = "Rot creeps 1 block onward from each block it kills, then stops.",
		branch = "green", col = 2, row = -3, cost = 5, requires = { "g2" }, icon = "spread",
		apply = function(s) s.poisonSpread = max(s.poisonSpread, 1) end },
	{ id = "g5", name = "Necrosis", desc = "Poison lasts twice as long.",
		branch = "green", col = 4, row = -2, cost = 7, requires = { "g3" }, icon = "skull",
		apply = function(s) s.poisonTime *= 2 end },
	{ id = "g6", name = "Pandemic", desc = "Rot creeps 2 more blocks onward before it burns out.",
		branch = "green", col = 3, row = -3, cost = 9, requires = { "g4" }, icon = "spread",
		apply = function(s) s.poisonSpread += 2 end },

	-- BLUE - Velocity
	{ id = "b1", name = "Slick", desc = "Shots travel 20% faster.",
		branch = "blue", col = 1, row = 0, cost = 1, requires = { "core" }, icon = "comet",
		apply = function(s) s.speed *= 1.2 end },
	{ id = "b2", name = "Ricochet", desc = "+8 bounces and +3s of flight.",
		branch = "blue", col = 2, row = 0, cost = 2, requires = { "b1" }, icon = "comet",
		apply = function(s) s.bounces += 8; s.lifetime += 3 end },
	{ id = "b3", name = "Phase", desc = "Unlocks the Ghost ball.",
		branch = "blue", col = 3, row = 0, cost = 4, requires = { "b2" }, icon = "ball",
		unlocksBall = "ghost", apply = function() end },
	{ id = "b4", name = "Split Shot", desc = "Fire 2 balls per pull.",
		branch = "blue", col = 3, row = 1, cost = 5, requires = { "b2" }, icon = "spread",
		apply = function(s) s.projectiles += 1 end },
	{ id = "b5", name = "Volley", desc = "Fire 2 more balls, in a wider fan.",
		branch = "blue", col = 4, row = 0, cost = 7, requires = { "b3" }, icon = "spread",
		apply = function(s) s.projectiles += 2; s.spreadAngle *= 1.25 end },

	-- MAGENTA - Fortune
	{ id = "m1", name = "Prospector", desc = "Tokens turn up 50% more often.",
		branch = "magenta", col = 0, row = 1, cost = 1, requires = { "core" }, icon = "radar",
		apply = function(s) s.luck += 0.5 end },
	{ id = "m2", name = "Lure Ball", desc = "Unlocks the Lure ball.",
		branch = "magenta", col = 0, row = 2, cost = 2, requires = { "m1" }, icon = "ball",
		unlocksBall = "lure", apply = function() end },
	{ id = "m3", name = "Deep Sight", desc = "You see 2 blocks further into the dark.",
		branch = "magenta", col = 0, row = 3, cost = 4, requires = { "m2" }, icon = "radar",
		apply = function(s) s.revealRadius += 2 end },
	{ id = "m4", name = "Golden Sense", desc = "A compass finds the golden block within 25 blocks.",
		branch = "magenta", col = -1, row = 2, cost = 5, requires = { "m2" }, icon = "flag",
		apply = function(s) s.compass = max(s.compass, 25) end },
	{ id = "m5", name = "Midas Touch", desc = "Tokens +100%, and the compass never sleeps.",
		branch = "magenta", col = 1, row = 3, cost = 7, requires = { "m3" }, icon = "flag",
		apply = function(s) s.luck += 1; s.compass = 9999 end },
}

local TECH_BY_ID = {}
for _, n in ipairs(TECH) do TECH_BY_ID[n.id] = n end

--[[ Applied in declaration order rather than purchase order. The web iterates
     a Set, so `o5`'s `splashRadius += 1` could land before `o2`'s
     `max(radius, 2)` and quietly produce a different number; declaration order
     is topological here, so the intended value is the one you always get. ]]
local function statsFor(unlocked)
	local s = {}
	for k, v in pairs(BASE_STATS) do s[k] = v end
	for _, n in ipairs(TECH) do
		if unlocked[n.id] then n.apply(s) end
	end
	return s
end

local function ballsFor(unlocked)
	local have = { basic = true }
	for id in pairs(unlocked) do
		local n = TECH_BY_ID[id]
		if n and n.unlocksBall then have[n.unlocksBall] = true end
	end
	local out = {}
	for _, b in ipairs(BALL_ORDER) do
		if have[b] then out[#out + 1] = b end
	end
	return out
end

-- ── RNG ───────────────────────────────────────────────────────────────────
-- mulberry32, bit-identical to the JS build, so a seed produces the same map.

local makeRng
do

local band, bor, bxor = bit32.band, bit32.bor, bit32.bxor
local rshift = bit32.rshift

local function imul(a, b)
	local ah, al = rshift(a, 16), band(a, 0xffff)
	local bh, bl = rshift(b, 16), band(b, 0xffff)
	local lo = al * bl
	local mid = (ah * bl + al * bh) % 0x10000
	return (lo + mid * 0x10000) % 0x100000000
end

function makeRng(seed)
	local a = seed % 0x100000000
	return function()
		a = (a + 0x6d2b79f5) % 0x100000000
		local t = a
		t = imul(bxor(t, rshift(t, 15)), bor(t, 1))
		t = bxor(t, (t + imul(bxor(t, rshift(t, 7)), bor(t, 61))) % 0x100000000)
		return bxor(t, rshift(t, 14)) / 4294967296
	end
end

end -- mulberry32 scope

-- ── Colour ────────────────────────────────────────────────────────────────

local function hexRgb(hex)
	return tonumber(hex:sub(2, 3), 16), tonumber(hex:sub(4, 5), 16), tonumber(hex:sub(6, 7), 16)
end
local function hexC3(hex)
	local r, g, b = hexRgb(hex)
	return Color3.fromRGB(r, g, b)
end

local BLOCK_RGB = {}
for i, b in ipairs(BLOCKS) do
	local r, g, bb = hexRgb(b.color)
	BLOCK_RGB[i] = { r = r, g = g, b = bb }
end

local RGB = {
	token = { hexRgb(BLOCK_TOKEN.color) },
	golden = { hexRgb(BLOCK_GOLDEN.color) },
	bedrock = { hexRgb(BLOCK_BEDROCK.color) },
	void = { hexRgb(PALETTE.unseen) },
}
local C3_GOLDEN = hexC3(BLOCK_GOLDEN.color)
local C3_WHITE = Color3.new(1, 1, 1)

--[[ Every ball is a moving lamp in its own colour, and so is the player. ]]
local BALL_LIGHT, PLAYER_LIGHT = {}, nil
do
	local function triple(hex)
		local r, g, b = hexRgb(hex)
		return { r / 255, g / 255, b / 255 }
	end
	for _, id in ipairs(BALL_ORDER) do BALL_LIGHT[id] = triple(BALLS[id].color) end
	PLAYER_LIGHT = triple(PALETTE.player)
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ENGINE — transcription of engine.js                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

--[[ The engine's own helpers stay inside this block so their registers are
     released at the end of it; only the names the renderer and the UI actually
     call are hoisted out. ]]
local icol, irow, genWorld, newLightMap, buildLight, newEffects
local tickPoison, spawnVolley, stepBall, walkToward
local PLAYER_REACH = 15

do

local KIND_ROCK = 0
local START_CHAMBER = 3
local BEDROCK_HP = 32000
local GOLDEN_HP = 40
local TOKEN_RARITY = 18

--[[ Terraria-style flood light: every emissive cell seeds the map, then four
     directional sweeps smear it outward, losing a fixed fraction per step. Air
     carries light much further than rock, which is what carves the soft pools
     around a lamp instead of a flat disc. ]]
local LIGHT_FALL_AIR = 0.82
local LIGHT_FALL_SOLID = 0.48
local LIGHT_AMBIENT = 0.15
local LIGHT_CUTOFF = 0.015
local LIGHT_PASSES = 2

--[[ Flat per-block colours for particles and impact flashes, plus the glow
     triples the light sweep seeds from. Split once; both run per frame. ]]
local BLOCK_C3, GLOW_RGB = {}, {}
for i, b in ipairs(BLOCKS) do
	BLOCK_C3[i] = hexC3(b.color)
	if b.glow then
		local r, g, bb = hexRgb(b.glow)
		GLOW_RGB[i] = { r / 255, g / 255, bb / 255 }
	else
		GLOW_RGB[i] = false
	end
end
local function triple(hex)
	local r, g, b = hexRgb(hex)
	return { r / 255, g / 255, b / 255 }
end
local GLOW_TOKEN = triple(BLOCK_TOKEN.glow)
local GLOW_GOLDEN = triple(BLOCK_GOLDEN.glow)
local C3_TOKEN = hexC3(BLOCK_TOKEN.color)
local C3_BEDROCK = hexC3(BLOCK_BEDROCK.color)

--[[ Cell arrays are 1-based so they live in Luau's array part. `idx` adds the
     offset; `icol`/`irow` take it back off. ]]
local function idx(col, row) return row * GRID_W + col + 1 end
function icol(i) return (i - 1) % GRID_W end
function irow(i) return floor((i - 1) / GRID_W) end

local function inBounds(col, row)
	return col >= 0 and col < GRID_W and row >= 0 and row < GRID_H
end
local function isSolid(w, col, row)
	if not inBounds(col, row) then return true end
	return w.hp[idx(col, row)] > 0
end
local function isBedrock(w, col, row)
	if not inBounds(col, row) then return true end
	return w.kind[idx(col, row)] == KIND_BEDROCK
end

-- Weighted block roll, flattened once into a cumulative table.
local BLOCK_CUM, BLOCK_CUM_TOTAL = {}, 0
for i, b in ipairs(BLOCKS) do
	BLOCK_CUM_TOTAL += b.weight
	BLOCK_CUM[i] = BLOCK_CUM_TOTAL
end

local function rollBlock(u)
	local x = u * BLOCK_CUM_TOTAL
	for i = 1, #BLOCK_CUM do
		if x < BLOCK_CUM[i] then return i end
	end
	return #BLOCK_CUM
end

local function carve(w, cc, cr, rad)
	local r = ceil(rad)
	for row = cr - r, cr + r do
		for col = cc - r, cc + r do
			if inBounds(col, row) then
				local i = idx(col, row)
				local k = w.kind[i]
				if k ~= KIND_BEDROCK and k ~= KIND_GOLDEN then
					local dc, dr = col - cc, row - cr
					if dc * dc + dr * dr <= rad * rad then
						w.hp[i] = 0
						w.kind[i] = KIND_ROCK
					end
				end
			end
		end
	end
end

local function reveal(w, cc, cr, rad)
	local r = ceil(rad)
	local r2 = rad * rad
	for row = cr - r, cr + r do
		if row >= 0 and row < GRID_H then
			for col = cc - r, cc + r do
				if col >= 0 and col < GRID_W then
					local dc, dr = col - cc, row - cr
					if dc * dc + dr * dr <= r2 then w.seen[idx(col, row)] = 1 end
				end
			end
		end
	end
end

function genWorld(seed)
	local rng = makeRng(seed)
	local w = {
		hp = table.create(CELLS, 0),
		maxHp = table.create(CELLS, 0),
		kind = table.create(CELLS, 0),
		hue = table.create(CELLS, 1),
		shade = table.create(CELLS, 0),
		seen = table.create(CELLS, 0),
		poisonT = table.create(CELLS, 0),
		poisonD = table.create(CELLS, 0),
		poisonB = table.create(CELLS, 0),
		poisoned = {},
		poisonCount = 0,
		goldenIdx = 0,
		goldenSighted = false,
		seed = seed,
	}

	--[[ Spawn is picked before a single block is rolled, because it is the
	     origin every tier is measured from. One of the four corners, inset far
	     enough that the starting chamber never eats into the bedrock border. ]]
	local spawnCol = (rng() < 0.5) and (6 + floor(rng() * 13)) or (GRID_W - 19 + floor(rng() * 13))
	local spawnRow = (rng() < 0.5) and (6 + floor(rng() * 13)) or (GRID_H - 19 + floor(rng() * 13))
	w.spawnCol = spawnCol
	w.spawnRow = spawnRow

	for row = 0, GRID_H - 1 do
		for col = 0, GRID_W - 1 do
			local i = idx(col, row)
			local tier = tierOfDist(distFrom(col, row, spawnCol, spawnRow))
			w.shade[i] = floor(rng() * 256)
			w.hue[i] = rollBlock(rng())

			if col == 0 or col == GRID_W - 1 or row == 0 or row == GRID_H - 1 then
				w.kind[i] = KIND_BEDROCK
				w.hp[i] = BEDROCK_HP
				w.maxHp[i] = BEDROCK_HP
				continue
			end

			local hp = max(1, jsRound(TIERS[tier + 1].hp * (0.75 + rng() * 0.55)))
			w.hp[i] = hp
			w.maxHp[i] = hp
			w.kind[i] = (rng() * TOKEN_RARITY < 1) and KIND_TOKEN or KIND_ROCK
		end
	end

	--[[ Natural voids, so the map is not a uniform slab and balls have room to
	     fly. Kept out of layer 1 so the opening dig is solid rock. ]]
	for _ = 1, 26 do
		local vc = 4 + floor(rng() * (GRID_W - 8))
		local vr = 4 + floor(rng() * (GRID_H - 8))
		-- The radius roll only happens for voids that survive the spawn check,
		-- so a skipped void must not consume it either.
		if distFrom(vc, vr, spawnCol, spawnRow) >= LAYER_RADIUS then
			carve(w, vc, vr, 1.5 + rng() * 2.5)
		end
	end

	--[[ The prize. Collected as a candidate list rather than dart-thrown, so it
	     can never silently miss and fall back to somewhere close. ]]
	local ring = {}
	for row = 1, GRID_H - 2 do
		for col = 1, GRID_W - 2 do
			local dist = distFrom(col, row, spawnCol, spawnRow)
			if dist >= GOLDEN_DIST_MIN and dist <= GOLDEN_DIST_MAX then
				local i = idx(col, row)
				if w.hp[i] > 0 and w.kind[i] ~= KIND_BEDROCK then ring[#ring + 1] = i end
			end
		end
	end

	local gi
	if #ring > 0 then
		gi = ring[floor(rng() * #ring) + 1]
	else
		-- Only reachable if the ring is entirely bedrock/void.
		gi = idx(floor(GRID_W / 2), floor(GRID_H / 2))
		local far = -1
		for i = 1, CELLS do
			if w.hp[i] > 0 and w.kind[i] ~= KIND_BEDROCK then
				local dist = distFrom(icol(i), irow(i), spawnCol, spawnRow)
				if dist > far then far = dist; gi = i end
			end
		end
	end
	w.kind[gi] = KIND_GOLDEN
	w.hp[gi] = GOLDEN_HP
	w.maxHp[gi] = GOLDEN_HP
	w.goldenIdx = gi

	carve(w, spawnCol, spawnRow, START_CHAMBER)
	reveal(w, spawnCol, spawnRow, START_CHAMBER + 2.5)
	return w
end

-- ── Lighting ──────────────────────────────────────────────────────────────

function newLightMap()
	return {
		r = table.create(CELLS, 0),
		g = table.create(CELLS, 0),
		b = table.create(CELLS, 0),
		c0 = 0, c1 = -1, r0 = 0, r1 = -1,
	}
end

--[[ Seeded light per unit of `power`. Above 1.0 a source reads as blown out,
     and because falloff eats ~20% per block, sources need to start over 1.0
     for the blocks touching them to still show their true colour. ]]
local LIGHT_SEED = 0.5

local function addPointLight(lm, col, row, rgb, power)
	if col < lm.c0 or col > lm.c1 or row < lm.r0 or row > lm.r1 then return end
	local i = idx(col, row)
	local s = power * LIGHT_SEED
	if rgb[1] * s > lm.r[i] then lm.r[i] = rgb[1] * s end
	if rgb[2] * s > lm.g[i] then lm.g[i] = rgb[2] * s end
	if rgb[3] * s > lm.b[i] then lm.b[i] = rgb[3] * s end
end

function buildLight(lm, w, c0, c1, r0, r1, extra)
	-- Pad the window so lights just off-screen still bleed in at the edges.
	local PAD = 10
	c0 = max(0, c0 - PAD); c1 = min(GRID_W - 1, c1 + PAD)
	r0 = max(0, r0 - PAD); r1 = min(GRID_H - 1, r1 + PAD)
	lm.c0, lm.c1, lm.r0, lm.r1 = c0, c1, r0, r1

	local R, G, B = lm.r, lm.g, lm.b
	local hpA, kindA, hueA, seenA = w.hp, w.kind, w.hue, w.seen

	for row = r0, r1 do
		local base = row * GRID_W + 1
		for col = c0, c1 do
			local i = base + col
			local lr, lg, lb = 0, 0, 0

			if seenA[i] ~= 0 then
				--[[ Anything you have uncovered keeps a dim floor. Without it,
				     rock more than a few blocks from a lamp is indistinguishable
				     from unexplored map, and the fog stops meaning anything. ]]
				lr, lg, lb = LIGHT_AMBIENT, LIGHT_AMBIENT, LIGHT_AMBIENT
				if hpA[i] > 0 then
					local kind = kindA[i]
					local glow, power = nil, 0
					if kind == KIND_TOKEN then
						glow, power = GLOW_TOKEN, BLOCK_TOKEN.light
					elseif kind == KIND_GOLDEN then
						glow, power = GLOW_GOLDEN, BLOCK_GOLDEN.light
					elseif kind ~= KIND_BEDROCK then
						local t = hueA[i]
						glow, power = GLOW_RGB[t], BLOCKS[t].light
					end
					if glow and power > 0 then
						local s = power * LIGHT_SEED
						lr, lg, lb = glow[1] * s, glow[2] * s, glow[3] * s
					end
				end
			end
			R[i], G[i], B[i] = lr, lg, lb
		end
	end

	if extra then
		for _, e in ipairs(extra) do addPointLight(lm, e.col, e.row, e.rgb, e.power) end
	end

	-- Four sweeps. `fall` depends on the cell being entered: rock swallows light.
	local function spread(i, from)
		local fall = hpA[i] > 0 and LIGHT_FALL_SOLID or LIGHT_FALL_AIR
		local nr, ng, nb = R[from] * fall, G[from] * fall, B[from] * fall
		if nr > R[i] and nr >= LIGHT_CUTOFF then R[i] = nr end
		if ng > G[i] and ng >= LIGHT_CUTOFF then G[i] = ng end
		if nb > B[i] and nb >= LIGHT_CUTOFF then B[i] = nb end
	end

	for _ = 1, LIGHT_PASSES do
		for row = r0, r1 do
			local base = row * GRID_W + 1
			for col = c0 + 1, c1 do spread(base + col, base + col - 1) end
			for col = c1 - 1, c0, -1 do spread(base + col, base + col + 1) end
		end
		for col = c0, c1 do
			for row = r0 + 1, r1 do spread(row * GRID_W + col + 1, (row - 1) * GRID_W + col + 1) end
			for row = r1 - 1, r0, -1 do spread(row * GRID_W + col + 1, (row + 1) * GRID_W + col + 1) end
		end
	end

	--[[ Fog wins over light. The sweeps happily smear illumination into cells
	     the player has never uncovered; without this, every lamp would quietly
	     outline the unexplored map around it. ]]
	for row = r0, r1 do
		local base = row * GRID_W + 1
		for col = c0, c1 do
			local i = base + col
			if seenA[i] == 0 then R[i] = 0; G[i] = 0; B[i] = 0 end
		end
	end
end

-- ── Damage ────────────────────────────────────────────────────────────────

function newEffects()
	return {
		particles = {}, arcs = {}, texts = {}, blockFx = {},
		shake = 0, haptic = 0,
		tokensGained = 0, brokenCount = 0, goldenHit = false, goldenBroken = false,
	}
end

--[[ Colour a block presents when it is hit or broken. Specials override their
     rolled palette colour so a token never shatters in some random hue. ]]
local function blockColorAt(w, i)
	local kind = w.kind[i]
	if kind == KIND_TOKEN then return C3_TOKEN end
	if kind == KIND_GOLDEN then return C3_GOLDEN end
	if kind == KIND_BEDROCK then return C3_BEDROCK end
	return BLOCK_C3[w.hue[i]]
end

local C3_GOLDEN_PAL = hexC3(PALETTE.golden)

local function spray(fx, x, y, color, n, rng)
	if #fx.particles > 320 then return end
	for _ = 1, n do
		local a = rng() * pi * 2
		local sp = 20 + rng() * 110
		local life = 0.25 + rng() * 0.45
		fx.particles[#fx.particles + 1] = {
			x = x, y = y, vx = cos(a) * sp, vy = sin(a) * sp,
			life = life, max = life, color = color,
		}
	end
end

local function clearPoison(w, i)
	if w.poisonT[i] > 0 then
		w.poisonT[i] = 0
		w.poisonD[i] = 0
		w.poisonB[i] = 0
		if w.poisoned[i] then
			w.poisoned[i] = nil
			w.poisonCount -= 1
		end
	end
end

--[[ Damage one block. `soft` hits (splash, chain, rot) do not fire haptics. ]]
local function damageBlock(w, col, row, amount, ctx, soft)
	if not inBounds(col, row) then return false end
	local i = idx(col, row)
	if w.hp[i] <= 0 or w.kind[i] == KIND_BEDROCK then return false end

	local golden = w.kind[i] == KIND_GOLDEN
	local nextHp = w.hp[i] - amount
	local cx = (col + 0.5) * CELL
	local cy = (row + 0.5) * CELL
	local fx = ctx.fx

	if nextHp > 0 then
		--[[ `hp` is an Int16Array in the web build, so storing fractional damage
		     truncates it. That is not an accident to tidy up: splash, chain and
		     rot all deal sub-1 damage, and the truncation is what turns a 0.03
		     poison tick into a whole point of HP. Keep the float for the
		     survival test above and the integer for the store, exactly as the
		     typed array does, or poison and splash come out far weaker here
		     than they do in the browser. ]]
		w.hp[i] = floor(nextHp)
		if golden then
			fx.goldenHit = true
			fx.haptic = max(fx.haptic, 3)
			spray(fx, cx, cy, C3_GOLDEN_PAL, 6, ctx.rng)
			fx.blockFx[#fx.blockFx + 1] = { col = col, row = row, color = C3_GOLDEN_PAL, kind = "hit" }
		else
			local c = blockColorAt(w, i)
			if not soft then
				fx.haptic = max(fx.haptic, 1)
				spray(fx, cx, cy, c, 2, ctx.rng)
			end
			-- Every hit registers visually, soft or not: a rot tick that
			-- silently shaves HP reads as nothing happening.
			fx.blockFx[#fx.blockFx + 1] = { col = col, row = row, color = c, kind = "hit" }
		end
		return false
	end

	w.hp[i] = 0
	local kind = w.kind[i]
	local brokeColor = blockColorAt(w, i)
	w.kind[i] = KIND_ROCK
	fx.blockFx[#fx.blockFx + 1] = { col = col, row = row, color = brokeColor, kind = "break" }
	clearPoison(w, i)
	fx.brokenCount += 1
	reveal(w, col, row, ctx.stats.revealRadius + ctx.ballReveal)

	if kind == KIND_GOLDEN then
		fx.goldenBroken = true
		fx.haptic = 4
		fx.shake = max(fx.shake, 26)
		spray(fx, cx, cy, C3_GOLDEN_PAL, 60, ctx.rng)
		return true
	end

	if kind == KIND_TOKEN then
		--[[ Outer rock takes far longer to break, so a token found out there is
		     worth more — otherwise income dries up exactly where upgrades
		     matter most. ]]
		local tier = tierOfDist(distFrom(col, row, w.spawnCol, w.spawnRow))
		local gained = max(1, jsRound(ctx.stats.luck * ctx.ballLuck * (1 + tier * 0.35)))
		fx.tokensGained += gained
		fx.haptic = max(fx.haptic, 3)
		fx.texts[#fx.texts + 1] = { x = cx, y = cy, life = 1.1, text = "+" .. gained, color = C3_WHITE }
		spray(fx, cx, cy, C3_WHITE, 16, ctx.rng)
	else
		fx.haptic = max(fx.haptic, 2)
		spray(fx, cx, cy, brokeColor, 6, ctx.rng)
		local bonus = (ctx.stats.luck - 1) * ctx.ballLuck * 0.006
		if bonus > 0 and ctx.rng() < bonus then
			fx.tokensGained += 1
			fx.texts[#fx.texts + 1] = { x = cx, y = cy, life = 1.1, text = "+1", color = C3_WHITE }
		end
	end
	fx.shake = max(fx.shake, 2.5)
	return true
end

--[[ Infect one block. `budget` is how many further generations the rot may
     jump once this block dies — that, and nothing else, is what stops an
     outbreak from eating the whole map. ]]
local function addPoison(w, col, row, dps, time, budget)
	if not inBounds(col, row) then return end
	local i = idx(col, row)
	if w.hp[i] <= 0 or w.kind[i] == KIND_BEDROCK then return end
	w.poisonD[i] = max(w.poisonD[i], dps)
	w.poisonT[i] = max(w.poisonT[i], time)
	w.poisonB[i] = max(w.poisonB[i], min(127, budget))
	if not w.poisoned[i] then
		w.poisoned[i] = true
		w.poisonCount += 1
	end
end

local function chain(w, col, row, ctx, direct)
	local s = ctx.stats
	local range = ceil(s.chainRange)
	local targets = {}
	for dr = -range, range do
		for dc = -range, range do
			if not (dc == 0 and dr == 0) then
				local c, r = col + dc, row + dr
				if inBounds(c, r) and hypot(dc, dr) <= s.chainRange then
					local i = idx(c, r)
					if w.hp[i] > 0 and w.kind[i] ~= KIND_BEDROCK then targets[#targets + 1] = i end
				end
			end
		end
	end
	local fromX = (col + 0.5) * CELL
	local fromY = (row + 0.5) * CELL
	local n = min(s.chainTargets, #targets)
	for _ = 1, n do
		local at = floor(ctx.rng() * #targets) + 1
		local pick = table.remove(targets, at)
		local tc, tr = icol(pick), irow(pick)
		local tx, ty = (tc + 0.5) * CELL, (tr + 0.5) * CELL
		ctx.fx.arcs[#ctx.fx.arcs + 1] = { x1 = fromX, y1 = fromY, x2 = tx, y2 = ty, life = 0.22 }
		damageBlock(w, tc, tr, direct * s.chainDamage, ctx, true)
		fromX, fromY = tx, ty
	end
end

local function applyImpact(w, col, row, ballId, ctx)
	local ball = BALLS[ballId]
	local s = ctx.stats
	local direct = s.damage * s.damageMul * ball.damageMul

	local broke = damageBlock(w, col, row, direct, ctx, false)

	local radius = s.splashRadius + ball.splashBonus
	if radius > 0 then
		local factor = s.splashFactor + (ball.splashBonus > 0 and 0.35 or 0)
		if factor > 0 then
			local r = ceil(radius)
			for dr = -r, r do
				for dc = -r, r do
					if not (dc == 0 and dr == 0) then
						local dist = hypot(dc, dr)
						if dist <= radius then
							damageBlock(w, col + dc, row + dr,
								direct * factor * (1 - dist / (radius + 1)), ctx, true)
						end
					end
				end
			end
			ctx.fx.shake = max(ctx.fx.shake, 3 + radius * 1.5)
		end
	end

	if ball.chains then chain(w, col, row, ctx, direct) end

	local poisonDps = (ball.poisons and s.poisonDps or 0) + s.poisonBase
	if poisonDps > 0 then
		addPoison(w, col, row, poisonDps, s.poisonTime, s.poisonSpread)
		if ball.poisons then
			addPoison(w, col + 1, row, poisonDps * 0.6, s.poisonTime, s.poisonSpread)
			addPoison(w, col - 1, row, poisonDps * 0.6, s.poisonTime, s.poisonSpread)
			addPoison(w, col, row + 1, poisonDps * 0.6, s.poisonTime, s.poisonSpread)
			addPoison(w, col, row - 1, poisonDps * 0.6, s.poisonTime, s.poisonSpread)
		end
	end
	return broke
end

--[[ Rot ticks. Spread is budgeted per block, so an outbreak always burns out. ]]
function tickPoison(w, dt, ctx)
	if w.poisonCount == 0 then return end
	local snapshot = {}
	for i in pairs(w.poisoned) do snapshot[#snapshot + 1] = i end

	local toSpread = {}
	for _, i in ipairs(snapshot) do
		if w.hp[i] <= 0 then
			clearPoison(w, i)
		else
			local col, row = icol(i), irow(i)
			local budget = w.poisonB[i]
			damageBlock(w, col, row, w.poisonD[i] * dt, ctx, true)
			w.poisonT[i] -= dt
			if w.hp[i] <= 0 and budget > 0 then
				toSpread[#toSpread + 1] = { col, row, budget - 1 }
			end
			if w.poisonT[i] <= 0 then clearPoison(w, i) end
		end
	end

	for _, e in ipairs(toSpread) do
		local col, row, budget = e[1], e[2], e[3]
		local dps = ctx.stats.poisonDps * 0.7
		local t = ctx.stats.poisonTime
		addPoison(w, col + 1, row, dps, t, budget)
		addPoison(w, col - 1, row, dps, t, budget)
		addPoison(w, col, row + 1, dps, t, budget)
		addPoison(w, col, row - 1, dps, t, budget)
	end
end

-- ── Balls ─────────────────────────────────────────────────────────────────

function spawnVolley(px, py, angle, power, ballType, s)
	local def = BALLS[ballType]
	local speed = s.speed * def.speedMul * (0.45 + power * 0.55)
	local out = {}
	local n = max(1, jsRound(s.projectiles))
	for k = 0, n - 1 do
		local offset = (n == 1) and 0 or ((k / (n - 1) - 0.5) * s.spreadAngle * (n - 1))
		local a = angle + offset
		out[#out + 1] = {
			x = px, y = py,
			vx = cos(a) * speed, vy = sin(a) * speed,
			bounces = jsRound(s.bounces) + def.bounceBonus,
			life = s.lifetime,
			type = ballType,
			trail = { px, py },
			dead = false,
		}
	end
	return out
end

local MAX_STEP = CELL * 0.4
local TRAIL_POINTS = 14

--[[ A touch of angular noise per bounce, so a ball never locks into a 2-wall
     loop. ]]
local function jitter(b, ctx)
	local a = atan2(b.vy, b.vx) + (ctx.rng() - 0.5) * 0.14
	local sp = hypot(b.vx, b.vy) * 0.985
	b.vx = cos(a) * sp
	b.vy = sin(a) * sp
end

--[[ Advance one ball.

     The rule that makes the game a game: a ball *always* ricochets off
     anything it hits, including a block it just destroyed. Only the Ghost ball
     tunnels. Letting balls punch straight through their kills turns every shot
     into a boring straight corridor. ]]
function stepBall(w, b, dt, ctx)
	local def = BALLS[b.type]
	local speed = hypot(b.vx, b.vy)
	if speed < 1 then b.dead = true; return end

	local steps = max(1, ceil((speed * dt) / MAX_STEP))
	local h = dt / steps

	for _ = 1, steps do
		if b.dead then break end

		-- Horizontal sweep.
		local nx = b.x + b.vx * h
		if isSolid(w, floor(nx / CELL), floor(b.y / CELL)) then
			local col, row = floor(nx / CELL), floor(b.y / CELL)
			applyImpact(w, col, row, b.type, ctx)
			if def.pierce and not isBedrock(w, col, row) then
				b.x = nx
				b.vx *= 0.82; b.vy *= 0.82
			else
				b.vx = -b.vx
				jitter(b, ctx)
				b.bounces -= 1
			end
		else
			b.x = nx
		end
		if b.bounces < 0 then b.dead = true; break end

		-- Vertical sweep.
		local ny = b.y + b.vy * h
		if isSolid(w, floor(b.x / CELL), floor(ny / CELL)) then
			local col, row = floor(b.x / CELL), floor(ny / CELL)
			applyImpact(w, col, row, b.type, ctx)
			if def.pierce and not isBedrock(w, col, row) then
				b.y = ny
				b.vx *= 0.82; b.vy *= 0.82
			else
				b.vy = -b.vy
				jitter(b, ctx)
				b.bounces -= 1
			end
		else
			b.y = ny
		end
		if b.bounces < 0 then b.dead = true; break end
	end

	b.life -= dt
	if b.life <= 0 then b.dead = true end

	reveal(w, floor(b.x / CELL), floor(b.y / CELL), ctx.stats.revealRadius + def.revealBonus)
	local t = b.trail
	t[#t + 1] = b.x
	t[#t + 1] = b.y
	while #t > TRAIL_POINTS * 2 do
		table.remove(t, 1)
		table.remove(t, 1)
	end
end

function walkToward(w, fromCol, fromRow, toCol, toRow)
	local dc, dr = toCol - fromCol, toRow - fromRow
	local dist = hypot(dc, dr)
	if dist < 0.5 then return nil end
	local capped = min(dist, PLAYER_REACH)
	local stepC, stepR = dc / dist, dr / dist
	local lastCol, lastRow = fromCol, fromRow
	local samples = ceil(capped * 4)
	for k = 1, samples do
		local t = (k / samples) * capped
		local c = jsRound(fromCol + stepC * t)
		local r = jsRound(fromRow + stepR * t)
		if not inBounds(c, r) or w.hp[idx(c, r)] > 0 then break end
		lastCol, lastRow = c, r
	end
	if lastCol == fromCol and lastRow == fromRow then return nil end
	return lastCol, lastRow
end

end -- engine scope

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PIXEL SURFACES                                                          ║
-- ║  EditableImage is Roblox's ImageData: a writable RGBA buffer you blit     ║
-- ║  into an ImageLabel. Pixelated resampling is imageSmoothingEnabled=false, ║
-- ║  Default is the bilinear pass the glow layer needs.                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local EDITABLE_OK = true

local function newEditable(w, h)
	if not EDITABLE_OK then return nil end
	local ok, img = pcall(function()
		return AssetService:CreateEditableImage({ Size = Vector2.new(w, h) })
	end)
	if not ok or not img then
		EDITABLE_OK = false
		return nil
	end
	return img
end

local function attachEditable(label, img)
	local ok = pcall(function() label.ImageContent = Content.fromObject(img) end)
	if not ok then pcall(function() img.Parent = label end) end
end

local blitFailed = false
local function blit(img, w, h, buf)
	if not img then return end
	local ok, err = pcall(img.WritePixelsBuffer, img, Vector2.zero, Vector2.new(w, h), buf)
	if not ok and not blitFailed then
		blitFailed = true
		warn("[BlindShot] pixel write failed, the world will not draw: " .. tostring(err))
	end
end

--[[ Pixels are packed little-endian as one u32 per pixel: R | G<<8 | B<<16 |
     A<<24. One write instead of four is worth it at 60fps. ]]
local function pack(r, g, b, a)
	if r < 0 then r = 0 elseif r > 255 then r = 255 end
	if g < 0 then g = 0 elseif g > 255 then g = 255 end
	if b < 0 then b = 0 elseif b > 255 then b = 255 end
	return floor(r) + floor(g) * 256 + floor(b) * 65536 + a * 16777216
end

-- ── Tiny software rasteriser, for the tech-tree icons and the golden halo ──
--[[ Everything from here to the end of the block runs once at boot, so it is
     wrapped to hand its registers back: Luau allows 200 live locals per
     scope and this file is one scope. ]]

local ICONS = {}
local HALO_IMG
local HALO_PX = 96

do

local function rasterNew(w, h)
	return { w = w, h = h, buf = buffer.create(w * h * 4) }
end

--[[ 3x3 supersampled coverage. `fn(x, y)` returns true inside the shape.
     Slow and simple, but it only ever runs at boot over 20x20 canvases. ]]
local function rasterFill(c, r, g, b, fn)
	for y = 0, c.h - 1 do
		for x = 0, c.w - 1 do
			local hits = 0
			for sy = 0, 2 do
				for sx = 0, 2 do
					if fn(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3) then hits += 1 end
				end
			end
			if hits > 0 then
				local a = floor((hits / 9) * 255)
				local o = (y * c.w + x) * 4
				if a >= buffer.readu8(c.buf, o + 3) then
					buffer.writeu32(c.buf, o, pack(r, g, b, a))
				end
			end
		end
	end
end

local function inDisc(cx, cy, rad)
	local r2 = rad * rad
	return function(x, y)
		local dx, dy = x - cx, y - cy
		return dx * dx + dy * dy <= r2
	end
end

local function inRing(cx, cy, rad, thick)
	local half = thick / 2
	return function(x, y)
		local dx, dy = x - cx, y - cy
		return abs(sqrt(dx * dx + dy * dy) - rad) <= half
	end
end

local function inSeg(x1, y1, x2, y2, thick)
	local half = thick / 2
	local dx, dy = x2 - x1, y2 - y1
	local len2 = dx * dx + dy * dy
	return function(x, y)
		local t = 0
		if len2 > 0 then
			t = clamp(((x - x1) * dx + (y - y1) * dy) / len2, 0, 1)
		end
		local px, py = x1 + dx * t - x, y1 + dy * t - y
		return px * px + py * py <= half * half
	end
end

-- Even-odd ray cast, so the SVG paths port straight across.
local function inPoly(pts)
	return function(x, y)
		local inside = false
		local n = #pts / 2
		local j = n
		for i = 1, n do
			local xi, yi = pts[i * 2 - 1], pts[i * 2]
			local xj, yj = pts[j * 2 - 1], pts[j * 2]
			if (yi > y) ~= (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi then
				inside = not inside
			end
			j = i
		end
		return inside
	end
end

--[[ The tech tree's SVG icon set, transcribed shape for shape. Drawn white so
     ImageColor3 can tint each node with its branch colour; the skull's eye
     sockets are drawn black on purpose so the tint leaves them dark. ]]
local ICON_SHAPES = {
	core = function(c)
		rasterFill(c, 255, 255, 255, inRing(10, 10, 6.4, 1.3))
		rasterFill(c, 255, 255, 255, inDisc(10, 10, 2.4))
	end,
	ball = function(c)
		rasterFill(c, 255, 255, 255, inRing(10, 10, 5.6, 1.3))
		rasterFill(c, 255, 255, 255, inRing(8, 8, 1.5, 1.2))
	end,
	clock = function(c)
		rasterFill(c, 255, 255, 255, inRing(10, 10, 7, 1.3))
		rasterFill(c, 255, 255, 255, inSeg(10, 6, 10, 10.6, 1.3))
		rasterFill(c, 255, 255, 255, inSeg(10, 10.6, 13, 12.6, 1.3))
	end,
	radar = function(c)
		rasterFill(c, 255, 255, 255, inRing(10, 10, 7, 1.3))
		rasterFill(c, 255, 255, 255, inRing(10, 10, 3.4, 1.3))
		rasterFill(c, 255, 255, 255, inSeg(10, 10, 16, 5, 1.3))
	end,
	bolt = function(c)
		rasterFill(c, 255, 255, 255, inPoly({ 11, 2, 5, 11, 9, 11, 8, 18, 14, 9, 10, 9 }))
	end,
	sword = function(c)
		rasterFill(c, 255, 255, 255, inPoly({ 12, 3, 15, 6, 8, 13, 5, 10 }))
		rasterFill(c, 255, 255, 255, inPoly({ 4, 15, 7, 12, 9, 14, 6, 17 }))
	end,
	comet = function(c)
		rasterFill(c, 255, 255, 255, inDisc(13, 7, 3.4))
		rasterFill(c, 255, 255, 255, inSeg(9, 11, 3, 17, 1.3))
		rasterFill(c, 255, 255, 255, inSeg(11, 13, 6, 17, 1.3))
		rasterFill(c, 255, 255, 255, inSeg(7, 9, 3, 12, 1.3))
	end,
	spread = function(c)
		rasterFill(c, 255, 255, 255, inDisc(10, 10, 2.6))
		local arms = {
			{ 10, 3, 10, 6 }, { 10, 14, 10, 17 }, { 3, 10, 6, 10 }, { 14, 10, 17, 10 },
			{ 5, 5, 7, 7 }, { 13, 13, 15, 15 }, { 15, 5, 13, 7 }, { 7, 13, 5, 15 },
		}
		for _, a in ipairs(arms) do
			rasterFill(c, 255, 255, 255, inSeg(a[1], a[2], a[3], a[4], 1.3))
		end
	end,
	skull = function(c)
		rasterFill(c, 255, 255, 255, inDisc(10, 9, 6))
		rasterFill(c, 255, 255, 255, inPoly({ 4, 9, 16, 9, 16, 12, 14, 14, 14, 17, 6, 17, 6, 14, 4, 12 }))
		rasterFill(c, 0, 0, 0, inDisc(7.6, 9.5, 1.6))
		rasterFill(c, 0, 0, 0, inDisc(12.4, 9.5, 1.6))
	end,
	flag = function(c)
		rasterFill(c, 255, 255, 255, inSeg(5, 3, 5, 17, 1.4))
		rasterFill(c, 255, 255, 255, inPoly({ 6, 4, 15, 4, 12.5, 7, 15, 10, 6, 10 }))
	end,
}

do
	for name, build in pairs(ICON_SHAPES) do
		local c = rasterNew(20, 20)
		build(c)
		local img = newEditable(20, 20)
		if img then
			blit(img, 20, 20, c.buf)
			ICONS[name] = img
		end
	end
end

--[[ The golden block's halo, baked once. The canvas version is a three-stop
     radial gradient; this is the same stops rasterised into an alpha ramp so
     ImageTransparency can dim the whole thing by distance at draw time. ]]
do
	local buf = buffer.create(HALO_PX * HALO_PX * 4)
	local mid = (HALO_PX - 1) / 2
	for y = 0, HALO_PX - 1 do
		for x = 0, HALO_PX - 1 do
			local t = min(1, hypot(x - mid, y - mid) / mid)
			local r, g, b, a
			if t < 0.45 then
				local k = t / 0.45
				r = 255; g = 230 + (200 - 230) * k; b = 140 + (60 - 140) * k
				a = 0.5 + (0.16 - 0.5) * k
			else
				local k = (t - 0.45) / 0.55
				r = 255; g = 200 + (190 - 200) * k; b = 60 + (40 - 60) * k
				a = 0.16 * (1 - k)
			end
			buffer.writeu32(buf, (y * HALO_PX + x) * 4, pack(r, g, b, floor(a * 255)))
		end
	end
	HALO_IMG = newEditable(HALO_PX, HALO_PX)
	if HALO_IMG then blit(HALO_IMG, HALO_PX, HALO_PX, buf) end
end

end -- rasteriser scope

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  GUI SCAFFOLDING — transcription of index.html + its stylesheet          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local function mk(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props) do
		if k ~= "Parent" then o[k] = v end
	end
	o.Parent = parent
	return o
end

local function S(px) return jsRound(px * UI_SCALE) end

--[[ Roblox has no letter-spacing. For the few labels where the tracking is
     wide enough to read as a design choice rather than kerning, space the
     glyphs out by hand. ]]
local function spaced(s)
	return (s:gsub("(.)", "%1 "):gsub("%s+$", ""))
end

local DIM = hexC3("#7b8f83")

for _, old in ipairs(PlayerGui:GetChildren()) do
	if old.Name == "BlindShot" then old:Destroy() end
end

local root = mk("Frame", {
	Name = "app",
	Size = UDim2.fromScale(1, 1),
	BackgroundColor3 = hexC3(PALETTE.unseen),
	BorderSizePixel = 0,
	ClipsDescendants = true,
}, mk("ScreenGui", {
	Name = "BlindShot",
	ResetOnSpawn = false,
	IgnoreGuiInset = true,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	DisplayOrder = 100,
}, PlayerGui))

-- The world canvas. Everything in here is positioned in screen pixels.
local worldFrame = mk("Frame", {
	Name = "world",
	Size = UDim2.fromScale(1, 1),
	BackgroundTransparency = 1,
	ClipsDescendants = true,
	ZIndex = 1,
}, root)

local blockLayer = mk("ImageLabel", {
	Name = "blocks",
	BackgroundTransparency = 1,
	BorderSizePixel = 0,
	ResampleMode = Enum.ResamplerMode.Pixelated,
	ZIndex = 1,
	Visible = false,
}, worldFrame)

--[[ The additive light pass. The canvas build draws this same buffer a second
     time with `globalCompositeOperation = 'lighter'` and bilinear smoothing —
     that is what makes light spill past a block's hard edge into open air.
     Roblox GUI has no additive blend, so the glow carries its strength in the
     alpha channel instead: dim light barely touches the layer underneath,
     bright light saturates toward the lamp's own colour, which is where
     additive ends up anyway. ]]
local glowLayer = mk("ImageLabel", {
	Name = "glow",
	BackgroundTransparency = 1,
	BorderSizePixel = 0,
	ResampleMode = Enum.ResamplerMode.Default,
	ZIndex = 2,
	Visible = false,
}, worldFrame)

local GLOW_STRENGTH = 0.42

-- Fallback grid, used only when EditableImage is unavailable on this client.
local fallbackFrame = nil

local fxLayer = mk("Frame", {
	Name = "fx",
	Size = UDim2.fromScale(1, 1),
	BackgroundTransparency = 1,
	ZIndex = 3,
}, worldFrame)

--[[ Every chrome element that reads `--accent` in the stylesheet is collected
     here and retinted each frame from the eased accent colour. ]]
local accentTargets = {}
local function tint(obj, prop)
	accentTargets[#accentTargets + 1] = { obj = obj, prop = prop }
	return obj
end

-- Accent wash bleeding up from the floor of the screen.
mk("UIGradient", {
	Rotation = 90,
	Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 1),
		NumberSequenceKeypoint.new(0.5, 1),
		NumberSequenceKeypoint.new(1, 0.85),
	}),
}, tint(mk("Frame", {
	Name = "wash",
	Size = UDim2.fromScale(1, 1),
	BackgroundColor3 = hexC3(PALETTE.hud),
	BorderSizePixel = 0,
	ZIndex = 4,
}, root), "BackgroundColor3"))

-- Inner outline on the whole viewport, also accent-tinted.
tint(mk("UIStroke", {
	Thickness = 4,
	Color = hexC3(PALETTE.hud),
	Transparency = 0.65,
	ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
}, mk("Frame", {
	Name = "frame",
	Position = UDim2.fromOffset(4, 4),
	Size = UDim2.new(1, -8, 1, -8),
	BackgroundTransparency = 1,
	ZIndex = 5,
}, root)), "Color")

local function gradientBar(parent, flip)
	local f = mk("Frame", {
		BackgroundColor3 = Color3.new(0, 0, 0),
		BorderSizePixel = 0,
		Size = UDim2.fromScale(1, 1),
		ZIndex = 0,
	}, parent)
	local stops = flip and {
		NumberSequenceKeypoint.new(0, 1),
		NumberSequenceKeypoint.new(0.3, 0.4),
		NumberSequenceKeypoint.new(1, 0.1),
	} or {
		NumberSequenceKeypoint.new(0, 0.1),
		NumberSequenceKeypoint.new(0.7, 0.4),
		NumberSequenceKeypoint.new(1, 1),
	}
	mk("UIGradient", { Rotation = 90, Transparency = NumberSequence.new(stops) }, f)
	return f
end

local function label(parent, text, size, color, props)
	local p = {
		Text = text,
		Font = FONT,
		TextSize = S(size),
		TextColor3 = color,
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Top,
		Size = UDim2.fromScale(1, 1),
		ZIndex = 2,
	}
	if props then for k, v in pairs(props) do p[k] = v end end
	return mk("TextLabel", p, parent)
end

--[[ `border: 3px solid var(--accent)` on a dark plate. UIStroke draws outside
     the frame where CSS draws inside, so the box reads a few pixels larger —
     the only place the chrome is not pixel-exact. ]]
local function button(parent, text, props)
	local p = {
		Text = text,
		Font = FONT,
		TextSize = S(10),
		TextColor3 = hexC3(PALETTE.hud),
		BackgroundColor3 = Color3.new(0, 0, 0),
		BackgroundTransparency = 0.3,
		BorderSizePixel = 0,
		AutoButtonColor = false,
		ZIndex = 3,
	}
	if props then for k, v in pairs(props) do p[k] = v end end
	local b = mk("TextButton", p, parent)
	local stroke = mk("UIStroke", {
		Thickness = 3,
		Color = hexC3(PALETTE.hud),
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
	}, b)
	return b, stroke
end

--[[ Element registry, the same shape as `el` in ui.js. Kept as one table
     rather than a local per widget: Luau allows 200 locals in a scope and the
     HUD alone would eat a quarter of them. ]]
local el = {}

local TOPBAR_H = S(58)
local BOTTOM_H = S(66)
local TREE_HEAD_H = S(48)
local DETAIL_H = S(64)
local MINI_PX = 116

-- ── Top bar ───────────────────────────────────────────────────────────────

el.top = mk("Frame", {
	Name = "top",
	Size = UDim2.new(1, 0, 0, TOPBAR_H),
	BackgroundTransparency = 1,
	ZIndex = 10,
}, root)
gradientBar(el.top, false)

do
	local statLeft = mk("Frame", {
		Position = UDim2.fromOffset(S(12), S(8)),
		Size = UDim2.fromOffset(S(180), S(40)),
		BackgroundTransparency = 1,
		ZIndex = 11,
	}, el.top)
	tint(label(statLeft, "FROM SPAWN", 9, hexC3(PALETTE.hud), {
		Size = UDim2.new(1, 0, 0, S(11)), TextTransparency = 0.2,
	}), "TextColor3")
	el.depth = label(statLeft, "0m", 17, C3_WHITE, {
		Position = UDim2.fromOffset(0, S(13)), Size = UDim2.new(1, 0, 0, S(20)),
	})

	local statMid = mk("Frame", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, S(8)),
		Size = UDim2.fromOffset(S(200), S(40)),
		BackgroundTransparency = 1,
		ZIndex = 11,
	}, el.top)
	el.lvl = label(statMid, "LAYER 1", 9, hexC3(PALETTE.hud), {
		Size = UDim2.new(1, 0, 0, S(11)),
		TextXAlignment = Enum.TextXAlignment.Center,
		TextTransparency = 0.2,
	})
	tint(el.lvl, "TextColor3")
	el.tier = label(statMid, "CRUST", 13, hexC3(TIERS[1].color), {
		Position = UDim2.fromOffset(0, S(13)), Size = UDim2.new(1, 0, 0, S(18)),
		TextXAlignment = Enum.TextXAlignment.Center,
	})

	local topRight = mk("Frame", {
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -S(12), 0, S(10)),
		Size = UDim2.fromOffset(0, S(30)),
		AutomaticSize = Enum.AutomaticSize.X,
		BackgroundTransparency = 1,
		ZIndex = 11,
	}, el.top)
	mk("UIListLayout", {
		FillDirection = Enum.FillDirection.Horizontal,
		VerticalAlignment = Enum.VerticalAlignment.Center,
		HorizontalAlignment = Enum.HorizontalAlignment.Right,
		SortOrder = Enum.SortOrder.LayoutOrder,
		Padding = UDim.new(0, S(6)),
	}, topRight)

	el.tokens = label(topRight, "\u{25C6} 0", 16, C3_WHITE, {
		Size = UDim2.fromOffset(0, S(24)),
		AutomaticSize = Enum.AutomaticSize.X,
		TextYAlignment = Enum.TextYAlignment.Center,
		LayoutOrder = 1, ZIndex = 12,
	})

	local function barButton(text, order)
		local b, stroke = button(topRight, text, {
			Size = UDim2.fromOffset(0, S(26)),
			AutomaticSize = Enum.AutomaticSize.X,
			LayoutOrder = order, ZIndex = 12,
		})
		mk("UIPadding", {
			PaddingLeft = UDim.new(0, S(9)), PaddingRight = UDim.new(0, S(9)),
		}, b)
		return b, stroke
	end

	el.vibBtn, el.vibStroke = barButton("VIB", 2)
	el.mapBtn, el.mapStroke = barButton("MAP", 3)
	el.techBtn, el.techStroke = barButton("TECH", 4)
	tint(el.techBtn, "TextColor3"); tint(el.techStroke, "Color")
end

-- ── Minimap ───────────────────────────────────────────────────────────────

el.miniPx = MINI_PX
el.miniWrap = mk("Frame", {
	Name = "miniWrap",
	AnchorPoint = Vector2.new(1, 0),
	Position = UDim2.new(1, -S(12), 0, S(74)),
	Size = UDim2.fromOffset(S(MINI_PX + 6), S(MINI_PX + 6)),
	BackgroundColor3 = Color3.new(0, 0, 0),
	BackgroundTransparency = 0.2,
	BorderSizePixel = 0,
	ZIndex = 8,
}, root)
tint(mk("UIStroke", {
	Thickness = 4, Color = hexC3(PALETTE.hud), ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
}, el.miniWrap), "Color")

el.mini = mk("ImageLabel", {
	Position = UDim2.fromOffset(S(3), S(3)),
	Size = UDim2.fromOffset(S(MINI_PX), S(MINI_PX)),
	BackgroundTransparency = 1,
	BorderSizePixel = 0,
	ResampleMode = Enum.ResamplerMode.Pixelated,
	ZIndex = 9,
}, el.miniWrap)

do
	local overlay = mk("Frame", {
		Position = UDim2.fromOffset(S(3), S(3)),
		Size = UDim2.fromOffset(S(MINI_PX), S(MINI_PX)),
		BackgroundTransparency = 1,
		ClipsDescendants = true,
		ZIndex = 10,
	}, el.miniWrap)

	el.miniGolden = mk("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Size = UDim2.fromOffset(S(4), S(4)),
		BackgroundColor3 = C3_GOLDEN,
		BorderSizePixel = 0,
		Visible = false,
		ZIndex = 11,
	}, overlay)

	el.miniPlayer = {}
	for i = 1, 3 do
		el.miniPlayer[i] = mk("Frame", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			BackgroundColor3 = hexC3(PALETTE.hud),
			BorderSizePixel = 0,
			ZIndex = 12,
		}, overlay)
	end
end

-- ── Compass, banner, help ─────────────────────────────────────────────────

el.compass = mk("Frame", {
	Name = "compass",
	Position = UDim2.fromOffset(S(12), S(74)),
	Size = UDim2.fromOffset(0, S(24)),
	AutomaticSize = Enum.AutomaticSize.X,
	BackgroundColor3 = Color3.new(0, 0, 0),
	BackgroundTransparency = 0.2,
	BorderSizePixel = 0,
	Visible = false,
	ZIndex = 8,
}, root)
mk("UIStroke", { Thickness = 3, Color = C3_GOLDEN, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, el.compass)
mk("UIPadding", { PaddingLeft = UDim.new(0, S(8)), PaddingRight = UDim.new(0, S(8)) }, el.compass)
mk("UIListLayout", {
	FillDirection = Enum.FillDirection.Horizontal,
	VerticalAlignment = Enum.VerticalAlignment.Center,
	SortOrder = Enum.SortOrder.LayoutOrder,
	Padding = UDim.new(0, S(6)),
}, el.compass)
el.compassArrow = label(el.compass, "\u{27A4}", 11, C3_GOLDEN, {
	Size = UDim2.fromOffset(S(14), S(14)),
	TextXAlignment = Enum.TextXAlignment.Center,
	TextYAlignment = Enum.TextYAlignment.Center,
	LayoutOrder = 1, ZIndex = 9,
})
el.compassTxt = label(el.compass, "- BLOCKS", 11, C3_GOLDEN, {
	Size = UDim2.fromOffset(0, S(14)),
	AutomaticSize = Enum.AutomaticSize.X,
	TextYAlignment = Enum.TextYAlignment.Center,
	LayoutOrder = 2, ZIndex = 9,
})

el.banner = label(root, "", 19, C3_WHITE, {
	Name = "banner",
	Position = UDim2.new(0, 0, 0.34, 0),
	Size = UDim2.new(1, 0, 0, S(26)),
	TextXAlignment = Enum.TextXAlignment.Center,
	TextYAlignment = Enum.TextYAlignment.Center,
	TextStrokeTransparency = 0.4,
	TextStrokeColor3 = hexC3(PALETTE.hud),
	Visible = false,
	ZIndex = 20,
})
tint(el.banner, "TextStrokeColor3")

el.help = label(root, spaced("HOLD & DRAG BACK TO SLING  -  RELEASE TO FIRE  -  TAP TO WALK"),
	10, hexC3("#5a6f66"), {
		Name = "help",
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.new(0, 0, 1, -S(78)),
		Size = UDim2.new(1, 0, 0, S(16)),
		TextXAlignment = Enum.TextXAlignment.Center,
		TextYAlignment = Enum.TextYAlignment.Center,
		ZIndex = 8,
	})

-- ── Bottom deck ───────────────────────────────────────────────────────────

el.bottom = mk("Frame", {
	Name = "bottom",
	AnchorPoint = Vector2.new(0, 1),
	Position = UDim2.new(0, 0, 1, 0),
	Size = UDim2.new(1, 0, 0, BOTTOM_H),
	BackgroundTransparency = 1,
	ZIndex = 10,
}, root)
gradientBar(el.bottom, true)

do
	local cdRow = mk("Frame", {
		Position = UDim2.fromOffset(S(10), S(10)),
		Size = UDim2.new(1, -S(20), 0, S(14)),
		BackgroundTransparency = 1,
		ZIndex = 11,
	}, el.bottom)

	local track = mk("Frame", {
		AnchorPoint = Vector2.new(0, 0.5),
		Position = UDim2.new(0, 0, 0.5, 0),
		Size = UDim2.new(1, -S(70), 0, S(5)),
		BackgroundColor3 = C3_WHITE,
		BackgroundTransparency = 0.87,
		BorderSizePixel = 0,
		ClipsDescendants = true,
		ZIndex = 11,
	}, cdRow)
	el.cdFill = mk("Frame", {
		Size = UDim2.fromScale(0, 1),
		BackgroundColor3 = hexC3(PALETTE.hud),
		BorderSizePixel = 0,
		ZIndex = 12,
	}, track)
	tint(el.cdFill, "BackgroundColor3")

	el.cdText = label(cdRow, "READY", 10, hexC3(PALETTE.hud), {
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, 0, 0.5, 0),
		Size = UDim2.fromOffset(S(64), S(14)),
		TextXAlignment = Enum.TextXAlignment.Right,
		TextYAlignment = Enum.TextYAlignment.Center,
		ZIndex = 11,
	})
end

el.chips = mk("Frame", {
	AnchorPoint = Vector2.new(0.5, 0),
	Position = UDim2.new(0.5, 0, 0, S(31)),
	Size = UDim2.fromOffset(0, S(26)),
	AutomaticSize = Enum.AutomaticSize.X,
	BackgroundTransparency = 1,
	ZIndex = 11,
}, el.bottom)
mk("UIListLayout", {
	FillDirection = Enum.FillDirection.Horizontal,
	HorizontalAlignment = Enum.HorizontalAlignment.Center,
	VerticalAlignment = Enum.VerticalAlignment.Center,
	SortOrder = Enum.SortOrder.LayoutOrder,
	Padding = UDim.new(0, S(6)),
}, el.chips)

-- ── Sheets ────────────────────────────────────────────────────────────────

--[[ The tree sits over the world rather than replacing it — the cave stays
     visible behind it. The web also blurs the backdrop; Roblox GUI has no
     blur, so that is the one effect which simply is not here. ]]
el.tree = mk("Frame", {
	Name = "tree", Size = UDim2.fromScale(1, 1),
	BackgroundColor3 = Color3.fromRGB(3, 10, 6), BackgroundTransparency = 0.18,
	BorderSizePixel = 0, Visible = false, ZIndex = 40,
}, root)
el.card = mk("Frame", {
	Name = "card", Size = UDim2.fromScale(1, 1),
	BackgroundColor3 = Color3.fromRGB(3, 13, 7), BackgroundTransparency = 0,
	BorderSizePixel = 0, Visible = false, ZIndex = 50,
}, root)
el.win = mk("Frame", {
	Name = "win", Size = UDim2.fromScale(1, 1),
	BackgroundColor3 = Color3.fromRGB(3, 13, 7), BackgroundTransparency = 0,
	BorderSizePixel = 0, Visible = false, ZIndex = 60,
}, root)

do
	local head = mk("Frame", {
		Size = UDim2.new(1, 0, 0, TREE_HEAD_H),
		BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.5,
		BorderSizePixel = 0, ZIndex = 41,
	}, el.tree)
	tint(mk("Frame", {
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.new(0, 0, 1, 0),
		Size = UDim2.new(1, 0, 0, 4),
		BackgroundColor3 = hexC3(PALETTE.hud),
		BorderSizePixel = 0, ZIndex = 42,
	}, head), "BackgroundColor3")

	tint(label(head, spaced("TECH TREE"), 12, hexC3(PALETTE.hud), {
		Position = UDim2.fromOffset(S(12), 0),
		Size = UDim2.new(0.5, 0, 1, -4),
		TextYAlignment = Enum.TextYAlignment.Center,
		ZIndex = 42,
	}), "TextColor3")

	local right = mk("Frame", {
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -S(12), 0.5, -2),
		Size = UDim2.fromOffset(0, S(28)),
		AutomaticSize = Enum.AutomaticSize.X,
		BackgroundTransparency = 1, ZIndex = 42,
	}, head)
	mk("UIListLayout", {
		FillDirection = Enum.FillDirection.Horizontal,
		VerticalAlignment = Enum.VerticalAlignment.Center,
		SortOrder = Enum.SortOrder.LayoutOrder,
		Padding = UDim.new(0, S(8)),
	}, right)
	el.treeTokens = label(right, "\u{25C6} 0", 14, C3_WHITE, {
		Size = UDim2.fromOffset(0, S(20)),
		AutomaticSize = Enum.AutomaticSize.X,
		TextYAlignment = Enum.TextYAlignment.Center,
		LayoutOrder = 1, ZIndex = 43,
	})
	local closeBtn, closeStroke = button(right, "CLOSE", {
		Size = UDim2.fromOffset(0, S(26)),
		AutomaticSize = Enum.AutomaticSize.X,
		LayoutOrder = 2, ZIndex = 43,
	})
	mk("UIPadding", { PaddingLeft = UDim.new(0, S(9)), PaddingRight = UDim.new(0, S(9)) }, closeBtn)
	tint(closeBtn, "TextColor3"); tint(closeStroke, "Color")
	el.treeClose = closeBtn
end

do
	local detail = mk("Frame", {
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.new(0, 0, 1, 0),
		Size = UDim2.new(1, 0, 0, DETAIL_H),
		BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.25,
		BorderSizePixel = 0, ZIndex = 41,
	}, el.tree)
	tint(mk("Frame", {
		Size = UDim2.new(1, 0, 0, 4),
		BackgroundColor3 = hexC3(PALETTE.hud),
		BorderSizePixel = 0, ZIndex = 42,
	}, detail), "BackgroundColor3")

	el.dNm = label(detail, "Slingshot", 13, C3_WHITE, {
		Position = UDim2.fromOffset(S(14), S(12)),
		Size = UDim2.new(1, -S(140), 0, S(16)), ZIndex = 42,
	})
	el.dDs = label(detail, "Pull back, let go, listen for the crack.", 11, DIM, {
		Position = UDim2.fromOffset(S(14), S(31)),
		Size = UDim2.new(1, -S(140), 0, S(24)),
		TextWrapped = true, ZIndex = 42,
	})
	el.dBtn, el.dBtnStroke = button(detail, "OWNED", {
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -S(14), 0.5, 0),
		Size = UDim2.fromOffset(S(104), S(30)),
		ZIndex = 42,
	})
end

el.treeView = mk("Frame", {
	Position = UDim2.fromOffset(0, TREE_HEAD_H),
	Size = UDim2.new(1, 0, 1, -(TREE_HEAD_H + DETAIL_H)),
	BackgroundTransparency = 1,
	ClipsDescendants = true,
	ZIndex = 41,
}, el.tree)
el.treePan = mk("Frame", { BackgroundTransparency = 1, ZIndex = 41 }, el.treeView)

-- New-ball reveal card
do
	local box = mk("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(S(330), S(190)),
		BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.04,
		BorderSizePixel = 0, ZIndex = 51,
	}, el.card)
	tint(mk("UIStroke", {
		Thickness = 4, Color = hexC3(PALETTE.hud), ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
	}, box), "Color")
	tint(label(box, spaced("NEW BALL"), 11, hexC3(PALETTE.hud), {
		Position = UDim2.fromOffset(0, S(18)), Size = UDim2.new(1, 0, 0, S(14)),
		TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 52,
	}), "TextColor3")
	el.cardName = label(box, "", 24, C3_WHITE, {
		Position = UDim2.fromOffset(0, S(42)), Size = UDim2.new(1, 0, 0, S(30)),
		TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 52,
	})
	el.cardDesc = label(box, "", 12, DIM, {
		Position = UDim2.fromOffset(S(20), S(82)), Size = UDim2.new(1, -S(40), 0, S(56)),
		TextXAlignment = Enum.TextXAlignment.Center, TextWrapped = true, ZIndex = 52,
	})
	label(box, spaced("TAP TO CONTINUE"), 10, hexC3("#56685c"), {
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.new(0, 0, 1, -S(16)), Size = UDim2.new(1, 0, 0, S(14)),
		TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 52,
	})
	el.cardHit = mk("TextButton", {
		Text = "", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1),
		AutoButtonColor = false, ZIndex = 53,
	}, el.card)
end

-- Victory sheet
do
	local wrap = mk("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(S(420), S(190)),
		BackgroundTransparency = 1, ZIndex = 61,
	}, el.win)
	label(wrap, spaced("THE GOLDEN BLOCK"), 12, C3_GOLDEN, {
		Size = UDim2.new(1, 0, 0, S(16)),
		TextXAlignment = Enum.TextXAlignment.Center,
		TextStrokeColor3 = C3_GOLDEN, TextStrokeTransparency = 0.6, ZIndex = 62,
	})
	label(wrap, spaced("FOUND IT"), 30, C3_WHITE, {
		Position = UDim2.fromOffset(0, S(28)), Size = UDim2.new(1, 0, 0, S(38)),
		TextXAlignment = Enum.TextXAlignment.Center,
		TextStrokeColor3 = C3_GOLDEN, TextStrokeTransparency = 0.35, ZIndex = 62,
	})
	el.winSub = label(wrap, "", 12, DIM, {
		Position = UDim2.fromOffset(0, S(76)), Size = UDim2.new(1, 0, 0, S(30)),
		TextXAlignment = Enum.TextXAlignment.Center, TextWrapped = true, ZIndex = 62,
	})
	local b, bs = button(wrap, "NEW MAP", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, S(126)),
		Size = UDim2.fromOffset(S(140), S(34)),
		ZIndex = 62,
	})
	tint(b, "TextColor3"); tint(bs, "Color")
	el.winBtn = b
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ACTOR POOLS                                                             ║
-- ║  The canvas build draws balls, particles and impact rings as vectors on   ║
-- ║  top of the pixel buffer. Here they are recycled Frames, positioned in    ║
-- ║  screen space through the same world transform.                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local function newPool(parent, class, props)
	local items, used, prevUsed = {}, 0, 0
	local pool = {}
	function pool.reset() used = 0 end
	function pool.get()
		used += 1
		local it = items[used]
		if not it then
			it = mk(class, props, parent)
			items[used] = it
		end
		it.Visible = true
		return it
	end
	function pool.finish()
		for i = used + 1, prevUsed do items[i].Visible = false end
		prevUsed = used
	end
	return pool
end

--[[ Draw order inside the fx layer, matching the canvas passes: golden shine,
     impact rings, chain arcs, particles, balls, aim dots, player, floating
     text. ZIndex 1..8. ]]
local P = {}
do
	local rect = {
		BackgroundColor3 = C3_WHITE, BorderSizePixel = 0,
		AnchorPoint = Vector2.new(0.5, 0.5), Visible = false,
	}
	local function props(base, z)
		local t = { ZIndex = z }
		for k, v in pairs(base) do t[k] = v end
		return t
	end
	P.bfxRing = newPool(fxLayer, "Frame", props({
		BackgroundTransparency = 1, BorderSizePixel = 0,
		AnchorPoint = Vector2.new(0.5, 0.5), Visible = false,
	}, 2))
	P.bfxFill = newPool(fxLayer, "Frame", props(rect, 2))
	P.arc = newPool(fxLayer, "Frame", props(rect, 3))
	P.part = newPool(fxLayer, "Frame", props(rect, 4))
	P.trail = newPool(fxLayer, "Frame", props(rect, 5))
	P.ball = newPool(fxLayer, "Frame", props(rect, 5))
	P.aim = newPool(fxLayer, "Frame", props(rect, 6))
	P.player = newPool(fxLayer, "Frame", props(rect, 7))
	P.text = newPool(fxLayer, "TextLabel", props({
		BackgroundTransparency = 1, BorderSizePixel = 0, Font = FONT, TextSize = 9,
		TextColor3 = C3_WHITE, AnchorPoint = Vector2.new(0.5, 0.5),
		TextXAlignment = Enum.TextXAlignment.Center, Visible = false,
	}, 8))
end

-- Every ring frame needs its own UIStroke; make it on first use.
local function ringStroke(f)
	local s = f:FindFirstChildOfClass("UIStroke")
	if not s then
		s = mk("UIStroke", { ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, f)
	end
	return s
end

P.halo = mk("ImageLabel", {
	BackgroundTransparency = 1, BorderSizePixel = 0,
	AnchorPoint = Vector2.new(0.5, 0.5), Visible = false, ZIndex = 1,
}, fxLayer)
if HALO_IMG then attachEditable(P.halo, HALO_IMG) end
P.arms = {}
for i = 1, 2 do
	P.arms[i] = mk("Frame", {
		BackgroundColor3 = Color3.fromRGB(255, 248, 214), BorderSizePixel = 0,
		AnchorPoint = Vector2.new(0.5, 0.5), Visible = false, ZIndex = 1,
	}, fxLayer)
end

--[[ Screen-space line between two points, drawn as a rotated rectangle. The
     extra `w` on the length fakes the miter join the canvas gets for free. ]]
local function setLine(f, x1, y1, x2, y2, w, color, alpha)
	local dx, dy = x2 - x1, y2 - y1
	local len = sqrt(dx * dx + dy * dy)
	f.Size = UDim2.fromOffset(max(1, len + w), max(1, w))
	f.Position = UDim2.fromOffset((x1 + x2) * 0.5, (y1 + y2) * 0.5)
	f.Rotation = math.deg(atan2(dy, dx))
	f.BackgroundColor3 = color
	f.BackgroundTransparency = 1 - alpha
end

local function setRect(f, cx, cy, w, h, color, alpha)
	f.Size = UDim2.fromOffset(max(1, w), max(1, h))
	f.Position = UDim2.fromOffset(cx, cy)
	f.Rotation = 0
	f.BackgroundColor3 = color
	f.BackgroundTransparency = 1 - alpha
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STATE                                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local MAX_PULL = 120
local WORLD_W = GRID_W * CELL
local WORLD_H = GRID_H * CELL
local FX_HIT_LIFE = 0.22
local FX_BREAK_LIFE = 0.42

local state = {
	tokens = 0,
	unlocked = { core = true },
	activeBall = "basic",
	won = false,
	vibeOn = true,
	mapOn = true,
	treeOpen = false,
	cardOpen = false,
}

local world = nil
local stats = statsFor(state.unlocked)
local balls = {}
local player = { col = 0, row = 0, x = 0, y = 0 }
local cam = { x = 0, y = 0 }
local aim = { active = false, sx = 0, sy = 0, angle = pi / 2, power = 0 }
local ptr = { id = nil, t0 = 0, moved = 0 }
local particles, arcs, texts, blockFx = {}, {}, {}, {}
local reload, shake = 0, 0
local reach, broken, maxTier = 0, 0, 0
local firedOnce = false
local miniDirty, miniTimer = true, 0
local bannerTimer, bannerRank = 0, 0
local lightMap = newLightMap()

local rng = math.random
local dmg = { stats = stats, rng = rng, fx = newEffects(), ballLuck = 1, ballReveal = 0 }

local function paused()
	return state.treeOpen or state.won or state.cardOpen
end

-- ── Accent ────────────────────────────────────────────────────────────────

local accentHex = PALETTE.hud
local accentCur = { hexRgb(PALETTE.hud) }
local accentC3 = hexC3(PALETTE.hud)
local hoverAccent = nil
local selectedNodeId = "core"

local function refreshAccent()
	local nextHex
	if state.treeOpen then
		nextHex = hoverAccent or PALETTE.branch[(TECH_BY_ID[selectedNodeId] or TECH[1]).branch]
	else
		nextHex = hoverAccent or BALLS[state.activeBall].color
	end
	accentHex = nextHex
end

local function stepAccent(dt)
	local tr, tg, tb = hexRgb(accentHex)
	local k = 1 - exp(-6 * dt)
	accentCur[1] += (tr - accentCur[1]) * k
	accentCur[2] += (tg - accentCur[2]) * k
	accentCur[3] += (tb - accentCur[3]) * k
	accentC3 = Color3.fromRGB(accentCur[1], accentCur[2], accentCur[3])
	for _, t in ipairs(accentTargets) do
		t.obj[t.prop] = accentC3
	end
end

-- ── Haptics ───────────────────────────────────────────────────────────────

--[[ `navigator.vibrate` has no Roblox equivalent for touch devices; gamepad
     rumble is the only motor a LocalScript can reach, so the VIB toggle drives
     that and quietly does nothing on a phone. ]]
local vibToken = 0
local function buzz(strength, duration)
	if not state.vibeOn then return end
	vibToken += 1
	local myToken = vibToken
	local ok = pcall(function()
		if HapticService:IsVibrationSupported(Enum.UserInputType.Gamepad1) then
			HapticService:SetMotor(Enum.UserInputType.Gamepad1, Enum.VibrationMotor.Large, strength)
		end
	end)
	if not ok then return end
	task.delay(duration, function()
		if vibToken ~= myToken then return end
		pcall(function()
			HapticService:SetMotor(Enum.UserInputType.Gamepad1, Enum.VibrationMotor.Large, 0)
		end)
	end)
end

-- ── Banner ────────────────────────────────────────────────────────────────

--[[ `rank` keeps a routine depth milestone from stomping something the player
     waited the whole run to read — sighting the golden block outranks all. ]]
local function showBanner(text, seconds, rank)
	local r = rank or 0
	if bannerTimer > 0 and r < bannerRank then return end
	el.banner.Text = spaced(text)
	el.banner.Visible = true
	bannerTimer = seconds or 2.6
	bannerRank = r
end

-- ── Layers ────────────────────────────────────────────────────────────────

local function distFromSpawn(col, row)
	if not world then return 0 end
	return distFrom(col, row, world.spawnCol, world.spawnRow)
end

local function tierAt(col, row)
	return tierOfDist(distFromSpawn(col, row))
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VIEW                                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local cssW, cssH = 1, 1
local scale = 1
local winW, winH = 1, 1
local blockImg, glowImg
local blockBuf, glowBuf = buffer.create(4), buffer.create(4)

local function viewScale(w)
	local cols = (w < 520) and 17 or ((w < 760) and 21 or 27)
	return w / (cols * CELL)
end

local function rebuildSurfaces()
	winW = ceil(cssW / scale / CELL) + 3
	winH = ceil(cssH / scale / CELL) + 3
	blockBuf = buffer.create(winW * winH * 4)
	glowBuf = buffer.create(winW * winH * 4)

	-- Surfaces are replaced on resize; hand the originals back.
	for _, old in ipairs({ blockImg, glowImg }) do
		pcall(function() old:Destroy() end)
	end
	blockImg, glowImg = nil, nil
	if EDITABLE_OK then
		blockImg = newEditable(winW, winH)
		glowImg = newEditable(winW, winH)
	end
	if blockImg and glowImg then
		attachEditable(blockLayer, blockImg)
		attachEditable(glowLayer, glowImg)
		blockLayer.Visible = true
		glowLayer.Visible = true
		if fallbackFrame then fallbackFrame.Visible = false end
	else
		blockLayer.Visible = false
		glowLayer.Visible = false
		if not fallbackFrame then
			fallbackFrame = mk("Frame", {
				Name = "blocksFallback", BackgroundTransparency = 1, ZIndex = 1,
			}, worldFrame)
		end
		fallbackFrame.Visible = true
	end
end

local function resize()
	local sz = root.AbsoluteSize
	local w = max(1, jsRound(sz.X))
	local h = max(1, jsRound(sz.Y))
	if w == cssW and h == cssH then return end
	cssW, cssH = w, h
	scale = viewScale(cssW)
	rebuildSurfaces()
end

local function screenToWorld(sx, sy)
	return cam.x + (sx - cssW / 2) / scale, cam.y + (sy - cssH / 2) / scale
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  RENDER — transcription of render.js                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local VOID_PACKED = pack(RGB.void[1], RGB.void[2], RGB.void[3], 255)

--[[ One pixel per cell, blitted and upscaled with resampling off. Identical in
     shape to the canvas build's `blockBuf` + drawImage pair. ]]
local function renderBlocks(w, lm, c0, r0, pulse)
	local buf = blockBuf
	local hpA, kindA, hueA, seenA, shadeA, maxHpA, poisonTA =
		w.hp, w.kind, w.hue, w.seen, w.shade, w.maxHp, w.poisonT
	local R, G, B = lm.r, lm.g, lm.b
	local o = 0

	for row = r0, r0 + winH - 1 do
		local inRow = row >= 0 and row < GRID_H
		local base = row * GRID_W + 1
		for col = c0, c0 + winW - 1 do
			if not inRow or col < 0 or col >= GRID_W then
				buffer.writeu32(buf, o, VOID_PACKED)
				o += 4
				continue
			end
			local i = base + col

			if seenA[i] == 0 then
				buffer.writeu32(buf, o, VOID_PACKED)
				o += 4
				continue
			end

			--[[ Light is unbounded on purpose — a lamp cell can read as
			     blown-out white — so clamp only at the point of use. ]]
			local lr, lg, lb = R[i], G[i], B[i]
			if lr > 1 then lr = 1 end
			if lg > 1 then lg = 1 end
			if lb > 1 then lb = 1 end

			local hp = hpA[i]
			if hp <= 0 then
				--[[ Carved-out air takes the colour of whatever is lighting it,
				     not a scaled version of the room tint. Kept well below rock
				     gain so a cleared pocket reads as a hole you can see into
				     rather than as a lit surface. ]]
				local AIR = 0.5
				buffer.writeu32(buf, o, pack(
					RGB.void[1] + lr * 255 * AIR,
					RGB.void[2] + lg * 255 * AIR,
					RGB.void[3] + lb * 255 * AIR, 255))
				o += 4
				continue
			end

			local kind = kindA[i]
			local cr, cg, cb
			if kind == KIND_TOKEN then
				cr, cg, cb = RGB.token[1], RGB.token[2], RGB.token[3]
			elseif kind == KIND_GOLDEN then
				cr, cg, cb = RGB.golden[1], RGB.golden[2], RGB.golden[3]
			elseif kind == KIND_BEDROCK then
				cr, cg, cb = RGB.bedrock[1], RGB.bedrock[2], RGB.bedrock[3]
			else
				local t = BLOCK_RGB[hueA[i]]
				cr, cg, cb = t.r, t.g, t.b
			end

			--[[ Per-block jitter so a wall of one tier is not a flat slab, then
			     damage reads as the block going dark and dead rather than as a
			     black overlay. ]]
			local mh = maxHpA[i]
			if mh == 0 then mh = 1 end
			local k = (0.88 + (shadeA[i] / 255) * 0.24) * (1 - (1 - hp / mh) * 0.55)
			local r, g, b = cr * lr * k, cg * lg * k, cb * lb * k

			if poisonTA[i] > 0 then
				local p = 0.3 + 0.2 * pulse
				r += (61 - r) * p
				g += (220 - g) * p
				b += (97 - b) * p
			end

			buffer.writeu32(buf, o, pack(r, g, b, 255))
			o += 4
		end
	end

	blit(blockImg, winW, winH, buf)
end

--[[ The same light map again, smoothed. In the canvas build this is an
     additive `lighter` composite at 30%; Roblox carries the strength in the
     alpha channel instead — see the note on `glowLayer`. ]]
local function renderGlow(w, lm, c0, r0)
	local buf = glowBuf
	local hpA = w.hp
	local R, G, B = lm.r, lm.g, lm.b
	local o = 0

	for row = r0, r0 + winH - 1 do
		local inRow = row >= 0 and row < GRID_H
		local base = row * GRID_W + 1
		for col = c0, c0 + winW - 1 do
			if not inRow or col < 0 or col >= GRID_W then
				buffer.writeu32(buf, o, 0)
				o += 4
				continue
			end
			local i = base + col
			-- Air blooms less than rock, so open rooms stay dark instead of
			-- hazing over into a flat grey wash.
			local k = hpA[i] > 0 and 1 or 0.45
			local lr, lg, lb = R[i] * k, G[i] * k, B[i] * k
			local m = lr
			if lg > m then m = lg end
			if lb > m then m = lb end

			if m <= 0.001 then
				buffer.writeu32(buf, o, 0)
			else
				if m > 1 then m = 1 end
				local inv = 255 / m
				buffer.writeu32(buf, o, pack(lr * inv, lg * inv, lb * inv,
					floor(m * GLOW_STRENGTH * 255)))
			end
			o += 4
		end
	end

	blit(glowImg, winW, winH, buf)
end

-- Frame-per-cell path, used only when EditableImage is unavailable.
local fallbackPool = nil
local function renderBlocksFallback(w, lm, c0, r0, x0, y0, cellPx)
	if not fallbackPool then
		fallbackPool = newPool(fallbackFrame, "Frame", {
			BorderSizePixel = 0, Visible = false, ZIndex = 1,
		})
	end
	fallbackPool.reset()
	local hpA, kindA, hueA, seenA, shadeA, maxHpA = w.hp, w.kind, w.hue, w.seen, w.shade, w.maxHp
	local R, G, B = lm.r, lm.g, lm.b

	for row = r0, r0 + winH - 1 do
		if row >= 0 and row < GRID_H then
			local base = row * GRID_W + 1
			for col = c0, c0 + winW - 1 do
				if col >= 0 and col < GRID_W then
					local i = base + col
					local f = fallbackPool.get()
					f.Position = UDim2.fromOffset(x0 + (col - c0) * cellPx, y0 + (row - r0) * cellPx)
					f.Size = UDim2.fromOffset(ceil(cellPx) + 1, ceil(cellPx) + 1)
					if seenA[i] == 0 then
						f.BackgroundColor3 = hexC3(PALETTE.unseen)
					else
						local lr = min(1, R[i]); local lg = min(1, G[i]); local lb = min(1, B[i])
						local hp = hpA[i]
						if hp <= 0 then
							f.BackgroundColor3 = Color3.fromRGB(
								clamp(RGB.void[1] + lr * 128, 0, 255),
								clamp(RGB.void[2] + lg * 128, 0, 255),
								clamp(RGB.void[3] + lb * 128, 0, 255))
						else
							local kind = kindA[i]
							local cr, cg, cb
							if kind == KIND_TOKEN then cr, cg, cb = 255, 255, 255
							elseif kind == KIND_GOLDEN then cr, cg, cb = RGB.golden[1], RGB.golden[2], RGB.golden[3]
							elseif kind == KIND_BEDROCK then cr, cg, cb = RGB.bedrock[1], RGB.bedrock[2], RGB.bedrock[3]
							else local t = BLOCK_RGB[hueA[i]]; cr, cg, cb = t.r, t.g, t.b end
							local mh = maxHpA[i]; if mh == 0 then mh = 1 end
							local k = (0.88 + (shadeA[i] / 255) * 0.24) * (1 - (1 - hp / mh) * 0.55)
							f.BackgroundColor3 = Color3.fromRGB(
								clamp(cr * lr * k, 0, 255), clamp(cg * lg * k, 0, 255), clamp(cb * lb * k, 0, 255))
						end
					end
				end
			end
		end
	end
	fallbackPool.finish()
end

-- ── Minimap ───────────────────────────────────────────────────────────────

local miniImg = newEditable(GRID_W, GRID_H)
local miniBuf = buffer.create(GRID_W * GRID_H * 4)
if miniImg then attachEditable(el.mini, miniImg) end

local function drawMini()
	if not miniImg then return end
	for i = 1, CELLS do
		local o = (i - 1) * 4
		if world.seen[i] == 0 then
			--[[ Undiscovered. The ring the golden block can sit in gets the
			     faintest possible hint, so the map tells you how far to dig
			     without telling you which block it is. ]]
			local dist = distFromSpawn(icol(i), irow(i))
			local bandOn = dist >= GOLDEN_DIST_MIN and dist <= GOLDEN_DIST_MAX
			buffer.writeu32(miniBuf, o, bandOn and pack(22, 18, 5, 255) or pack(6, 14, 9, 255))
		else
			local kind = world.kind[i]
			if world.hp[i] <= 0 then
				buffer.writeu32(miniBuf, o, pack(14, 40, 22, 255))
			elseif kind == KIND_BEDROCK then
				buffer.writeu32(miniBuf, o, pack(26, 32, 34, 255))
			elseif kind == KIND_TOKEN then
				buffer.writeu32(miniBuf, o, pack(255, 255, 255, 255))
			elseif kind == KIND_GOLDEN then
				buffer.writeu32(miniBuf, o, pack(255, 210, 61, 255))
			else
				local c = BLOCK_RGB[world.hue[i]]
				buffer.writeu32(miniBuf, o, pack(c.r * 0.75, c.g * 0.75, c.b * 0.75, 255))
			end
		end
	end
	blit(miniImg, GRID_W, GRID_H, miniBuf)

	-- Player triangle, pointing wherever the next shot goes.
	local k = S(el.miniPx) / GRID_W
	local px, py = (player.col + 0.5) * k, (player.row + 0.5) * k
	local pts = { { 4.5, 0 }, { -3, -3.2 }, { -3, 3.2 } }
	local ca, sa = cos(aim.angle), sin(aim.angle)
	local sx, sy = {}, {}
	for i, p in ipairs(pts) do
		sx[i] = px + (p[1] * ca - p[2] * sa) * k
		sy[i] = py + (p[1] * sa + p[2] * ca) * k
	end
	for i = 1, 3 do
		local j = i % 3 + 1
		setLine(el.miniPlayer[i], sx[i], sy[i], sx[j], sy[j], max(1.4, k), accentC3, 1)
	end

	if world.goldenSighted and world.goldenIdx > 0 and world.hp[world.goldenIdx] > 0 then
		el.miniGolden.Visible = true
		el.miniGolden.Position = UDim2.fromOffset((icol(world.goldenIdx) + 0.5) * k, (irow(world.goldenIdx) + 0.5) * k)
	else
		el.miniGolden.Visible = false
	end
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  HUD                                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

--[[ The web build writes the run to localStorage every 15 seconds. A
     LocalScript cannot reach DataStoreService, so the call sites are kept and
     the write is a no-op — wire this to a RemoteEvent if you want it to stick. ]]
local function save() end

local buildChips

local function syncHud(force)
	el.depth.Text = jsRound(distFromSpawn(player.col, player.row)) .. "m"
	local t = tierAt(player.col, player.row)
	el.lvl.Text = "LAYER " .. (t + 1)
	el.tier.Text = TIERS[t + 1].name:upper()
	el.tier.TextColor3 = hexC3(TIERS[t + 1].color)
	el.tokens.Text = "\u{25C6} " .. state.tokens
	el.treeTokens.Text = "\u{25C6} " .. state.tokens

	local frac = reload > 0 and (1 - reload / max(0.001, stats.reload)) or 1
	el.cdFill.Size = UDim2.fromScale(clamp(frac, 0, 1), 1)
	if reload > 0 then
		el.cdText.Text = string.format("%.1fs", reload)
		el.cdText.TextColor3 = hexC3("#94a3b8")
	else
		el.cdText.Text = "READY"
		el.cdText.TextColor3 = accentC3
	end

	-- The el.compass is earned two ways: buy Golden Sense, or lay eyes on the block.
	local alive = world and world.goldenIdx > 0 and world.hp[world.goldenIdx] > 0
	local range = (world and world.goldenSighted) and 9999 or stats.compass
	if alive and range > 0 then
		local gc, gr = icol(world.goldenIdx), irow(world.goldenIdx)
		local dc, dr = gc - player.col, gr - player.row
		local d = hypot(dc, dr)
		if d <= range then
			el.compass.Visible = true
			el.compassArrow.Rotation = math.deg(atan2(dr, dc))
			el.compassTxt.Text = jsRound(d) .. " BLOCKS"
		else
			el.compass.Visible = false
		end
	else
		el.compass.Visible = false
	end

	if force then buildChips() end
end

function buildChips()
	for _, c in ipairs(el.chips:GetChildren()) do
		if c:IsA("GuiObject") then c:Destroy() end
	end
	local list = ballsFor(state.unlocked)
	for i, id in ipairs(list) do
		local def = BALLS[id]
		local col = hexC3(def.color)
		local on = state.activeBall == id
		local chip = mk("TextButton", {
			Text = "",
			BackgroundColor3 = Color3.new(0, 0, 0),
			BackgroundTransparency = 0.3,
			BorderSizePixel = 0,
			AutoButtonColor = false,
			Size = UDim2.fromOffset(0, S(24)),
			AutomaticSize = Enum.AutomaticSize.X,
			LayoutOrder = i,
			Transparency = on and 0 or 0.6,
			ZIndex = 12,
		}, el.chips)
		mk("UIStroke", { Thickness = 3, Color = col, Transparency = on and 0 or 0.6,
			ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, chip)
		mk("UIPadding", {
			PaddingLeft = UDim.new(0, S(9)), PaddingRight = UDim.new(0, S(9)),
		}, chip)
		mk("UIListLayout", {
			FillDirection = Enum.FillDirection.Horizontal,
			VerticalAlignment = Enum.VerticalAlignment.Center,
			SortOrder = Enum.SortOrder.LayoutOrder,
			Padding = UDim.new(0, S(5)),
		}, chip)
		mk("Frame", {
			Size = UDim2.fromOffset(S(7), S(7)), BackgroundColor3 = col,
			BorderSizePixel = 0, LayoutOrder = 1,
			BackgroundTransparency = on and 0 or 0.6, ZIndex = 13,
		}, chip)
		label(chip, def.name:gsub(" ball", ""):upper(), 10, col, {
			Size = UDim2.fromOffset(0, S(14)),
			AutomaticSize = Enum.AutomaticSize.X,
			TextYAlignment = Enum.TextYAlignment.Center,
			TextTransparency = on and 0 or 0.6,
			LayoutOrder = 2, ZIndex = 13,
		})

		chip.MouseEnter:Connect(function() hoverAccent = def.color; refreshAccent() end)
		chip.MouseLeave:Connect(function() hoverAccent = nil; refreshAccent() end)
		chip.MouseButton1Click:Connect(function()
			state.activeBall = id
			hoverAccent = nil
			buildChips()
			refreshAccent()
			buzz(0.15, 0.05)
			save()
		end)
	end
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  TECH TREE                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local NODE_SIZE = S(46)
local GAP_X = S(88)
local GAP_Y = S(82)
local nodeEls = {}
local edgeDots = {}
local treeCore = { x = 0, y = 0 }
local treeCentred = false
local pan = { x = 0, y = 0, dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = 0, id = nil }

local nc = {}
local syncTree

local function canAfford(n)
	if state.unlocked[n.id] then return false end
	for _, r in ipairs(n.requires) do
		if not state.unlocked[r] then return false end
	end
	return state.tokens >= n.cost
end

--[[ What a node is worth is derived, never hand-written: price the stat block
     with and without the node and diff it. That way the card stays honest when
     the tree is retuned, and a new node needs no copy written for it. ]]
local STAT_ORDER = {
	"damage", "damageMul", "splashRadius", "splashFactor", "projectiles",
	"spreadAngle", "bounces", "speed", "lifetime", "reload", "chainTargets",
	"chainRange", "chainDamage", "poisonBase", "poisonDps", "poisonTime",
	"poisonSpread", "revealRadius", "luck", "compass",
}
local STAT_PCT = { speed = true, damageMul = true, splashFactor = true, luck = true, chainDamage = true }
local STAT_SEC = { reload = true, lifetime = true, poisonTime = true }
local STAT_HIDE = { compass = true }

local function statBase(key)
	local b = BASE_STATS[key]
	if not b or b == 0 then return 1 end
	return b
end

local function fmtStat(key, v)
	if STAT_PCT[key] then
		local pct = jsRound((v / statBase(key) - 1) * 100)
		return (pct >= 0 and "+" or "") .. pct .. "%"
	end
	if STAT_SEC[key] then return (jsRound(v * 10) / 10) .. "s" end
	return tostring(jsRound(v * 100) / 100)
end

local function deltaLabel(d)
	local sign = d.to >= d.from and "+" or ""
	if STAT_PCT[d.key] then
		return sign .. jsRound(((d.to - d.from) / statBase(d.key)) * 100) .. "%"
	end
	local raw = jsRound((d.to - d.from) * 100) / 100
	return sign .. raw .. (STAT_SEC[d.key] and "s" or "")
end

local function nodeDelta(n)
	local without = {}
	for k in pairs(state.unlocked) do without[k] = true end
	without[n.id] = nil
	local before = statsFor(without)
	local with = {}
	for k in pairs(without) do with[k] = true end
	with[n.id] = true
	local after = statsFor(with)

	local best = nil
	for _, key in ipairs(STAT_ORDER) do
		if not STAT_HIDE[key] and before[key] ~= after[key] then
			local denom = abs(before[key])
			if denom == 0 then denom = 1 end
			local rel = abs((after[key] - before[key]) / denom)
			if not best or rel > best.rel then
				best = { key = key, from = before[key], to = after[key], rel = rel }
			end
		end
	end
	return best
end

local function nodePx(n, minC) return (n.col - minC) * GAP_X + S(30) end
local function nodePy(n, minR) return (n.row - minR) * GAP_Y + S(30) end

local function buildTree()
	local minC, maxC, minR, maxR = math.huge, -math.huge, math.huge, -math.huge
	for _, n in ipairs(TECH) do
		minC = min(minC, n.col); maxC = max(maxC, n.col)
		minR = min(minR, n.row); maxR = max(maxR, n.row)
	end
	local W = (maxC - minC) * GAP_X + NODE_SIZE + S(60)
	local H = (maxR - minR) * GAP_Y + NODE_SIZE + S(60)
	el.treePan.Size = UDim2.fromOffset(W, H)

	--[[ Dotted, not solid: the tree should read as a wiring diagram. Roblox has
	     no dashed stroke, so `stroke-dasharray: 1 7` becomes literal dots. ]]
	for _, n in ipairs(TECH) do
		for _, req in ipairs(n.requires) do
			local p = TECH_BY_ID[req]
			if p then
				local x1 = nodePx(p, minC) + NODE_SIZE / 2
				local y1 = nodePy(p, minR) + NODE_SIZE / 2
				local x2 = nodePx(n, minC) + NODE_SIZE / 2
				local y2 = nodePy(n, minR) + NODE_SIZE / 2
				local len = hypot(x2 - x1, y2 - y1)
				local steps = max(1, floor(len / S(8)))
				local col = hexC3(PALETTE.branch[n.branch])
				local dots = {}
				for k = 0, steps do
					local t = k / steps
					dots[#dots + 1] = mk("Frame", {
						AnchorPoint = Vector2.new(0.5, 0.5),
						Position = UDim2.fromOffset(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t),
						Size = UDim2.fromOffset(S(3), S(3)),
						BackgroundColor3 = col,
						BackgroundTransparency = 0.7,
						BorderSizePixel = 0,
						ZIndex = 41,
					}, el.treePan)
				end
				edgeDots[#edgeDots + 1] = { id = n.id, dots = dots }
			end
		end
	end

	for _, n in ipairs(TECH) do
		local color = hexC3(PALETTE.branch[n.branch])
		local slot = mk("Frame", {
			Position = UDim2.fromOffset(nodePx(n, minC), nodePy(n, minR)),
			Size = UDim2.fromOffset(NODE_SIZE, NODE_SIZE),
			BackgroundTransparency = 1,
			ZIndex = 42,
		}, el.treePan)

		local shape = mk("Frame", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.5),
			Size = UDim2.fromOffset(NODE_SIZE, NODE_SIZE),
			BackgroundColor3 = Color3.new(0, 0, 0),
			BackgroundTransparency = 0.15,
			BorderSizePixel = 0,
			ZIndex = 42,
		}, slot)
		local corner = mk("UICorner", { CornerRadius = UDim.new(0.5, 0) }, shape)
		local stroke = mk("UIStroke", {
			Thickness = 3, Color = hexC3("#8b969b"),
			ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
		}, shape)

		local icon = mk("ImageLabel", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.5),
			Size = UDim2.fromOffset(S(22), S(22)),
			BackgroundTransparency = 1,
			ImageColor3 = hexC3("#8b969b"),
			ZIndex = 43,
		}, shape)
		if ICONS[n.icon] then attachEditable(icon, ICONS[n.icon]) end

		local pip = mk("Frame", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.5),
			Size = UDim2.fromOffset(S(4), S(4)),
			BackgroundColor3 = hexC3("#8b969b"),
			BorderSizePixel = 0,
			Visible = false,
			ZIndex = 43,
		}, shape)

		local plus = label(slot, "+", 13, color, {
			AnchorPoint = Vector2.new(1, 0),
			Position = UDim2.fromOffset(NODE_SIZE + S(7), -S(9)),
			Size = UDim2.fromOffset(S(14), S(14)),
			TextXAlignment = Enum.TextXAlignment.Center,
			Visible = false,
			ZIndex = 44,
		})

		local hit = mk("TextButton", {
			Text = "", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1),
			AutoButtonColor = false, ZIndex = 45,
		}, slot)

		nodeEls[n.id] = {
			slot = slot, shape = shape, corner = corner, stroke = stroke,
			icon = icon, pip = pip, plus = plus, color = color, node = n,
			x = nodePx(n, minC), y = nodePy(n, minR),
		}

		hit.MouseEnter:Connect(function() hoverAccent = PALETTE.branch[n.branch]; refreshAccent() end)
		hit.MouseLeave:Connect(function() hoverAccent = nil; refreshAccent() end)
		hit.MouseButton1Click:Connect(function()
			if pan.moved > 4 then return end
			selectedNodeId = n.id
			hoverAccent = nil
			syncTree()
			refreshAccent()
		end)
	end

	--[[ Floats above the selected node. The web deals it in tilted and lets it
	     settle level; Roblox has no keyframes here, so it simply appears. ]]
	nc.card = mk("Frame", {
		AnchorPoint = Vector2.new(0.5, 1),
		Size = UDim2.fromOffset(S(210), S(96)),
		BackgroundColor3 = Color3.fromRGB(5, 7, 6),
		BorderSizePixel = 0,
		Visible = false,
		ZIndex = 46,
	}, el.treePan)
	nc.stroke = mk("UIStroke", {
		Thickness = 3, Color = hexC3(PALETTE.hud), ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
	}, nc.card)
	nc.k = label(nc.card, "", 11, hexC3(PALETTE.hud), {
		Position = UDim2.fromOffset(0, S(10)), Size = UDim2.new(1, 0, 0, S(13)),
		TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 47,
	})
	nc.v = label(nc.card, "", 21, C3_WHITE, {
		Position = UDim2.fromOffset(0, S(29)), Size = UDim2.new(1, 0, 0, S(26)),
		TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 47,
	})
	nc.s = label(nc.card, "", 11, hexC3("#7f8c85"), {
		Position = UDim2.fromOffset(0, S(57)), Size = UDim2.new(1, 0, 0, S(13)),
		TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 47,
	})
	nc.c = label(nc.card, "", 15, C3_WHITE, {
		Position = UDim2.fromOffset(0, S(73)), Size = UDim2.new(1, 0, 0, S(18)),
		TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 47,
	})

	treeCore.x = nodePx(TECH_BY_ID.core, minC) + NODE_SIZE / 2
	treeCore.y = nodePy(TECH_BY_ID.core, minR) + NODE_SIZE / 2
end

local function applyPan()
	el.treePan.Position = UDim2.fromOffset(jsRound(pan.x), jsRound(pan.y))
end

local function centreTree()
	if treeCentred then return end
	local rect = el.treeView.AbsoluteSize
	if rect.X < 2 then return end
	treeCentred = true
	pan.x = rect.X / 2 - treeCore.x
	pan.y = rect.Y / 2 - treeCore.y
	applyPan()
end

local function syncNodeCard(n)
	local e = nodeEls[n.id]
	if not e or not nc.card then
		if nc.card then nc.card.Visible = false end
		return
	end
	local owned = state.unlocked[n.id] == true
	local color = e.color

	local kicker, big, sub
	if n.unlocksBall then
		kicker = owned and "Ball" or "New ball"
		big = BALLS[n.unlocksBall].name
		sub = n.branch:sub(1, 1):upper() .. n.branch:sub(2)
	else
		local d = nodeDelta(n)
		kicker = n.name
		if not d then
			big = n.desc; sub = ""
		elseif owned then
			big = fmtStat(d.key, d.to); sub = ""
		else
			big = fmtStat(d.key, d.from) .. " > " .. fmtStat(d.key, d.to)
			sub = deltaLabel(d)
		end
	end

	nc.card.Visible = true
	nc.stroke.Color = color
	nc.k.Text = kicker
	nc.k.TextColor3 = color
	nc.v.Text = big
	nc.v.TextSize = (#big > 18) and S(13) or S(21)
	nc.s.Text = sub
	nc.c.Text = (not owned and n.cost > 0) and ("\u{25C6} " .. n.cost) or ""
	nc.card.Position = UDim2.fromOffset(e.x + NODE_SIZE / 2, e.y - S(16))
end

function syncTree()
	for _, n in ipairs(TECH) do
		local e = nodeEls[n.id]
		if e then
			local owned = state.unlocked[n.id] == true
			local ready = true
			for _, r in ipairs(n.requires) do
				if not state.unlocked[r] then ready = false; break end
			end
			--[[ "far" is one step beyond reachable: its prerequisites are not
			     owned and neither are theirs, so it is context, not a choice. ]]
			local near = ready
			if not near then
				for _, r in ipairs(n.requires) do
					local p = TECH_BY_ID[r]
					if p then
						local pready = true
						for _, rr in ipairs(p.requires) do
							if not state.unlocked[rr] then pready = false; break end
						end
						if pready then near = true; break end
					end
				end
			end

			local far = not owned and not near
			local short = not owned and ready and state.tokens < n.cost
			local buyable = not owned and ready and state.tokens >= n.cost

			if far then
				e.shape.Size = UDim2.fromOffset(S(18), S(18))
				e.shape.BackgroundTransparency = 1
				e.stroke.Thickness = 2
				e.stroke.Transparency = 0.55
				e.corner.CornerRadius = UDim.new(0.5, 0)
				e.icon.Visible = false
				e.pip.Visible = true
			else
				e.shape.Size = UDim2.fromOffset(NODE_SIZE, NODE_SIZE)
				e.stroke.Thickness = 3
				e.stroke.Transparency = short and 0.38 or 0
				e.icon.Visible = true
				e.pip.Visible = false
				-- Node shape carries ownership: a circle is something you have
				-- not bought, a rounded square is something you have.
				e.corner.CornerRadius = owned and UDim.new(0, S(8)) or UDim.new(0.5, 0)
				if owned then
					e.shape.BackgroundColor3 = e.color:Lerp(Color3.fromRGB(10, 13, 11), 0.74)
					e.shape.BackgroundTransparency = 0
				else
					e.shape.BackgroundColor3 = Color3.new(0, 0, 0)
					e.shape.BackgroundTransparency = 0.15
				end
			end

			local lit = owned or ready
			e.stroke.Color = lit and e.color or hexC3("#8b969b")
			e.icon.ImageColor3 = lit and e.color or hexC3("#8b969b")
			e.icon.ImageTransparency = short and 0.38 or 0
			e.pip.BackgroundColor3 = lit and e.color or hexC3("#8b969b")
			e.pip.BackgroundTransparency = 0.55
			e.plus.Visible = buyable

			local sel = selectedNodeId == n.id
			e.stroke.Thickness = far and 2 or (sel and 4 or 3)
		end
	end

	for _, edge in ipairs(edgeDots) do
		local a = state.unlocked[edge.id] and 0.15 or 0.7
		for _, d in ipairs(edge.dots) do d.BackgroundTransparency = a end
	end

	local n = TECH_BY_ID[selectedNodeId] or TECH[1]
	el.dNm.Text = n.name
	el.dDs.Text = n.desc
	el.treeTokens.Text = "\u{25C6} " .. state.tokens
	syncNodeCard(n)

	local ready = true
	for _, r in ipairs(n.requires) do
		if not state.unlocked[r] then ready = false; break end
	end

	if state.unlocked[n.id] then
		el.dBtn.Text = "OWNED"
		el.dBtn.Active = false
		el.dBtn.TextColor3 = hexC3("#04160c")
		el.dBtn.BackgroundColor3 = accentC3
		el.dBtn.BackgroundTransparency = 0
		el.dBtnStroke.Color = accentC3
	elseif not ready then
		el.dBtn.Text = "LOCKED"
		el.dBtn.Active = false
		el.dBtn.TextColor3 = DIM
		el.dBtn.BackgroundColor3 = Color3.new(0, 0, 0)
		el.dBtn.BackgroundTransparency = 0.3
		el.dBtnStroke.Color = DIM
	elseif state.tokens < n.cost then
		el.dBtn.Text = "NEED \u{25C6}" .. n.cost
		el.dBtn.Active = false
		el.dBtn.TextColor3 = DIM
		el.dBtn.BackgroundColor3 = Color3.new(0, 0, 0)
		el.dBtn.BackgroundTransparency = 0.3
		el.dBtnStroke.Color = DIM
	else
		el.dBtn.Text = "UNLOCK \u{25C6}" .. n.cost
		el.dBtn.Active = true
		el.dBtn.TextColor3 = hexC3("#04160c")
		el.dBtn.BackgroundColor3 = accentC3
		el.dBtn.BackgroundTransparency = 0
		el.dBtnStroke.Color = accentC3
	end
end

local function unlockSelected()
	local n = TECH_BY_ID[selectedNodeId]
	if not n or not canAfford(n) then return end
	state.tokens -= n.cost
	state.unlocked[n.id] = true
	stats = statsFor(state.unlocked)
	buzz(0.4, 0.08)
	if n.unlocksBall then
		state.activeBall = n.unlocksBall
		state.cardOpen = true
		el.cardName.Text = BALLS[n.unlocksBall].name
		el.cardDesc.Text = BALLS[n.unlocksBall].desc
		el.card.Visible = true
	end
	buildChips()
	syncTree()
	syncHud()
	save()
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  WORLD LIFECYCLE                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local function startWorld(seed)
	local w = genWorld(seed)
	player.col = w.spawnCol
	player.row = w.spawnRow
	reach, broken, maxTier = 0, 0, 0
	player.x = (player.col + 0.5) * CELL
	player.y = (player.row + 0.5) * CELL
	cam.x, cam.y = player.x, player.y
	balls = {}; particles = {}; arcs = {}; texts = {}; blockFx = {}
	reload, shake = 0, 0
	world = w
	miniDirty = true
end

local function newRun()
	state.tokens = 0
	state.unlocked = { core = true }
	state.activeBall = "basic"
	state.won = false
	stats = statsFor(state.unlocked)
	el.win.Visible = false
	el.tree.Visible = false
	state.treeOpen = false
	selectedNodeId = "core"
	startWorld(floor(rng() * 0xffffffff))
	buildChips()
	syncTree()
	syncHud(true)
	refreshAccent()
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  INPUT                                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local function ptrPos(input)
	local inset = GuiService:GetGuiInset()
	return Vector2.new(input.Position.X + inset.X, input.Position.Y + inset.Y)
end

local function inBottomDeck(p)
	local ap, as = el.bottom.AbsolutePosition, el.bottom.AbsoluteSize
	return p.X >= ap.X and p.X <= ap.X + as.X and p.Y >= ap.Y and p.Y <= ap.Y + as.Y
end

local function fireIfReady()
	if aim.power > 0.06 and reload <= 0 then
		for _, b in ipairs(spawnVolley(player.x, player.y, aim.angle, aim.power, state.activeBall, stats)) do
			balls[#balls + 1] = b
		end
		reload = stats.reload
		buzz(0.35, 0.06)
		if not firedOnce then
			firedOnce = true
			el.help.Visible = false
		end
	end
end

local function tapWalk(sx, sy)
	local wx, wy = screenToWorld(sx, sy)
	local tc, tr = walkToward(world, player.col, player.row, floor(wx / CELL), floor(wy / CELL))
	if tc then
		player.col, player.row = tc, tr
		player.x = (tc + 0.5) * CELL
		player.y = (tr + 0.5) * CELL
		reach = max(reach, distFromSpawn(tc, tr))
		buzz(0.12, 0.04)
		miniDirty = true
	end
end

UserInputService.InputBegan:Connect(function(input, gpe)
	if gpe then return end
	if input.UserInputType ~= Enum.UserInputType.MouseButton1
		and input.UserInputType ~= Enum.UserInputType.Touch then return end
	if paused() or not world then return end
	local p = ptrPos(input)
	if inBottomDeck(p) then return end

	ptr.id = input
	ptr.t0 = os.clock()
	ptr.moved = 0
	aim.active = true
	aim.sx, aim.sy = p.X, p.Y
	aim.power = 0
end)

UserInputService.InputChanged:Connect(function(input, gpe)
	if not aim.active then return end
	local kind = input.UserInputType
	if kind == Enum.UserInputType.Touch then
		-- A second finger must not steer a drag the first one started.
		if input ~= ptr.id then return end
	elseif kind ~= Enum.UserInputType.MouseMovement then
		return
	end

	-- Slingshot: drag away from the target, the ball flies the other way.
	local p = ptrPos(input)
	local dx, dy = aim.sx - p.X, aim.sy - p.Y
	local len = hypot(dx, dy)
	ptr.moved = max(ptr.moved, len)
	if len > 4 then
		aim.angle = atan2(dy, dx)
		aim.power = min(1, len / MAX_PULL)
	end
end)

local function endPointer(input)
	if not aim.active then return end
	aim.active = false
	local held = (os.clock() - ptr.t0) * 1000
	local moved = ptr.moved
	ptr.id = nil
	if not world then return end

	if moved < 14 and held < 320 then
		local p = ptrPos(input)
		tapWalk(p.X, p.Y)
		return
	end
	fireIfReady()
end

UserInputService.InputEnded:Connect(function(input)
	if input.UserInputType ~= Enum.UserInputType.MouseButton1
		and input.UserInputType ~= Enum.UserInputType.Touch then return end
	endPointer(input)
end)

--[[ Console and keyboard, which the web build has no equivalent for. The left
     stick is the sling: pull it back and let go. WASD walks with the same
     `walkToward` step a tap does, so the mechanic stays identical. ]]
local padPower, padAngle, padWasPulled = 0, pi / 2, false
local keyHeld = {}
local keyRepeat = 0

UserInputService.InputBegan:Connect(function(input, gpe)
	if gpe then return end
	local kc = input.KeyCode
	if kc == Enum.KeyCode.W or kc == Enum.KeyCode.Up then keyHeld.up = true
	elseif kc == Enum.KeyCode.S or kc == Enum.KeyCode.Down then keyHeld.down = true
	elseif kc == Enum.KeyCode.A or kc == Enum.KeyCode.Left then keyHeld.left = true
	elseif kc == Enum.KeyCode.D or kc == Enum.KeyCode.Right then keyHeld.right = true
	elseif kc == Enum.KeyCode.ButtonY then
		if state.treeOpen then
			state.treeOpen = false; el.tree.Visible = false
		else
			state.treeOpen = true; el.tree.Visible = true; centreTree(); syncTree()
		end
		refreshAccent()
	end
end)

UserInputService.InputEnded:Connect(function(input)
	local kc = input.KeyCode
	if kc == Enum.KeyCode.W or kc == Enum.KeyCode.Up then keyHeld.up = nil
	elseif kc == Enum.KeyCode.S or kc == Enum.KeyCode.Down then keyHeld.down = nil
	elseif kc == Enum.KeyCode.A or kc == Enum.KeyCode.Left then keyHeld.left = nil
	elseif kc == Enum.KeyCode.D or kc == Enum.KeyCode.Right then keyHeld.right = nil
	end
end)

UserInputService.InputChanged:Connect(function(input, gpe)
	if input.KeyCode ~= Enum.KeyCode.Thumbstick1 then return end
	if paused() then return end
	local v = input.Position
	local mag = hypot(v.X, v.Y)
	if mag > 0.22 then
		-- Pull back to load: the ball leaves opposite the stick, like a drag.
		aim.angle = atan2(-v.Y, -v.X)
		padAngle = aim.angle
		padPower = min(1, (mag - 0.22) / 0.68)
		aim.power = padPower
		aim.active = true
		padWasPulled = true
	elseif padWasPulled then
		padWasPulled = false
		aim.active = false
		aim.angle = padAngle
		aim.power = padPower
		fireIfReady()
		aim.power = 0
		padPower = 0
	end
end)

local function stepKeyboardWalk(dt)
	keyRepeat -= dt
	if keyRepeat > 0 or paused() or not world then return end
	local dx, dy = 0, 0
	if keyHeld.up then dy -= 1 end
	if keyHeld.down then dy += 1 end
	if keyHeld.left then dx -= 1 end
	if keyHeld.right then dx += 1 end
	if dx == 0 and dy == 0 then return end
	keyRepeat = 0.13
	local tc, tr = walkToward(world, player.col, player.row,
		player.col + dx * PLAYER_REACH, player.row + dy * PLAYER_REACH)
	if tc then
		player.col, player.row = tc, tr
		player.x = (tc + 0.5) * CELL
		player.y = (tr + 0.5) * CELL
		reach = max(reach, distFromSpawn(tc, tr))
		miniDirty = true
	end
end

-- ── Buttons ───────────────────────────────────────────────────────────────

el.techBtn.MouseButton1Click:Connect(function()
	state.treeOpen = true
	el.tree.Visible = true
	centreTree()
	syncTree()
	refreshAccent()
end)
el.treeClose.MouseButton1Click:Connect(function()
	state.treeOpen = false
	el.tree.Visible = false
	hoverAccent = nil
	refreshAccent()
	save()
end)
el.dBtn.MouseButton1Click:Connect(function()
	if el.dBtn.Active then unlockSelected() end
end)
el.cardHit.MouseButton1Click:Connect(function()
	state.cardOpen = false
	el.card.Visible = false
end)
el.winBtn.MouseButton1Click:Connect(newRun)

el.vibBtn.MouseButton1Click:Connect(function()
	state.vibeOn = not state.vibeOn
	el.vibBtn.Text = state.vibeOn and "VIB" or "VIB\u{2715}"
	el.vibBtn.TextColor3 = state.vibeOn and accentC3 or DIM
	el.vibStroke.Color = state.vibeOn and accentC3 or DIM
	if state.vibeOn then buzz(0.5, 0.08) end
	save()
end)
el.mapBtn.MouseButton1Click:Connect(function()
	state.mapOn = not state.mapOn
	el.miniWrap.Visible = state.mapOn
	el.mapBtn.TextColor3 = state.mapOn and accentC3 or DIM
	el.mapStroke.Color = state.mapOn and accentC3 or DIM
	save()
end)

-- Tech tree panning.
el.treeView.InputBegan:Connect(function(input)
	if input.UserInputType ~= Enum.UserInputType.MouseButton1
		and input.UserInputType ~= Enum.UserInputType.Touch then return end
	pan.dragging = true
	pan.id = input
	pan.moved = 0
	local p = ptrPos(input)
	pan.sx, pan.sy = p.X, p.Y
	pan.ox, pan.oy = pan.x, pan.y
end)
el.treeView.InputChanged:Connect(function(input)
	if not pan.dragging then return end
	if input.UserInputType ~= Enum.UserInputType.MouseMovement
		and input.UserInputType ~= Enum.UserInputType.Touch then return end
	local p = ptrPos(input)
	local dx, dy = p.X - pan.sx, p.Y - pan.sy
	pan.moved = max(pan.moved, hypot(dx, dy))
	if pan.moved > 4 then
		pan.x = pan.ox + dx
		pan.y = pan.oy + dy
		applyPan()
	end
end)
local function endPan()
	pan.dragging = false
	pan.id = nil
	task.defer(function() pan.moved = 0 end)
end
el.treeView.InputEnded:Connect(endPan)
UserInputService.InputEnded:Connect(function(input)
	if pan.dragging and (input.UserInputType == Enum.UserInputType.MouseButton1
		or input.UserInputType == Enum.UserInputType.Touch) then endPan() end
end)

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  UPDATE                                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local function update(dt, nowMs)
	local fx = newEffects()
	dmg.stats = stats
	dmg.fx = fx

	local alive = {}
	for _, b in ipairs(balls) do
		dmg.ballLuck = BALLS[b.type].luckMul
		dmg.ballReveal = BALLS[b.type].revealBonus
		stepBall(world, b, dt, dmg)
		reach = max(reach, distFromSpawn(b.x / CELL, b.y / CELL))
		if not b.dead then alive[#alive + 1] = b end
	end
	balls = alive

	dmg.ballLuck = 1
	dmg.ballReveal = 0
	tickPoison(world, dt, dmg)

	if reload > 0 then reload = max(0, reload - dt) end

	for _, p in ipairs(fx.particles) do particles[#particles + 1] = p end
	for _, a in ipairs(fx.arcs) do arcs[#arcs + 1] = a end
	for _, t in ipairs(fx.texts) do texts[#texts + 1] = t end
	for _, f in ipairs(fx.blockFx) do
		f.life = (f.kind == "hit") and FX_HIT_LIFE or FX_BREAK_LIFE
		blockFx[#blockFx + 1] = f
	end
	if fx.shake > shake then shake = min(30, fx.shake) end
	if fx.brokenCount > 0 then broken += fx.brokenCount; miniDirty = true end
	if fx.tokensGained > 0 then state.tokens += fx.tokensGained; miniDirty = true end

	if fx.haptic > 0 then
		if fx.haptic == 1 then buzz(0.12, 0.03)
		elseif fx.haptic == 2 then buzz(0.22, 0.04)
		elseif fx.haptic == 3 then buzz(0.45, 0.07)
		else buzz(1, 0.35) end
	end

	-- First sighting of the golden block — loud, and it hands you the el.compass.
	if not world.goldenSighted and world.goldenIdx > 0
		and world.hp[world.goldenIdx] > 0 and world.seen[world.goldenIdx] ~= 0 then
		world.goldenSighted = true
		showBanner("GOLDEN BLOCK SIGHTED", 3.6, 2)
		buzz(0.7, 0.25)
		miniDirty = true
		save()
	end

	if fx.goldenBroken and not state.won then
		state.won = true
		el.winSub.Text = broken .. " blocks broken - " .. jsRound(reach)
			.. " blocks out - \u{25C6}" .. state.tokens .. " left over"
		el.win.Visible = true
		save()
	end

	local tier = tierOfDist(reach)
	if tier > maxTier then
		maxTier = tier
		showBanner("LAYER " .. (tier + 1) .. " - " .. TIERS[tier + 1].name:upper(), 2.6)
		buzz(0.3, 0.08)
	end

	for i = #blockFx, 1, -1 do
		blockFx[i].life -= dt
		if blockFx[i].life <= 0 then table.remove(blockFx, i) end
	end
	for i = #particles, 1, -1 do
		local p = particles[i]
		p.life -= dt
		if p.life <= 0 then
			table.remove(particles, i)
		else
			p.x += p.vx * dt; p.y += p.vy * dt
			p.vx *= 0.92; p.vy *= 0.92
		end
	end
	for i = #arcs, 1, -1 do
		arcs[i].life -= dt
		if arcs[i].life <= 0 then table.remove(arcs, i) end
	end
	for i = #texts, 1, -1 do
		texts[i].life -= dt
		texts[i].y -= 18 * dt
		if texts[i].life <= 0 then table.remove(texts, i) end
	end

	shake *= (0.0015 ^ dt)
	if shake < 0.15 then shake = 0 end

	-- Camera rides the ball swarm while it flies, else the player.
	local tx, ty = player.x, player.y
	if #balls > 0 then
		local sx, sy = 0, 0
		for _, b in ipairs(balls) do sx += b.x; sy += b.y end
		tx, ty = sx / #balls, sy / #balls
	end
	local k = 1 - exp(-7 * dt)
	cam.x += (tx - cam.x) * k
	cam.y += (ty - cam.y) * k

	local halfW, halfH = cssW / 2 / scale, cssH / 2 / scale
	cam.x = (halfW * 2 >= WORLD_W) and (WORLD_W / 2) or clamp(cam.x, halfW, WORLD_W - halfW)
	cam.y = (halfH * 2 >= WORLD_H) and (WORLD_H / 2) or clamp(cam.y, halfH, WORLD_H - halfH)
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  DRAW                                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local function draw(nowMs)
	local jx = (shake > 0) and (rng() - 0.5) * shake or 0
	local jy = (shake > 0) and (rng() - 0.5) * shake or 0
	local ox = cssW / 2 + (jx - cam.x) * scale
	local oy = cssH / 2 + (jy - cam.y) * scale
	local function sx(x) return ox + x * scale end
	local function sy(y) return oy + y * scale end

	local halfW, halfH = cssW / 2 / scale, cssH / 2 / scale
	local c0 = floor((cam.x - halfW) / CELL) - 1
	local r0 = floor((cam.y - halfH) / CELL) - 1
	local pulse = 0.55 + 0.45 * sin(nowMs / 260)

	--[[ Balls and the player carry their own light, so a shot lights its own
	     way through unlit rock. Collected fresh each frame — not baked in. ]]
	local moving = {}
	for _, b in ipairs(balls) do
		moving[#moving + 1] = {
			col = floor(b.x / CELL), row = floor(b.y / CELL),
			rgb = BALL_LIGHT[b.type] or BALL_LIGHT.basic, power = 3.2,
		}
	end
	moving[#moving + 1] = { col = player.col, row = player.row, rgb = PLAYER_LIGHT, power = 2.4 }

	buildLight(lightMap, world, c0, c0 + winW - 1, r0, r0 + winH - 1, moving)

	local bx, by = sx(c0 * CELL), sy(r0 * CELL)
	local bw, bh = winW * CELL * scale, winH * CELL * scale

	if blockImg then
		renderBlocks(world, lightMap, c0, r0, pulse)
		renderGlow(world, lightMap, c0, r0)
		blockLayer.Position = UDim2.fromOffset(bx, by)
		blockLayer.Size = UDim2.fromOffset(ceil(bw), ceil(bh))
		glowLayer.Position = blockLayer.Position
		glowLayer.Size = blockLayer.Size
	else
		renderBlocksFallback(world, lightMap, c0, r0, bx, by, CELL * scale)
	end

	-- ── Golden shine ──────────────────────────────────────────────────────
	--[[ The golden block's light already reaches through rock via the light
	     map; this is the bit that says "treasure". ]]
	local showGold = false
	if world.goldenIdx > 0 and world.hp[world.goldenIdx] > 0 then
		local gx = (icol(world.goldenIdx) + 0.5) * CELL
		local gy = (irow(world.goldenIdx) + 0.5) * CELL
		local dist = hypot(gx - cam.x, gy - cam.y) / CELL
		local reachOut = GOLDEN_AURA * 2.4
		if dist < reachOut then
			showGold = true
			local strength = max(0, 1 - dist / reachOut)
			local spin = nowMs / 900
			local gp = 0.65 + 0.35 * sin(nowMs / 220)
			local px, py = sx(gx), sy(gy)

			P.halo.Visible = true
			local rad = CELL * 3.4 * gp * scale
			P.halo.Position = UDim2.fromOffset(px, py)
			P.halo.Size = UDim2.fromOffset(rad * 2, rad * 2)
			P.halo.ImageTransparency = 1 - strength

			local arm = CELL * (1.5 + 0.45 * gp) * scale
			for i = 1, 2 do
				local f = P.arms[i]
				f.Visible = true
				f.Position = UDim2.fromOffset(px, py)
				f.Size = UDim2.fromOffset(max(1, arm * 2), max(1, 1.6 * scale))
				f.Rotation = math.deg(spin) + (i - 1) * 90
				f.BackgroundTransparency = 1 - 0.9 * strength
			end
		end
	end
	if not showGold then
		P.halo.Visible = false
		P.arms[1].Visible = false
		P.arms[2].Visible = false
	end

	-- ── Block impact animation ────────────────────────────────────────────
	--[[ Drawn over the block buffer rather than inside it: the buffer is one
	     pixel per cell, so anything that scales past a cell boundary has to be
	     its own pass. ]]
	P.bfxFill.reset(); P.bfxRing.reset()
	for _, f in ipairs(blockFx) do
		local x, y = f.col * CELL, f.row * CELL
		if f.kind == "hit" then
			-- A struck block flashes its own colour and snaps back.
			local t = 1 - f.life / FX_HIT_LIFE
			local k = 1 - t
			local g = t * 3
			local fill = P.bfxFill.get()
			setRect(fill, sx(x + CELL / 2), sy(y + CELL / 2),
				(CELL - g * 2) * scale, (CELL - g * 2) * scale, f.color, k * 0.85)

			local s = t * 7
			local ring = P.bfxRing.get()
			ring.Position = UDim2.fromOffset(sx(x + CELL / 2), sy(y + CELL / 2))
			ring.Size = UDim2.fromOffset((CELL + s * 2) * scale, (CELL + s * 2) * scale)
			local st = ringStroke(ring)
			st.Thickness = max(1, 1.5 * scale)
			st.Color = C3_WHITE
			st.Transparency = 1 - k * 0.5
		else
			-- break: the cell blows outward as a fading ring plus a bright core.
			local t = 1 - f.life / FX_BREAK_LIFE
			local k = 1 - t
			local ease = 1 - (1 - t) * (1 - t)
			local s = ease * CELL * 0.85

			local ring = P.bfxRing.get()
			ring.Position = UDim2.fromOffset(sx(x + CELL / 2), sy(y + CELL / 2))
			ring.Size = UDim2.fromOffset((CELL + s * 2) * scale, (CELL + s * 2) * scale)
			local st = ringStroke(ring)
			st.Thickness = max(1, (1 + k * 2.5) * scale)
			st.Color = f.color
			st.Transparency = 1 - k * 0.9

			local inset = ease * CELL * 0.5
			local fill = P.bfxFill.get()
			setRect(fill, sx(x + CELL / 2), sy(y + CELL / 2),
				max(0, CELL - inset * 2) * scale, max(0, CELL - inset * 2) * scale,
				C3_WHITE, k * k * 0.8)
		end
	end
	P.bfxFill.finish(); P.bfxRing.finish()

	-- ── Chain arcs ────────────────────────────────────────────────────────
	P.arc.reset()
	local BOLT = hexC3("#f7ef7a")
	for _, a in ipairs(arcs) do
		local alpha = min(1, a.life / 0.22)
		local x1, y1, x2, y2 = sx(a.x1), sy(a.y1), sx(a.x2), sy(a.y2)
		local segs = 6
		local dx, dy = (x2 - x1) / segs, (y2 - y1) / segs
		local nx, ny = -(y2 - y1), x2 - x1
		local len = hypot(nx, ny)
		if len == 0 then len = 1 end
		local px, py = x1, y1
		for i = 1, segs do
			local qx, qy
			if i < segs then
				local j = (rng() - 0.5) * 8 * scale
				qx = x1 + dx * i + (nx / len) * j
				qy = y1 + dy * i + (ny / len) * j
			else
				qx, qy = x2, y2
			end
			setLine(P.arc.get(), px, py, qx, qy, max(1, 1.6 * scale), BOLT, alpha)
			px, py = qx, qy
		end
	end
	P.arc.finish()

	-- ── Particles ─────────────────────────────────────────────────────────
	P.part.reset()
	for _, p in ipairs(particles) do
		setRect(P.part.get(), sx(p.x), sy(p.y), 3 * scale, 3 * scale,
			p.color, max(0, p.life / p.max))
	end
	P.part.finish()

	-- ── Balls ─────────────────────────────────────────────────────────────
	P.trail.reset(); P.ball.reset()
	for _, b in ipairs(balls) do
		local col = hexC3(BALLS[b.type].color)
		local t = b.trail
		-- Trail: a short comet streak that thins toward the tail.
		local n = #t
		for i = 1, n - 2, 2 do
			local k = (i - 1) / max(2, n - 2)
			local s = (1.2 + k * 2.2) * scale
			setRect(P.trail.get(), sx(t[i]), sy(t[i + 1]), s, s, col, k * 0.55)
		end
		local dot = P.ball.get()
		setRect(dot, sx(b.x), sy(b.y), 6.8 * scale, 6.8 * scale, col, 1)
		if not dot:FindFirstChildOfClass("UICorner") then
			mk("UICorner", { CornerRadius = UDim.new(0.5, 0) }, dot)
		end
	end
	P.trail.finish(); P.ball.finish()

	-- ── Aim line ──────────────────────────────────────────────────────────
	P.aim.reset()
	if aim.active and aim.power > 0.06 then
		local loaded = reload <= 0
		local dots = jsRound(6 + aim.power * 12)
		local col = loaded and accentC3 or C3_WHITE
		for i = 1, dots do
			local d = 10 + i * 9
			local alpha = loaded and (1 - i / (dots + 3)) or 0.3
			setRect(P.aim.get(),
				sx(player.x + cos(aim.angle) * d), sy(player.y + sin(aim.angle) * d),
				3 * scale, 3 * scale, col, alpha)
		end
	end
	P.aim.finish()

	-- ── Player ────────────────────────────────────────────────────────────
	-- A small hollow triangle aimed wherever the next shot goes.
	P.player.reset()
	do
		local pts = { { 6.5, 0 }, { -4.5, -5.2 }, { -4.5, 5.2 } }
		local ca, sa = cos(aim.angle), sin(aim.angle)
		local ptx, pty = {}, {}
		for i, p in ipairs(pts) do
			ptx[i] = sx(player.x + p[1] * ca - p[2] * sa)
			pty[i] = sy(player.y + p[1] * sa + p[2] * ca)
		end
		for i = 1, 3 do
			local j = i % 3 + 1
			setLine(P.player.get(), ptx[i], pty[i], ptx[j], pty[j],
				max(1, 1.7 * scale), accentC3, 1)
		end
	end
	P.player.finish()

	-- ── Floating text ─────────────────────────────────────────────────────
	P.text.reset()
	for _, t in ipairs(texts) do
		local l = P.text.get()
		l.Text = t.text
		l.TextSize = max(8, jsRound(9 * scale))
		l.TextColor3 = t.color
		l.TextTransparency = 1 - min(1, t.life)
		l.Size = UDim2.fromOffset(S(80), S(20))
		l.Position = UDim2.fromOffset(sx(t.x), sy(t.y))
	end
	P.text.finish()
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  LOOP                                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local hudTimer = 0
local crashed = false

local function showCrash(msg)
	if crashed then return end
	crashed = true
	warn("[BlindShot] " .. tostring(msg))
	local box = mk("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(560, 200),
		BackgroundColor3 = Color3.new(0, 0, 0),
		BorderSizePixel = 0,
		ZIndex = 900,
	}, root)
	mk("UIStroke", { Thickness = 3, Color = Color3.fromRGB(239, 68, 68) }, box)
	label(box, "BLINDSHOT ERROR\n\n" .. tostring(msg), 12, Color3.fromRGB(255, 200, 200), {
		Position = UDim2.fromOffset(14, 14),
		Size = UDim2.new(1, -28, 1, -28),
		TextWrapped = true, ZIndex = 901,
	})
end

local function frame(dt)
	if crashed then return end
	dt = min(0.05, dt)
	local nowMs = os.clock() * 1000

	resize()
	stepAccent(dt)
	stepKeyboardWalk(dt)
	if not paused() then update(dt, nowMs) end
	draw(nowMs)

	hudTimer += dt
	if hudTimer > 0.1 then hudTimer = 0; syncHud() end

	miniTimer += dt
	if state.mapOn and (miniDirty or miniTimer > 0.2) then
		miniDirty = false
		miniTimer = 0
		drawMini()
	end

	if bannerTimer > 0 then
		bannerTimer -= dt
		if bannerTimer <= 0 then el.banner.Visible = false; bannerRank = 0 end
	end
end

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  BOOT                                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

local booted, bootErr = pcall(function()
	resize()
	startWorld(floor(rng() * 0xffffffff))
	buildTree()
	buildChips()
	syncTree()
	syncHud(true)
	refreshAccent()
	stepAccent(1)

	el.vibBtn.Text = state.vibeOn and "VIB" or "VIB\u{2715}"
	el.miniWrap.Visible = state.mapOn
end)

if not booted then
	showCrash(bootErr)
else
	root:GetPropertyChangedSignal("AbsoluteSize"):Connect(resize)
	RunService.RenderStepped:Connect(function(dt)
		local fine, ferr = pcall(frame, dt)
		if not fine then showCrash(ferr) end
	end)
	print(string.format(
		"[BlindShot] running - %dx%d grid, %dx%d cell window, EditableImage=%s",
		GRID_W, GRID_H, winW, winH, tostring(blockImg ~= nil)))
end
