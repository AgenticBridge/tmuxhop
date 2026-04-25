<p align="center">
  <img src="assets/full_logo.png" alt="tmuxhop logo" width="180">
</p>
<p align="center">Continuez à coder quand la vie vous éloigne du bureau.</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-7FBF4D">
  <img alt="Node.js 22+" src="https://img.shields.io/badge/node-22%2B-2D2D2D">
  <img alt="tmux required" src="https://img.shields.io/badge/terminal-tmux-EA8A4A">
  <img alt="LAN or VPN" src="https://img.shields.io/badge/network-LAN%20or%20VPN-5A9E57">
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-TW.md">繁體中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.es.md">Español</a> |
  Français
</p>

![tmuxhop background](assets/backgroud.png)

## Pourquoi l’utiliser

```text
💻 vous êtes en plein vibe coding
-> 💩 vous devez aller aux toilettes
-> 📱 vous ouvrez tmuxhop sur votre téléphone
-> 🤖 vous continuez à dire à l’IA quoi faire
-> ✅ vous gardez le flow
```

## Démarrage rapide

```sh
git clone https://github.com/<your-org-or-user>/tmuxhop.git
cd tmuxhop
npm install
tmux has-session 2>/dev/null || tmux new -d -s tmuxhop
npm start
```

Ouvrez l’application :

```text
http://127.0.0.1:3000/
```

Pour y accéder depuis un téléphone sur le même réseau local :

```sh
HOST=0.0.0.0 PORT=3000 npm start
```

Puis ouvrez `http://<your-computer-ip>:3000/` dans le navigateur du téléphone.

## Comment ça marche

tmuxhop lit l’état de votre session locale `tmux`, l’expose via un petit serveur Node, puis affiche le pane sélectionné dans le navigateur avec `xterm.js`. L’interface navigateur est pensée pour le tactile, mais la session sous-jacente reste la même.

L’objectif n’est pas d’offrir un bureau distant complet. L’objectif est de vous permettre de passer rapidement sur un autre appareil pendant quelques minutes et de continuer.

## Prérequis

- Node.js 22+
- `tmux` installé localement
- un navigateur sur la même machine, le même LAN ou un VPN

Par défaut, tmuxhop cherche :

- `tmux` dans `/opt/homebrew/bin/tmux`
- une session par défaut nommée `tmuxhop`

Vous pouvez remplacer cela avec les variables d’environnement suivantes :

- `TMUX_BIN` : chemin vers le binaire `tmux` que tmuxhop doit utiliser
- `TMUXHOP_SESSION` : nom de session par défaut que tmuxhop doit chercher ou suggérer
- `TMUXHOP_SCROLLBACK_LINES` : nombre de lignes de scrollback à conserver dans le terminal du navigateur
- `HOST` : interface réseau sur laquelle le backend écoute
- `PORT` : port utilisé par le backend

## Modèle de sécurité

tmuxhop est volontairement léger. Il ne vous demande pas de configurer SSH sur le téléphone et n’a pas vocation à exposer un service shell distant générique sur l’internet public.

Utilisez-le :

- sur la même machine
- sur un réseau local de confiance
- ou via un VPN

Ne le considérez pas, dans son état actuel, comme un service renforcé pour l’internet public.

## Limites

- Flux de travail mono-utilisateur
- Conçu autour de `tmux`, pas de multiplexeurs arbitraires
- Terminal navigateur, pas remplacement de bureau
- Outil de continuité mobile, pas plateforme complète d’accès distant

## Développement

Lancer les tests :

```sh
npm test
```

Vérification de types uniquement :

```sh
npm run typecheck
```

Construire le client :

```sh
npm run build
```

## Licence

MIT
