# FocusHUD ⚡

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="FocusHUD Logo" width="100" />
</p>

<p align="center">
  <strong>A futuristic, dual-dock desktop companion for productivity, focus timers, and system telemetry.</strong>
</p>

<p align="center">
  <a href="https://github.com/kp-97/FocusHUD/releases"><img src="https://img.shields.io/github/v/release/kp-97/FocusHUD?include_prereleases&style=flat-square&color=00e5ff" alt="Latest Release" /></a>
  <a href="https://github.com/kp-97/FocusHUD/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/kp-97/FocusHUD/ci.yml?branch=main&style=flat-square&label=CI" alt="CI Status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/platform-Windows-0078d4.svg?style=flat-square" alt="Platform: Windows" />
  <img src="https://img.shields.io/badge/tauri-v2-ffc13b.svg?style=flat-square" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/react-v19-61dafb.svg?style=flat-square" alt="React 19" />
</p>

---

## 🚀 Overview

**FocusHUD** is a sci-fi desktop HUD application designed for ultrawide and multi-monitor setups. It pins transparent, resizable sidebars to the left and right edges of your display, while automatically reserving Windows desktop work area space so your code editor, terminal, and browser snap cleanly between them without being obstructed.

Built with a cyberpunk HUD aesthetic (cyan/amber themes, scanlines, telemetry waveforms, and bracket accents), FocusHUD keeps your daily focus rituals and performance diagnostics accessible without cluttering your main workspace.

---

## ✨ Features

### 🖥️ Dual-Dock Desktop Windows
- **Pinned Edge Docks**: Separate left and right dock windows pinned seamlessly to your monitor edges.
- **Smart Work Area Reservation**: Modifies the Windows work area (`SystemParametersInfoW`) so maximized applications snap into the center space between the two sidebars.
- **Stationary Canvas Clipping**: Zero-relayout live-drag resizing powered by Win32 window regions (`SetWindowRgn`)—preventing Chromium Webview reflow lag during drag.
- **Quick Snap Widths**: Double-click the resize handles to snap between presets: `68px` (Icon Rail), `220px` (Compact), `280px` (Default), and `360px` (Expanded).

### ⏱️ Pomodoro HUD Timer
- **Phase Cycle Management**: Automatically cycles through 4 focus intervals and short/long breaks.
- **Dynamic Controls**: Clean button replacement—displays a single `START` button when idle, dynamically splitting into `PAUSE` and `CANCEL` controls when running.
- **Manual Adjustments**: Click `+` or `-` to adjust remaining time by $\pm 1$ minute on the fly (with safety guards against decrementing under 1 minute).
- **Exact Focus Time Tracking**: Tracks active focus seconds and rolls them over into daily accumulated focus hours and minutes (`XH YM`).
- **Compact Mini Rail**: Collapses into a 68px vertical HUD status gauge when width is snapped down.

### 📊 System Telemetry & Diagnostics
- **Live Hardware Stats**: Real-time CPU load, memory utilization, and hardware diagnostics updated via an asynchronous background worker.
- **HUD Waveform**: Animated visualizer representing system rhythm and state.

### 🌐 Cross-Window Synchronization
- Synchronizes dock pane states, themes, view selections, and active timers across windows via the HTML5 `BroadcastChannel` API.

### 📥 System Tray Companion
- Seamlessly minimize both docks to the Windows system tray and restore them with a single click.

---

## 🛠️ Tech Stack

- **Desktop Shell**: [Tauri v2](https://tauri.app/) (Rust backend with native Windows API integration via `windows-sys`)
- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite 8](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: [Vitest](https://vitest.dev/), [@testing-library/react](https://testing-library.com/), Cargo Test

---

## 📦 Installation

### Pre-built Binaries (Windows)
Download the latest Windows installer (`.msi`) or portable executable from the **[Releases](https://github.com/kp-97/FocusHUD/releases)** page.

### Prerequisites
- **Operating System**: Windows 10 / 11 (64-bit)
- **Runtime**: [Microsoft Edge WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 10/11)

---

## 💻 Development Setup

To build and run FocusHUD locally:

### 1. Prerequisites
- **Node.js**: v20 or newer ([nodejs.org](https://nodejs.org/))
- **Rust Toolchain**: Stable channel ([rustup.rs](https://rustup.rs/))
- **C++ Build Tools**: Microsoft Visual Studio C++ Build Tools (required by Rust on Windows)

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/kp-97/FocusHUD.git
cd focus_hud
npm install
```

### 3. Run Locally

#### Option A: Fast Browser UI Preview
Runs the frontend in your default browser with a unified 3-column layout:
```bash
npm run dev
```

#### Option B: Full Native Desktop App
Launches Tauri with native multi-dock Windows windows and Win32 desktop reservation:
```bash
npm run tauri dev
```

---

## 🧪 Testing & Code Quality

Before opening pull requests, ensure all checks pass:

```bash
# Run the complete CI verification pipeline:
npm run test:ci
```

This runs:
1. `npm run typecheck` — TypeScript strict type checking
2. `npm test` — Vitest unit & component test suite
3. `cargo fmt --check` — Rust formatting verification
4. `cargo clippy` — Rust linter with warnings treated as errors
5. `cargo test` — Rust backend unit tests

Individual test commands:
```bash
# Run frontend tests with watch mode
npm run test:watch

# Run Rust tests only
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 🗺️ Project Roadmap

### ✅ Completed (v0.1.x)
- [x] Dual-dock resizable layout with Win32 work area reservation
- [x] Pomodoro timer with dynamic Pause/Cancel controls & daily time tracking
- [x] Compact 68px rail mode with mini circular HUD progress gauge
- [x] Floating system menu popout with dynamic window unclipping ([#12](https://github.com/kp-97/FocusHUD/issues/12))
- [x] Central popup settings window for configurable pane widths ([#6](https://github.com/kp-97/FocusHUD/issues/6), [#13](https://github.com/kp-97/FocusHUD/issues/13))
- [x] Taskbar-less tray-only companion mode ([#10](https://github.com/kp-97/FocusHUD/issues/10))

### 🚧 In Progress: v0.2.0 Foundation & Expansion
- [x] **Local SQLite Persistence**: Embedded local SQLite storage with an infinitely nestable tree schema (Goals, Tasks, Action Plans, Notes) and real-time dual-dock cache synchronization ([#24](https://github.com/kp-97/FocusHUD/issues/24))
- [x] **Notes View & Scratchpad**: Embedded HUD note-taking interface with auto-save, standalone capture, and optional links to goals, tasks, or action plans ([#25](https://github.com/kp-97/FocusHUD/issues/25))
- [ ] **macOS Compatibility**: Cross-platform window abstractions, macOS Accessibility API window snapping, and multi-platform CI verification ([#26](https://github.com/kp-97/FocusHUD/issues/26))

### 🔮 Future Horizons
- [ ] Custom HUD color themes (Amber, Emerald, Crimson)
- [ ] Sound effects & audio cues for Pomodoro transitions
- [ ] Global quick-capture hotkey (`Ctrl/Cmd + Shift + Space`) for rapid thought offloading


---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Ensure all CI tests pass (`npm run test:ci`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

<p align="center">
  Crafted by <a href="https://github.com/kp-97">Ryan Pham</a> with ⚡ Tauri & React
</p>
