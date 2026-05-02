<p align="center">
  <img src="assets/full_logo.png" alt="tmuxhop logo" width="180">
</p>
<p align="center"> Keep coding when life pulls you away.</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-7FBF4D">
  <img alt="Node.js 22+" src="https://img.shields.io/badge/node-22%2B-2D2D2D">
  <img alt="tmux required" src="https://img.shields.io/badge/terminal-tmux-EA8A4A">
  <img alt="LAN or VPN" src="https://img.shields.io/badge/network-LAN%20or%20VPN-5A9E57">
</p>

<p align="center">
  English |
  <a href="README.zh-TW.md">繁體中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a>
</p>

> [!IMPORTANT]
> tmuxhop is designed for trusted networks only. It exposes your live terminal to other clients on the network without authentication. Run it only on the same machine, a trusted LAN, or a VPN. See [SECURITY.md](SECURITY.md).

![tmuxhop background](assets/backgroud.png)

## Why Use It

```text
💻 vibe coding
-> 💩 need to poop
-> 📱 open tmuxhop on your phone
-> 🤖 keep coding while sitting on the bowl
-> ✅ stay in flow
```

## Quickstart

```sh
git clone https://github.com/<your-org-or-user>/tmuxhop.git
cd tmuxhop
npm install
tmux has-session 2>/dev/null || tmux new -d -s tmuxhop
npm start
```

Open the app:

```text
http://127.0.0.1:3000/
```

For phone access on the same local network:

```sh
HOST=0.0.0.0 PORT=3000 npm start
```

Then open `http://<your-computer-ip>:3000/` from the phone browser.

## How It Works

tmuxhop reads your local `tmux` session state, exposes it through a small Node server, and renders the selected pane in the browser with `xterm.js`. The browser UI is touch-friendly, but the underlying session stays the same.

The goal is not full remote desktop access. The goal is to make it easy to hop to another device for a few minutes and keep going.

## Requirements

- Node.js 22+
- `tmux` installed locally
- a browser on the same machine, LAN, or VPN

By default, tmuxhop looks for:

- `tmux` at `/opt/homebrew/bin/tmux`
- a default session named `tmuxhop`

You can override those with:

- `TMUX_BIN`: path to the `tmux` binary tmuxhop should use
- `TMUX_SOCKET`: tmux socket name (equivalent to `-L` flag, e.g., `tmux -L mysocket`)
- `TMUXHOP_SESSION`: default session name tmuxhop should look for or suggest
- `TMUXHOP_SCROLLBACK_LINES`: how many scrollback lines to keep in the browser terminal
- `HOST`: which network interface the backend binds to
- `PORT`: which port the backend serves on

### Using a custom tmux socket

If your tmux server was started with a custom socket name (e.g., `tmux -L mysocket`), set the `TMUX_SOCKET` environment variable:

```sh
TMUX_SOCKET=mysocket npm start
```

This is equivalent to passing `-L mysocket` to all tmux commands.

## Limits

- Single-user workflow.
- Built around `tmux`, not arbitrary terminal multiplexers.
- Browser terminal, not desktop replacement.
- Mobile-first continuity tool, not a full remote access platform.

## Development

Run the test suite:

```sh
npm test
```

Run type-checking only:

```sh
npm run typecheck
```

Build the client:

```sh
npm run build
```

## License

MIT
