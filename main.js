const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, Menu, nativeTheme, shell, ipcMain, screen } = require("electron");

app.setName("Good Time");
app.setPath("userData", path.join(app.getPath("appData"), "focus-widget"));

let mainWindow;
let quickWindow;
let bubbleWindow;
let bubbleExpanded = false;
let bubbleDocked = false;
let latestTimerStatus = {
  active: false,
  title: "",
  elapsed: "00:00:00",
  paused: false
};

function isLiveWindow(targetWindow) {
  return Boolean(targetWindow && !targetWindow.isDestroyed());
}

function getPanelBounds() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  return {
    width: Math.min(1040, width - 36),
    height: Math.min(720, height - 36),
    x: Math.max(18, width - Math.min(1040, width - 36) - 24),
    y: 24
  };
}

function getQuickBounds() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const quickWidth = Math.min(430, width - 32);
  const quickHeight = 470;
  return {
    width: quickWidth,
    height: Math.min(quickHeight, height - 32),
    x: Math.max(16, width - quickWidth - 24),
    y: Math.round(height * 0.17)
  };
}

function createMainWindow() {
  const bounds = getPanelBounds();
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 360,
    minHeight: 560,
    title: "Good Time（好时光）",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#18201d" : "#eef2f1",
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadURL(pathToFileURL(path.join(__dirname, "index.html")).href);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", (event) => {
    if (process.platform !== "darwin") {
      app.isQuitting = true;
      return;
    }
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createQuickWindow() {
  const bounds = getQuickBounds();
  quickWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 360,
    minHeight: 430,
    title: "Good Time（好时光）",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#18201d" : "#eef2f1",
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  quickWindow.loadURL(`${pathToFileURL(path.join(__dirname, "index.html")).href}?mode=compact`);

  quickWindow.on("close", (event) => {
    if (process.platform !== "darwin") {
      app.isQuitting = true;
      return;
    }
    if (!app.isQuitting) {
      event.preventDefault();
      quickWindow.hide();
    }
  });

  quickWindow.on("closed", () => {
    quickWindow = null;
  });
}

function createBubbleWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  bubbleWindow = new BrowserWindow({
    width: 316,
    height: 96,
    x: width - 340,
    y: Math.round(height * 0.34),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  bubbleWindow.loadURL(pathToFileURL(path.join(__dirname, "bubble.html")).href);
  bubbleWindow.webContents.once("did-finish-load", () => {
    if (isLiveWindow(bubbleWindow)) {
      bubbleWindow.webContents.send("timer-status", latestTimerStatus);
    }
  });
  bubbleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  bubbleWindow.setAlwaysOnTop(true, "floating");
  bubbleWindow.on("closed", () => {
    bubbleWindow = null;
  });
}

function resizeBubbleForStatus(status) {
  if (!isLiveWindow(bubbleWindow)) {
    return;
  }

  const bounds = bubbleWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const workArea = display.workArea;
  const width = bubbleDocked ? 58 : 316;
  const height = bubbleDocked ? 96 : bubbleExpanded ? 404 : 96;
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;
  const x = bubbleDocked
    ? workArea.x + workArea.width - width + 8
    : Math.min(Math.max(bounds.x, workArea.x), maxX);
  const y = Math.min(Math.max(bounds.y, workArea.y), maxY);

  bubbleWindow.setBounds({
    x,
    y,
    width,
    height
  });
}

function setBubbleExpanded(expanded) {
  if (bubbleDocked && expanded) {
    bubbleDocked = false;
    if (isLiveWindow(bubbleWindow)) {
      bubbleWindow.webContents.send("bubble-docked", false);
    }
  }
  bubbleExpanded = Boolean(expanded);
  resizeBubbleForStatus(latestTimerStatus);
}

function setBubbleDocked(docked) {
  bubbleDocked = Boolean(docked);
  if (bubbleDocked) {
    bubbleExpanded = false;
  }
  resizeBubbleForStatus(latestTimerStatus);
  if (isLiveWindow(bubbleWindow)) {
    bubbleWindow.showInactive();
    bubbleWindow.webContents.send("bubble-docked", bubbleDocked);
  }
}

function toggleMainWindow() {
  if (!isLiveWindow(mainWindow)) {
    createMainWindow();
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  const bounds = getPanelBounds();
  mainWindow.setBounds(bounds);
  mainWindow.show();
  mainWindow.focus();
}

function toggleQuickWindow() {
  if (!isLiveWindow(quickWindow)) {
    createQuickWindow();
  }

  if (quickWindow.isVisible()) {
    quickWindow.hide();
    return;
  }

  quickWindow.setBounds(getQuickBounds());
  quickWindow.show();
  quickWindow.focus();
}

function openMainWindow() {
  if (!isLiveWindow(mainWindow)) {
    createMainWindow();
  }

  mainWindow.setBounds(getPanelBounds());
  mainWindow.show();
  mainWindow.focus();
}

function hidePanels() {
  if (isLiveWindow(quickWindow)) {
    quickWindow.hide();
  }
  if (isLiveWindow(mainWindow)) {
    mainWindow.hide();
  }
}

function hideBubble() {
  setBubbleDocked(true);
}

function showBubble() {
  if (!isLiveWindow(bubbleWindow)) {
    createBubbleWindow();
    return;
  }
  bubbleDocked = false;
  resizeBubbleForStatus(latestTimerStatus);
  bubbleWindow.showInactive();
  bubbleWindow.webContents.send("bubble-docked", false);
}

function quitApp() {
  app.isQuitting = true;
  app.quit();
}

function getControllerWindow() {
  if (isLiveWindow(mainWindow)) {
    return mainWindow;
  }
  if (isLiveWindow(quickWindow)) {
    return quickWindow;
  }
  return null;
}

function sendToController(channel, payload) {
  const targetWindow = getControllerWindow();
  if (targetWindow) {
    targetWindow.webContents.send(channel, payload);
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false
  });
  createMainWindow();
  createQuickWindow();
  createBubbleWindow();

  ipcMain.on("toggle-main-window", toggleMainWindow);
  ipcMain.on("toggle-quick-window", toggleQuickWindow);
  ipcMain.on("open-main-window", openMainWindow);
  ipcMain.on("hide-panels", hidePanels);
  ipcMain.on("hide-bubble", hideBubble);
  ipcMain.on("set-bubble-docked", (_event, docked) => {
    setBubbleDocked(docked);
  });
  ipcMain.on("quit-app", quitApp);
  ipcMain.on("move-bubble-by", (_event, delta) => {
    if (!isLiveWindow(bubbleWindow) || !Number.isFinite(delta?.x) || !Number.isFinite(delta?.y)) {
      return;
    }

    const bounds = bubbleWindow.getBounds();
    bubbleWindow.setPosition(Math.round(bounds.x + delta.x), Math.round(bounds.y + delta.y), false);
  });
  ipcMain.on("set-bubble-expanded", (_event, expanded) => {
    setBubbleExpanded(expanded);
  });
  ipcMain.on("start-task", (_event, taskId) => {
    sendToController("start-task", taskId);
  });
  ipcMain.on("start-activity", (_event, activity) => {
    sendToController("start-activity", activity);
  });
  ipcMain.on("pause-active", () => {
    sendToController("pause-active");
  });
  ipcMain.on("finish-active", () => {
    sendToController("finish-active");
  });
  ipcMain.on("set-active-note", (_event, note) => {
    sendToController("set-active-note", String(note || ""));
  });
  ipcMain.on("timer-status", (_event, status) => {
    latestTimerStatus = status;
    resizeBubbleForStatus(status);
    if (isLiveWindow(bubbleWindow)) {
      bubbleWindow.webContents.send("timer-status", status);
    }
  });

  app.on("activate", () => {
    showBubble();
    toggleQuickWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && app.isQuitting) {
    app.quit();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
});
