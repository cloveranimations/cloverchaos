--[[ BlindShot Main Game - DEBUG VERSION
Place this as a LocalScript in: StarterPlayer > StarterPlayerScripts > Game
This version shows status on screen and logs everything to console.
]]

print("========== BLINDSHOT STARTING ==========")

-- Get or create GUI immediately
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
print("Player found:", player.Name)

local playerGui = player:WaitForChild("PlayerGui", 10)
if not playerGui then
	error("ERROR: PlayerGui not found!")
	return
end
print("PlayerGui found")

-- Create status display
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "BlindShotDebug"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

local statusLabel = Instance.new("TextLabel")
statusLabel.Name = "Status"
statusLabel.Size = UDim2.new(0, 400, 0, 200)
statusLabel.Position = UDim2.new(0.5, -200, 0.5, -100)
statusLabel.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
statusLabel.BackgroundTransparency = 0.3
statusLabel.TextColor3 = Color3.fromRGB(249, 161, 46)
statusLabel.TextSize = 18
statusLabel.Font = Enum.Font.GothamMono
statusLabel.TextWrapped = true
statusLabel.TextXAlignment = Enum.TextXAlignment.Left
statusLabel.TextYAlignment = Enum.TextYAlignment.Top
statusLabel.Parent = screenGui

local function updateStatus(text)
	statusLabel.Text = text
	print("[BlindShot]", text)
end

updateStatus("Loading modules...")

-- Try to load Config
local Config
local success, err = pcall(function()
	Config = require(script.Parent:WaitForChild("Config", 5))
end)

if not success then
	updateStatus("ERROR: Config failed\n" .. tostring(err))
	error("Config load error: " .. tostring(err))
	return
end

updateStatus("Config loaded\nLoading Engine...")

-- Try to load Engine
local Engine
success, err = pcall(function()
	Engine = require(script.Parent:WaitForChild("Engine", 5))
end)

if not success then
	updateStatus("ERROR: Engine failed\n" .. tostring(err))
	error("Engine load error: " .. tostring(err))
	return
end

updateStatus("Engine loaded\nLoading Render...")

-- Try to load Render
local Render
success, err = pcall(function()
	Render = require(script.Parent:WaitForChild("Render", 5))
end)

if not success then
	updateStatus("ERROR: Render failed\n" .. tostring(err))
	error("Render load error: " .. tostring(err))
	return
end

updateStatus("All modules loaded!\nGenerating world...")

-- Initialize game state
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

-- Generate world
gameState.world = Engine.genWorld(math.random(0, 2^31 - 1))
gameState:initPlayer()

updateStatus("Creating viewport...")

-- Create viewport
local viewport = Render.createViewport(screenGui)

-- Create HUD labels
local depthLabel = Render.drawText(screenGui, "0 blocks", 10, 10, 18, Config.PALETTE.hud)
local tokensLabel = Render.drawText(screenGui, "◆ 0", 10, 35, 16, Config.PALETTE.hud)
local reloadLabel = Render.drawText(screenGui, "READY", 10, 60, 14, Config.PALETTE.hud)

-- Hide status after UI is ready
updateStatus("Game running!")
task.wait(1)
statusLabel.Visible = false

print("[BlindShot] Game initialized and running!")

-- Input handling
local keys = {}
local userInput = game:GetService("UserInputService")

userInput.InputBegan:Connect(function(input, gpe)
	if gpe then return end

	if input.KeyCode == Enum.KeyCode.W then keys.W = true
	elseif input.KeyCode == Enum.KeyCode.S then keys.S = true
	elseif input.KeyCode == Enum.KeyCode.A then keys.A = true
	elseif input.KeyCode == Enum.KeyCode.D then keys.D = true
	elseif input.KeyCode == Enum.KeyCode.Space then
		if gameState.reload <= 0 then
			table.insert(gameState.balls, {
				x = gameState.player.x,
				y = gameState.player.y,
				vx = math.cos(gameState.player.face) * 300,
				vy = math.sin(gameState.player.face) * 300,
				lifetime = 5,
			})
			gameState.reload = 0.5
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

local mouse = player:GetMouse()
mouse.WheelMoved:Connect(function(wheel)
	gameState.camera.manualZoom = math.max(0.3, math.min(2, gameState.camera.manualZoom - wheel * 0.05))
end)

-- Game loop
local lastTime = tick()
local lightMap = Engine.newLightMap()
local frameCount = 0

while not gameState.won do
	local now = tick()
	local dt = math.min(now - lastTime, 0.05)
	lastTime = now
	frameCount = frameCount + 1

	-- Handle input
	gameState.player.ix = 0
	gameState.player.iy = 0

	if keys.W then gameState.player.iy = gameState.player.iy - 1 end
	if keys.S then gameState.player.iy = gameState.player.iy + 1 end
	if keys.A then gameState.player.ix = gameState.player.ix - 1 end
	if keys.D then gameState.player.ix = gameState.player.ix + 1 end

	if gameState.player.ix ~= 0 and gameState.player.iy ~= 0 then
		local len = math.sqrt(gameState.player.ix ^ 2 + gameState.player.iy ^ 2)
		gameState.player.ix = gameState.player.ix / len
		gameState.player.iy = gameState.player.iy / len
	end

	-- Update player
	Engine.stepPlayer(gameState.player, gameState.world, dt)

	-- Update camera
	gameState.camera.x = gameState.player.x
	gameState.camera.y = gameState.player.y

	-- Update reload
	if gameState.reload > 0 then
		gameState.reload = gameState.reload - dt
	end

	-- Update balls
	for i = #gameState.balls, 1, -1 do
		local ball = gameState.balls[i]
		ball.x = ball.x + ball.vx * dt
		ball.y = ball.y + ball.vy * dt
		ball.lifetime = ball.lifetime - dt

		if ball.lifetime <= 0 then
			table.remove(gameState.balls, i)
		end
	end

	-- Build light map
	Engine.buildLightMap(gameState.world, lightMap, gameState.balls)

	-- Render
	local viewScale = gameState.camera.zoom * gameState.camera.manualZoom
	local halfW = 1920 / 2 / viewScale
	local halfH = 1080 / 2 / viewScale
	local c0 = math.max(0, math.floor((gameState.camera.x - halfW) / Config.CELL))
	local c1 = math.min(Config.GRID_W - 1, math.ceil((gameState.camera.x + halfW) / Config.CELL))
	local r0 = math.max(0, math.floor((gameState.camera.y - halfH) / Config.CELL))
	local r1 = math.min(Config.GRID_H - 1, math.ceil((gameState.camera.y + halfH) / Config.CELL))

	Render.renderBlocks(viewport, gameState.world, lightMap, c0, c1, r0, r1, 32)

	-- Draw player
	for _, child in ipairs(viewport:GetChildren()) do
		if child.Name == "Player" then
			child:Destroy()
		end
	end
	Render.drawPlayer(viewport, gameState.player.x, gameState.player.y, gameState.player.face, Config.PALETTE.hud, 12)

	-- Update HUD
	local depth = Engine.distFrom(gameState.player.col, gameState.player.row, Config.START_COL, Config.START_ROW)
	depthLabel.Text = math.floor(depth) .. " blocks"
	tokensLabel.Text = "◆ " .. gameState.tokens
	if gameState.reload > 0 then
		reloadLabel.Text = string.format("%.1fs", gameState.reload)
	else
		reloadLabel.Text = "READY"
	end

	RunService.RenderStepped:Wait()
end
