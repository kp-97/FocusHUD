# Contributing to FocusHUD ⚡

Thank you for your interest in contributing to **FocusHUD**!

FocusHUD is built with modern web and desktop technologies (React 19 + Tauri v2 + Rust) and is actively developed using **human-AI pair programming**. Whether you are contributing manually or using an AI coding agent (e.g., Antigravity, Claude Code, Cursor, Windsurf, GitHub Copilot), this guide will help you get set up quickly and submit high-quality contributions.

---

## 🤖 Contributing with AI Coding Agents

If you are using an AI agent to explore the codebase, implement features, or fix bugs, follow these best practices to ensure smooth integration:

### 1. Give Your Agent the Project Context
Before asking your agent to implement changes, prompt it to review the following files:
- [README.md](README.md): High-level feature overview and local setup.
- [docs/development-workflow.md](docs/development-workflow.md): Detailed lifecycle (issues, branches, tests, releases).
- [package.json](package.json): Frontend scripts, dependencies, and test runner configurations.
- [src-tauri/Cargo.toml](src-tauri/Cargo.toml): Rust backend dependencies and crate structure.

### 2. Instruct Your Agent on Stack Boundaries
- **Frontend (`src/`):** React 19, TypeScript, Tailwind CSS v4, Lucide icons, Vitest. State synchronization across dock windows uses standard Web APIs (`BroadcastChannel`).
- **Backend (`src-tauri/`):** Tauri v2, Rust (2021 edition). Platform-specific integrations (Win32 window positioning, work area reservations, window regions) use `windows-sys` with `#[cfg(target_os = "windows")]` guards.
- **Documentation (`docs/`):** Contains architecture guides and diagrams (e.g., `.drawio` files). When modifying complex logic like state machines, remind your agent to update or add corresponding diagrams.

### 3. Agent Verification Rule
Instruct your agent to run the unified CI gate before considering any task complete:
```bash
npm run test:ci
```
Ensure your agent checks both:
- **TypeScript & Vitest:** `npm run typecheck && npm test`
- **Rust Clippy, Formatting & Tests:** `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo test`

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js:** v20 or newer
- **Rust Toolchain:** Stable channel (`rustup default stable`)
- **Windows C++ Build Tools:** Visual Studio Build Tools (C++ workload) required for Rust compilation on Windows.

### Installation
```bash
git clone https://github.com/kp-97/FocusHUD.git
cd focus_hud
npm install
```

### Running the App
- **Web UI mode (fast development):**
  ```bash
  npm run dev
  ```
- **Native Tauri desktop app:**
  ```bash
  npm run tauri dev
  ```

---

## 🔄 Contribution Process

For a comprehensive guide on the issue-to-release lifecycle, see [docs/development-workflow.md](docs/development-workflow.md). Here is the quick reference:

1. **Find or Open an Issue:** Check open issues or file a new one with clear acceptance criteria.
2. **Create a Feature Branch:** Branch off `main` using descriptive prefixes:
   ```bash
   git checkout -b feat/<issue-id>-short-description
   # or: fix/<issue-id>-short-description
   ```
3. **Make Atomic Changes:** Keep commits focused and formatted with [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(scope): add new capability`
   - `fix(scope): resolve issue`
   - `docs(scope): update documentation or diagram`
4. **Run Verification:** Verify everything passes cleanly:
   ```bash
   npm run test:ci
   ```
5. **Open a Pull Request:**
   - Target the `main` branch.
   - Use a conventional commit title.
   - Reference the issue in the body (`Closes #<issue_id>`).
   - Confirm automated CI checks pass on GitHub Actions.

---

## 📏 Code Style Guidelines

- **TypeScript:** Strict types enabled (`noEmit` typecheck must pass). Avoid using `any`.
- **Styling:** Use Tailwind CSS utility classes adhering to the cyber/HUD theme (cyan, amber, dark glassmorphism).
- **Rust:** Code must conform to `rustfmt` and compile with zero `clippy` warnings (`-D warnings`).
- **Dependencies:** Avoid introducing heavyweight dependencies without prior discussion on the relevant GitHub issue.

---

## 💬 Questions or Help?

Open an issue on GitHub or start a discussion on your pull request. We look forward to your contributions!

