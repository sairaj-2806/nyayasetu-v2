const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const path = require("path");

let mainWindow = null;
const LIVE_URL = "https://nyaysetu.sujal309206.workers.dev";
const startUrl = process.env.ELECTRON_START_URL || process.env.VITE_DEV_SERVER_URL || LIVE_URL;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 868,
    minWidth: 1024,
    minHeight: 680,
    title: "NyayaSetu - Smart Court Scheduling & Cause-List System",
    icon: path.join(__dirname, "../public/nyayasetu-logo.png"),
    backgroundColor: "#090d16",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Allows preload to bridge IPC cleanly
      spellcheck: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Strict URL opening & navigation policy: prevent arbitrary protocols & untrusted windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (
        parsed.origin === new URL(LIVE_URL).origin ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1"
      ) {
        mainWindow.loadURL(url);
        return { action: "deny" };
      }
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        shell.openExternal(url);
        return { action: "deny" };
      }
    } catch {
      // Invalid URL
    }
    return { action: "deny" };
  });

  // Prevent renderer navigation to arbitrary untrusted external origins
  mainWindow.webContents.on("will-navigate", (event, navUrl) => {
    try {
      const parsed = new URL(navUrl);
      const isTrusted =
        parsed.origin === new URL(LIVE_URL).origin ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        navUrl.startsWith("file://");
      if (!isTrusted) {
        event.preventDefault();
        shell.openExternal(navUrl);
      }
    } catch {
      event.preventDefault();
    }
  });

  console.log(`[NyayaSetu Desktop] Launching Court Workspace: ${startUrl}`);

  mainWindow.loadURL(startUrl).catch((err) => {
    console.warn(`[NyayaSetu Desktop] Initial load failed:`, err.message);
    loadOfflineFallback(mainWindow);
  });

  // ONLY trigger fallback if the top-level page failed to load (e.g. true offline)
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
      if (!isMainFrame) return; // Crucial: Ignore subresource, font, or analytics errors
      if (errorCode === -3) return; // -3 is ERR_ABORTED (redirects or cancelled requests)

      console.warn(
        `[NyayaSetu Desktop] Main page failed to load (${errorCode}: ${errorDescription})`,
      );
      loadOfflineFallback(mainWindow);
    },
  );

  createApplicationMenu();
}

function loadOfflineFallback(win) {
  if (!win || win.isDestroyed()) return;
  win.loadFile(path.join(__dirname, "offline.html")).catch((err) => {
    console.error("Failed to load local offline.html:", err);
  });
}

// IPC listener from offline.html retry button
ipcMain.on("retry-connection", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log(`[NyayaSetu Desktop] Retrying connection to ${startUrl}...`);
    mainWindow.loadURL(startUrl).catch((err) => {
      console.warn("[NyayaSetu Desktop] Retry load failed:", err.message);
      loadOfflineFallback(mainWindow);
    });
  }
});

function createApplicationMenu() {
  const isMac = process.platform === "darwin";

  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "Court Registry",
      submenu: [
        {
          label: "Reload Cause Lists",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow?.reload(),
        },
        {
          label: "Go to Live Portal",
          accelerator: "CmdOrCtrl+H",
          click: () => mainWindow?.loadURL(startUrl),
        },
        {
          label: "Toggle Full Screen",
          accelerator: isMac ? "Ctrl+Cmd+F" : "F11",
          click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()),
        },
        { type: "separator" },
        { role: isMac ? "close" : "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "toggledevtools" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
