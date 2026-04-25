# Security

tmuxhop is designed for trusted networks only.

It exposes a live terminal session to any client that can reach the backend. There is currently no built-in authentication, authorization, or transport hardening layer in front of that terminal access.

Use tmuxhop only on:

- the same machine
- a trusted local network
- or a VPN you control

Do not expose it directly to the public internet.

## Security model

tmuxhop optimizes for low-friction session continuation:

- no mobile app install
- no SSH setup on the phone
- no key management for short device hops

That simplicity comes with a hard boundary:

- network trust is the security boundary

If an untrusted client can reach the tmuxhop server, that client can interact with your terminal.

## Threat model

Assets at risk:

- your live shell session
- commands running inside tmux
- terminal output and scrollback
- files and credentials reachable from that shell

Assumptions:

- the host machine is already trusted by you
- the tmux session belongs to a single user
- the network path between client and server is trusted

Out of scope today:

- multi-user isolation
- public internet exposure
- hostile local networks
- per-user auth, RBAC, or audit logging

## Main risks

### Unauthenticated terminal access

Any client that can reach the server can access the exposed terminal workflow.

Impact:

- run commands
- read terminal output
- interfere with the active session

### Network eavesdropping or interception

If you run tmuxhop on an untrusted network without a secure outer transport, terminal traffic may be observed or modified by others on that network path.

Impact:

- command leakage
- output leakage
- session tampering

### Session hijacking through accidental exposure

Binding to `0.0.0.0` is convenient for phone access, but it also makes the server reachable by other devices on that network.

Impact:

- unintended clients discover the service
- terminal access from the wrong device

### Sensitive data exposure through scrollback

The browser UI can expose terminal history, prompts, file paths, command output, and secrets printed in the session.

Impact:

- credential disclosure
- project or system data leakage

## Safe deployment guidance

- Prefer running on `127.0.0.1` when you only need same-machine access.
- Only bind `HOST=0.0.0.0` on a network you trust.
- Prefer a private home LAN or a VPN you control.
- Do not port-forward tmuxhop to the public internet.
- Do not run it on shared Wi‑Fi or other hostile networks.
- Treat the exposed tmux session as fully interactive shell access.

## If you need stronger security

tmuxhop is the wrong tool to expose directly.

If you need internet-facing access or stronger trust boundaries, place it behind a properly authenticated and encrypted access layer, or use a different tool designed for that threat model.
