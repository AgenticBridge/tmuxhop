# tmuxhop

tmuxhop lets you continue the same local `tmux` session from your phone in a browser. It is built for short desk-to-phone hops when you want to keep coding momentum without installing a mobile app, setting up SSH on the phone, or starting a fresh shell.

![tmuxhop logo](assets/full_logo.png)

![tmuxhop background](assets/backgroud.png)

## Why Use It

```text
💻 vibe coding
-> 💩 need to poop
-> 📱 open tmuxhop on your phone
-> 🤖 keep coding sitting on the bowl
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
- `TMUXHOP_SESSION`: default session name tmuxhop should look for or suggest
- `TMUXHOP_SCROLLBACK_LINES`: how many scrollback lines to keep in the browser terminal
- `HOST`: which network interface the backend binds to
- `PORT`: which port the backend serves on

## Security Model

tmuxhop is intentionally lightweight. It does not ask you to set up mobile SSH or expose a general remote shell service to the internet.

Use it on:

- the same machine
- a trusted local network
- or a VPN

Do not treat it as a hardened public internet service in its current form.

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
