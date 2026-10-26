# NFSU2 WebAssembly Trainer / NOS Hack

[![Trainer Preview](preview.png)](https://youtu.be/c2urRNPexhU)

> A lightweight, feature-rich memory manipulation script and trainer designed for **nfsu2.xyz**. Features custom NOS acceleration, position save/load, jump mechanics, chaos mode, low gravity, spin, and a built-in HUD overlay!

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
- **Chaos Mode:** Random impulses and spins — good for clips, terrible for lap times.
- **Low Gravity:** Softens falls and keeps the car in the air longer.
- **Spin:** Rotates the car mid-air (or mid-road, no judgement).
- **On-Screen Panel:** Clickable buttons and sliders for every feature — works on touch devices too, no keyboard needed.
- **Live Speedometer:** Real-time km/h readout with active mode indicators.
- **Controller & Keyboard Support:** Dual input handling for standard keyboard layouts and XInput-compatible Gamepads.
- **Clean HUD Overlay:** Native HTML Popover API implementation ensuring zero external CSS dependencies.

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
| **X** | Toggle Chaos Mode |
| **G** | Toggle Low Gravity |
| **Z** | Toggle Spin |
| **P** | Show / Hide On-Screen Panel |
| **T** | Show / Hide Speedometer |
| **0** | Show / Hide Help HUD |
| **Alt (Hold)** | Keep NOS active |

### Gamepad Layout

| Button | Action |
| :---: | :--- |
| **LB** | Toggle Boost |
| **RB** | Jump |
| **A** | Toggle Stop Lock |
| **B** | Toggle Chaos Mode |
| **X** | Toggle Low Gravity |
| **Y** | Toggle Spin |
| **D-Pad Left / Right** | Save / Load Position |
| **D-Pad Up / Down** | Boost Power +/- |

### On-Screen Panel

The clickable panel in the bottom-right corner has every action plus NOS/jump power sliders, so the trainer is fully usable on phones and tablets without a keyboard. Press **P** to hide or show it.

---

## Usage Instructions

1. Navigate to [nfsu2.xyz](https://nfsu2.xyz) via a WebAssembly-compatible browser.
2. Open the Developer Console (`F12` or `Ctrl+Shift+I`).
3. Inject the contents of `trainer.js` into the console execution context and press **Enter**.
4. Press **`0`** to toggle the on-screen telemetry and control overlay.

---

## Changelog

### v1.1
- Clickable on-screen panel with sliders (keyboard-free, touch friendly)
- Live speedometer with active mode indicators
- Chaos Mode (random impulses + spins)
- Low Gravity mode
- Spin mode
- Adjustable jump power
- New gamepad bindings for the new modes

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

