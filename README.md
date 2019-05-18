# VS Code `npm test` Screenshot

In this repository I aim to prototype a process whereby a VS Code extension's test suite contains methods (faux unit tests)
which connect to the VS Code extension host window using `--inspect` and the DevTools protocol and use the Electron APIs to
capture a screenshot of the VS Code extension host automatically.

The faux unit test method may contain a scene setup code so that multiple screenshots can be taken displaying various stages
of whatever functionality the extension implements and wishes to display and these screenshots may then be references in the
extensions README file or anywhere else.

The key component of this endeavour is an ability to connect to an Electron application with a debugger attached and use the
Electron `capturePage` API to obtain a screenshot and save it. I have recently learnt of a way to achieve this, it goes like
this:

- Start an Electron based application, like VS Code, with the debugger attached: `code --inspect`
- Go to `chrome://inspect` in Chrome (or use another DevTools protocol client) and open the DevTools
- Enter the following client at the developer tools console, utilizing the Electron API for screenshot capture:

```javascript
const electron = process.mainModule.require('electron')
const fs = process.mainModule.require('fs')
const webContents = electron.webContents.getAllWebContents()[0] // [1] is the shared process
webContents.capturePage(image => fs.writeFileSync('screenshot.png', image.toPNG()))
// Look in `process.cwd()`
```

The missing pieces to make this all work then are:

- Ensure `npm test` starts the VS Code extension host with a debugger attached (if it doesn't already)
- Use a DevTools protocol client library or the web socket connection directly to connect and issue the above commands
- Set up faux unit test methods which set up a scene (such as document contents and selection, command issuance etc.)
- Gather the screenshot files and place them to predetermined places as a part of the test run
