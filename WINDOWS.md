# Windows Notes

This document explains how this repository behaves on Windows, what was changed for Windows compatibility, and what still differs from Linux/macOS.

## Current status

The project now runs on Windows for normal CLI use and the test suite.

Validated on Windows:

- `npm run start -- --help`
- `npm run dev -- --help`
- `npm run tui:list`
- `npm run test:readable`
- `npm run test:debug`
- `npm run test:unit`
- `npm run test:all`

## What was changed for Windows

### 1. Cross-platform shell execution

Shell command execution no longer assumes `sh` exists.

- On Windows:
  - Use Git Bash (`bash.exe`) if found.
  - If Git Bash is not found, fall back to `cmd.exe`.
- On Linux/macOS:
  - Use `$SHELL` if set, otherwise `sh`.

This affects the Bash tool runtime and sandbox fallback execution.

### 2. Session path encoding for Windows paths

Session project folder encoding now supports Windows paths correctly.

- Example:
  - Input: `C:\Users\name\my_project`
  - Encoded folder: `C-Users-name-my-project`

This fixes session index/file path failures seen on Windows.

### 3. npm scripts are now platform-neutral

Scripts were updated to avoid Unix-only syntax (`./cli.mjs`, inline env assignment, `ls | grep` pipelines).

Helper scripts were added:

- `scripts/run-cli.mjs`
- `scripts/run-integration.mjs`
- `scripts/list-tuis.mjs`

### 4. Terminal setup command supports PowerShell

`/terminal-setup` now handles Windows by:

- Detecting PowerShell.
- Suggesting `Set-Alias claude dario` in the user profile.
- Checking `dario` availability with `Get-Command`.

### 5. Windows-specific install hints for voice

Voice mode depends on `sox` (SoX = Sound eXchange), which is a command-line audio tool.

In this project, SoX is used to record microphone audio before it is sent to the speech-to-text provider.
If SoX is missing, voice mode cannot start.

`winget` and `choco` are package managers:

- `winget`: Windows Package Manager (often preinstalled on modern Windows).
- `choco`: Chocolatey (third-party package manager; may not be installed).

Check what you have:

```powershell
winget --version
choco --version
```

Install SoX on Windows (choose one option):

1. If `winget` is available:
   - `winget install SoX.SoX`
2. If `choco` is available:
   - `choco install sox`
3. If neither is available, install manually:
   - Download the Windows SoX build from the official SoX project/release page.
   - Install or extract it to a stable folder (example: `C:\Tools\sox`).
   - Add the SoX folder (or its `bin` folder) to your `PATH`.
4. Close and reopen your terminal.
5. Verify:
   - `sox --version`

If `sox` is still not found, it is almost always a `PATH` issue.

### 6. Git Bash installation on Windows

The Bash tool works best when Git Bash is installed.
Without Git Bash, this project falls back to `cmd.exe`, and some Bash commands will fail.

`winget` and `choco` can also install Git:

- `winget`: Windows Package Manager
- `choco`: Chocolatey

Check what you have:

```powershell
winget --version
choco --version
```

Install Git Bash (choose one option):

1. If `winget` is available:
   - `winget install Git.Git`
2. If `choco` is available:
   - `choco install git`
3. If neither is available, install manually:
   - Download Git for Windows from the official Git for Windows site.
   - Run installer with default options unless your environment needs custom settings.
   - Ensure Git Bash is included and Git is added to `PATH`.
4. Close and reopen your terminal.
5. Verify Git Bash:
   - `bash --version`
   - `where bash`

Typical installed paths:

- `C:\Program Files\Git\bin\bash.exe`
- `C:\Program Files\Git\usr\bin\bash.exe`

## Behavior differences on Windows

### Bash tool behavior depends on available shell

If Git Bash is installed, Bash-like commands work as expected.

If Git Bash is not installed, commands run via `cmd.exe`, so Bash syntax may fail.

Examples that can fail in `cmd.exe` fallback:

- `echo "x" >&2`
- `sleep 1`
- Bash-specific operators and shell features

Recommendation: install Git for Windows so `bash.exe` is available.

### Sandboxing

Sandbox mode is not supported on Windows.

- macOS: supported via `sandbox-exec`
- Linux: supported via `bwrap`/`firejail` if available
- Windows: commands run without sandboxing

If strict sandboxing is required, use Linux/macOS.

## Not supported on Windows (current)

### Clipboard access caveats in headless or restricted environments

Clipboard text/image support is implemented on Windows using `@napi-rs/clipboard`.
Image conversion to PNG for mentions also relies on PowerShell (`System.Windows.Forms`) to read image dimensions.

This can still fail in restricted contexts, for example:

- service accounts without desktop session access
- locked-down CI runners without clipboard access
- hardened environments where PowerShell or clipboard APIs are blocked

## Configuration notes for Windows

### Recommended prerequisites

- Node.js 18+ (22+ works)
- Git for Windows (for Git Bash support)
- Optional for voice: SoX

### PowerShell alias

For Claude-compatible command alias in PowerShell profile:

```powershell
Set-Alias claude dario
```

## Troubleshooting

### `Bash` tool commands fail with shell syntax errors

Likely running in `cmd.exe` fallback.

1. Install Git Bash (see section "Git Bash installation on Windows").
2. Restart terminal.
3. Verify `bash --version` works.
4. Re-run your command.

### Voice mode says SoX is missing

Install SoX using the steps in section "Windows-specific install hints for voice", then restart terminal and verify with `sox --version`.

### Session errors with malformed project path

This should be fixed by current encoding logic. If you still see this, delete old broken session directories under:

- `%USERPROFILE%\.dario\projects\`
