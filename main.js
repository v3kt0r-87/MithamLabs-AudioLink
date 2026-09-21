const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Allow unprompted audio autoplay for ringtones
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 680,
    height: 780,
    minWidth: 420,
    minHeight: 600,
    autoHideMenuBar: true,
    title: 'AudioLink — Zero Latency P2P Voice',
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  // Automatically grant microphone and notification permissions
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'notifications'];
    callback(allowed.includes(permission));
  });

  win.loadFile('index.html');

  // Open external links (e.g. GitHub) in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
