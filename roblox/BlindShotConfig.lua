--!strict
--[[
	BlindShot — portable game data, Roblox Luau mirror.

	This is a 1:1 port of `app/blindshot/config.ts`. Keep the two in sync when
	tuning: the web build and the Roblox build should look and play identically,
	so all balance numbers, colours and tech-tree topology live here rather than
	being scattered through gameplay code.

	Nothing in this module touches Roblox services, so it is safe to require
	from the server, a client, or a plugin.

	Coordinate convention matches the web build: `col` runs left→right, `row`
	runs top→bottom. When you map this onto a 3D Roblox world, row becomes -Y.

	Difficulty is radial, not vertical: tiers are rings measured from the run's
	spawn point, so neither axis is "the deep end" on its own.
]]

local Config = {}

-- ─── World ───────────────────────────────────────────────────────────────────

Config.GRID_W = 100
Config.GRID_H = 100
--- Studs per block. Blocks are square.
Config.CELL = 16

--- The spawn is rolled per-run from the seed, in one of the four corners: each
--- axis lands within this many blocks of its near or far edge.
Config.SPAWN_INSET_MIN = 6
Config.SPAWN_INSET_MAX = 18
--- Radius (in blocks) of the pre-carved starting chamber.
Config.START_CHAMBER = 3

--- Solid, indestructible frame so balls can never leave the map.
Config.BEDROCK_HP = 32000

-- ─── Layers ──────────────────────────────────────────────────────────────────

export type Tier = {
	name: string,
	--- Base durability of a block in this tier. Each block rolls ±30%.
	hp: number,
	color: Color3,
}

--- 8 tiers as rings around the spawn point. Layer 1 is whatever you spawned in,
--- so there is no such thing as a spawn you cannot dig out of.
Config.TIERS: { Tier } = {
	{ name = "Crust", hp = 3, color = Color3.fromHex("#9aa4a8") },
	{ name = "Moss", hp = 6, color = Color3.fromHex("#4ea85c") },
	{ name = "Clay", hp = 11, color = Color3.fromHex("#b5a72f") },
	{ name = "Rust", hp = 19, color = Color3.fromHex("#c2703a") },
	{ name = "Ember", hp = 32, color = Color3.fromHex("#c1402f") },
	{ name = "Slate", hp = 52, color = Color3.fromHex("#6c6f7a") },
	{ name = "Void", hp = 84, color = Color3.fromHex("#7a3fb5") },
	{ name = "Core", hp = 130, color = Color3.fromHex("#c22fa8") },
}

--- Blocks of straight-line distance from spawn per tier step.
Config.LAYER_RADIUS = 12

function Config.distFrom(col: number, row: number, fromCol: number, fromRow: number): number
	local dc, dr = col - fromCol, row - fromRow
	return math.sqrt(dc * dc + dr * dr)
end

