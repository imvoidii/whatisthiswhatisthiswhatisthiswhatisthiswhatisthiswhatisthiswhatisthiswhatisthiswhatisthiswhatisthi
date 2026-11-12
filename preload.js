const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcherAPI", {
  getGames: () => ipcRenderer.invoke("get-games"),
  addGame: () => ipcRenderer.invoke("add-game"),
  renameGame: (id, newName) => ipcRenderer.invoke("rename-game", { id, newName }),
  removeGame: (id) => ipcRenderer.invoke("remove-game", id),
  launchGame: (id) => ipcRenderer.invoke("launch-game", id),
  onGameStopped: (callback) =>
    ipcRenderer.on("game-stopped", (_, data) => callback(data))
});