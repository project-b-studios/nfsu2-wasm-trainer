# NFSU2 WebAssembly Trainer / NOS Hack

[![Trainer Preview](preview.png)](https://youtu.be/c2urRNPexhU)

> A lightweight, feature-rich memory manipulation script and trainer designed for **nfsu2.xyz**. Features custom NOS acceleration, position save/load, jump mechanics, and a built-in HUD overlay!

![Banner / Preview](https://img.shields.io/badge/Status-Working-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-WebAssembly-orange?style=for-the-badge)

---

## Quick Links & References

- **Target Platform:** Play the game directly at [nfsu2.xyz](https://nfsu2.xyz)
- **Video Demonstration:** [Watch on YouTube](https://youtu.be/c2urRNPexhU)

---

## Features

- **Custom NOS Boost:** Dynamic acceleration control with adjustable km/h increments (50 - 500 km/h).
- **Position Save & Load:** Coordinate persistence allowing instant state saving and telemetry restoration.
- **Stop Lock / Hard Stop:** Instant vehicle immobilization and position locking mechanisms.
- **Jump Mechanic:** Upward velocity vector application for obstacle clearance.
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
| **0** | Show / Hide Help HUD |
| **Alt (Hold)** | Keep NOS active |

### Gamepad Layout

| Button | Action |
| :---: | :--- |
| **LB** | Toggle Boost |
| **RB** | Jump |
| **A** | Toggle Stop Lock |
| **D-Pad Left / Right** | Save / Load Position |
| **D-Pad Up / Down** | Boost Power +/- |

---

## Usage Instructions

1. Navigate to [nfsu2.xyz](https://nfsu2.xyz) via a WebAssembly-compatible browser.
2. Open the Developer Console (`F12` or `Ctrl+Shift+I`).
3. Inject the contents of `trainer.js` into the console execution context and press **Enter**.
4. Press **`0`** to toggle the on-screen telemetry and control overlay.

---

## Disclaimer

This software is provided strictly for educational and research purposes, demonstrating WebAssembly memory hooks and runtime manipulation concepts within browser environments.

---

## License

Distributed under the MIT License. See `LICENSE` for details.

## Credits
- Background Music: Music by [Marco Conti](https://pixabay.com/users/velariomusic-54515099/) from [Pixabay](https://pixabay.com/music/)