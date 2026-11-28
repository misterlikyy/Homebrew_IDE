module.exports = async function checkSerial(editor, ipcMain) {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const address = process.platform === 'linux' ? '/dev/ttyUSB0' : 'COM5';
  let active = null, scans = 0, opens = 0, closes = 0, uploads = 0;
  const native = process.platform === 'linux';
  const replace = (name, action) => { ipcMain.removeHandler(name); ipcMain.handle(name, action); };
  if (native) {
    replace('serial:native:ports', () => ({ ok: true, ports: ++scans < 3 ? [] : [{ address, vid: 0x1a86, pid: 0x7523, serialNumber: 'test-uno' }] }));
    replace('serial:native:open', (event, path, baud, token) => {
      if (path !== address || baud !== 9600 || active) throw Error('Invalid monitor open');
      if (++opens === 1) return { ok: false, error: 'Port is still restarting (test)' };
      active = token; return { ok: true };
    });
    replace('serial:native:close', (event, token) => { if (active === token) { active = null; closes++; } return { ok: true }; });
    replace('serial:native:write', () => ({ ok: true }));
  } else {
    replace('serial:describe', () => [{ address, vid: 0x1a86, pid: 0x7523 }]);
    await editor.webContents.executeJavaScript(`
      window.testSerial = { scans: 0, opens: 0, closes: 0, active: false };
      window.testPort = {
        getInfo: () => ({ usbVendorId: 0x1a86, usbProductId: 0x7523 }),
        async open() {
          if (++testSerial.opens === 1) throw Error('Port is still restarting (test)');
          if (testSerial.active) throw Error('Monitor was not closed before upload');
          testSerial.active = true;
          this.readable = new ReadableStream({ start(c) { testSerial.controller = c; } });
          this.writable = new WritableStream();
        },
        async close() { if (testSerial.active) { testSerial.active = false; testSerial.closes++; } this.readable = this.writable = null; }
      };
      navigator.serial.getPorts = async () => ++testSerial.scans < 3 ? [] : [testPort];
      void 0;
    `);
  }
  replace('cli:upload', async () => {
    if (native ? active : await editor.webContents.executeJavaScript('testSerial.active')) throw Error('Upload tried to use a locked monitor');
    uploads++; return { ok: true, port: address };
  });
  await editor.webContents.executeJavaScript(`
    replaceWorkspace(newWorkspace('Serial regression', 1), '');
    fileOf('main.ino').text = 'void setup() { Serial.begin(9600); }\\nvoid loop() {}';
    loadEditor(); connInfo = null;
  `);
  for (let i = 0; i < 2; i++) {
    await editor.webContents.executeJavaScript('uploadMyCode()');
    if (!(await editor.webContents.executeJavaScript('connected && !!writer && !busy'))) throw Error('Post-upload monitor did not reconnect');
    const line = 'DISPLAY:Screen café ' + i + '\n';
    if (native) editor.webContents.send('serial:native:data', { token: active, kind: 'data', data: new TextEncoder().encode(line) });
    else await editor.webContents.executeJavaScript(`testSerial.controller.enqueue(new TextEncoder().encode(${JSON.stringify(line)}))`);
    await wait(100);
    if (!(await editor.webContents.executeJavaScript(`lastRxAt > 0 && $('#now').textContent.includes(${JSON.stringify('Screen café ' + i)})`))) throw Error('Reconnected dashboard did not receive actual serial text');
  }
  if (native) editor.webContents.send('serial:native:data', { token: active, kind: 'error', message: 'USB disconnected (test)' });
  else await editor.webContents.executeJavaScript("testSerial.controller.error(Error('USB disconnected (test)')); void 0;");
  await wait(100);
  if (!(await editor.webContents.executeJavaScript("!connected && $('#liveState').textContent.includes('last received data')"))) throw Error('Disconnected dashboard did not mark stale readings');
  for (let i = 0; i < 100; i++) { if (await editor.webContents.executeJavaScript('connected')) break; await wait(50); }
  if (!(await editor.webContents.executeJavaScript('connected'))) throw Error('Unexpected USB disconnect did not reconnect');
  await editor.webContents.executeJavaScript('disconnect()');
  await wait(500);
  if (await editor.webContents.executeJavaScript('connected || serialDesired')) throw Error('Manual disconnect triggered an unwanted reconnect');
  const counts = native ? { opens, closes } : await editor.webContents.executeJavaScript('({ opens: testSerial.opens, closes: testSerial.closes })');
  if (uploads !== 2 || counts.opens < 4 || counts.closes !== 3) throw Error('Serial retry or cleanup was not exercised: ' + JSON.stringify(counts));
};
