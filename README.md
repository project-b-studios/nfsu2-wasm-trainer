# NFSU2 WebAssembly Trainer / NOS Hack

[![Trainer Preview](preview.png)](https://youtu.be/c2urRNPexhU)

> A lightweight, feature-rich memory manipulation script and trainer designed for **nfsu2.xyz**. Features custom NOS acceleration, position save/load, jump mechanics, drift assist, low gravity, spin, and a built-in HUD overlay!

![Banner / Preview](https://img.shields.io/badge/Status-Working-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-WebAssembly-orange?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-1.1-brightgreen?style=for-the-badge)

---

## Quick Links & References

- **Target Platform:** Play the game directly at [nfsu2.xyz](https://nfsu2.xyz)
- **Video Demonstration:** [Watch on YouTube](https://youtu.be/c2urRNPexhU)

---

## Features

- **Custom NOS Boost:** Dynamic acceleration control with adjustable km/h increments (50 - 500 km/h).
- **Position Save & Load:** Coordinate persistence allowing instant state saving and telemetry restoration.
- **Stop Lock / Hard Stop:** Instant vehicle immobilization and position locking mechanisms.
- **Jump Mechanic:** Upward velocity vector application for obstacle clearance, with adjustable jump power (6 - 60).
- **Drift Assist:** Uses the game's own drift handling and forces it on in every driving mode, not just free roam. Keeps the streak alive through wall hits, and every 1,000,000 points are banked automatically so the counter restarts.
- **Low Gravity:** Softens falls and keeps the car in the air longer.
- **Spin:** Rotates the car around its own up axis in place, without flying off or sliding wide.
- **On-Screen Panel:** A compact, draggable trainer window at the top-left with labeled rows, state indicators, and sliders. Toggle with **Insert**; a small **☰ TRAINER** tab brings it back when hidden.
- **Controller & Keyboard Support:** Dual input handling for standard keyboard layouts and XInput-compatible Gamepads.
- **Clean HUD Overlay:** Native HTML Popover API implementation ensuring zero external CSS dependencies.
- **Works on old and new game builds:** Detects both the pre- and post-2026-11-03 player address, so the trainer keeps working after the split-screen update.

---

## Controls

### Keyboard (Digit Row / Numpad)

| Key | Action |
| :---: | :--- |
| **1** | Toggle Boost ON/OFF |
| **2** | Jump |
| **3** | Stop Once (Hard Stop) |
| **4** | Toggle Stop Lock ON/OFF |
| **5** | Save Position |
| **6** | Load Position |
| **7 / 8** | Decrease / Increase Boost Power (-/+ 50 km/h) |
| **, / .** or **PgUp / PgDn** | Decrease / Increase Jump Power |
| **Z** | Toggle Spin |
| **Insert** | Show / Hide On-Screen Panel |
| **0** | Show / Hide Help HUD |
| **Alt (Hold)** | Keep NOS active |

> **X** is still the game's own drift toggle in free roam, but the trainer's **FORCE DRIFT** is on by default and keeps drift handling active in every driving mode. Toggle it from the panel or with gamepad **B**.

### Gamepad Layout

| Button | Action |
| :---: | :--- |
| **LB** | Toggle Boost |
| **RB** | Jump |
| **A** | Toggle Stop Lock |
| **B** | Toggle Force Drift |
| **X** | Toggle Low Gravity |
| **Y** | Toggle Spin |
| **D-Pad Left / Right** | Save / Load Position |
| **D-Pad Up / Down** | Boost Power +/- |

### On-Screen Panel

The panel starts hidden as a small **☰ TRAINER** tab at the top-left. Click the tab or press **Insert** to open it. Drag the window by its header to move it, and use the **–** button or **Insert** to hide it again. It has state indicators and sliders for every feature, so it is fully usable on phones and tablets. It does not use **P** (the game's pause key) or **F9**.

---

## Usage Instructions

1. Navigate to [nfsu2.xyz](https://nfsu2.xyz) via a WebAssembly-compatible browser.
2. Open the Developer Console (`F12` or `Ctrl+Shift+I`).
3. **Inject the contents of `trainer.js` before pressing Play.** The trainer hooks `WebAssembly.Memory`, and the game's memory must be created after the hook is in place.
4. Press **Play**. A small **☰ TRAINER** tab appears at the top-left; press **Insert** or click the tab to open the panel.
5. Use **Insert** for the panel, **X** in free roam if you want the game's own drift setup, and **Z** for spin. Force drift is already on by default.

### Troubleshooting

- **~1 second freeze the first time NOS kicks in:** the game is loading the NOS effect and streaming map assets at high speed. It is not a trainer bug. Lower the boost power with **7** if it bothers you.
- **Trainer does nothing:** it was injected after the game started. Reload the page and inject it again before pressing Play.
- **Drift mode feels too slippery in races:** press the panel's **FORCE DRIFT** row or gamepad **B** to turn it off; **X** still toggles the game's own drift in free roam.

---

## Changelog

### v1.1

- **Fixed for the 2026-11-03 split-screen update.** The web build moved `PlayersByNumber[0]` from `0x008900AC` to `0x00D00000`. The trainer now detects either address and sanity-checks the pointer chain, so it works on both old and new builds.
- **Replaced Chaos Mode with the game's own drift handling.** The trainer no longer intercepts **X**. **FORCE DRIFT** is on by default and keeps the game's drift-event switch active in every driving mode, not just free roam; **X** still toggles the game's own drift setup in free roam, and gamepad **B** toggles the force. The trainer keeps the drift streak alive through wall hits and banks 1,000,000 points at a time so the counter restarts.
- **Rewrote Spin.** The car now rotates around its own up axis in place instead of sliding or launching into the air.
- **Rebuilt the panel as a real trainer window.** Compact top-left layout, draggable header, labeled rows with ON/OFF states, grouped sections, and a **☰ TRAINER** tab when hidden. Toggle with **Insert**; **P** (pause) and **F9** are left to the game.
- **Removed the trainer speedometer.** The game already has one, and the extra readout only cluttered the screen.
- **Removed the trainer's G shortcut** for low gravity, because **G** toggles the game's headlights. Low gravity remains available from the panel and gamepad **X**.
- **Typing guard:** trainer hotkeys no longer fire while the game's text entry is open.
- Adjustable jump power and gamepad bindings for force drift, spin, low gravity, save/load, and boost power.

### v1.0

- Initial public release: NOS boost, position save/load, stop lock, jump, HUD

---

## Disclaimer

This software is provided strictly for educational and research purposes, demonstrating WebAssembly memory hooks and runtime manipulation concepts within browser environments.

---

## License

Distributed under the MIT License. See `LICENSE` for details.

## Credits
- Background Music: Music by [Marco Conti](https://pixabay.com/users/velariomusic-54515099/) from [Pixabay](https://pixabay.com/music/)
