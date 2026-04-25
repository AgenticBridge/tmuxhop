<p align="center">
  <img src="assets/full_logo.png" alt="tmuxhop logo" width="180">
</p>
<p align="center">잠깐 자리를 떠나도 코딩을 이어가세요.</p>

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
  한국어 |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a>
</p>

![tmuxhop background](assets/backgroud.png)

## 왜 쓰나요

```text
💻 vibe coding 중
-> 💩 화장실 가고 싶음
-> 📱 휴대폰에서 tmuxhop 열기
-> 🤖 AI에게 계속 지시하기
-> ✅ 흐름 유지
```

## 빠른 시작

```sh
git clone https://github.com/<your-org-or-user>/tmuxhop.git
cd tmuxhop
npm install
tmux has-session 2>/dev/null || tmux new -d -s tmuxhop
npm start
```

앱 열기:

```text
http://127.0.0.1:3000/
```

같은 로컬 네트워크의 휴대폰에서 접속하려면:

```sh
HOST=0.0.0.0 PORT=3000 npm start
```

그다음 휴대폰 브라우저에서 `http://<your-computer-ip>:3000/` 를 여세요.

## 동작 방식

tmuxhop은 로컬 `tmux` 세션 상태를 읽고, 작은 Node 서버를 통해 노출한 뒤, 선택한 pane을 `xterm.js`로 브라우저에 렌더링합니다. 브라우저 UI는 터치 친화적이지만, 아래에서 돌아가는 세션은 그대로 유지됩니다.

목표는 완전한 원격 데스크톱이 아닙니다. 잠깐 자리를 비울 때 다른 기기로 hop 해서 같은 작업을 이어가기 쉽게 만드는 것입니다.

## 요구 사항

- Node.js 22+
- 로컬에 `tmux` 설치
- 같은 머신, LAN, 또는 VPN 안의 브라우저

기본적으로 tmuxhop은 다음을 찾습니다:

- `/opt/homebrew/bin/tmux` 의 `tmux`
- `tmuxhop` 이라는 기본 세션 이름

다음 환경 변수로 덮어쓸 수 있습니다:

- `TMUX_BIN`: tmuxhop이 사용할 `tmux` 바이너리 경로
- `TMUXHOP_SESSION`: tmuxhop이 찾거나 제안할 기본 세션 이름
- `TMUXHOP_SCROLLBACK_LINES`: 브라우저 터미널에 유지할 scrollback 줄 수
- `HOST`: 백엔드가 바인딩할 네트워크 인터페이스
- `PORT`: 백엔드가 사용할 포트

## 보안 모델

tmuxhop은 의도적으로 가볍습니다. 휴대폰에서 SSH를 설정할 필요가 없고, 일반적인 원격 셸 서비스를 인터넷에 그대로 공개하는 용도도 아닙니다.

다음 환경에서 사용하세요:

- 같은 머신
- 신뢰할 수 있는 로컬 네트워크
- 또는 VPN

현재 형태로는 공개 인터넷 서비스로 간주하지 마세요.

## 제한 사항

- 단일 사용자 워크플로우
- `tmux` 중심이며 다른 터미널 멀티플렉서는 대상 아님
- 브라우저 터미널이지 데스크톱 대체제가 아님
- 모바일에서 흐름을 이어가기 위한 도구이지 전체 원격 접속 플랫폼은 아님

## 개발

테스트 실행:

```sh
npm test
```

타입 체크만 실행:

```sh
npm run typecheck
```

클라이언트 빌드:

```sh
npm run build
```

## 라이선스

MIT
