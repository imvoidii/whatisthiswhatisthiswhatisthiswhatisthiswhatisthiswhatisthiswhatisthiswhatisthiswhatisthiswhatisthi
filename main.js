const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const DATA_FILE = path.join(app.getPath("userData"), "games.json");
let mainWindow;

function createWindow() {
  Menu.setApplicationMenu(null); // Removes the File, Edit, View, Help bar

  mainWindow = new BrowserWindow({
    width: 850,
    height: 620,
    title: "Eclipse Launcher",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    backgroundColor: "#0f1117",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  mainWindow.loadFile("index.html");
}

function loadGames() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveGames(games) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2), "utf-8");
}

app.whenReady().then(createWindow);

// Load initial game list
ipcMain.handle("get-games", () => loadGames());

// Open file picker to add a game and auto-create games.json
ipcMain.handle("add-game", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Game Executable",
    filters: [{ name: "Executables", extensions: ["exe", "app", "bat", "sh"] }],
    properties: ["openFile"]
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const exePath = result.filePaths[0];
  const defaultName = path.parse(exePath).name;

  const games = loadGames();
  const newGame = {
    id: Date.now().toString(),
    name: defaultName,
    path: exePath,
    playtimeSeconds: 0
  };

  games.push(newGame);
  saveGames(games);
  return games;
});

// Rename a game
ipcMain.handle("rename-game", (_, { id, newName }) => {
  const games = loadGames();
  const game = games.find((g) => g.id === id);
  if (game && newName.trim()) {
    game.name = newName.trim();
    saveGames(games);
  }
  return games;
});

// Delete a game
ipcMain.handle("remove-game", (_, id) => {
  const games = loadGames().filter((g) => g.id !== id);
  saveGames(games);
  return games;
});

// Launch game and track open duration
ipcMain.handle("launch-game", (_, id) => {
  const games = loadGames();
  const game = games.find((g) => g.id === id);
  if (!game || !fs.existsSync(game.path)) {
    return { error: "Executable not found on disk." };
  }

  const startTime = Date.now();
  const child = spawn(game.path, [], {
    cwd: path.dirname(game.path),
    detached: false
  });

  child.on("error", (err) => {
    mainWindow.webContents.send("game-stopped", {
      id,
      games: loadGames(),
      error: err.message
    });
  });

  child.on("exit", () => {
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const updatedGames = loadGames();
    const target = updatedGames.find((g) => g.id === id);
    if (target) {
      target.playtimeSeconds = (target.playtimeSeconds || 0) + elapsedSeconds;
      saveGames(updatedGames);
    }
    mainWindow.webContents.send("game-stopped", { id, games: updatedGames });
  });

  return { started: true };
});