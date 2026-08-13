--[[ BlindShot Game Engine - Roblox Version
Place this as a ModuleScript in: StarterPlayer > StarterPlayerScripts > Engine
]]

local Config = require(script.Parent:WaitForChild("Config"))
local Engine = {}

local function noise2D(x, y, seed)
	local n = math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453
	return n - math.floor(n)
end

function Engine.genWorld(seed)
	local world = {
		seed = seed,
		spawnCol = Config.START_COL,
		spawnRow = Config.START_ROW,
		hp = {},
		hue = {},
		kind = {},
		shade = {},
		seen = {},
		poisonT = {},
		maxHp = {},
		goldenIdx = -1,
		goldenSighted = false,
	}

	for i = 1, Config.CELLS do
		world.hp[i] = 0
		world.hue[i] = 1
		world.kind[i] = Config.KIND_SOLID
		world.shade[i] = 128
		world.seen[i] = 0
		world.poisonT[i] = 0
		world.maxHp[i] = 0
	end

	local rng = seed
	local function nextRng()
		rng = (rng * 1103515245 + 12345) % (2^31)
		return rng / (2^31)
	end

	for row = 0, Config.GRID_H - 1 do
		for col = 0, Config.GRID_W - 1 do
			local i = row * Config.GRID_W + col

			local dc = col - Config.START_COL
			local dr = row - Config.START_ROW
			local dist = math.sqrt(dc * dc + dr * dr)

			if col == 0 or col == Config.GRID_W - 1 or row == 0 or row == Config.GRID_H - 1 then
				world.kind[i] = Config.KIND_BEDROCK
				world.hp[i] = 9999
				world.maxHp[i] = 9999
				world.hue[i] = 0
				goto continue
			end

			if dist < 8 then
				world.hp[i] = 0
				world.seen[i] = 1
				goto continue
			end

			if dist > 250 then
				world.hp[i] = 0
				goto continue
			end

			local n = noise2D(col * 0.1, row * 0.1, seed)
			local threshold = 0.5 + dist / 500

			if n < threshold then
				world.hp[i] = 0
				goto continue
			end

			local baseHp = Config.hpAtDist(dist)
			world.hp[i] = math.max(1, math.floor(baseHp * (0.75 + nextRng() * 0.55)))
			world.maxHp[i] = world.hp[i]
			world.hue[i] = (math.floor(dist / 8) % #Config.BLOCKS) + 1
			world.shade[i] = 128 + math.floor((nextRng() - 0.5) * 80)

			if nextRng() < (1 / Config.TOKEN_RARITY) then
				world.kind[i] = Config.KIND_TOKEN
				world.hp[i] = 1
				world.maxHp[i] = 1
			end

			if dist >= Config.GOLDEN_DIST_MIN and dist <= Config.GOLDEN_DIST_MAX and
			   world.goldenIdx == -1 and nextRng() < 0.001 then
				world.kind[i] = Config.KIND_GOLDEN
				world.hp[i] = math.max(30, math.floor(Config.hpAtDist(dist) * 3))
				world.maxHp[i] = world.hp[i]
				world.goldenIdx = i
			end

			::continue::
		end
	end

	return world
end

function Engine.distFrom(c1, r1, c2, r2)
	local dc = c1 - c2
	local dr = r1 - r2
	return math.sqrt(dc * dc + dr * dr)
end

function Engine.blockedAt(world, x, y, radius)
	local l = math.floor((x - radius) / Config.CELL)
	local r = math.floor((x + radius) / Config.CELL)
	local t = math.floor((y - radius) / Config.CELL)
	local b = math.floor((y + radius) / Config.CELL)

	local function solidAt(c, row)
		if c < 0 or c >= Config.GRID_W or row < 0 or row >= Config.GRID_H then
			return true
		end
		local i = row * Config.GRID_W + c
		return world.hp[i] > 0
	end

	return solidAt(l, t) or solidAt(r, t) or solidAt(l, b) or solidAt(r, b)
end

function Engine.stepPlayer(player, world, dt)
	local tvx = player.ix * Config.MOVE_SPEED
	local tvy = player.iy * Config.MOVE_SPEED
	local moving = (player.ix ~= 0 or player.iy ~= 0)
	local k = 1 - math.exp(-(moving and Config.MOVE_ACCEL or Config.MOVE_DECEL) * dt)

	player.vx = player.vx + (tvx - player.vx) * k
	player.vy = player.vy + (tvy - player.vy) * k

	if not moving and math.sqrt(player.vx * player.vx + player.vy * player.vy) < 1 then
		player.vx = 0
		player.vy = 0
	end

	if player.vx == 0 and player.vy == 0 then return end

	local nx = player.x + player.vx * dt
	if not Engine.blockedAt(world, nx, player.y, Config.PLAYER_RADIUS) then
		player.x = nx
	else
		local col = math.floor((nx + (player.vx > 0 and 1 or -1) * Config.PLAYER_RADIUS) / Config.CELL)
		player.x = player.vx > 0 and col * Config.CELL - Config.PLAYER_RADIUS - 0.01 or (col + 1) * Config.CELL + Config.PLAYER_RADIUS + 0.01
		player.vx = 0
	end

	local ny = player.y + player.vy * dt
	if not Engine.blockedAt(world, player.x, ny, Config.PLAYER_RADIUS) then
		player.y = ny
	else
		local row = math.floor((ny + (player.vy > 0 and 1 or -1) * Config.PLAYER_RADIUS) / Config.CELL)
		player.y = player.vy > 0 and row * Config.CELL - Config.PLAYER_RADIUS - 0.01 or (row + 1) * Config.CELL + Config.PLAYER_RADIUS + 0.01
		player.vy = 0
	end

	player.col = math.floor(player.x / Config.CELL)
	player.row = math.floor(player.y / Config.CELL)
end

function Engine.breakBlock(world, col, row)
	if col < 0 or col >= Config.GRID_W or row < 0 or row >= Config.GRID_H then
		return 0
	end
	local i = row * Config.GRID_W + col
	if world.hp[i] <= 0 then return 0 end

	world.hp[i] = 0
	world.seen[i] = 1
	return 1
end

function Engine.damageBlock(world, col, row, damage)
	if col < 0 or col >= Config.GRID_W or row < 0 or row >= Config.GRID_H then
		return 0
	end
	local i = row * Config.GRID_W + col
	if world.hp[i] <= 0 then return 0 end

	world.hp[i] = world.hp[i] - damage
	if world.hp[i] <= 0 then
		world.hp[i] = 0
		world.seen[i] = 1
		return 1
	end
	return 0
end

function Engine.newLightMap()
	local lm = {
		r = {},
		g = {},
		b = {},
	}
	for i = 1, Config.CELLS do
		lm.r[i] = Config.LIGHT_AMBIENT
		lm.g[i] = Config.LIGHT_AMBIENT
		lm.b[i] = Config.LIGHT_AMBIENT
	end
	return lm
end

function Engine.buildLightMap(world, lightMap, ballList)
	for i = 1, Config.CELLS do
		lightMap.r[i] = Config.LIGHT_AMBIENT
		lightMap.g[i] = Config.LIGHT_AMBIENT
		lightMap.b[i] = Config.LIGHT_AMBIENT
	end

	for _, ball in ipairs(ballList) do
		local bc = math.floor(ball.x / Config.CELL)
		local br = math.floor(ball.y / Config.CELL)
		for r = br - Config.LIGHT_RANGE, br + Config.LIGHT_RANGE do
			for c = bc - Config.LIGHT_RANGE, bc + Config.LIGHT_RANGE do
				if c >= 0 and c < Config.GRID_W and r >= 0 and r < Config.GRID_H then
					local i = r * Config.GRID_W + c
					local dc = c - bc
					local dr = r - br
					local dist = math.sqrt(dc * dc + dr * dr)
					local falloff = math.exp(-Config.LIGHT_FALLOFF * dist)
					lightMap.r[i] = lightMap.r[i] + falloff * 0.3
					lightMap.g[i] = lightMap.g[i] + falloff * 0.3
					lightMap.b[i] = lightMap.b[i] + falloff * 0.3
				end
			end
		end
	end

	if world.goldenIdx >= 0 and world.hp[world.goldenIdx] > 0 then
		local c = world.goldenIdx % Config.GRID_W
		local r = math.floor(world.goldenIdx / Config.GRID_W)
		for r2 = r - Config.GOLDEN_AURA, r + Config.GOLDEN_AURA do
			for c2 = c - Config.GOLDEN_AURA, c + Config.GOLDEN_AURA do
				if c2 >= 0 and c2 < Config.GRID_W and r2 >= 0 and r2 < Config.GRID_H then
					local i = r2 * Config.GRID_W + c2
					local dc = c2 - c
					local dr = r2 - r
					local dist = math.sqrt(dc * dc + dr * dr)
					local falloff = math.exp(-0.08 * dist)
					lightMap.r[i] = lightMap.r[i] + falloff * 0.8
					lightMap.g[i] = lightMap.g[i] + falloff * 0.6
					lightMap.b[i] = lightMap.b[i] + falloff * 0.2
				end
			end
		end
	end
end

return Engine
