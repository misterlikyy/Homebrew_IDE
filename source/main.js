const { app, BrowserWindow, Menu, dialog, ipcMain, session, net } = require('electron');
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/* ---------- arduino-cli: use the copy this app installed, or the one on the PATH ---------- */
const cliDir = () => path.join(app.getPath('userData'), 'arduino-cli');
function cliCmd() {
  const local = path.join(cliDir(), process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');
  return fs.existsSync(local) ? local : 'arduino-cli';
}
function run(args, onLine) {
  return new Promise(resolve => {
    let out = '', so = '', p;
    try { p = spawn(cliCmd(), args, { windowsHide: true }); }
    catch (e) { return resolve({ code: -1, out: '', so: '', missing: true }); }
    p.on('error', e => resolve({ code: -1, out: '', so: '', missing: e.code === 'ENOENT' }));
    const h = d => {
      const t = d.toString(); out += t;
      if (onLine) t.split(/\r?\n/).filter(Boolean).forEach(onLine);
    };
    p.stdout.on('data', d => { so += d.toString(); h(d); }); p.stderr.on('data', h);
    p.on('close', code => resolve({ code, out, so }));
  });
}
function parseJson(s) {
  try { return JSON.parse(s); } catch {}
  const a = s.search(/[\[{]/), b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch {} }
  return null;
}

/* 'cli' = arduino-cli missing, 'core' = Uno support missing, 'ok' */
async function toolsState() {
  const v = await run(['version']);
  if (v.missing || v.code !== 0) return 'cli';
  const c = await run(['core', 'list']);
  return /arduino:avr/.test(c.out) ? 'ok' : 'core';
}
let toolsOk = false;
async function needTools(fqbn) {
  const st = await toolsState();
  const core = (fqbn || 'arduino:avr:uno').split(':').slice(0, 2).join(':');
  if (st === 'cli') return { ok: false, needInstall: true, error: 'Building and uploading need the free Arduino tool arduino-cli, which is not installed on this computer.' };
  if (core === 'arduino:avr') return st === 'ok' ? null : { ok: false, needInstall: true, error: 'Building and uploading need the Arduino Uno support package, which is not installed yet.' };
  const c = await run(['core', 'list']);
  return c.out.includes(core) ? null : { ok: false, error: 'The board package ' + core + ' is not installed. Open Tools, Boards Manager and install it first.' };
}

/* Writes the project to a temporary sketch folder. The first .ino file becomes the main sketch file. */
function writeSketch(files) {
  const list = typeof files === 'string' ? [{ name: 'uno_bench_sketch.ino', text: files }] : files;
  const primary = list.findIndex(f => /\.ino$/i.test(f.name));
  if (primary < 0) return null;
  const dir = path.join(os.tmpdir(), 'uno_bench_sketch');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  list.forEach((f, i) => fs.writeFileSync(path.join(dir, i === primary ? 'uno_bench_sketch.ino' : path.basename(f.name)), f.text));
  return dir;
}

/* ---------- finding serial ports: arduino-cli when it is there, the operating system otherwise ---------- */
let osCache = { t: 0, list: [] };
function osPorts() {
  return new Promise(resolve => {
    if (Date.now() - osCache.t < 5000) return resolve(osCache.list);
    const done = list => { osCache = { t: Date.now(), list }; resolve(list); };
    if (process.platform === 'win32') {
      const cmd = "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | ForEach-Object { $_.Name + '|' + $_.PNPDeviceID }";
      execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true, timeout: 10000 }, (err, out) => {
        const list = [];
        (out || '').split(/\r?\n/).forEach(l => {
          const m = l.match(/^(.*)\((COM\d+)\)\|(.*)$/); if (!m) return;
          const v = m[3].match(/VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i), name = m[1].trim();
          list.push({ address: m[2], board: /arduino/i.test(name) ? name : '', vid: v ? parseInt(v[1], 16) : null, pid: v ? parseInt(v[2], 16) : null });
        });
        done(list);
      });
    } else {
      let names = []; try { names = fs.readdirSync('/dev').filter(n => /^(ttyACM|ttyUSB|cu\.usb)/.test(n)); } catch (e) {}
      done(names.map(n => ({ address: '/dev/' + n, board: '', vid: null, pid: null })));
    }
  });
}
async function cliPorts() {
  const r = await Promise.race([run(['board', 'list', '--format', 'json']), new Promise(res => setTimeout(() => res({ code: -1, out: '' }), 5000))]);
  const list = [];
  try {
    const j = parseJson(r.so || r.out) || {}, arr = Array.isArray(j) ? j : (j.detected_ports || []);
    arr.forEach(x => {
      const p = x.port || x, pr = p.properties || {}; if (p.protocol !== 'serial' || !p.address) return;
      const b = (x.matching_boards || x.boards || [])[0];
      list.push({ address: p.address, board: b ? b.name : '', vid: pr.vid ? parseInt(pr.vid, 16) : null, pid: pr.pid ? parseInt(pr.pid, 16) : null });
    });
  } catch {}
  return list;
}
const ARDUINO_LIKE = new Set([0x2341, 0x2a03, 0x1a86, 0x0403, 0x10c4, 0x067b]);
async function allPorts() { const c = await cliPorts(); return c.length ? c : osPorts(); }

