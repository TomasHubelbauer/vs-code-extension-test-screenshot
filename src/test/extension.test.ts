import * as path from 'path';
import ps from 'ps-list';
import fetch from 'node-fetch';
import * as ws from 'ws';
import * as fs from 'fs-extra';
import * as vscode from 'vscode';

function defer<T>() {
  let resolve: (value: T) => void = undefined!;
  let reject: (reason: any) => void = undefined!;
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  if (!resolve || !reject) {
    throw new Error('Settlement methods have not been bound!');
  }

  return { promise, resolve, reject };
}

async function retry<T>(action: () => Promise<T>) {
  let attempt = 1;
  do {
    try {
      return await action();
    }
    catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } while (attempt < 5);

  throw new Error(`Failed to invoke action successfuly in ${attempt} attempts.`);
}

suite("Extension Tests", function () {
  test("Screenshot", async function () {
    // Generate the demo file
    console.log('Generating the demo file');
    const content = [
      '# VS Code Extension `npm test` Screenshot',
      '',
      'This screenshot was captured completely automatically for the purpose of',
      'VS Code extension documentation generation.',
      '',
      `It was captured on *${new Date().toLocaleString()}*.`,
    ].join('\n');

    // Go up and out of the directory with the test version of VS Code in it
    const directoryPath = '../../demo';
    await fs.emptyDir(directoryPath);
    const filePath = path.resolve(path.join(directoryPath, 'readme.md'));
    await fs.writeFile(filePath, content);

    // Open the demo file in the VS Code instance used for testing
    console.log('Opening the demo file');
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document);

    // Wait for the document to open in VS Code
    // TODO: Figure out how to detect this better, the VS Code API resolves too soon
    console.log('Waiting for the document to open and syntax highlighting to kick in');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find the running VS Code process ID
    console.log('Finding running VS Code process ID');
    const processes = await ps();
    const codes = processes.filter(p => p.name === 'Code.exe' || p.name === 'code');
    const main = codes.find(code => !codes.find(code2 => code2.pid === code.ppid));
    if (!main) {
      console.log('Failed to find the main VS Code instance process among these:');
      for (const code of codes) {
        console.log(code.name, code.pid, code.ppid);
      }

      throw new Error('Failed to determine main VS Code process ID.');
    }

    // Attach a debugger to the VS Code process
    console.log('Attaching a debugger to a VS Code process with PID', main.pid);
    (process as any)._debugProcess(main.pid);

    // Download the debugger connection information
    // https://chromedevtools.github.io/devtools-protocol/#endpoints
    // chrome://inspect
    console.log('Downloading the debugger connection information');
    const response = await retry(() => fetch('http://localhost:9229/json'));
    const data = await response.json();
    const url = data[0].webSocketDebuggerUrl as string;

    // Wait for the web socket to be ready
    // TODO: Implement a retry mechanism instead, sometimes in GitHub Actions this fails otherwise
    console.log('Waiting for the web socket to be ready');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Connect to the debugger web socket
    console.log('Connecting to the debugger web socket');
    const socket = new ws(url, { perMessageDeflate: false });
    await new Promise(resolve => socket.once('open', resolve));

    // Defer anticipated messages to promises based on callbacks
    console.log('Deferring anticipated messages to promises based on callbacks');
    const { promise, resolve, reject } = defer<string>();
    socket.on('message', async data => {
      const { id, result, error, ...rest } = JSON.parse(data.toString());
      if (id !== 1 || !result || !result.result || result.result.type !== 'string' || !result.result.value || error) {
        reject({ id, result, error, rest });
      }

      resolve(result.result.value);
    });

    // Evaluate the expression which logs the screenshot data URL to the console
    console.log('Evaluating the expression which captures the screenshot');
    const expression = [
      `const electron = process.mainModule.require('electron');`,
      `const webContents = electron.webContents.getFocusedWebContents();`,

      // Note that we are sending a data URI of the image as we cannot send the `NativeImage` instance itself
      'webContents.capturePage().then(nativeImage => nativeImage.toDataURL())'
    ].join('\n');
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, replMode: true } }));

    // Await the evaluation completion with the screenshot data URL
    console.log('Awaiting the evaluation completion with the data URL');
    const dataUrl = await promise;

    // Bufferize the data URL
    console.log('Bufferizing the screenshot Base64');
    const buffer = Buffer.from(dataUrl.substring('data:image/png;base64,'.length), 'base64');

    // Save the screenshot to a file
    console.log('Saving the screenshot buffer');
    // Note that in local, `process.cwd()` is in `.vscode-test/vscode-version`
    const screenshotPath = path.resolve((process.cwd().includes('.vscode-test') ? '../../' : '') + `screenshot-${process.platform}.png`);
    await fs.writeFile(screenshotPath, buffer);
    console.log('Screenshot saved:', screenshotPath);

    // Delete the temporary demo file
    console.log('Deleting the temporary demo file');
    await fs.remove(directoryPath);
  }).timeout(10 * 1000);
});
