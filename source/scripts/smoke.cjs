const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ide-ui-check-'));
const bundle = path.join(profile, 'Project.ideproj');
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? profile : value);
app.setPath('userData', profile);
app.disableHardwareAcceleration();
dialog.showSaveDialog = async () => ({ canceled: false, filePath: bundle });
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [bundle] });
const errors = [];
app.on('web-contents-created', (event, contents) => {
  contents.on('console-message', (event, level, message) => { if (level === 3) errors.push(message); });
});
const main = new Module(path.join(root, 'main.js'), module);
main.filename = path.join(root, 'main.js');
main.paths = Module._nodeModulePaths(root);
main._compile(fs.readFileSync(main.filename, 'utf8').replace('const opts = {', 'const opts = { show: false,'), main.filename);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(win, expression) {
  for (let i = 0; i < 150; i++) {
    if (win && !win.isDestroyed() && await win.webContents.executeJavaScript(expression)) return;
    await wait(50);
  }
  throw new Error('Timed out waiting for ' + expression);
}
const timeout = setTimeout(() => { console.error('UI check timed out'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  let editor;
  try {
    await wait(150);
    editor = BrowserWindow.getAllWindows()[0];
    if (editor.webContents.isLoading()) await new Promise(resolve => editor.webContents.once('did-finish-load', resolve));
    await until(editor, "typeof openWorkspaceSetup === 'function'");
    const projectId = await editor.webContents.executeJavaScript(`
      (async () => {
        if (!navigator.serial || !window.uno.platform) throw new Error('Serial API or preload bridge missing');
        if (!$('#workspaceDialog').open || $('#tabProj') || $('#tabExt')) throw new Error('Workspace startup failed');
        const faces = await document.fonts.load('19px "Russo One"');
        if (!faces.length) throw new Error('Bundled font failed to load');
        document.querySelectorAll('#workspaceTabChoices input').forEach(input => { input.checked = ['code', 'board'].includes(input.value); });
        await finishWorkspaceSetup();
        document.querySelector('input[name="workspaceMode"][value="new"]').checked = true;
        $('#workspaceName').value = 'Cross-platform project';
        $('#workspaceFileCount').value = '2';
        await finishWorkspaceSetup();
        if ($('#workspaceDialog').open || project.open.length !== 2 || !$('#tabDash').hidden) throw new Error('Project creation failed');
        await saveProjectToDisk(false);
        return project.id;
      })()
    `);
    if (JSON.parse(fs.readFileSync(bundle, 'utf8')).open.length !== 2) throw new Error('Project did not save both files');
    await editor.webContents.executeJavaScript('openVisualization()');
    await wait(200);
    const visual = BrowserWindow.getAllWindows().find(win => win !== editor);
    if (!visual) throw new Error('Visualization did not open');
    if (visual.webContents.isLoading()) await new Promise(resolve => visual.webContents.once('did-finish-load', resolve));
    await until(visual, 'typeof project !== "undefined" && project.id === ' + JSON.stringify(projectId));
    await visual.webContents.executeJavaScript("addPart('led')");
    await until(editor, 'project.circuit && project.circuit.parts.length === 1');
    await visual.webContents.executeJavaScript('saveProjectToDisk(false)');
    await wait(200);
    if (JSON.parse(fs.readFileSync(bundle, 'utf8')).circuit.parts.length !== 1) throw new Error('Diagram did not save');
    await editor.webContents.executeJavaScript(`
      (async () => {
        replaceWorkspace(newWorkspace('Other', 1), '');
        openWorkspaceSetup(true);
        await finishWorkspaceSetup();
        document.querySelector('input[name="workspaceMode"][value="open"]').checked = true;
        await finishWorkspaceSetup();
        if (project.open.length !== 2 || project.circuit.parts.length !== 1) throw new Error('Project reopen failed');
      })()
    `);
    if (errors.length) throw new Error(errors.join('\n'));
    clearTimeout(timeout);
    console.log(JSON.stringify({ ok: true, platform: process.platform, projectSaveOpen: true, visualization: true, bundledFont: true }));
    app.exit(0);
  } catch (error) {
    clearTimeout(timeout);
    console.error(error.stack || error);
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'smoke-error.txt'), String(error.stack || error) + '\n' + errors.join('\n'));
    if (editor && !editor.isDestroyed()) fs.writeFileSync(path.join(root, 'dist', 'smoke-error.png'), (await editor.webContents.capturePage()).toPNG());
    app.exit(1);
  }
});
