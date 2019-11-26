import { join, resolve } from 'path';
import ps from 'ps-list';
import fetch from 'node-fetch';
import * as ws from 'ws';
import * as fs from 'fs-extra';
import * as assert from 'assert';
import * as vscode from 'vscode';

suite("Extension Tests", function () {
  test("Screenshot", async function () {
    console.log('Generating the demo file');
    const content = `# VS Code Extension \`npm test\` Screenshot

This screenshot was captured completely automatically for the purpose of VS Code
extension documentation generation.

It was captured on *${new Date().toLocaleString()}*.
`;

    // Dot up out of the directory with the test version of VS Code
    const directoryPath = '../../demo';
    await fs.emptyDir(directoryPath);
    const filePath = resolve(join(directoryPath, 'readme.md'));
    await fs.writeFile(filePath, content);

    console.log('Opening the demo file');
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document);

    // TODO: Figure out how to detect this better, the VS Code API resolves too soon
    console.log('Waiting for the document to open and syntax highlighting to kick in');
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Listing running VS Code processes');
    const processes = await ps();
    const codes = processes.filter(p => p.name === 'Code.exe' || p.name === 'code');
    for (const code of codes) {
      console.log(code.name, code.pid, code.ppid);
    }

    console.log('Finding the main VS Code process among', codes.length);
    const main = codes.find(code => !codes.find(code2 => code2.pid === code.ppid))!;

    console.log('Attaching to the main VS Code process with PID', main.pid);
    (process as any)._debugProcess(main.pid);

    // https://chromedevtools.github.io/devtools-protocol/#endpoints
    // chrome://inspect
    console.log('Downloading the debugger information');
    const response = await fetch('http://localhost:9229/json');
    const data = await response.json();
    const url: string = data[0].webSocketDebuggerUrl;

    // TODO: Implement a retry mechanism instead, sometimes in GitHub Actions this fails otherwise
    console.log('Waiting for the web socket to be ready');
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('Connecting to the debugger web socket', url);
    const socket = new ws(url, { perMessageDeflate: false });
    await new Promise(resolve => socket.once('open', resolve));

    console.log('Subscribing to callbacks');
    socket.on('message', async data => {
      const json = JSON.parse(String(data));
      switch (json.id) {
        case 1: {
          console.log('Evaluating the expression');
          // Note that we are using `var` so that we can redeclare the variables on each run making the script reentrant
          // Note that we are sending a data URI of the image as we cannot send the `NativeImage` instance itself
          const expression = `
var electron = process.mainModule.require('electron');
var webContents = electron.webContents.getAllWebContents()[0] // [1] is the shared process
new Promise(resolve => webContents.capturePage(image => resolve(image.toDataURL())));
`;
          socket.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression, awaitPromise: true } }));
          break;
        }
        case 2: {
          assert.ok(json.result.result.value);
          const buffer = Buffer.from(json.result.result.value.substring('data:image/png;base64,'.length), 'base64');
          const timestamp = new Date().toISOString().replace(/:/g, '-');
          // Note that in local, `process.cwd()` is in `.vscode-test/vscode-version`
          const screenshotPath = resolve((process.cwd().includes('.vscode-test') ? '../../' : '') + `screenshot-${process.platform}-${timestamp}.png`);
          console.log('Saving the screenshot buffer', screenshotPath);
          await fs.writeFile(screenshotPath, buffer);

          console.log('Deleting the temporary demo file');
          await fs.remove(directoryPath);
          break;
        }
        case undefined: {
          // Ignore events
          break;
        }
        default: {
          throw new Error(`Unexpected ID.`);
        }
      }
    });

    console.log('Enabling the runtime agent');
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  });
});
