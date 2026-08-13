--[[ BlindShot Configuration - Roblox Version
Place this as a ModuleScript in: StarterPlayer > StarterPlayerScripts > Config
]]

local Config = {}

Config.GRID_W = 1024
Config.GRID_H = 512
Config.CELLS = Config.GRID_W * Config.GRID_H
Config.CELL = 16

Config.START_COL = 512
Config.START_ROW = 256
Config.GOLDEN_DIST_MIN = 120
Config.GOLDEN_DIST_MAX = 180

Config.KIND_SOLID = 0
Config.KIND_TOKEN = 1
Config.KIND_GOLDEN = 2
Config.KIND_BEDROCK = 3

Config.BLOCKS = {
	{ color = "#d4af91" }, { color = "#c99c7c" }, { color = "#d9ad7c" },
	{ color = "#c0956b" }, { color = "#e5b87e" }, { color = "#d4956d" },
	{ color = "#c89968" }, { color = "#dea66b" }, { color = "#d19870" },
	{ color = "#c9a077" }, { color = "#daa869" }, { color = "#cc9c6a" },
	{ color = "#d9a97a" },
}

Config.BLOCK_TOKEN = { color = "#f9f9f9" }
Config.BLOCK_GOLDEN = { color = "#ffd23d" }
Config.BLOCK_BEDROCK = { color = "#333333" }

function Config.hpAtDist(dist)
	local baseHp = math.max(1, 1 + dist * 0.8 + (dist * dist) * 0.015)
	return math.floor(baseHp)
end

Config.TOKEN_RARITY = 50
Config.MOVE_SPEED = 448
Config.MOVE_ACCEL = 8
Config.MOVE_DECEL = 4.5
Config.PLAYER_RADIUS = 5.2

Config.MAX_PULL = 120

Config.LIGHT_AMBIENT = 0.15
Config.LIGHT_RANGE = 18
Config.LIGHT_FALLOFF = 0.08
Config.TOKEN_LIGHT = 30
Config.GOLDEN_AURA = 20

Config.PALETTE = {
	hud = "#f9a12e",
	unseen = "#0a0808",
	bg = "#0a0808",
	branch = {
		orange = "#f2a65a",
		yellow = "#f4e04d",
		green = "#3ddc61",
		blue = "#5ad1f5",
		magenta = "#f45ce0",
		red = "#e85959",
	}
}

Config.BALLS = {
	basic = {
		name = "Iron ball",
		color = "#daa8db",
		speed = 200,
		damage = 1,
		lifetime = 5,
		luckMul = 1,
		revealBonus = 0,
		desc = "A heavy iron ball."
	},
	bomb = {
		name = "Bomb ball",
		color = "#fb7a1e",
		speed = 180,
		damage = 2,
		lifetime = 6,
		splashRadius = 3,
		splashFactor = 0.6,
		luckMul = 1.1,
		revealBonus = 0,
		desc = "Explodes in a radius."
	},
}

Config.BALL_ORDER = {"basic", "bomb"}

Config.TECH = {
	{ id = "core", name = "Slingshot", branch = "orange", icon = "core", col = 0, row = 0, cost = 0, requires = {}, unlocksBall = nil },
	{ id = "r1", name = "Steady", branch = "red", icon = "sword", col = 1, row = -1, cost = 1, requires = {"core"}, unlocksBall = nil },
	{ id = "o3", name = "Detonator", branch = "orange", icon = "comet", col = 2, row = 0, cost = 2, requires = {"core"}, unlocksBall = "bomb" },
}

Config.TECH_BY_ID = {}
for _, tech in ipairs(Config.TECH) do
	Config.TECH_BY_ID[tech.id] = tech
end

Config.BASE_STATS = {
	speed = 200,
	damage = 1,
	damageMul = 1,
	reload = 0.8,
	lifetime = 5,
	ballCount = 1,
	splashFactor = 0,
	luck = 1,
	chainDamage = 0,
	poisonTime = 0,
	compass = 0,
}

return Config
