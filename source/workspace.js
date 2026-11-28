/* Project files, startup choices, and the separate Visualization window. */
const workspaceViews = ['code', 'dash', 'board', 'mon', 'log'];
let workspaceHasProjectStep = true;
let workspaceStep = 1;
let workspaceStarted = false;

function selectedWorkspaceViews() {
  return [...document.querySelectorAll('#workspaceTabChoices input:checked')].map(input => input.value);
}

function applyWorkspaceViews(views) {
  const selected = workspaceViews.filter(view => views.includes(view));
  if (!selected.length) selected.push('code');
  for (const view of workspaceViews) $('#tab' + VIEWS[view]).hidden = !selected.includes(view);
  project.visibleViews = selected;
  try { localStorage.setItem('ide.workspace-tabs', JSON.stringify(selected)); } catch {}
  if (!selected.includes(currentView)) show(selected[0]);
}

function openVisualization() {
  if (VIEW === 'proj') return;
  popOut('proj');
}

function projectBundle() {
  return {
    format: 'ide-beta-project', version: 1, id: project.id, name: project.name,
    files: filesPayload(), open: project.open.slice(), active: project.active,
    visibleViews: (project.visibleViews || workspaceViews).slice(),
    circuit: project.circuit || { parts: [] }
  };
}

async function saveProjectToDisk(saveAs) {
  if (VIEW) {
    saveProject();
    broadcastProject(false);
    post({ t: 'save-project', to: OWNER, saveAs: !!saveAs });
    if (inApp) window.uno.focusWindow(OWNER);
    return;
  }
  if (needApp()) return;
  try {
    const result = await window.uno.saveProject(projectBundle(), project.projectPath || '', !!saveAs);
    if (result.cancelled) return;
    if (!result.ok) throw new Error(result.error);
    project.projectPath = result.path;
    saveProject();
    flash('Saved project ' + project.name);
  } catch (error) { out('Could not save project: ' + error.message, true); }
}

function replaceWorkspace(value, projectPath) {
  if (window.ideCollaboration?.active) throw new Error('Leave the shared session before opening a different project.');
  if (!value || !Array.isArray(value.files) || !value.files.length) throw new Error('The project has no sketch files.');
  const files = value.files.map(file => ({ name: file.name, text: file.text }));
  const names = files.map(file => file.name);
  const open = Array.isArray(value.open) ? value.open.filter(name => names.includes(name)) : names.slice();
  if (!open.length) open.push(names[0]);
  const active = names.includes(value.active) ? value.active : open[0];
  if (!open.includes(active)) open.push(active);
  for (const key of Object.keys(project)) delete project[key];
  Object.assign(project, {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Arduino project',
    files, open, active, projectPath: projectPath || '',
    circuit: value.circuit && Array.isArray(value.circuit.parts) ? value.circuit : { parts: [] }
  });
  projSel = null;
  compileProblems = [];
  renderTabs(); renderExplorer(); loadEditor(); queueLint();
  saveProject();
  broadcastProject(true);
}

function newWorkspace(name, count) {
  if (!name.trim()) throw new Error('Give the project a name.');
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Choose between 1 and 100 sketch files.');
  const files = [{ name: 'main.ino', text: SKELETON }];
  for (let i = 2; i <= count; i++) {
    files.push({ name: i === 2 ? 'helpers.ino' : 'sketch_' + i + '.ino',
      text: '// Supporting functions for ' + name.trim().replace(/[\r\n]/g, ' ') + '.\n// setup() and loop() are in main.ino.\n\n' });
  }
  return { id: crypto.randomUUID(), name: name.trim(), files, open: files.map(file => file.name), active: 'main.ino', circuit: { parts: [] } };
}

function setWorkspaceStep(step) {
  workspaceStep = step;
  $('#workspaceTabsStep').hidden = step !== 1;
  $('#workspaceProjectStep').hidden = step !== 2;
  $('#workspaceBack').hidden = step === 1;
  $('#workspaceHeading').textContent = step === 1 ? 'Choose your workspace' : 'Open or create a project';
  $('#workspaceNext').textContent = step === 1 && workspaceHasProjectStep ? 'Next' : 'Open workspace';
  $('#workspaceError').textContent = '';
}

