class NativeSerial {
  constructor({ getPorts, emit, loadSerial = () => require('serialport').SerialPort }) {
    this.getPorts = getPorts; this.emit = emit; this.loadSerial = loadSerial;
    this.connections = new Map();
  }
  async open(owner, address, baudRate, token) {
    if (typeof token !== 'string' || !/^[a-f0-9-]{36}$/.test(token)) throw Error('Invalid serial connection identifier.');
    if (!Number.isInteger(baudRate) || baudRate < 300 || baudRate > 2000000) throw Error('Unsupported baud rate.');
    const ports = await this.getPorts();
    if (!ports.some(port => port.address === address)) throw Error('The selected serial device is not available yet.');
    if (this.connections.has(owner)) throw Error('Close the existing serial connection before reopening it.');
    if ([...this.connections.values()].some(record => record.address === address)) throw Error('This Arduino is already connected in another app window.');
    const SerialPort = this.loadSerial();
    const port = new SerialPort({ path: address, baudRate, autoOpen: false, lock: true, highWaterMark: 65536 });
    const record = { owner, address, port, token, closing: false, opening: null };
    this.connections.set(owner, record);
    const send = value => this.emit(owner, { token, ...value });
    port.on('data', data => { if (!record.closing) send({ kind: 'data', data: new Uint8Array(data) }); });
    port.on('error', error => { send({ kind: 'error', message: error.message }); if (!record.closing) this.close(owner, token).catch(() => {}); });
    port.on('close', error => {
      if (this.connections.get(owner) === record) this.connections.delete(owner);
      send({ kind: 'closed', message: error?.message || '' });
    });
    record.opening = new Promise((resolve, reject) => port.open(error => error ? reject(error) : resolve()));
    try {
      await record.opening;
      if (record.closing) throw Error('Serial connection cancelled.');
      return { ok: true, token, address };
    } catch (error) {
      if (port.isOpen) await new Promise(resolve => port.close(() => resolve()));
      if (this.connections.get(owner) === record) this.connections.delete(owner);
      throw error;
    }
  }
  async close(owner, token) {
    const record = this.connections.get(owner);
    if (!record || (token && record.token !== token)) return;
    record.closing = true;
    try { await record.opening; } catch {}
    if (record.port.isOpen) await new Promise((resolve, reject) => record.port.close(error => error ? reject(error) : resolve()));
    if (this.connections.get(owner) === record) this.connections.delete(owner);
  }
  async write(owner, token, bytes) {
    const record = this.connections.get(owner);
    if (!record || record.token !== token || record.closing || !record.port.isOpen) throw Error('The Arduino serial connection is closed.');
    if (!ArrayBuffer.isView(bytes) || bytes.byteLength > 65536) throw Error('Invalid serial write.');
    const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    await new Promise((resolve, reject) => record.port.write(data, error => error ? reject(error) : record.port.drain(error => error ? reject(error) : resolve())));
  }
}
module.exports = { NativeSerial };