--- 1-based tier index for a distance from spawn, in blocks. This is also the
--- layer number the HUD shows: layer 1 is the spawn chamber.
function Config.tierOfDist(dist: number): number
	local t = math.floor(dist / Config.LAYER_RADIUS) + 1
	return math.clamp(t, 1, #Config.TIERS)
end

-- ─── Block kinds ─────────────────────────────────────────────────────────────

Config.KIND_ROCK = 0
Config.KIND_TOKEN = 1
Config.KIND_GOLDEN = 2
Config.KIND_BEDROCK = 3

--- 1 in N solid blocks hides an upgrade token, before luck bonuses. Tuned so
--- the first token shows up within the opening few shots.
Config.TOKEN_RARITY = 18
--- The golden block only ever spawns in this ring around the spawn point,
--- measured in blocks — layers 6 through 8.
Config.GOLDEN_DIST_MIN = 70
Config.GOLDEN_DIST_MAX = 90
Config.GOLDEN_HP = 40

--- Outer tokens are worth more, so income does not dry up where rock is hardest.
function Config.tokenValue(dist: number, luck: number, ballLuck: number): number
	local layerBonus = 1 + (Config.tierOfDist(dist) - 1) * 0.35
	return math.max(1, math.round(luck * ballLuck * layerBonus))
end

-- ─── Palette ─────────────────────────────────────────────────────────────────

Config.PALETTE = {
	bg = Color3.fromHex("#04160c"),
	unseen = Color3.fromHex("#000000"),
	player = Color3.fromHex("#e8a33d"),
	aim = Color3.fromHex("#ffffff"),
	token = Color3.fromHex("#ffffff"),
	golden = Color3.fromHex("#ffd23d"),
	hud = Color3.fromHex("#4ade80"),
}

Config.BRANCH_COLORS = {
	red = Color3.fromHex("#ef4444"),
	orange = Color3.fromHex("#f97316"),
	yellow = Color3.fromHex("#eab308"),
	green = Color3.fromHex("#22c55e"),
	blue = Color3.fromHex("#38bdf8"),
	magenta = Color3.fromHex("#e935c8"),
}

-- ─── Balls ───────────────────────────────────────────────────────────────────

export type BallDef = {
	id: string,
	name: string,
	branch: string,
	color: Color3,
	desc: string,
	damageMul: number,
	splashBonus: number,
	pierce: boolean,
	chains: boolean,
	poisons: boolean,
	revealBonus: number,
	luckMul: number,
	speedMul: number,
	bounceBonus: number,
}

Config.BALLS: { [string]: BallDef } = {
	basic = {
		id = "basic", name = "Iron ball", branch = "orange", color = Color3.fromHex("#f2a65a"),
		desc = "No tricks. Ricochets hard and hits reliably.",
		damageMul = 1, splashBonus = 0, pierce = false, chains = false, poisons = false,
		revealBonus = 0, luckMul = 1, speedMul = 1, bounceBonus = 2,
	},
	bomb = {
		id = "bomb", name = "Bomb ball", branch = "orange", color = Color3.fromHex("#fb7a1e"),
		desc = "Detonates on every bounce. Huge splash, slower flight.",
		damageMul = 0.85, splashBonus = 2, pierce = false, chains = false, poisons = false,
		revealBonus = 0, luckMul = 1, speedMul = 0.85, bounceBonus = 0,
	},
	lightning = {
		id = "lightning", name = "Storm ball", branch = "yellow", color = Color3.fromHex("#f4e04d"),
		desc = "Arcs to nearby blocks on every hit. Fast, and it bounces forever.",
		damageMul = 0.8, splashBonus = 0, pierce = false, chains = true, poisons = false,
		revealBonus = 1, luckMul = 1, speedMul = 1.25, bounceBonus = 5,
	},
	poison = {
		id = "poison", name = "Poison ball", branch = "green", color = Color3.fromHex("#3ddc61"),
		desc = "Rots blocks over time. Weak up front, brutal if you wait.",
		damageMul = 0.6, splashBonus = 1, pierce = false, chains = false, poisons = true,
		revealBonus = 0, luckMul = 1, speedMul = 1, bounceBonus = 2,
	},
	ghost = {
		id = "ghost", name = "Ghost ball", branch = "blue", color = Color3.fromHex("#5ad1f5"),
		desc = "The only ball that tunnels instead of bouncing. Dies fast.",
		damageMul = 0.7, splashBonus = 0, pierce = true, chains = false, poisons = false,
		revealBonus = 1, luckMul = 1, speedMul = 1.15, bounceBonus = 0,
	},
	lure = {
		id = "lure", name = "Lure ball", branch = "magenta", color = Color3.fromHex("#f45ce0"),
		desc = "Lights up the dark and shakes tokens loose.",
		damageMul = 0.75, splashBonus = 0, pierce = false, chains = false, poisons = false,
		revealBonus = 4, luckMul = 2.5, speedMul = 0.95, bounceBonus = 3,
	},
}

--- Order shown in the ball picker.
Config.BALL_ORDER = { "basic", "bomb", "lightning", "poison", "ghost", "lure" }

-- ─── Player stats ────────────────────────────────────────────────────────────

export type Stats = {
	damage: number,
	damageMul: number,
	splashRadius: number,
	splashFactor: number,
	projectiles: number,
	spreadAngle: number,
	bounces: number,
	speed: number,
	lifetime: number,
	reload: number,
	chainTargets: number,
	chainRange: number,
	chainDamage: number,
	poisonBase: number,
	poisonDps: number,
	poisonTime: number,
	poisonSpread: number,
	revealRadius: number,
	luck: number,
	compass: number,
}

function Config.baseStats(): Stats
	return {
		damage = 9,
		damageMul = 1,
		splashRadius = 0,
		splashFactor = 0,
		projectiles = 1,
		spreadAngle = 0.16,
		-- Generous bounce budget: a shot fired from inside an already-carved
		-- cave still has to cross open space before it reaches fresh rock.
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
		--- Generations of onward infection. 0 = rot never leaves the block it killed.
		poisonSpread = 0,
		revealRadius = 2.6,
		luck = 1,
		compass = 0,
	}
end

-- ─── Tech tree ───────────────────────────────────────────────────────────────

export type TechNode = {
	id: string,
	name: string,
	desc: string,
	branch: string,
	--- Grid position in the tree graph. Core sits at (0, 0).
	col: number,
	row: number,
	cost: number,
	requires: { string },
	icon: string,
	--- "circle" nodes unlock a ball or ability; "square" nodes are passive stats.
	shape: string,
	unlocksBall: string?,
	apply: (Stats) -> (),
}

Config.TECH: { TechNode } = {
	{
		id = "core", name = "Slingshot", desc = "Pull back, let go, listen for the crack.",
		branch = "green", col = 0, row = 0, cost = 0, requires = {}, icon = "core", shape = "circle",
		apply = function(_s) end,
	},

	-- ── RED · Force ──────────────────────────────────────────────────────────
	{
		id = "r1", name = "Honed Tip", desc = "+3 damage on every impact.",
		branch = "red", col = -1, row = 0, cost = 1, requires = { "core" }, icon = "sword", shape = "square",
		apply = function(s) s.damage += 3 end,
	},
	{
		id = "r2", name = "Heavy Shot", desc = "+6 damage. The ball hits like a hammer.",
		branch = "red", col = -2, row = 0, cost = 2, requires = { "r1" }, icon = "sword", shape = "square",
		apply = function(s) s.damage += 6 end,
	},
	{
		id = "r3", name = "Crushing Blow", desc = "+10 damage.",
		branch = "red", col = -3, row = 0, cost = 4, requires = { "r2" }, icon = "sword", shape = "square",
		apply = function(s) s.damage += 10 end,
	},
	{
		id = "r4", name = "Fracture", desc = "All damage multiplied by 1.35.",
		branch = "red", col = -3, row = -1, cost = 5, requires = { "r3" }, icon = "spread", shape = "square",
		apply = function(s) s.damageMul *= 1.35 end,
	},
	{
		id = "r5", name = "Overload", desc = "+18 damage, but shots fly 15% slower.",
		branch = "red", col = -4, row = 0, cost = 7, requires = { "r3" }, icon = "sword", shape = "square",
		apply = function(s) s.damage += 18 s.speed *= 0.85 end,
	},

	-- ── ORANGE · Impact ──────────────────────────────────────────────────────
	{
		id = "o1", name = "Shockwave", desc = "Impacts spill 40% damage into neighbours.",
		branch = "orange", col = -1, row = -1, cost = 1, requires = { "core" }, icon = "comet", shape = "square",
		apply = function(s) s.splashRadius = math.max(s.splashRadius, 1) s.splashFactor += 0.4 end,
	},
	{
		id = "o2", name = "Blast Ring", desc = "Splash reaches 2 blocks out.",
		branch = "orange", col = -2, row = -2, cost = 2, requires = { "o1" }, icon = "comet", shape = "square",
		apply = function(s) s.splashRadius = math.max(s.splashRadius, 2) s.splashFactor += 0.05 end,
	},
	{
		id = "o3", name = "Detonator", desc = "Unlocks the Bomb ball.",
		branch = "orange", col = -3, row = -2, cost = 4, requires = { "o2" }, icon = "ball", shape = "circle",
		unlocksBall = "bomb", apply = function(_s) end,
	},
	{
		id = "o4", name = "Concussion", desc = "Splash damage +25%.",
		branch = "orange", col = -2, row = -3, cost = 5, requires = { "o2" }, icon = "spread", shape = "square",
		apply = function(s) s.splashFactor += 0.25 end,
	},
	{
		id = "o5", name = "Cataclysm", desc = "Splash radius +1 and splash damage +30%.",
		branch = "orange", col = -4, row = -2, cost = 7, requires = { "o3" }, icon = "comet", shape = "square",
		apply = function(s) s.splashRadius += 1 s.splashFactor += 0.3 end,
	},

	-- ── YELLOW · Storm ───────────────────────────────────────────────────────
	{
		id = "y1", name = "Static", desc = "Cooldown 18% shorter.",
		branch = "yellow", col = 0, row = -1, cost = 1, requires = { "core" }, icon = "clock", shape = "square",
		apply = function(s) s.reload *= 0.82 end,
	},
	{
		id = "y2", name = "Arc", desc = "Unlocks the Storm ball.",
		branch = "yellow", col = 0, row = -2, cost = 2, requires = { "y1" }, icon = "ball", shape = "circle",
		unlocksBall = "lightning", apply = function(_s) end,
	},
	{
		id = "y3", name = "Conductor", desc = "Lightning hits +1 block and deals 20% more.",
		branch = "yellow", col = 0, row = -3, cost = 4, requires = { "y2" }, icon = "bolt", shape = "square",
		apply = function(s) s.chainTargets += 1 s.chainDamage += 0.2 end,
	},
	{
		id = "y4", name = "Quickdraw", desc = "Cooldown 28% shorter.",
		branch = "yellow", col = -1, row = -3, cost = 5, requires = { "y3" }, icon = "clock", shape = "square",
		apply = function(s) s.reload *= 0.72 end,
	},
	{
		id = "y5", name = "Tempest", desc = "Lightning hits +2 blocks at 50% more range.",
		branch = "yellow", col = 0, row = -4, cost = 7, requires = { "y3" }, icon = "bolt", shape = "square",
		apply = function(s) s.chainTargets += 2 s.chainRange *= 1.5 end,
	},

	{
		id = "y6", name = "Overclock", desc = "Cooldown 30% shorter. Roughly 2 seconds a shot.",
		branch = "yellow", col = -1, row = -4, cost = 9, requires = { "y4" }, icon = "clock", shape = "square",
		apply = function(s) s.reload *= 0.7 end,
	},

	-- ── GREEN · Toxin ────────────────────────────────────────────────────────
	{
		id = "g1", name = "Blight", desc = "Every impact leaves a weak rot behind.",
		branch = "green", col = 1, row = -1, cost = 1, requires = { "core" }, icon = "skull", shape = "square",
		apply = function(s) s.poisonBase += 1 end,
	},
	{
		id = "g2", name = "Poison Ball", desc = "Unlocks the Poison ball.",
		branch = "green", col = 2, row = -2, cost = 2, requires = { "g1" }, icon = "ball", shape = "circle",
		unlocksBall = "poison", apply = function(_s) end,
	},
	{
		id = "g3", name = "Virulence", desc = "Poison ticks for double damage.",
		branch = "green", col = 3, row = -2, cost = 4, requires = { "g2" }, icon = "skull", shape = "square",
		apply = function(s) s.poisonDps *= 2 end,
	},
	{
		id = "g4", name = "Contagion", desc = "Rot creeps 1 block onward from each block it kills, then stops.",
		branch = "green", col = 2, row = -3, cost = 5, requires = { "g2" }, icon = "spread", shape = "square",
		apply = function(s) s.poisonSpread = math.max(s.poisonSpread, 1) end,
	},
	{
		id = "g5", name = "Necrosis", desc = "Poison lasts twice as long.",
		branch = "green", col = 4, row = -2, cost = 7, requires = { "g3" }, icon = "skull", shape = "square",
		apply = function(s) s.poisonTime *= 2 end,
	},

	{
		id = "g6", name = "Pandemic", desc = "Rot creeps 2 more blocks onward before it burns out.",
		branch = "green", col = 3, row = -3, cost = 9, requires = { "g4" }, icon = "spread", shape = "square",
		apply = function(s) s.poisonSpread += 2 end,
	},

	-- ── BLUE · Velocity ──────────────────────────────────────────────────────
	{
		id = "b1", name = "Slick", desc = "Shots travel 20% faster.",
		branch = "blue", col = 1, row = 0, cost = 1, requires = { "core" }, icon = "comet", shape = "square",
		apply = function(s) s.speed *= 1.2 end,
	},
	{
		id = "b2", name = "Ricochet", desc = "+8 bounces and +3s of flight.",
		branch = "blue", col = 2, row = 0, cost = 2, requires = { "b1" }, icon = "comet", shape = "square",
		apply = function(s) s.bounces += 8 s.lifetime += 3 end,
	},
	{
		id = "b3", name = "Phase", desc = "Unlocks the Ghost ball.",
		branch = "blue", col = 3, row = 0, cost = 4, requires = { "b2" }, icon = "ball", shape = "circle",
		unlocksBall = "ghost", apply = function(_s) end,
	},
	{
		id = "b4", name = "Split Shot", desc = "Fire 2 balls per pull.",
		branch = "blue", col = 3, row = 1, cost = 5, requires = { "b2" }, icon = "spread", shape = "square",
		apply = function(s) s.projectiles += 1 end,
	},
	{
		id = "b5", name = "Volley", desc = "Fire 2 more balls, in a wider fan.",
		branch = "blue", col = 4, row = 0, cost = 7, requires = { "b3" }, icon = "spread", shape = "square",
		apply = function(s) s.projectiles += 2 s.spreadAngle *= 1.25 end,
	},

	-- ── MAGENTA · Fortune ────────────────────────────────────────────────────
	{
		id = "m1", name = "Prospector", desc = "Tokens turn up 50% more often.",
		branch = "magenta", col = 0, row = 1, cost = 1, requires = { "core" }, icon = "radar", shape = "square",
		apply = function(s) s.luck += 0.5 end,
	},
	{
		id = "m2", name = "Lure Ball", desc = "Unlocks the Lure ball.",
		branch = "magenta", col = 0, row = 2, cost = 2, requires = { "m1" }, icon = "ball", shape = "circle",
		unlocksBall = "lure", apply = function(_s) end,
	},
	{
		id = "m3", name = "Deep Sight", desc = "You see 2 blocks further into the dark.",
		branch = "magenta", col = 0, row = 3, cost = 4, requires = { "m2" }, icon = "radar", shape = "square",
		apply = function(s) s.revealRadius += 2 end,
	},
	{
		id = "m4", name = "Golden Sense", desc = "A compass finds the golden block within 25 blocks.",
		branch = "magenta", col = -1, row = 2, cost = 5, requires = { "m2" }, icon = "flag", shape = "circle",
		apply = function(s) s.compass = math.max(s.compass, 25) end,
	},
	{
		id = "m5", name = "Midas Touch", desc = "Tokens +100%, and the compass never sleeps.",
		branch = "magenta", col = 1, row = 3, cost = 7, requires = { "m3" }, icon = "flag", shape = "circle",
		apply = function(s) s.luck += 1 s.compass = 9999 end,
	},
}

Config.TECH_BY_ID = {} :: { [string]: TechNode }
for _, node in Config.TECH do
	Config.TECH_BY_ID[node.id] = node
end

--- Rebuild the full stat block from a set of unlocked node ids.
function Config.statsFor(unlocked: { [string]: boolean }): Stats
	local s = Config.baseStats()
	for id, owned in unlocked do
		if owned then
			local node = Config.TECH_BY_ID[id]
			if node then
				node.apply(s)
			end
		end
	end
	return s
end

--- Which ball types a set of unlocked nodes gives access to, in picker order.
function Config.ballsFor(unlocked: { [string]: boolean }): { string }
	local have = { basic = true }
	for id, owned in unlocked do
		if owned then
			local node = Config.TECH_BY_ID[id]
			if node and node.unlocksBall then
				have[node.unlocksBall] = true
			end
		end
	end
	local out = {}
	for _, id in Config.BALL_ORDER do
		if have[id] then
			table.insert(out, id)
		end
	end
	return out
end

-- ─── Seeded RNG (mulberry32) ─────────────────────────────────────────────────

--- 32-bit multiply with wraparound — the equivalent of JavaScript's `Math.imul`.
--- A plain `a * b` would overflow a double's 53-bit mantissa and silently drop
--- the low bits, which is exactly the half the hash depends on, so the operands
--- are split into 16-bit halves and recombined mod 2^32.
local function imul(a: number, b: number): number
	a = bit32.band(a, 0xffffffff)
	b = bit32.band(b, 0xffffffff)
	local al = bit32.band(a, 0xffff)
	local ah = bit32.rshift(a, 16)
	local bl = bit32.band(b, 0xffff)
	local bh = bit32.rshift(b, 16)
	-- The ah*bh term only lands above bit 31, so it drops out entirely.
	local mid = bit32.band(ah * bl + al * bh, 0xffff)
	return bit32.band(bit32.lshift(mid, 16) + al * bl, 0xffffffff)
end

--- mulberry32, matching the web build exactly, so the same seed generates the
--- same map on both platforms.
function Config.makeRng(seed: number): () -> number
	local a = bit32.band(seed, 0xffffffff)
	return function(): number
		a = bit32.band(a + 0x6d2b79f5, 0xffffffff)
		local t = a
		t = imul(bit32.bxor(t, bit32.rshift(t, 15)), bit32.bor(t, 1))
		t = bit32.bxor(t, bit32.band(t + imul(bit32.bxor(t, bit32.rshift(t, 7)), bit32.bor(t, 61)), 0xffffffff))
		return bit32.bxor(t, bit32.rshift(t, 14)) / 4294967296
	end
end

return Config
