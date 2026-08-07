# StoryLoom

StoryLoom is a focused writing app for building long-form stories as Parts, Chapters, Scenes, and Beats. Notes stay separate from manuscript text, and the compiler exports only the drafted manuscript matter.

## Open without a command prompt

### Windows

Double-click `StoryLoom.vbs`.

The launcher starts a small local StoryLoom server in the background and opens the app in your default browser. No command prompt window is required.

### macOS

Double-click `StoryLoom.command`. macOS may ask you to confirm that you trust the file the first time you run it.

### Linux

Run `scripts/launch_storyloom.py` with Python 3, or create a desktop shortcut that points to it.

## Developer/open from terminal

If you do want to run it manually, use:

```bash
npm start
```

Then open `http://localhost:4173`.

## Saving and exporting

- StoryLoom autosaves your current project in the browser's local storage.
- Use **Choose Save Directory** in Chromium-based browsers to save the project JSON to a folder you select.
- Use **Save Project** to write/download the project file.
- Use **Load Project** to open a previously saved `.storyloom.json` or JSON project file.
- Use **Recent Projects** to quickly reopen recent local snapshots saved by this browser.
- Use **Compile PDF** to export manuscript matter only; planning notes, scene notes, beat notes, and reminders are not compiled.
