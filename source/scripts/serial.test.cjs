const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { StreamReader, Retry, chooseDevice, NativePort } = require('../serial-runtime.js');
const { NativeSerial } = require('../native-serial.cjs');
const { serverUrl } = require('../collaboration/url.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) { for (let i = 0; i < 200; i++) { if (check()) return; await wait(10); } throw Error('Serial test timed out'); }

test('Local HTTP addresses are accepted; bind aliases connect to localhost; public HTTP is rejected', () => {
  for (const host of ['127.0.0.1', '127.0.2.3', 'localhost', 'localhost.', '[::1]', '192.168.1.2', '10.0.1.2', '172.16.0.1']) assert.equal(serverUrl('http://' + host + ':1234'), 'http://' + host + ':1234');
  for (const host of ['127.0.0.0', '0.0.0.0']) assert.equal(serverUrl('http://' + host + ':1234'), 'http://127.0.0.1:1234');
  for (const host of ['example.com', '127.0.0.1.example.com', '192.168.1.2.example.com', '172.32.0.1', '128.0.0.1']) assert.throws(() => serverUrl('http://' + host), /HTTPS/);
});

test('Serial reader preserves fragmented Unicode and telemetry, reports errors and releases its stream', async () => {
  let controller; const port = { readable: new ReadableStream({ start(c) { controller = c; } }) };
  const lines = [], errors = [], input = new TextEncoder().encode('DISPLAY:café 😀\nPINS:0,1\n');
  const reader = new StreamReader(port, { onLine: line => lines.push(line), onError: error => errors.push(error), partialDelay: 5 });
  reader.start();
  for (const byte of input) controller.enqueue(new Uint8Array([byte]));
  await until(() => lines.length === 2);
  assert.deepEqual(lines, ['DISPLAY:café 😀', 'PINS:0,1']);
  controller.enqueue(new TextEncoder().encode('DISPLAY:wait')); await wait(20); assert.equal(lines.length, 2);
  controller.enqueue(new TextEncoder().encode('ing\nplain text')); await until(() => lines.length === 4);
  assert.deepEqual(lines.slice(2), ['DISPLAY:waiting', 'plain text']);
  await reader.stop(); assert.equal(port.readable.locked, false); assert.equal(errors.length, 0);
});

test('Reader resumes after recoverable Web Serial errors and identifies fatal disconnection', async () => {
  let old, next;
  const first = new ReadableStream({ start(c) { old = c; } });
  const port = { readable: first }, lines = [];
  const reader = new StreamReader(port, { onLine: line => lines.push(line) }); const done = reader.start();
  port.readable = new ReadableStream({ start(c) { next = c; } }); old.error(Error('framing error'));
  await wait(10); next.enqueue(new TextEncoder().encode('DISPLAY:back\n')); await until(() => lines.length);
  next.error(Error('unplugged')); const result = await done;
  assert.equal(result.intentional, false); assert.match(result.error.message, /unplugged/); assert.equal(first.locked, false);
});

test('Reconnect retries delayed discovery and busy opens; cancellation stops later attempts', async () => {
  const retry = new Retry(); let count = 0;
  assert.equal(await retry.run(async () => ++count === 4, { attempts: 5, delay: 1, maxDelay: 1 }), true);
  assert.equal(count, 4); count = 0;
  const done = retry.run(async () => { count++; return false; }, { delay: 50 });
  await wait(5); retry.cancel(); assert.equal(await done, false); await wait(60); assert.equal(count, 1);
});

test('Device selection follows the uploaded path or serial number and refuses ambiguous boards', () => {
  const a = { portName: '/dev/ttyUSB0', key: '1a86:7523', serialNumber: 'A', kind: 'likely' };
  const b = { ...a, portName: '/dev/ttyUSB1', serialNumber: 'B' };
  assert.equal(chooseDevice([a, b], { portName: b.portName }), b);
  assert.equal(chooseDevice([a, b], { key: a.key }), null);
  assert.equal(chooseDevice([a, b], { serialNumber: 'A', portName: '/dev/ttyUSB9' }), a);
  assert.equal(chooseDevice([b], { serialNumber: 'A' }), null);
});

test('Native serial bridge carries bytes both ways and releases the port for another upload', async () => {
  const { SerialPortMock } = require('serialport');
  SerialPortMock.binding.reset(); SerialPortMock.binding.createPort('/dev/ttyUSB0', { record: true });
  let receive;
  const backend = new NativeSerial({ getPorts: async () => [{ address: '/dev/ttyUSB0' }], emit: (owner, message) => receive?.(message), loadSerial: () => SerialPortMock });
  const bridge = {
    onNativeSerial: fn => { receive = fn; return () => { receive = null; }; },
    nativeSerialOpen: (address, baud, token) => backend.open(1, address, baud, token),
    nativeSerialWrite: async (token, bytes) => { await backend.write(1, token, bytes); return { ok: true }; },
    nativeSerialClose: async token => { await backend.close(1, token); return { ok: true }; }
  };
  const port = new NativePort(bridge, { address: '/dev/ttyUSB0' }); await port.open({ baudRate: 9600 });
  const record = backend.connections.get(1), lines = [];
  const reader = new StreamReader(port, { onLine: line => lines.push(line) }); reader.start();
  record.port.port.emitData('DISPLAY:real bytes\n'); await until(() => lines.length);
  assert.deepEqual(lines, ['DISPLAY:real bytes']);
  const writer = port.writable.getWriter(); await writer.write(new TextEncoder().encode('ping\n')); writer.releaseLock();
  assert.equal(record.port.port.recording.toString(), 'ping\n');
  await assert.rejects(backend.open(2, '/dev/ttyUSB0', 9600, randomUUID()), /another app window/);
  await assert.rejects(backend.write(2, port.token, new Uint8Array([1])), /closed/);
  await backend.close(1, randomUUID()); assert.equal(record.port.isOpen, true);
  await reader.stop(); await port.close(); assert.equal(backend.connections.size, 0);
  await port.open({ baudRate: 115200 }); await port.close(); assert.equal(backend.connections.size, 0);
});

test('Linux native serial driver reads and writes a real pseudo-terminal and reopens it', { skip: process.platform !== 'linux', timeout: 15000 }, async () => {
  const child = spawn('python3', ['-u', require('node:path').join(__dirname, 'serial-pty.py')], { stdio: ['pipe', 'pipe', 'inherit'] });
  const output = createInterface({ input: child.stdout }); const iterator = output[Symbol.asyncIterator]();
  let backend;
  try {
    const address = JSON.parse((await iterator.next()).value).path, messages = [];
    backend = new NativeSerial({ getPorts: async () => [{ address }], emit: (_, message) => messages.push(message) });
    const token = randomUUID(); await backend.open(1, address, 9600, token);
    child.stdin.write('send\n'); await until(() => messages.some(m => m.kind === 'data'));
    assert.match(Buffer.concat(messages.filter(m => m.kind === 'data').map(m => Buffer.from(m.data))).toString(), /DISPLAY:PTY live/);
    await backend.write(1, token, new TextEncoder().encode('ping\n'));
    child.stdin.write('read\n'); assert.equal(JSON.parse((await iterator.next()).value).received, 'ping\n');
    await backend.close(1, token); await backend.open(1, address, 115200, randomUUID()); await backend.close(1);
  } finally { if (backend) await backend.close(1); output.close(); child.kill(); await once(child, 'exit'); }
});
