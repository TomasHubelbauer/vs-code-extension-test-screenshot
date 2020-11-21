# VS Code `npm test` Screenshot

Windows:

<!-- screencast win32 -->
![](screencast-2020-05-04T19-28-28.896Z-win32.apng)
<!-- /screencast win32 -->

Linux:

<!-- screencast linux -->
![](screencast-2020-05-07T20-29-41.103Z-linux.apng)
<!-- /screencast linux -->

This repository contains a VS Code extension which has a faux test which does
the following:

- Dresses the extension host window by opening a generated demo MarkDown doc
- Finds the PID of the running VS Code extension host process (self-window)
- Attaches a debugger to self and connect to the debugger using CDP over WS
- Executes a script within the context of the host to capture its screenshot

This is a proof of concept and I plan on making it into a library which could be
used by any VS Code extension. The utility of this would be to in addition to
having a normal test suite have a test suite which would generates screenshots
showcasing the extension functionality for the docs and the readme.

## Running

`npm test` generates `screencast-*.apng` and embeds it in the readme.

## Notes

The easiest way to attach a debugger to a VS Code window is to start it with
`--inspect`, but we cannot pass this switch to the extension host window in any
way without manually patching the infrastructure the Yeoman VS Code extension
template sets up and we want to avoid manual patching of any sort.

The extension host is started using a script in `node_modules/vscode/bin/test`
which downloads the latest version of VS Code and runs it with a fixed set of
CLI arguments (which do not include `--inspect`). This is run via `npm test`.

It may be possible to pass the `--inpect` switch now with current version of VS
Code, but I haven't looked into it yet.
https://github.com/microsoft/vscode-docs/blob/vnext/api/working-with-extensions/testing-extension.md#debugging-the-tests

The VS Code extension host won't run unless it is the only VS Code instance
running. We take advantage of this when finding the main VS Code process PID,
because VS Code starts multiple (about a dozen) and we look for one whose parent
PID is not VS Code. This will break when the VS Code extension host is made to
be able to run with other instances of VS Code running (there will be multiple
VS Code processes and we will need to use something like the window title then),
but it is not a concern until Microsoft has enabled that.

## To-Do

### Package this as a library for use in VS Code extension building

Or perhaps more general - split into logic for finding the VS Code main window
PID and to logic for capturing screencasts of any Electron applications:

```js
await startScreencast();
/* Use the VS Code API / Electron and CDP to manipulate the window's contents */
const buffer = await stopScreencast();
```

### Use this in my MarkDown To-Do and MarkDown Link Suggestions extensions

### Troubleshoot `Page.captureScreenshot` and `Page.startScreencast` not working

https://vanilla.aslushnikov.com/?Page.captureScreenshot

https://vanilla.aslushnikov.com/?Page.startScreencast

### See if it is possible to pass `--inspect` to the current VS Code version

https://github.com/microsoft/vscode-docs/blob/vnext/api/working-with-extensions/testing-extension.md#debugging-the-tests

https://github.com/microsoft/vscode/issues/97182

### Integrate https://github.com/TomasHubelbauer/node-cdp-ws into this
