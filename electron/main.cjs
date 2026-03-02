const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const si = require('systeminformation');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    show: false,
    title: 'BYCORE',
    backgroundColor: '#0c0a09',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    startSystemMonitoring();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

async function getSystemStats() {
  try {
    const [load, mem, disk, net, netIfaces] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.networkInterfaces(),
    ]);

    const mainDisk = Array.isArray(disk) && disk.length > 0 ? disk[0] : { used: 0, size: 1 };
    let rx = 0, tx = 0;
    if (Array.isArray(net)) net.forEach(i => { rx += i.rx_sec || 0; tx += i.tx_sec || 0; });
    const isOnline = Array.isArray(netIfaces) ? netIfaces.some(i => i.operstate === 'up' && !i.internal) : false;

    return {
      cpu: parseFloat(load.currentLoad).toFixed(1),
      ram: {
        used: (mem.active / 1073741824).toFixed(2),
        total: (mem.total / 1073741824).toFixed(2),
      },
      disk: {
        used: (mainDisk.used / 1073741824).toFixed(2),
        total: (mainDisk.size / 1073741824).toFixed(2),
      },
      network: {
        online: isOnline,
        speed: ((rx + tx) * 8 / 1048576).toFixed(2) + ' Mbps',
      },
    };
  } catch (err) {
    console.error('Systeminfo Fehler:', err);
    return null;
  }
}

function startSystemMonitoring() {
  setInterval(async () => {
    if (!mainWindow) return;
    const stats = await getSystemStats();
    if (stats) mainWindow.webContents.send('system-stats', stats);
  }, 2000);
}

ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow && mainWindow.close());

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
