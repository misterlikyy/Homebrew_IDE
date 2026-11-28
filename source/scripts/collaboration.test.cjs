const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { WebSocket } = require('ws');
const { createServer } = require('../collaboration/server.cjs');
const model = require('../collaboration/model.cjs');
const { Y, LOCAL, REMOTE } = model;
const { Session, invitation, parseInvitation, serverUrl } = require('../collaboration/client.cjs');
global.WebSocket = WebSocket;
const project = () => ({ name: 'Joint Arduino café', files: [{ name: 'main.ino', text: 'void setup() {}\nvoid loop() {}\n' }] });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) { for (let i = 0; i < 250; i++) { if (check()) return; await wait(20); } throw Error('Timed out waiting for collaboration state'); }
const clone = doc => { const result = new Y.Doc(); Y.applyUpdate(result, Y.encodeStateAsUpdate(doc), REMOTE); return result; };
const merge = (a, b) => { Y.applyUpdate(b, Y.encodeStateAsUpdate(a), REMOTE); Y.applyUpdate(a, Y.encodeStateAsUpdate(b), REMOTE); };
const text = doc => doc.getMap('files').get('initial-000').get('text');

test('Concurrent typing merges and undo preserves the other participant’s edits', () => {
  const a = model.createDocument(project()), b = clone(a);
  const undo = new Y.UndoManager(a.getMap('files'), { trackedOrigins: new Set([LOCAL]) });
  a.transact(() => text(a).insert(0, '// Alice\n'), LOCAL);
  b.transact(() => text(b).insert(0, '// Bob\n'), LOCAL);
  merge(a, b);
  assert.equal(text(a).toString(), text(b).toString());
  assert.match(text(a).toString(), /Alice/); assert.match(text(a).toString(), /Bob/);
  undo.undo(); merge(a, b);
  assert.doesNotMatch(text(a).toString(), /Alice/); assert.match(text(a).toString(), /Bob/);
  undo.destroy(); a.destroy(); b.destroy();
});

test('Concurrent file creation, rename and deletion converge with stable file identities', () => {
  const a = model.createDocument(project()), b = clone(a);
  const list = doc => model.snapshot(doc).files.map(file => ({ ...file, collabId: file.id }));
  const af = list(a), bf = list(b);
  af.push({ name: 'helpers.h', text: '// A' }); bf.push({ name: 'helpers.h', text: '// B' });
  model.syncProject(a, { name: 'Joint', files: af }); model.syncProject(b, { name: 'Joint', files: bf }); merge(a, b);
  assert.deepEqual(model.snapshot(a), model.snapshot(b));
  assert.equal(new Set(model.snapshot(a).files.map(file => file.name)).size, 3);
  const next = list(a); next.find(file => file.name === 'main.ino').name = 'renamed.ino';
  model.syncProject(a, { name: 'Joint', files: next }); merge(a, b);
  assert.ok(model.snapshot(b).files.some(file => file.id === 'initial-000' && file.name === 'renamed.ino'));
  model.syncProject(b, { name: 'Joint', files: list(b).filter(file => file.id === 'initial-000') }); merge(a, b);
  assert.equal(model.snapshot(a).files.length, 1); a.destroy(); b.destroy();
});

