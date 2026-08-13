--[[ BlindShot Main Game Script - Roblox Version
Place this as a LocalScript in: StarterPlayer > StarterPlayerScripts > Game
]]

print("[BlindShot] Initializing game script...")

local Config, Engine, Render
local success, err

success, err = pcall(function()
	Config = require(script.Parent:WaitForChild("Config"))
end)
if not success then
	error("[BlindShot] Failed to load Config: " .. tostring(err))
end

success, err = pcall(function()
	Engine = require(script.Parent:WaitForChild("Engine"))
end)
if not success then
	error("[BlindShot] Failed to load Engine: " .. tostring(err))
end

success, err = pcall(function()
	Render = require(script.Parent:WaitForChild("Render"))
end)
if not success then
	error("[BlindShot] Failed to load Render: " .. tostring(err))
end

print("[BlindShot] All modules loaded successfully")

local gameState = {
	world = nil,
	player = {
		x = 0, y = 0,
		vx = 0, vy = 0,
		ix = 0, iy = 0,
		col = Config.START_COL,
		row = Config.START_ROW,
		face = math.pi / 2,
	},
	camera = {
		x = 0, y = 0,
		zoom = 1,
		targetZoom = 1,
		manualZoom = 1,
	},
	aim = {
		active = false,
		angle = math.pi / 2,
		power = 0,
		anchorWorldX = 0,
		anchorWorldY = 0,
	},
	balls = {},
	particles = {},
	reload = 0,
	reach = 0,
	broken = 0,
	tokens = 0,
	won = false,
}

function gameState:initPlayer()
	self.player.x = (self.player.col + 0.5) * Config.CELL
	self.player.y = (self.player.row + 0.5) * Config.CELL
	self.camera.x = self.player.x
	self.camera.y = self.player.y
end

local function createUI()
	print("[BlindShot] Creating UI...")
	local playerGui = game.Players.LocalPlayer:WaitForChild("PlayerGui")

	local screenGui = Instance.new("ScreenGui")
	screenGui.Name = "GameGui"
	screenGui.ResetOnSpawn = false
	screenGui.Parent = playerGui

	local viewport = Render.createViewport(screenGui)

	local depthLabel = Render.drawText(screenGui, "0 blocks", 10, 10, 18, Config.PALETTE.hud)
	local tokensLabel = Render.drawText(screenGui, "◆ 0", 10, 35, 16, Config.PALETTE.hud)
	local reloadLabel = Render.drawText(screenGui, "READY", 10, 60, 14, Config.PALETTE.hud)

	print("[BlindShot] UI created successfully")

	return {
		gui = screenGui,
		viewport = viewport,
		depthLabel = depthLabel,
		tokensLabel = tokensLabel,
		reloadLabel = reloadLabel,
	}
end

local function updateHUD(ui, state)
	local depth = Engine.distFrom(state.player.col, state.player.row, Config.START_COL, Config.START_ROW)
	ui.depthLabel.Text = math.floor(depth) .. " blocks"
	ui.tokensLabel.Text = "◆ " .. state.tokens
	if state.reload > 0 then
		ui.reloadLabel.Text = string.format("%.1fs", state.reload)
	else
		ui.reloadLabel.Text = "READY"
	end
end

local keys = {}
local gamepadConnected = false

local function handleInput(state)
	local keyMap = {
		W = { 0, -1 }, S = { 0, 1 },
		A = { -1, 0 }, D = { 1, 0 },
	}

	state.player.ix = 0
	state.player.iy = 0

	for key, dir in pairs(keyMap) do
		if keys[key] then
			state.player.ix = state.player.ix + dir[1]
			state.player.iy = state.player.iy + dir[2]
		end
	end

	if state.player.ix ~= 0 and state.player.iy ~= 0 then
		local len = math.sqrt(state.player.ix ^ 2 + state.player.iy ^ 2)
		state.player.ix = state.player.ix / len
		state.player.iy = state.player.iy / len
	end

	local userInput = game:GetService("UserInputService")
	if gamepadConnected then
		pcall(function()
			local thumbPos = userInput:GetGamepadState(Enum.UserInputType.Gamepad1, Enum.KeyCode.Thumbstick1)
			if thumbPos then
				if math.abs(thumbPos.X) > 0.1 or math.abs(thumbPos.Y) > 0.1 then
					state.player.ix = thumbPos.X
					state.player.iy = thumbPos.Y
				end
			end
		end)
	end
