<p align="center">
  <img src="assets/full_logo.png" alt="tmuxhop logo" width="180">
</p>
<p align="center">席を外しても、コードを書き続ける。</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-7FBF4D">
  <img alt="Node.js 22+" src="https://img.shields.io/badge/node-22%2B-2D2D2D">
  <img alt="tmux required" src="https://img.shields.io/badge/terminal-tmux-EA8A4A">
  <img alt="LAN or VPN" src="https://img.shields.io/badge/network-LAN%20or%20VPN-5A9E57">
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-TW.md">繁體中文</a> |
  日本語 |
  <a href="README.ko.md">한국어</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a>
</p>

![tmuxhop background](assets/backgroud.png)

## 使う理由

```text
💻 vibe coding 中
-> 💩 トイレに行きたい
-> 📱 スマホで tmuxhop を開く
-> 🤖 AI に指示を出し続ける
-> ✅ flow を切らさない
```

## クイックスタート

```sh
git clone https://github.com/<your-org-or-user>/tmuxhop.git
cd tmuxhop
npm install
tmux has-session 2>/dev/null || tmux new -d -s tmuxhop
npm start
```

アプリを開く：

```text
http://127.0.0.1:3000/
```

同じローカルネットワーク上のスマホから使う場合：

```sh
HOST=0.0.0.0 PORT=3000 npm start
```

その後、スマホのブラウザで `http://<your-computer-ip>:3000/` を開きます。

## 仕組み

tmuxhop はローカルの `tmux` セッション状態を読み取り、小さな Node サーバーで公開し、選択した pane を `xterm.js` でブラウザに表示します。ブラウザ UI はタッチ操作向けですが、下で動いているセッションは同じままです。

目的はフルリモートデスクトップではありません。少し席を外すときに、別の端末へすぐ hop して作業を続けられるようにすることです。

## 要件

- Node.js 22+
- ローカルに `tmux` がインストールされていること
- 同じマシン、LAN、または VPN 上のブラウザ

デフォルトでは tmuxhop は以下を探します：

- `/opt/homebrew/bin/tmux` にある `tmux`
- `tmuxhop` という名前のデフォルトセッション

次の環境変数で上書きできます：

- `TMUX_BIN`：tmuxhop が使う `tmux` バイナリのパス
- `TMUXHOP_SESSION`：tmuxhop が探す、または提案するデフォルトセッション名
- `TMUXHOP_SCROLLBACK_LINES`：ブラウザ端末に保持するスクロールバック行数
- `HOST`：バックエンドが bind するネットワークインターフェース
- `PORT`：バックエンドが使うポート

## セキュリティモデル

tmuxhop は意図的に軽量です。スマホ側で SSH を設定する必要はなく、一般的なリモート shell サービスをそのままインターネットに公開する想定でもありません。

使う場所：

- 同じマシン
- 信頼できるローカルネットワーク
- または VPN

現状では、公開インターネット向けの堅牢なサービスとして扱わないでください。

## 制限

- 単一ユーザー向けワークフロー
- `tmux` 前提で、他のターミナルマルチプレクサは対象外
- ブラウザ端末であり、デスクトップ代替ではない
- モバイルで flow をつなぐ道具であり、フルリモートアクセス基盤ではない

## 開発

テスト実行：

```sh
npm test
```

型チェックのみ：

```sh
npm run typecheck
```

クライアントをビルド：

```sh
npm run build
```

## ライセンス

MIT