test('Relative cursors follow edits and invitations require a secure public endpoint', () => {
  const a = model.createDocument(project()), b = clone(a), cursor = model.cursor(b, 'initial-000', 5, 5);
  a.transact(() => text(a).insert(0, 'abc'), LOCAL); merge(a, b);
  assert.equal(model.resolveCursor(b, cursor).start, 8);
  const room = '01234567-89ab-cdef-0123-456789abcdef', token = 'a'.repeat(43);
  assert.deepEqual(parseInvitation(invitation('https://collab.example.com', room, token)), { server: 'https://collab.example.com', room, token });
  assert.equal(serverUrl('http://192.168.1.10:1234'), 'http://192.168.1.10:1234');
  assert.throws(() => serverUrl('http://example.com'), /HTTPS/);
  assert.throws(() => parseInvitation('not an invitation'));
  a.destroy(); b.destroy();
});

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ide-collab-test-')), clients = [];
  const key = 'test-create-key-only-' + 'a'.repeat(32);
  let service = createServer({ directory, createKey: key });
  await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
  const port = service.server.address().port, server = 'http://127.0.0.1:' + port;
  t.after(async () => { clients.forEach(client => client.close()); await service.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const create = async (creationKey = key) => fetch(server + '/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + creationKey }, body: JSON.stringify(project()) });
  const response = await create(), room = await response.json(); assert.equal(response.status, 201);
  const connect = async role => {
    const errors = [], events = [];
    const client = new Session({ server, room: room.room, token: room.keys[role], name: role, onError: error => errors.push(error), onStatus: status => events.push(status) });
    client.errors = errors; client.events = events; clients.push(client); client.connect(); await until(() => client.status === 'connected'); return client;
  };
  return { directory, room, create, connect, get service() { return service; },
    async restart() { await service.close(); service = createServer({ directory, createKey: key }); await new Promise(resolve => service.server.listen(port, '127.0.0.1', resolve)); } };
}

test('Real server authenticates invitations, merges live edits, and enforces viewer and owner permissions', async t => {
  const f = await fixture(t), owner = await f.connect('owner'), editor = await f.connect('editor'), viewer = await f.connect('viewer');
  assert.equal((await f.create('wrong key')).status, 401);
  owner.doc.transact(() => text(owner.doc).insert(0, '// owner\n'), LOCAL);
  editor.doc.transact(() => text(editor.doc).insert(0, '// editor\n'), LOCAL);
  owner.flush(); editor.flush();
  await until(() => /owner/.test(text(viewer.doc).toString()) && /editor/.test(text(viewer.doc).toString()));
  assert.equal(text(owner.doc).toString(), text(editor.doc).toString());
  assert.equal(text(editor.doc).toString(), text(viewer.doc).toString());
  viewer.send({ t: 'update', state: Buffer.from(Y.encodeStateAsUpdate(viewer.doc)).toString('base64') });
  editor.send({ t: 'end' });
  await until(() => viewer.errors.length && editor.errors.length);
  assert.match(viewer.errors[0], /Viewer/); assert.match(editor.errors[0], /owner/);
  owner.send({ t: 'presence', cursor: owner.cursor('initial-000', 0, 0) });
  await until(() => editor.people.some(person => person.role === 'owner' && person.cursor));
  const persisted = fs.readFileSync(path.join(f.directory, f.room.room + '.json'), 'utf8');
  for (const key of Object.values(f.room.keys)) assert.ok(!persisted.includes(key), 'Raw invitation token must not be persisted');
  assert.equal(model.snapshot(f.service.rooms.get(f.room.room).doc).name, 'Joint Arduino café');
});

test('Reconnect after server restart merges offline edits with the persisted shared project', async t => {
  const f = await fixture(t), owner = await f.connect('owner'), editor = await f.connect('editor');
  owner.doc.transact(() => text(owner.doc).insert(0, '// saved\n'), LOCAL); owner.flush();
  await until(() => owner.status === 'connected' && /saved/.test(text(editor.doc).toString()));
  await f.restart();
  await until(() => !owner.ready);
  owner.doc.transact(() => text(owner.doc).insert(0, '// offline owner\n'), LOCAL);
  editor.doc.transact(() => text(editor.doc).insert(0, '// offline editor\n'), LOCAL);
  await until(() => owner.status === 'connected' && editor.status === 'connected' && /offline editor/.test(text(owner.doc).toString()) && /offline owner/.test(text(editor.doc).toString()));
  assert.equal(text(owner.doc).toString(), text(editor.doc).toString());
  assert.match(text(editor.doc).toString(), /saved/);
});

test('Owner can revoke guest invitations and end the persisted session', async t => {
  const f = await fixture(t), owner = await f.connect('owner'), viewer = await f.connect('viewer');
  let keys; owner.options.onInvites = value => { keys = value; };
  owner.send({ t: 'rotate' });
  await until(() => keys && viewer.status === 'ended');
  assert.notEqual(keys.viewer, f.room.keys.viewer); assert.equal(owner.ready, true);
  owner.send({ t: 'end' });
  await until(() => owner.status === 'ended');
  assert.ok(!fs.existsSync(path.join(f.directory, f.room.room + '.json')));
});

test('Composition defers incoming edits and merges them after the local composition completes', async t => {
  const f = await fixture(t), owner = await f.connect('owner'), editor = await f.connect('editor');
  editor.composing = true;
  owner.doc.transact(() => text(owner.doc).insert(0, '// remote\n'), LOCAL); owner.flush();
  await until(() => editor.deferred.length > 0);
  assert.doesNotMatch(text(editor.doc).toString(), /remote/);
  editor.doc.transact(() => text(editor.doc).insert(0, '// local café\n'), LOCAL); editor.flush();
  editor.resumeUpdates();
  await until(() => /remote/.test(text(editor.doc).toString()) && /local café/.test(text(owner.doc).toString()));
  assert.equal(text(editor.doc).toString(), text(owner.doc).toString());
});