end

local function gameLoop()
	print("[BlindShot] Starting game loop...")

	gameState.world = Engine.genWorld(math.random(0, 2^31 - 1))
	gameState:initPlayer()

	local ui = createUI()
	local lastTime = tick()
	local lightMap = Engine.newLightMap()

	local userInput = game:GetService("UserInputService")

	userInput.InputBegan:Connect(function(input, gpe)
		if gpe then return end

		if input.KeyCode == Enum.KeyCode.W then keys.W = true
		elseif input.KeyCode == Enum.KeyCode.S then keys.S = true
		elseif input.KeyCode == Enum.KeyCode.A then keys.A = true
		elseif input.KeyCode == Enum.KeyCode.D then keys.D = true
		elseif input.KeyCode == Enum.KeyCode.Space then
			if gameState.reload <= 0 and gameState.aim.power > 0.06 then
				table.insert(gameState.balls, {
					x = gameState.player.x,
					y = gameState.player.y,
					vx = math.cos(gameState.aim.angle) * 200,
					vy = math.sin(gameState.aim.angle) * 200,
					lifetime = 5,
				})
				gameState.reload = 0.8
				gameState.aim.power = 0
			end
		end
	end)

	userInput.InputEnded:Connect(function(input, gpe)
		if input.KeyCode == Enum.KeyCode.W then keys.W = false
		elseif input.KeyCode == Enum.KeyCode.S then keys.S = false
		elseif input.KeyCode == Enum.KeyCode.A then keys.A = false
		elseif input.KeyCode == Enum.KeyCode.D then keys.D = false
		end
	end)

	userInput.GamepadConnected:Connect(function()
		gamepadConnected = true
		print("[BlindShot] Gamepad connected")
	end)

	userInput.GamepadDisconnected:Connect(function()
		gamepadConnected = false
		print("[BlindShot] Gamepad disconnected")
	end)

	local mouse = game.Players.LocalPlayer:GetMouse()
	mouse.WheelMoved:Connect(function(wheel)
		local delta = wheel
		gameState.camera.manualZoom = math.max(0.3, math.min(2, gameState.camera.manualZoom - delta * 0.05))
	end)

	print("[BlindShot] Game loop running...")

	while not gameState.won do
		local now = tick()
		local dt = math.min(now - lastTime, 0.05)
		lastTime = now

		handleInput(gameState)

		Engine.stepPlayer(gameState.player, gameState.world, dt)

		gameState.camera.x = gameState.player.x
		gameState.camera.y = gameState.player.y
		gameState.camera.targetZoom = 1
		local k = 1 - math.exp(-9 * dt)
		gameState.camera.zoom = gameState.camera.zoom + (gameState.camera.targetZoom - gameState.camera.zoom) * k

		if gameState.reload > 0 then
			gameState.reload = gameState.reload - dt
		end

		for i = #gameState.balls, 1, -1 do
			local ball = gameState.balls[i]
			ball.x = ball.x + ball.vx * dt
			ball.y = ball.y + ball.vy * dt
			ball.lifetime = ball.lifetime - dt

			if ball.lifetime <= 0 then
				table.remove(gameState.balls, i)
			end
		end

		Engine.buildLightMap(gameState.world, lightMap, gameState.balls)

		local viewScale = gameState.camera.zoom * gameState.camera.manualZoom
		local halfW = 1920 / 2 / viewScale
		local halfH = 1080 / 2 / viewScale
		local c0 = math.max(0, math.floor((gameState.camera.x - halfW) / Config.CELL))
		local c1 = math.min(Config.GRID_W - 1, math.ceil((gameState.camera.x + halfW) / Config.CELL))
		local r0 = math.max(0, math.floor((gameState.camera.y - halfH) / Config.CELL))
		local r1 = math.min(Config.GRID_H - 1, math.ceil((gameState.camera.y + halfH) / Config.CELL))

		Render.renderBlocks(ui.viewport, gameState.world, lightMap, c0, c1, r0, r1, 32)

		Render.drawPlayer(ui.viewport, gameState.player.x, gameState.player.y, gameState.player.face, Config.PALETTE.hud, 12)

		updateHUD(ui, gameState)

		game:GetService("RunService").RenderStepped:Wait()
	end
end

local ok, gameErr = pcall(gameLoop)
if not ok then
	error("[BlindShot] Game loop error: " .. tostring(gameErr))
end
