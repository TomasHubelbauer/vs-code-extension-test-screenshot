const ps = require('ps-node');
const fetch = require('node-fetch');
const ws = require('ws');
const fs = require('fs');

console.log('Listing running Code instances…');
ps.lookup({ command: 'Code.exe' }, async (_, codes) => {
  console.log('Finding main Code instance…');
  const main = codes.find(code => !codes.find(code2 => code2.pid === code.ppid));
  console.log('Attaching to Code instance with PID', main.pid);
  process._debugProcess(main.pid);
  console.log('Downloading the debugger information…');
  const response = await fetch('http://localhost:9229/json');
  const data = await response.json();
  const url = data[0].webSocketDebuggerUrl;
  console.log('Connecting to the debugger socket…', url);
  const socket = new ws(url, { perMessageDeflate: false });
  await new Promise(resolve => socket.once('open', resolve));
  console.log('Subscribing to callbacks…');
  socket.on('message', data => {
    const json = JSON.parse(data);
    switch (json.id) {
      case 1: {
        console.log('Evaluating the expression…');
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
        const buffer = new Buffer(json.result.result.value.substring('data:image/png;base64,'.length), 'base64');
        console.log('Saving the screenshot buffer…');
        fs.writeFileSync('screenshot.png', buffer);
        process.exit();
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
  console.log('Enabling the runtime agent…');
  socket.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
});
