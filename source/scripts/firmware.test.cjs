const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const { EventEmitter } = require('events');
const { readCommand, validateHex } = require('../firmware.cjs');
const hex = ':0400000001020304F2\n:00000001FF\n';
const root = path.resolve(__dirname, '..');

test('Windows and Linux commands only read flash and keep spaced paths intact', () => {
  for (const platform of ['win32', 'linux']) {
    const tool = platform === 'win32' ? 'C:\\Arduino Tools\\avrdude' : '/home/user/Arduino Tools/avrdude';
    const reader = readCommand(`tools.avrdude.path=${tool}\nbuild.mcu=atmega328p\nupload.protocol=arduino`, platform === 'win32' ? 'COM7' : '/dev/ttyACM0', platform);
    assert.ok(reader.command.includes('Arduino Tools'));
    assert.equal(reader.args.at(-1), 'flash:r:firmware.hex:i');
    assert.ok(reader.args.includes('-n'));
    assert.ok(reader.args.includes('-D'));
    assert.ok(!reader.args.some(arg => /:w:/.test(arg) || ['-e', '-F'].includes(arg)));
  }
  assert.throws(() => readCommand('build.mcu=atmega4809', 'COM7'), /classic Arduino Uno/);
});

test('HEX validation rejects corrupt, empty, truncated and out-of-range data', () => {
  assert.equal(validateHex(hex), 4);
  for (const value of ['', ':00000001FF', hex.replace('F2', 'F3'), hex.split('\n')[0], hex + hex,
    ':048000000102030472\n:00000001FF', ':020000040001F9\n' + hex]) {
    assert.throws(() => validateHex(value));
  }
});

function harness(t, mode = 'ok') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ide-read-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'bin'));
  fs.mkdirSync(path.join(directory, 'etc'));
  const tool = path.join(directory, 'bin', process.platform === 'win32' ? 'avrdude.exe' : 'avrdude');
  fs.writeFileSync(tool, ''); fs.writeFileSync(path.join(directory, 'etc', 'avrdude.conf'), '');
  const target = path.join(directory, 'existing.hex');
  fs.writeFileSync(target, 'keep this backup');
  const handlers = {}, calls = [], temporary = [], messages = [];
  let unblock;
  const app = { getPath: () => directory, setPath() {}, whenReady: () => ({ then() {} }), on() {} };
  const electron = { app, ipcMain: { handle: (name, handler) => { handlers[name] = handler; }, on() {} },
    BrowserWindow: { fromWebContents: () => ({}) },
    dialog: { showSaveDialog: async () => mode === 'cancel' ? { canceled: true } : { filePath: target }, showMessageBoxSync: () => 0 } };
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.kill = () => child.emit('close', -1);
    const respond = () => {
      let output = '', code = 0;
      if (args[0] === 'version') output = 'arduino-cli version';
      else if (args[0] === 'core') output = 'arduino:avr 1.8.8';
      else if (args[0] === 'board' && args[1] === 'list') output = JSON.stringify({ detected_ports: [{ port: { protocol: 'serial', address: 'COM7' }, matching_boards: [{ name: 'Uno' }] }] });
      else if (args[0] === 'board' && args[1] === 'details') output = `tools.avrdude.path=${directory}\nbuild.mcu=atmega328p\nupload.protocol=arduino`;
      else if (command === tool) {
        temporary.push(options.cwd);
        if (mode === 'failure') { code = 1; output = 'programmer is not responding'; }
        else fs.writeFileSync(path.join(options.cwd, 'firmware.hex'), mode === 'corrupt' ? hex.replace('F2', 'F3') : hex);
      } else throw new Error('Unexpected tool invocation');
      child.stdout.emit('data', Buffer.from(output)); child.emit('close', code);
    };
    if (mode === 'hold' && calls.length === 1) unblock = respond;
    else queueMicrotask(respond);
    return child;
  };
  const localRequire = createRequire(path.join(root, 'main.js'));
  vm.runInNewContext(fs.readFileSync(path.join(root, 'main.js'), 'utf8'), {
    require: name => name === 'electron' ? electron : name === 'child_process' ? { spawn } : localRequire(name),
    process: { platform: process.platform, argv: [] }, __dirname: root, setTimeout, clearTimeout, console, Buffer
  });
  const event = { sender: { isDestroyed: () => false, send: (channel, line) => messages.push(line) } };
  return { read: fqbn => handlers['cli:readFirmware'](event, fqbn), upload: () => handlers['cli:upload'](event, [], 'arduino:avr:uno'),
    target, calls, temporary, messages, unblock: () => unblock() };
}

test('Readback saves validated HEX, returns viewer data and cleans temporary files', async t => {
  const h = harness(t);
  const result = await h.read('arduino:avr:uno');
  assert.equal(result.ok, true); assert.equal(result.bytes, 4); assert.equal(result.text, hex);
  assert.equal(fs.readFileSync(h.target, 'utf8'), hex);
  assert.equal(h.temporary.length, 1);
  assert.ok(h.temporary.every(dir => !fs.existsSync(dir)));
  assert.ok(!h.calls.some(call => ['upload', 'compile', 'burn-bootloader'].includes(call.args[0])));
});

for (const mode of ['cancel', 'failure', 'corrupt']) test(mode + ' preserves an existing backup and releases the board lock', async t => {
  const h = harness(t, mode);
  const result = await h.read('arduino:avr:uno');
  assert.equal(result.ok, false);
  assert.equal(fs.readFileSync(h.target, 'utf8'), 'keep this backup');
  assert.ok(h.temporary.every(dir => !fs.existsSync(dir)));
  assert.doesNotMatch((await h.read('arduino:avr:uno')).error || '', /Another board operation/);
  if (mode === 'cancel') assert.ok(!h.calls.some(call => call.command.endsWith('avrdude.exe') || call.command.endsWith('/avrdude')));
});

test('Unsupported boards and overlapping read/upload operations never touch the board', async t => {
  const h = harness(t, 'hold');
  assert.equal((await h.read('arduino:avr:mega')).ok, false);
  assert.equal(h.calls.length, 0);
  const pending = h.read('arduino:avr:uno');
  assert.match((await h.read('arduino:avr:uno')).error, /Another board operation/);
  assert.match((await h.upload()).error, /Another board operation/);
  h.unblock();
  assert.equal((await pending).ok, true);
});
