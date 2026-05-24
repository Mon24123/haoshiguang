const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("focusWidget", {
  toggleMainWindow: () => ipcRenderer.send("toggle-main-window"),
  toggleQuickWindow: () => ipcRenderer.send("toggle-quick-window"),
  openMainWindow: () => ipcRenderer.send("open-main-window"),
  hidePanels: () => ipcRenderer.send("hide-panels"),
  hideBubble: () => ipcRenderer.send("hide-bubble"),
  setBubbleDocked: (docked) => ipcRenderer.send("set-bubble-docked", docked),
  quitApp: () => ipcRenderer.send("quit-app"),
  moveBubbleBy: (delta) => ipcRenderer.send("move-bubble-by", delta),
  setBubbleExpanded: (expanded) => ipcRenderer.send("set-bubble-expanded", expanded),
  startTask: (taskId) => ipcRenderer.send("start-task", taskId),
  startActivity: (activity) => ipcRenderer.send("start-activity", activity),
  pauseActive: () => ipcRenderer.send("pause-active"),
  finishActive: () => ipcRenderer.send("finish-active"),
  setActiveNote: (note) => ipcRenderer.send("set-active-note", note),
  updateTimerStatus: (status) => ipcRenderer.send("timer-status", status),
  onTimerStatus: (callback) => ipcRenderer.on("timer-status", (_event, status) => callback(status)),
  onBubbleDocked: (callback) => ipcRenderer.on("bubble-docked", (_event, docked) => callback(docked)),
  onStartTask: (callback) => ipcRenderer.on("start-task", (_event, taskId) => callback(taskId)),
  onStartActivity: (callback) => ipcRenderer.on("start-activity", (_event, activity) => callback(activity)),
  onPauseActive: (callback) => ipcRenderer.on("pause-active", callback),
  onFinishActive: (callback) => ipcRenderer.on("finish-active", callback),
  onSetActiveNote: (callback) => ipcRenderer.on("set-active-note", (_event, note) => callback(note))
});
