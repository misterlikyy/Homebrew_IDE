(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IDESerial = api;
})(globalThis, function () {
  class StreamReader {
    constructor(port, options = {}) { this.port = port; this.options = options; this.stopped = false; this.reader = null; this.buffer = ''; this.timer = null; this.done = null; }
    deliver(line) { if (!line) return; try { this.options.onLine?.(line); } catch (error) { this.options.onError?.(error); } }
    consume(text) {
      clearTimeout(this.timer); this.buffer += text;
      let end;
      while ((end = this.buffer.indexOf('\n')) >= 0) { this.deliver(this.buffer.slice(0, end).trim()); this.buffer = this.buffer.slice(end + 1); }
      if (this.buffer.length > 65536) { this.buffer = ''; this.options.onError?.(Error('A serial line exceeded 64 KB and was dropped.')); }
      if (this.buffer.trim() && !/^(?:STEP|VAL|TEST|PINS|TIMING|DISPLAY):/.test(this.buffer.trim())) {
        this.timer = setTimeout(() => { this.deliver(this.buffer.trim()); this.buffer = ''; }, this.options.partialDelay ?? 220);
      }
    }
    start() { return this.done || (this.done = this.pump()); }
    async pump() {
      let error = null, failures = 0;
      while (!this.stopped && this.port.readable) {
        const stream = this.port.readable, decoder = new TextDecoder(); let failed = null;
        try {
          this.reader = stream.getReader();
          while (!this.stopped) {
            const result = await this.reader.read(); if (result.done) break;
            failures = 0; error = null; this.consume(decoder.decode(result.value, { stream: true }));
          }
          this.consume(decoder.decode());
        } catch (caught) { failed = caught; }
        finally { try { this.reader?.releaseLock(); } catch {} this.reader = null; }
        if (this.stopped) break;
        if (failed) {
          clearTimeout(this.timer); this.buffer = ''; error = failed;
          if (this.port.readable && this.port.readable !== stream && ++failures < 4) { this.options.onError?.(failed); continue; }
          break;
        }
        if (!this.port.readable || this.port.readable === stream) break;
      }
      clearTimeout(this.timer);
      if (!this.stopped && !error) this.deliver(this.buffer.trim());
      this.buffer = '';
      return { intentional: this.stopped, error };
    }
    async stop() { this.stopped = true; clearTimeout(this.timer); try { await this.reader?.cancel(); } catch {} if (this.done) await this.done; }
  }

  class Retry {
    constructor() { this.generation = 0; this.timer = null; this.wake = null; }
    cancel() { this.generation++; clearTimeout(this.timer); this.wake?.(); this.wake = null; }
    async run(attempt, options = {}) {
      this.cancel(); const generation = this.generation;
      for (let count = 0; count < (options.attempts ?? 20); count++) {
        if (count) await new Promise(resolve => { this.wake = resolve; this.timer = setTimeout(resolve, Math.min((options.delay ?? 400) * count, options.maxDelay ?? 1500)); });
        if (generation !== this.generation) return false;
        this.wake = null;
        if (await attempt(count)) return generation === this.generation;
      }
      return false;
    }
  }

  function chooseDevice(devices, remembered, preferred) {
    if (preferred) { const same = devices.find(device => device.port === preferred); if (same) return same; }
    if (remembered?.serialNumber) {
      const matches = devices.filter(device => device.serialNumber === remembered.serialNumber && (!remembered.key || device.key === remembered.key));
      return matches.length === 1 ? matches[0] : null;
    }
    if (remembered?.portName) {
      const same = devices.find(device => device.portName === remembered.portName && (!remembered.key || !device.key || device.key === remembered.key));
      if (same) return same;
      if (!remembered.key) return null;
    }
    if (remembered?.key) { const matches = devices.filter(device => device.key === remembered.key); return matches.length === 1 ? matches[0] : null; }
    const known = devices.filter(device => device.kind === 'arduino'); if (known.length === 1) return known[0];
    const likely = devices.filter(device => device.kind !== 'other'); return !known.length && likely.length === 1 ? likely[0] : null;
  }

  class NativePort {
    constructor(bridge, info) { this.bridge = bridge; this.info = info; this.readable = null; this.writable = null; this.token = null; this.unsubscribe = null; this.closing = null; this.native = true; }
    getInfo() { return { usbVendorId: this.info.vid ?? undefined, usbProductId: this.info.pid ?? undefined }; }
    finish(error) {
      try { if (error) this.controller?.error(error); else this.controller?.close(); } catch {}
      this.readable = null; this.writable = null; this.unsubscribe?.(); this.unsubscribe = null;
    }
    async open({ baudRate }) {
      if (this.readable || this.token) throw Error('This serial port is already open.');
      this.token = crypto.randomUUID();
      this.readable = new ReadableStream({ start: controller => { this.controller = controller; }, cancel: () => this.close() }, { highWaterMark: 65536, size: data => data.byteLength });
      this.writable = new WritableStream({ write: async data => { const result = await this.bridge.nativeSerialWrite(this.token, data); if (!result.ok) throw Error(result.error); } });
      this.unsubscribe = this.bridge.onNativeSerial(message => {
        if (message.token !== this.token) return;
        if (message.kind === 'data') {
          try { this.controller.enqueue(new Uint8Array(message.data)); } catch {}
        } else this.finish(message.kind === 'error' || message.message ? Error(message.message || 'Serial device disconnected.') : null);
      });
      try {
        const result = await this.bridge.nativeSerialOpen(this.info.address, baudRate, this.token);
        if (!result.ok) throw Error(result.error);
        if (!this.readable || !this.writable) throw Error('The serial device closed while connecting.');
      } catch (error) { await this.close(); throw error; }
    }
    async close() {
      if (this.closing) return this.closing;
      const token = this.token; if (!token) return;
      this.closing = (async () => {
        try { const result = await this.bridge.nativeSerialClose(token); if (!result.ok) throw Error(result.error); }
        finally { this.finish(); this.token = null; }
      })();
      try { await this.closing; } finally { this.closing = null; }
    }
  }
  return { StreamReader, Retry, chooseDevice, NativePort };
});