let lastPortName = '';          // the port the window was connected to
async function pickPort(win) {
  const list = await allPorts();
  if (lastPortName && (!list.length || list.some(x => x.address === lastPortName))) return lastPortName;
  if (!list.length) return null;
  const likely = list.filter(x => x.board || ARDUINO_LIKE.has(x.vid));
  const pool = likely.length ? likely : list;
  if (pool.length === 1) return pool[0].address;
  const i = dialog.showMessageBoxSync(win, {
    type: 'question', message: 'Which port is your Arduino?',
    buttons: [...pool.map(x => x.address + (x.board ? ' (' + x.board + ')' : '')), 'Cancel'], cancelId: pool.length
  });
  if (win) { win.focus(); win.webContents.focus(); }
  return i < pool.length ? pool[i].address : null;
}
const NO_PORT = 'Could not find the serial port of your Arduino. Plug it in and press Connect Arduino first, so the app can see which port it is on.';
function uploadHint(out) {
  if (/can't open device|access is denied|permission denied|busy/i.test(out)) return 'The port is busy. Close the Arduino IDE, any other serial monitor and other windows of this app that use the board, then try again.';
  if (/not in sync|stk500|programmer is not responding/i.test(out)) return 'The board did not answer. Check that it is an Arduino Uno, and try pressing the reset button on the board just before uploading.';
  return 'Upload failed. Read the messages above for the reason.';
}

/* ---------- interface updates: a newer index.html can be installed without rebuilding the exe ---------- */
const API_LEVEL = 1;            // raised only when the interface needs something new from main.js or preload.js
const uiDir = () => path.join(app.getPath('userData'), 'ui');
function meta(file, name) {
  try { const t = fs.readFileSync(file, 'utf8').slice(0, 4000), x = t.match(new RegExp('<meta name="' + name + '" content="(\\d+)"')); return x ? +x[1] : 0; } catch { return 0; }
}
function uiFile() {
  const bundled = path.join(__dirname, 'index.html'), ext = path.join(uiDir(), 'index.html');
  if (fs.existsSync(ext) && meta(ext, 'ide-api') <= API_LEVEL && meta(ext, 'ide-build') > meta(bundled, 'ide-build')) return ext;
  return bundled;
}
const reloadAll = () => wins.forEach(w => w.loadFile(uiFile(), { query: w._query }));

/* ---------- windows ---------- */
const wins = new Map();                       // id -> BrowserWindow. Every window is its own workspace.
function nextId() { let n = 1; while (wins.has(n)) n++; return n; }

function createWindow(o) {
  o = o || {};
  const sat = !!o.view;                       // a view (Dashboard, Board, Monitor, Log) opened as its own window
  const id = nextId();
  const opts = {
    width: sat ? 920 : 1280, height: sat ? 720 : 860, minWidth: sat ? 520 : 760, minHeight: sat ? 360 : 520,
    resizable: true, maximizable: true, minimizable: true,
    title: 'ide-alpha', autoHideMenuBar: true, backgroundColor: '#0A1426', icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  };
  const f = BrowserWindow.getFocusedWindow();
  if (f) { const b = f.getBounds(); opts.x = b.x + 34; opts.y = b.y + 34; }
  const win = new BrowserWindow(opts);
  wins.set(id, win);
  win.on('closed', () => wins.delete(id));
  win.on('focus', () => win.webContents.focus());      // keyboard goes to the page whenever the window is activated
  const query = { ws: String(id) }; if (sat) { query.view = String(o.view); query.owner = String(o.owner || ''); }
  win._query = query;
  win.loadFile(uiFile(), { query });
  return id;
}

/* serial permissions are set once for every window */
function setupSession() {
  const ses = session.defaultSession;
  ses.setPermissionCheckHandler((wc, permission) => permission === 'serial');
  ses.setDevicePermissionHandler(d => d.deviceType === 'serial');
  ses.on('select-serial-port', (event, portList, wc, callback) => {
    event.preventDefault();
    const win = BrowserWindow.fromWebContents(wc);
    if (!portList.length) return callback('');
    if (portList.length === 1) return callback(portList[0].portId);
    const i = dialog.showMessageBoxSync(win, {
      type: 'question', message: 'Which device?',
      buttons: [...portList.map(p => (p.displayName || 'Serial device') + ' (' + p.portName + ')'), 'Cancel'],
      cancelId: portList.length
    });
    if (win) { win.focus(); win.webContents.focus(); }
    callback(i < portList.length ? portList[i].portId : '');
  });
}

/* ---------- IPC ---------- */
ipcMain.handle('ui:info', () => ({ build: meta(uiFile(), 'ide-build'), bundled: meta(path.join(__dirname, 'index.html'), 'ide-build'), external: uiFile() !== path.join(__dirname, 'index.html') }));
ipcMain.handle('ui:install', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Choose the interface update', filters: [{ name: 'Interface file', extensions: ['html'] }], properties: ['openFile'] });
  if (r.canceled) return { ok: false, cancelled: true };
  const f = r.filePaths[0], build = meta(f, 'ide-build'), api = meta(f, 'ide-api');
  if (!build) return { ok: false, error: 'That file is not an interface update for this app.' };
  if (api > API_LEVEL) return { ok: false, error: 'This update needs a newer ide-alpha-1.exe. Build the app again from the latest zip first.' };
  if (build <= meta(path.join(__dirname, 'index.html'), 'ide-build')) return { ok: false, error: 'This update is not newer than the interface that is already built into ide-alpha-1.exe (build ' + build + '). Nothing was changed.' };
  fs.mkdirSync(uiDir(), { recursive: true }); fs.copyFileSync(f, path.join(uiDir(), 'index.html')); reloadAll();
  return { ok: true, build };
});
ipcMain.handle('ui:reset', () => { fs.rmSync(path.join(uiDir(), 'index.html'), { force: true }); reloadAll(); return { ok: true }; });
ipcMain.handle('window:new', (e, o) => createWindow(o));
ipcMain.on('window:focus', (e, id) => { const w = wins.get(Number(id)); if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
ipcMain.on('window:close', (e, id) => { const w = wins.get(Number(id)); if (w && w !== BrowserWindow.fromWebContents(e.sender)) w.close(); });

ipcMain.handle('serial:describe', () => allPorts());            // port names and board names for the device picker
ipcMain.on('serial:prefer', (e, name) => { lastPortName = String(name || ''); });

ipcMain.handle('cli:check', async () => {
  const st = await toolsState();
  if (st === 'cli') return { found: false };
  const v = await run(['version']);
  return { found: true, version: v.out.split(/\r?\n/)[0], hasAvr: st === 'ok' };
});

/* downloads arduino-cli from arduino.cc when it is missing, then installs the Uno support */
ipcMain.handle('cli:installCore', async e => {
  const send = l => e.sender.send('cli:output', l);
  try {
    if ((await toolsState()) === 'cli') {
      const plat = process.platform;
      const file = plat === 'win32' ? 'Windows_64bit.zip' : plat === 'darwin' ? (process.arch === 'arm64' ? 'macOS_ARM64.tar.gz' : 'macOS_64bit.tar.gz') : 'Linux_64bit.tar.gz';
      send('Downloading arduino-cli from arduino.cc (about 30 MB)…');
      const res = await net.fetch('https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_' + file);
      if (!res.ok) throw new Error('the download failed (HTTP ' + res.status + ')');
      fs.mkdirSync(cliDir(), { recursive: true });
      const archive = path.join(cliDir(), file);
      fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
      send('Unpacking…');
      await new Promise((ok, bad) => {
        const args = plat === 'win32'
          ? ['powershell', ['-NoProfile', '-NonInteractive', '-Command', "Expand-Archive -Force -LiteralPath '" + archive.replace(/'/g, "''") + "' -DestinationPath '" + cliDir().replace(/'/g, "''") + "'"]]
          : ['tar', ['-xzf', archive, '-C', cliDir()]];
        execFile(args[0], args[1], { windowsHide: true }, err => (err ? bad(err) : ok()));
      });
      fs.rmSync(archive, { force: true });
      if (plat !== 'win32') fs.chmodSync(path.join(cliDir(), 'arduino-cli'), 0o755);
      send('arduino-cli is installed.');
    }
    send('Downloading Arduino Uno support. This can take a few minutes…');
    let r = await run(['core', 'update-index'], send);
    if (r.missing) return { ok: false, error: 'arduino-cli could not be started after installing it.' };
    r = await run(['core', 'install', 'arduino:avr'], send);
    toolsOk = false;
    return r.code === 0 ? { ok: true } : { ok: false, error: 'The Uno support package did not install. Check your internet connection and try again.' };
  } catch (err) { return { ok: false, error: 'Install failed: ' + err.message }; }
});

ipcMain.handle('cli:compile', async (e, files, fqbn) => {
  const send = l => e.sender.send('cli:output', l);
  fqbn = fqbn || 'arduino:avr:uno';
  const need = await needTools(fqbn); if (need) return need;
  const dir = writeSketch(files);
  if (!dir) return { ok: false, error: 'The project needs a .ino file.' };
  send('Compiling…');
  const r = await run(['compile', '--warnings', 'more', '--fqbn', fqbn, dir], send);
  return r.code === 0 ? { ok: true } : { ok: false, error: 'Build failed. See Problems for the details.' };
});

ipcMain.handle('cli:upload', async (e, files, fqbn) => {
  const send = l => e.sender.send('cli:output', l);
  const win = BrowserWindow.fromWebContents(e.sender);
  fqbn = fqbn || 'arduino:avr:uno';
  const need = await needTools(fqbn); if (need) return need;
  const dir = writeSketch(files);
  if (!dir) return { ok: false, error: 'The project needs a .ino file.' };

  send('Looking for the Arduino…');
  const port = await pickPort(win);
  if (!port) return { ok: false, error: NO_PORT };
  send('Using port ' + port);

  send('Compiling…');
  let r = await run(['compile', '--warnings', 'more', '--fqbn', fqbn, dir], send);
  if (r.code !== 0) return { ok: false, error: 'Build failed. See Problems for the details.' };

  send('Uploading to ' + port + '…');
  r = await run(['upload', '-p', port, '--fqbn', fqbn, dir], send);
  return r.code === 0 ? { ok: true } : { ok: false, error: uploadHint(r.out) };
});

/* ---------- Boards Manager and Library Manager ---------- */
const indexed = { core: false, lib: false };
const TOOLS_MISSING = { ok: false, needInstall: true, error: 'The Boards Manager and Library Manager need the free Arduino tool arduino-cli, which is not installed on this computer.' };
function normCores(j) {
  const arr = Array.isArray(j) ? j : ((j && j.platforms) || []);
  return arr.map(p => {
    const rel = p.releases || {}, latest = p.latest_version || (typeof p.latest === 'string' ? p.latest : '') || Object.keys(rel).pop() || '';
    const inst = p.installed_version || (typeof p.installed === 'string' ? p.installed : '') || '', r = rel[latest] || rel[inst] || {};
    return { id: p.id, name: p.name || r.name || p.id, maintainer: p.maintainer || '', latest, installed: inst, boards: (r.boards || p.boards || []).map(b => b.name).slice(0, 12) };
  });
}
function normLibs(j) {
  return (((j && j.libraries) || [])).map(l => {
    const lat = l.latest || {}, rel = l.releases || {}, ver = lat.version || Object.keys(rel).pop() || '', r = rel[ver] || lat;
    return { name: l.name, latest: ver, author: r.author || lat.author || '', sentence: r.sentence || lat.sentence || '', paragraph: r.paragraph || lat.paragraph || '' };
  });
}
function normInstalledLibs(j) {
  const arr = Array.isArray(j) ? j : ((j && j.installed_libraries) || []);
  return arr.map(x => { const l = x.library || x; return { name: l.name, version: l.version || '', includes: l.provides_includes || [], author: l.author || '', sentence: l.sentence || '' }; });
}
async function jsonCmd(args) { const r = await run(args); return r.missing ? null : parseJson(r.so || r.out); }

ipcMain.handle('pkg:search', async (e, kind, query) => {
  if ((await toolsState()) === 'cli') return TOOLS_MISSING;
  const q = String(query || '').trim();
  if (kind === 'core') {
    if (!indexed.core) { await run(['core', 'update-index']); indexed.core = true; }
    return { ok: true, items: normCores(await jsonCmd(['core', 'search', ...(q ? [q] : []), '--format', 'json'])).slice(0, 120) };
  }
  if (q.length < 2) return { ok: true, items: [] };
  if (!indexed.lib) { await run(['lib', 'update-index']); indexed.lib = true; }
  return { ok: true, items: normLibs(await jsonCmd(['lib', 'search', q, '--format', 'json'])).slice(0, 80) };
});
ipcMain.handle('pkg:installed', async () => {
  if ((await toolsState()) === 'cli') return TOOLS_MISSING;
  return { ok: true, cores: normCores(await jsonCmd(['core', 'list', '--format', 'json'])), libs: normInstalledLibs(await jsonCmd(['lib', 'list', '--format', 'json'])) };
});
async function pkgRun(e, kind, verb, key) {
  const send = l => e.sender.send('cli:output', l);
  if ((await toolsState()) === 'cli') return TOOLS_MISSING;
  const r = await run([kind === 'core' ? 'core' : 'lib', verb, key], send);
  toolsOk = false;
  return r.code === 0 ? { ok: true } : { ok: false, error: 'That did not work. Read the messages above for the reason.' };
}
ipcMain.handle('pkg:install', (e, kind, key) => pkgRun(e, kind, 'install', key));
ipcMain.handle('pkg:upgrade', (e, kind, key) => pkgRun(e, kind, 'upgrade', key));
ipcMain.handle('pkg:remove', (e, kind, key) => pkgRun(e, kind, 'uninstall', key));
ipcMain.handle('pkg:boards', async () => {
  if ((await toolsState()) === 'cli') return TOOLS_MISSING;
  const j = await jsonCmd(['board', 'listall', '--format', 'json']), arr = Array.isArray(j) ? j : ((j && j.boards) || []);
  return { ok: true, boards: arr.filter(b => b.fqbn).map(b => ({ name: b.name, fqbn: b.fqbn })) };
});
ipcMain.handle('pkg:urls', async (e, action, url) => {
  const send = l => e.sender.send('cli:output', l);
  if ((await toolsState()) === 'cli') return TOOLS_MISSING;
  const key = 'board_manager.additional_urls', u = String(url || '').trim();
  if (action === 'add' && /^https?:\/\//.test(u)) { await run(['config', 'add', key, u]); send('Updating the list of boards…'); await run(['core', 'update-index'], send); indexed.core = true; }
  if (action === 'remove' && u) await run(['config', 'remove', key, u]);
  const g = await run(['config', 'get', key]);
  return { ok: true, urls: [...new Set((g.so || g.out).match(/https?:\/\/[^\s\]\[,'"]+/g) || [])] };
});

ipcMain.handle('file:open', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { filters: [{ name: 'Arduino files', extensions: ['ino', 'h', 'hpp', 'cpp', 'c'] }], properties: ['openFile'] });
  return r.canceled ? null : { name: path.basename(r.filePaths[0]), text: fs.readFileSync(r.filePaths[0], 'utf8'), path: r.filePaths[0] };
});
ipcMain.handle('file:save', async (e, text, name) => {
  const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: name || 'sketch.ino', filters: [{ name: 'Arduino files', extensions: ['ino', 'h', 'hpp', 'cpp', 'c'] }] });
  if (!r.canceled) fs.writeFileSync(r.filePath, text);
  return { ok: !r.canceled, path: r.filePath };
});
ipcMain.handle('file:write', (e, p, text) => { try { fs.writeFileSync(p, text); return true; } catch { return false; } });
ipcMain.on('edit:cmd', (e, c) => {          // Edit menu: act on the focused text box of the window that asked
  const wc = e.sender, f = { undo: () => wc.undo(), redo: () => wc.redo(), cut: () => wc.cut(), copy: () => wc.copy(), paste: () => wc.paste(), selectAll: () => wc.selectAll() }[c];
  if (f) f();
});

app.whenReady().then(() => { Menu.setApplicationMenu(null); setupSession(); createWindow(); });
app.on('window-all-closed', () => app.quit());
