--[[ BlindShot Renderer - Roblox Version with Object Pooling
Place this as a ModuleScript in: StarterPlayer > StarterPlayerScripts > Render
]]

local Config = require(script.Parent:WaitForChild("Config"))
local Render = {}

local blockPool = {}
local blockPoolSize = 0
local maxPoolSize = 2000

function Render.hexToRgb(hex)
	if hex:sub(1, 1) == "#" then hex = hex:sub(2) end
	return {
		r = tonumber(hex:sub(1, 2), 16),
		g = tonumber(hex:sub(3, 4), 16),
		b = tonumber(hex:sub(5, 6), 16),
	}
end

function Render.colorToColor3(hex)
	local rgb = Render.hexToRgb(hex)
	return Color3.fromRGB(rgb.r, rgb.g, rgb.b)
end

function Render.getBlockFromPool(parent)
	if blockPoolSize > 0 then
		local block = blockPool[blockPoolSize]
		blockPool[blockPoolSize] = nil
		blockPoolSize = blockPoolSize - 1
		block.Parent = parent
		block.Visible = true
		return block
	end

	local block = Instance.new("Frame")
	block.BorderSizePixel = 0
	block.Name = "Block"
	return block
end

function Render.returnBlockToPool(block)
	if blockPoolSize < maxPoolSize then
		block.Parent = nil
		block.Visible = false
		blockPoolSize = blockPoolSize + 1
		blockPool[blockPoolSize] = block
	else
		block:Destroy()
	end
end

function Render.createViewport(parent)
	local viewport = Instance.new("Frame")
	viewport.BackgroundColor3 = Render.colorToColor3(Config.PALETTE.unseen)
	viewport.BorderSizePixel = 0
	viewport.Size = UDim2.new(1, 0, 1, 0)
	viewport.Position = UDim2.new(0, 0, 0, 0)
	viewport.Name = "GameViewport"
	viewport.Parent = parent
	return viewport
end

function Render.renderBlocks(viewport, world, lightMap, c0, c1, r0, r1, blockSize)
	local usedBlocks = {}

	for row = r0, r1 do
		for col = c0, c1 do
			if col >= 0 and col < Config.GRID_W and row >= 0 and row < Config.GRID_H then
				local i = row * Config.GRID_W + col

				local block = Render.getBlockFromPool(viewport)
				usedBlocks[#usedBlocks + 1] = block

				local color
				local light = 1

				if world.seen[i] == 0 then
					color = Config.PALETTE.unseen
					light = 1
				elseif world.hp[i] > 0 then
					local lr = math.min(1, lightMap.r[i])
					local lg = math.min(1, lightMap.g[i])
					local lb = math.min(1, lightMap.b[i])
					light = math.max(lr, lg, lb)

					if world.kind[i] == Config.KIND_TOKEN then
						color = Config.BLOCK_TOKEN.color
					elseif world.kind[i] == Config.KIND_GOLDEN then
						color = Config.BLOCK_GOLDEN.color
					elseif world.kind[i] == Config.KIND_BEDROCK then
						color = Config.BLOCK_BEDROCK.color
					else
						color = Config.BLOCKS[world.hue[i]].color
					end
				else
					color = Config.PALETTE.bg
					light = 0.8
				end

				block.BackgroundColor3 = Render.colorToColor3(color)
				block.BackgroundTransparency = 1 - light
				block.Size = UDim2.new(0, blockSize, 0, blockSize)
				block.Position = UDim2.new(0, col * blockSize, 0, row * blockSize)
			end
		end
	end

	for _, child in ipairs(viewport:GetChildren()) do
		if child.Name == "Block" then
			local found = false
			for _, used in ipairs(usedBlocks) do
				if child == used then
					found = true
					break
				end
			end
			if not found then
				Render.returnBlockToPool(child)
			end
		end
	end
end

function Render.drawPlayer(parent, x, y, angle, color, size)
	local player = Instance.new("Frame")
	player.BackgroundTransparency = 1
	player.BorderSizePixel = 0
	player.Size = UDim2.new(0, size, 0, size)
	player.Position = UDim2.new(0, x - size/2, 0, y - size/2)
	player.Rotation = math.deg(angle)
	player.Name = "Player"
	player.Parent = parent

	local triangle = Instance.new("Frame")
	triangle.BackgroundColor3 = Render.colorToColor3(color)
	triangle.BorderSizePixel = 0
	triangle.Size = UDim2.new(0, 1, 0, size)
	triangle.Parent = player

	return player
end

function Render.drawText(parent, text, x, y, size, color, anchor)
	local label = Instance.new("TextLabel")
	label.Text = text
	label.TextSize = size or 14
	label.TextColor3 = Render.colorToColor3(color)
	label.BackgroundTransparency = 1
	label.BorderSizePixel = 0
	label.Size = UDim2.new(0, 200, 0, 40)
	label.Position = UDim2.new(0, x, 0, y)
	label.TextXAlignment = anchor or Enum.TextXAlignment.Left
	label.Font = Enum.Font.GothamMono
	label.Parent = parent
	return label
end

return Render