function openWorkspaceSetup(chooseProject = true) {
  if (VIEW) return;
  workspaceHasProjectStep = chooseProject;
  let choices = project.visibleViews;
  if (!Array.isArray(choices)) {
    try { choices = JSON.parse(localStorage.getItem('ide.workspace-tabs')); } catch {}
  }
  if (!Array.isArray(choices)) choices = workspaceViews;
  document.querySelectorAll('#workspaceTabChoices input').forEach(input => { input.checked = choices.includes(input.value); });
  $('#workspaceName').value = project.name;
  $('#workspaceVisualization').checked = false;
  const canContinue = workspaceStarted || !!recoveredProject;
  $('#workspaceContinueChoice').hidden = !canContinue;
  document.querySelector('input[name="workspaceMode"][value="' + (canContinue ? 'continue' : 'new') + '"]').checked = true;
  updateWorkspaceMode();
  setWorkspaceStep(1);
  $('#workspaceCancel').hidden = !workspaceStarted;
  if (!$('#workspaceDialog').open) $('#workspaceDialog').showModal();
}

function updateWorkspaceMode() {
  const isNew = document.querySelector('input[name="workspaceMode"]:checked').value === 'new';
  $('#workspaceNewFields').hidden = !isNew;
  $('#workspaceNewHint').hidden = !isNew;
}

async function finishWorkspaceSetup() {
  const views = selectedWorkspaceViews();
  if (!views.length) { $('#workspaceError').textContent = 'Choose at least one workspace tab.'; return; }
  if (workspaceStep === 1 && workspaceHasProjectStep) { setWorkspaceStep(2); return; }
  const button = $('#workspaceNext');
  button.disabled = true;
  try {
    if (workspaceHasProjectStep) {
      const mode = document.querySelector('input[name="workspaceMode"]:checked').value;
      let value = null, projectPath = '';
      if (mode === 'new') value = newWorkspace($('#workspaceName').value, Number($('#workspaceFileCount').value));
      if (mode === 'open') {
        if (needApp()) throw new Error('Open projects in the desktop app.');
        const result = await window.uno.openProject();
        if (result.cancelled) return;
        if (!result.ok) throw new Error(result.error);
        value = result.project; projectPath = result.path;
      }
      if (value) {
        // Preserve the prior local draft before switching projects.
        try { localStorage.setItem('ide.previous-workspace.' + WS, JSON.stringify(project)); } catch {}
        replaceWorkspace(value, projectPath);
      }
    }
    applyWorkspaceViews(views);
    saveProject();
    $('#workspaceDialog').close();
    workspaceStarted = true;
    if ($('#workspaceVisualization').checked) openVisualization();
  } catch (error) { $('#workspaceError').textContent = error.message; }
  finally { button.disabled = false; }
}

function restorePreviousWorkspace() {
  try {
    const value = JSON.parse(localStorage.getItem('ide.previous-workspace.' + WS));
    if (!value) { flash('No previous workspace is available'); return; }
    const current = JSON.stringify(project);
    replaceWorkspace(value, value.projectPath);
    localStorage.setItem('ide.previous-workspace.' + WS, current);
    applyWorkspaceViews(value.visibleViews || workspaceViews);
  } catch (error) { out('Could not restore the previous workspace: ' + error.message, true); }
}

$('#openVisualization').onclick = openVisualization;
$('#saveVisualization').onclick = () => saveProjectToDisk(false);
$('#workspaceCancel').onclick = () => $('#workspaceDialog').close();
$('#workspaceNext').onclick = finishWorkspaceSetup;
$('#workspaceBack').onclick = () => setWorkspaceStep(1);
document.querySelectorAll('input[name="workspaceMode"]').forEach(input => { input.onchange = updateWorkspaceMode; });
$('#workspaceDialog').addEventListener('cancel', event => {
  if (!workspaceStarted) event.preventDefault();
});
if (VIEW === 'proj') {
  document.querySelector('.titlebar h1').textContent = 'Visualization';
  $('#saveVisualization').hidden = false;
} else if (!VIEW) {
  openWorkspaceSetup(true);
}
