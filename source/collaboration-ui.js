/* Online code sessions. Hardware and window layouts remain local. */
(() => {
  if (VIEW) { $('#shareProject').hidden = true; return; }
  const style = document.createElement('style');
  style.textContent = `
    #collabDialog{width:min(650px,94vw);max-height:88vh;overflow:auto;padding:24px}
    #collabDialog h2{margin:0 0 8px}#collabDialog h3{margin:20px 0 8px;font-size:14px}
    #collabDialog label{display:block;margin:12px 0 5px;font-size:12px;color:var(--mute)}
    #collabDialog input,#collabDialog textarea{width:100%;box-sizing:border-box;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:9px;font:12px var(--mono)}
    #collabDialog textarea{resize:vertical;min-height:70px}#collabDialog .collab-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
    #collabDialog .collab-note{color:var(--mute);font-size:12px;line-height:1.6}#collabError{color:var(--err);white-space:pre-wrap}
    #collabPeople{display:grid;gap:8px;padding:0;list-style:none}#collabPeople li{border-left:3px solid;padding-left:9px;font-size:12px}
    #collabCursors{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:5}.collab-caret{position:absolute;border-left:2px solid;height:20px}
    .collab-caret span{position:absolute;bottom:100%;left:-2px;font:10px var(--mono);color:#fff;padding:2px 4px;border-radius:3px;white-space:nowrap}
    #shareProject[data-live="true"]{border-color:var(--accent);color:var(--accent)}
  `;
  document.head.appendChild(style);
  const dialog = document.createElement('dialog'); dialog.id = 'collabDialog'; dialog.className = 'wdlg';
  dialog.setAttribute('aria-labelledby', 'collabHeading');
  dialog.innerHTML = `
    <h2 id="collabHeading">Share project</h2>
    <p class="collab-note">Work on code together across PCs. Each person keeps their own layout and Arduino controls. Circuit visualization and serial data are local in this first version.</p>
    <label for="collabName">Your display name</label><input id="collabName" maxlength="40" autocomplete="nickname" placeholder="Your name">
    <div id="collabSetup">
      <h3>Create a session</h3>
      <p class="collab-note">Enter your collaboration server address. A Linux Mint server setup is included in the repository.</p>
      <label for="collabServer">Server address</label><input id="collabServer" placeholder="https://collab.example.com" spellcheck="false">
      <label for="collabKey">Server creation key (from server setup)</label><input id="collabKey" type="password" autocomplete="off" placeholder="Not needed for a localhost test">
      <div class="collab-actions"><button id="collabCreate" class="primary">Share this project</button></div>
      <h3>Join a session</h3><label for="collabInvite">Invitation code</label><textarea id="collabInvite" spellcheck="false" placeholder="IDE1.…"></textarea>
      <div class="collab-actions"><button id="collabJoin">Join session</button><button id="collabRecover">Open recovered local draft</button></div>
    </div>
    <div id="collabSession" hidden>
      <h3 id="collabState">Connecting…</h3><p class="collab-note" id="collabDetail"></p>
      <ul id="collabPeople" aria-label="Session participants"></ul>
      <div id="collabOwner" hidden>
        <p id="collabInviteHint" class="collab-note"></p>
        <label for="collabEditorCode">Editor invitation — can change code</label><textarea id="collabEditorCode" readonly aria-label="Editor invitation"></textarea><button data-copy="collabEditorCode">Copy editor invitation</button>
        <label for="collabViewerCode">Viewer invitation — can read code</label><textarea id="collabViewerCode" readonly aria-label="Viewer invitation"></textarea><button data-copy="collabViewerCode">Copy viewer invitation</button>
        <details><summary>Owner recovery code — keep private</summary><p class="collab-note">Keep this code to reopen the session as its owner. Credentials are not stored in your sketch or project file.</p><textarea id="collabOwnerCode" readonly aria-label="Owner recovery invitation"></textarea><button data-copy="collabOwnerCode">Copy owner recovery code</button></details>
      </div>
      <div class="collab-actions"><button id="collabRotate" hidden>Replace guest invitations</button><button id="collabEnd" hidden>End session for everyone</button><button id="collabLeave">Leave session</button></div>
      <p class="collab-note">Leaving keeps a local copy of the shared code. File → Restore Previous Workspace returns to the project you had before joining. Sessions expire after 7 days without changes.</p>
    </div>
    <p id="collabError" role="status"></p><div class="collab-actions"><button id="collabClose">Close</button></div>`;
  document.body.appendChild(dialog);
  const overlay = document.createElement('div'); overlay.id = 'collabCursors'; overlay.setAttribute('aria-hidden', 'true'); $('.codewrap').appendChild(overlay);
  let session = null, applying = false, keys = {}, people = [], statusMessage = '', presenceTimer, changing = false, firstApply = false, joining = false;
  const palette = ['#df547b', '#00a893', '#9873e6', '#d78422', '#348ee4', '#a967a2'];
  const color = id => palette[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length];
  const error = message => { $('#collabError').textContent = message || ''; };
  const backup = () => { try { localStorage.setItem('ide.collab-recovery.' + WS, JSON.stringify(project)); } catch { error('Local draft storage is full. Save a project copy to disk.'); } };
  const cursor = () => session?.cursor(curFile()?.collabId, $('#code').selectionStart, $('#code').selectionEnd);
  const controller = window.ideCollaboration = {
    get active() { return !!session; }, get applying() { return applying; },
    get session() { return session; }, get readOnly() { return !!session && !['owner', 'editor'].includes(session.role); },
    onLocalChange() {
      if (!session || applying || changing) return;
      if (controller.readOnly) return;
      try { changing = true; session.sync(project); backup(); } catch (e) { error(e.message); } finally { changing = false; }
    },
    onCaret() {
      renderCursors(); clearTimeout(presenceTimer);
      presenceTimer = setTimeout(() => session?.send({ t: 'presence', cursor: cursor() }), 80);
    },
    undo(command) { if (session) { if (!controller.readOnly) session[command](); return true; } return false; }
  };
  function render() {
    $('#collabSetup').hidden = !!session; $('#collabSession').hidden = !session;
    $('#collabName').disabled = !!session; $('#shareProject').dataset.live = String(!!session);
    $('#code').readOnly = controller.readOnly; $('#newFileBtn').disabled = controller.readOnly;
    const owner = session?.role === 'owner';
    $('#collabOwner').hidden = !owner; $('#collabRotate').hidden = !owner; $('#collabEnd').hidden = !owner;
    $('#collabInviteHint').textContent = owner && !keys.editor ? 'You reopened this session with its owner code. Use Replace guest invitations to issue new guest codes.' : 'Share only the invitation for the access you want to grant.';
    if (!session) { $('#shareProject').textContent = 'Share project'; overlay.replaceChildren(); return; }
    const labels = { connecting: 'Connecting…', reconnecting: 'Reconnecting…', connected: 'Connected · saved', saving: 'Saving changes…', offline: 'Offline · local draft', ended: 'Session ended' };
    $('#collabState').textContent = labels[session.status] || session.status;
    $('#shareProject').textContent = session.status === 'connected' ? 'Sharing · ' + session.role : 'Sharing · ' + session.status;
    $('#collabDetail').textContent = statusMessage || ('Access: ' + (session.role || 'checking invitation') + '. ' + session.server);
    $('#collabPeople').replaceChildren();
    for (const person of people) {
      const row = document.createElement('li'); row.style.borderColor = color(person.id);
      const position = session.resolve(person.cursor), file = project.files.find(file => file.collabId === position?.file);
      const line = file && position ? file.text.slice(0, position.start).split('\n').length : null;
      row.textContent = person.name + (person.id === session.id ? ' (you)' : '') + ' · ' + person.role + (line ? ' · ' + file.name + ':' + line : '');
      $('#collabPeople').appendChild(row);
    }
    for (const [role, target] of [['editor', 'collabEditorCode'], ['viewer', 'collabViewerCode'], ['owner', 'collabOwnerCode']]) {
      $( '#' + target).value = keys[role] ? IDECollab.invitation(session.server, session.room, keys[role]) : '';
    }
    renderCursors();
  }
  function renderCursors() {
    overlay.replaceChildren(); if (!session) return;
    const text = $('#code'), font = getComputedStyle(text), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    ctx.font = font.font; const width = ctx.measureText('M').width, lineHeight = parseFloat(font.lineHeight) || 20;
    for (const person of people) {
      if (person.id === session.id) continue;
      const position = session.resolve(person.cursor); if (!position || position.file !== curFile()?.collabId) continue;
      const lines = text.value.slice(0, position.start).split('\n'), column = lines.at(-1).replace(/\t/g, '  ').length;
      const caret = document.createElement('div'); caret.className = 'collab-caret'; caret.style.borderColor = color(person.id);
      caret.style.left = (parseFloat(font.paddingLeft) + column * width - text.scrollLeft) + 'px';
      caret.style.top = (parseFloat(font.paddingTop) + (lines.length - 1) * lineHeight - text.scrollTop) + 'px';
      const label = document.createElement('span'); label.textContent = person.name; label.style.background = color(person.id); caret.appendChild(label); overlay.appendChild(caret);
    }
  }
  function apply(value, selection) {
    if (!session) return;
    applying = true;
    try {
      if (firstApply) {
        if (joining) { project.projectPath = ''; project.circuit = { parts: [] }; for (const file of project.files) delete file.path; }
        project.id = session.room; firstApply = false;
      }
      const previous = project.files, activeId = curFile()?.collabId, oldActive = project.active, ta = $('#code');
      const top = ta.scrollTop, left = ta.scrollLeft, focused = document.activeElement === ta;
      const next = value.files.map(file => ({ name: file.name, text: file.text, collabId: file.id, path: previous.find(old => old.collabId === file.id || (!old.collabId && old.name === file.name))?.path }));
      const namesById = new Map(next.map(file => [file.collabId, file.name]));
      const structureChanged = previous.length !== next.length || previous.some((file, index) => file.name !== next[index]?.name || file.collabId !== next[index]?.collabId);
      const open = project.open.map(name => namesById.get(previous.find(file => file.name === name)?.collabId) || (next.some(file => file.name === name) ? name : '')).filter(Boolean);
      project.files = next; project.name = value.name; project.open = open.length ? [...new Set(open)] : [next[0].name];
      project.active = namesById.get(activeId) || (next.some(file => file.name === oldActive) ? oldActive : project.open[0]);
      if (!project.open.includes(project.active)) project.open.push(project.active);
      const resolved = selection && session.resolve(selection);
      if (structureChanged || oldActive !== project.active) { renderTabs(); renderExplorer(); }
      if (ta.value !== curFile().text || oldActive !== project.active) loadEditor();
      ta.scrollTop = top; ta.scrollLeft = left; syncScroll();
      if (resolved?.file === curFile()?.collabId) ta.setSelectionRange(resolved.start, resolved.end);
      if (focused) ta.focus();
      compileProblems = []; queueLint(); saveProject(); broadcastProject(true); controller.onCaret();
    } finally { applying = false; render(); }
  }
  function start(invite, ownerKeys = {}, isJoin = false) {
    firstApply = true; joining = isJoin;
    keys = ownerKeys; people = []; error(''); statusMessage = '';
    session = new IDECollab.Session({ ...invite, name: $('#collabName').value,
      beforeRemote: cursor, onProject: apply, beforeReject: backup,
      onReady: () => render(), onPeople: value => { people = value; render(); },
      onInvites: value => { keys = { ...keys, ...value }; render(); },
      onStatus: (status, message) => { statusMessage = message || ''; render(); },
      onError: error, onEnded: () => { backup(); const ended = statusMessage; leave(); error(ended); }
    });
    render(); session.connect();
  }
  function rememberDraft() {
    try { localStorage.setItem('ide.previous-workspace.' + WS, JSON.stringify(project)); } catch { throw Error('Could not back up the current workspace. Save it to disk before joining.'); }
    backup();
  }
  function leave() {
    backup(); session?.close(); session = null; keys = {}; people = []; clearTimeout(presenceTimer); render(); saveProject();
    $('#collabKey').value = ''; $('#collabInvite').value = ''; for (const id of ['collabOwnerCode', 'collabEditorCode', 'collabViewerCode']) $('#' + id).value = '';
  }
  async function action(fn) {
    error(''); $('#collabCreate').disabled = $('#collabJoin').disabled = true;
    try {
      if (!$('#collabName').value.trim()) throw Error('Enter a display name.');
      localStorage.setItem('ide.collab-name', $('#collabName').value.trim()); await fn();
    } catch (e) { error(e.message); }
    finally { $('#collabCreate').disabled = $('#collabJoin').disabled = false; }
  }
  $('#collabCreate').onclick = () => action(async () => {
    if (needApp()) throw Error('Use the desktop app to create a session.');
    const address = IDECollab.serverUrl($('#collabServer').value);
    rememberDraft(); localStorage.setItem('ide.collab-server', address);
    const result = await window.uno.createSession(address, { name: project.name, files: filesPayload() }, $('#collabKey').value);
    $('#collabKey').value = ''; if (!result.ok) throw Error(result.error);
    start({ server: address, room: result.room, token: result.keys.owner }, result.keys);
  });
  $('#collabJoin').onclick = () => action(async () => {
    const invite = IDECollab.parseInvitation($('#collabInvite').value);
    if (!(await askConfirm('Join this shared project on ' + invite.server + '? Your current workspace will be backed up, then the session code will open here.', 'Join session'))) return;
    rememberDraft(); start(invite, { owner: invite.token }, true); $('#collabInvite').value = '';
  });
  $('#collabRecover').onclick = () => {
    try { const draft = JSON.parse(localStorage.getItem('ide.collab-recovery.' + WS)); if (!draft) throw Error('No recovered draft is available.'); replaceWorkspace(draft, draft.projectPath); dialog.close(); }
    catch (e) { error(e.message); }
  };
  $('#collabLeave').onclick = async () => { if (await askConfirm('Leave this session? A local copy of the code will stay open. Unsent edits are backed up locally.', 'Leave session')) leave(); };
  $('#collabRotate').onclick = async () => { if (await askConfirm('Replace both guest invitations? Current editors and viewers will be disconnected and need the new codes.', 'Replace invitations')) session?.send({ t: 'rotate' }); };
  $('#collabEnd').onclick = async () => { if (await askConfirm('End this session for everyone and delete its server copy? Each participant keeps their local draft.', 'End session')) session?.send({ t: 'end' }); };
  dialog.querySelectorAll('[data-copy]').forEach(button => { button.onclick = async () => {
    const field = $('#' + button.dataset.copy);
    try { await navigator.clipboard.writeText(field.value); flash('Invitation copied'); } catch { field.focus(); field.select(); error('Press Ctrl+C to copy the selected invitation.'); }
  }; });
  $('#shareProject').onclick = () => { render(); error(''); if (!dialog.open) dialog.showModal(); };
  $('#collabClose').onclick = () => dialog.close();
  $('#code').addEventListener('scroll', renderCursors);
  $('#code').addEventListener('beforeinput', event => { if (controller.readOnly) event.preventDefault(); });
  $('#code').addEventListener('compositionstart', () => { if (session) session.composing = true; });
  $('#code').addEventListener('compositionend', () => { setTimeout(() => session?.resumeUpdates(), 0); });
  document.addEventListener('keydown', event => {
    if (!session || event.target !== $('#code') || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z' || key === 'y') { event.preventDefault(); event.stopImmediatePropagation(); controller.undo(key === 'y' || event.shiftKey ? 'redo' : 'undo'); }
  }, true);
  window.addEventListener('beforeunload', () => { if (session) { controller.onLocalChange(); backup(); session.flush(); } });
  try { $('#collabName').value = localStorage.getItem('ide.collab-name') || ''; $('#collabServer').value = localStorage.getItem('ide.collab-server') || 'http://127.0.0.1:1234'; } catch {}
})();
