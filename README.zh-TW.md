<p align="center">
  <img src="assets/full_logo.png" alt="tmuxhop logo" width="180">
</p>
<p align="center">當生活把你拉走時，繼續寫程式。</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-7FBF4D">
  <img alt="Node.js 22+" src="https://img.shields.io/badge/node-22%2B-2D2D2D">
  <img alt="tmux required" src="https://img.shields.io/badge/terminal-tmux-EA8A4A">
  <img alt="LAN or VPN" src="https://img.shields.io/badge/network-LAN%20or%20VPN-5A9E57">
</p>

<p align="center">
  <a href="README.md">English</a> |
  繁體中文 |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a>
</p>

![tmuxhop background](assets/backgroud.png)

## 為什麼要用

```text
💻 正在 vibe coding
-> 💩 想去上廁所
-> 📱 在手機上打開 tmuxhop
-> 🤖 繼續指揮 AI
-> ✅ 保持 flow
```

## 快速開始

```sh
git clone https://github.com/<your-org-or-user>/tmuxhop.git
cd tmuxhop
npm install
tmux has-session 2>/dev/null || tmux new -d -s tmuxhop
npm start
```

開啟應用程式：

```text
http://127.0.0.1:3000/
```

如果要從同一個區域網路上的手機存取：

```sh
HOST=0.0.0.0 PORT=3000 npm start
```

然後在手機瀏覽器開啟 `http://<your-computer-ip>:3000/`。

## 運作方式

tmuxhop 會讀取你本機的 `tmux` session 狀態，透過一個小型 Node 伺服器提供出去，並用 `xterm.js` 在瀏覽器中渲染所選的 pane。瀏覽器介面對觸控操作友善，但底層 session 仍然是同一個。

它的目標不是完整的遠端桌面。它的目標是讓你在短暫離開桌面時，能輕鬆換到另一台裝置繼續工作。

## 需求

- Node.js 22+
- 本機已安裝 `tmux`
- 同一台機器、區域網路或 VPN 上的瀏覽器

tmuxhop 預設會尋找：

- `/opt/homebrew/bin/tmux` 的 `tmux`
- 名稱為 `tmuxhop` 的預設 session

你可以用以下環境變數覆寫：

- `TMUX_BIN`：tmuxhop 應該使用的 `tmux` 執行檔路徑
- `TMUXHOP_SESSION`：tmuxhop 應該尋找或建議的預設 session 名稱
- `TMUXHOP_SCROLLBACK_LINES`：瀏覽器終端要保留的 scrollback 行數
- `HOST`：後端要綁定的網路介面
- `PORT`：後端服務使用的連接埠

## 安全模型

tmuxhop 故意保持輕量。它不要求你在手機上設定 SSH，也不打算把一個通用遠端 shell 服務直接暴露到公開網際網路。

請用在：

- 同一台機器
- 可信任的區域網路
- 或 VPN

不要把它當成一個已強化、可以直接公開上網的服務。

## 限制

- 單一使用者工作流程
- 以 `tmux` 為核心，不支援任意終端多工工具
- 是瀏覽器終端，不是桌面替代品
- 是行動裝置延續工作 flow 的工具，不是完整遠端存取平台

## 開發

執行測試：

```sh
npm test
```

只做型別檢查：

```sh
npm run typecheck
```

建置前端：

```sh
npm run build
```

## 授權

MIT
