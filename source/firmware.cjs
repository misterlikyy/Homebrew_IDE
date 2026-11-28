const path = require('path');

function readCommand(properties, port, platform = process.platform) {
  const props = Object.fromEntries(properties.split(/\r?\n/).map(line => {
    const at = line.indexOf('=');
    return at > 0 ? [line.slice(0, at).trim(), line.slice(at + 1).trim()] : [];
  }).filter(pair => pair.length));
  const root = props['tools.avrdude.path'] || props['runtime.tools.avrdude.path'];
  if (!root || root.includes('{') || props['build.mcu'] !== 'atmega328p' || props['upload.protocol'] !== 'arduino') {
    throw new Error('Firmware download currently supports the classic Arduino Uno (ATmega328P) with its serial bootloader.');
  }
  const paths = platform === 'win32' ? path.win32 : path.posix;
  return {
    command: paths.join(root, 'bin', platform === 'win32' ? 'avrdude.exe' : 'avrdude'),
    config: paths.join(root, 'etc', 'avrdude.conf'),
    // Read only: never erase, write, or override the device signature.
    args: ['-C', paths.join(root, 'etc', 'avrdude.conf'), '-p', 'atmega328p', '-c', 'arduino',
      '-P', port, '-b', '115200', '-n', '-D', '-U', 'flash:r:firmware.hex:i']
  };
}

function validateHex(text) {
  let base = 0, eof = false;
  const addresses = new Set();
  for (const line of text.trim().split(/\r?\n/)) {
    if (eof || !/^:(?:[0-9a-f]{2})+$/i.test(line)) throw new Error('The board returned invalid Intel HEX data.');
    const data = Buffer.from(line.slice(1), 'hex');
    if (data.length < 5 || data.length !== data[0] + 5 || data.reduce((sum, byte) => sum + byte, 0) % 256) {
      throw new Error('The firmware checksum is invalid. Try reading the board again.');
    }
    const count = data[0], address = data.readUInt16BE(1), type = data[3];
    if (type === 0) {
      if (base + address + count > 32768) throw new Error('The firmware is larger than Uno flash memory.');
      for (let i = 0; i < count; i++) addresses.add(base + address + i);
    } else if (type === 1 && count === 0 && address === 0) eof = true;
    else if ((type === 2 || type === 4) && count === 2 && address === 0) base = data.readUInt16BE(4) * (type === 2 ? 16 : 65536);
    else throw new Error('The board returned an unsupported Intel HEX record.');
  }
  if (!eof || !addresses.size) throw new Error('No complete firmware was read from the board.');
  return addresses.size;
}

module.exports = { readCommand, validateHex };
