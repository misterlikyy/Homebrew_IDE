const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const script = path.join(root, 'hosting/linux/setup-server.sh').replace(/\\/g, '/');
for (const [id, family, packages] of [
  ['ubuntu', 'ubuntu', 'docker.io docker-compose-v2 docker-buildx openssl'],
  ['linuxmint', 'ubuntu', 'docker.io docker-compose-v2 docker-buildx openssl'],
  ['debian', 'debian', 'docker.io docker-compose docker-buildx openssl'],
  ['fedora', 'fedora', 'moby-engine docker-compose docker-buildx openssl']
]) test('Server setup detects ' + id + ' without installing packages or writing credentials', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ide-hosting-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const release = path.join(directory, 'os-release');
  fs.writeFileSync(release, `ID=${id}\nPRETTY_NAME="Test ${id}"\n`);
  const output = execFileSync(bash, [script, '--check-platform'], { encoding: 'utf8', env: { ...process.env, IDE_OS_RELEASE_FILE: release.replace(/\\/g, '/') } });
  assert.match(output, new RegExp('Package family: ' + family));
  assert.ok(output.includes('Default packages: ' + packages));
  assert.deepEqual(fs.readdirSync(directory), ['os-release']);
});
test('The Mint compatibility command uses the generic Linux setup', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ide-hosting-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const release = path.join(directory, 'os-release'); fs.writeFileSync(release, 'ID=fedora\nPRETTY_NAME="Fedora test"\n');
  const wrapper = path.join(root, 'hosting/linux/setup-mint.sh').replace(/\\/g, '/');
  const output = execFileSync(bash, [wrapper, '--check-platform'], { encoding: 'utf8', env: { ...process.env, IDE_OS_RELEASE_FILE: release.replace(/\\/g, '/') } });
  assert.match(output, /Package family: fedora/);
});
