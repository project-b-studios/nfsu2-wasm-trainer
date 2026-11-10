# NFSU2 WebAssembly Trainer

[![Trainer Preview](preview.png)](https://youtu.be/c2urRNPexhU)

Trainer for **nfsu2.xyz**. It hooks `WebAssembly.Memory` before the game starts and changes the game's memory from the browser console.

![Version](https://img.shields.io/badge/Version-1.1-brightgreen?style=for-the-badge)

---

## Links

- **Game:** [nfsu2.xyz](https://nfsu2.xyz)
- **Video:** [Watch on YouTube](https://youtu.be/c2urRNPexhU)

---

## Features

- **NOS boost:** raises the car's speed towards a target. The target is the speed when boost was enabled plus 50-500 km/h, adjustable.
- **Jump:** adds upward velocity. Power is adjustable from 6 to 60.
- **Hard stop / stop lock:** zeroes the car's velocity. Stop lock also holds the position and orientation; it uses a deadband and pins the render body so the camera does not shake.
- **Position save / load:** stores the position, centre of mass and orientation, plus the game's own copies of them, and restores them for 250 ms.
- **Drift:** the game's own **X** toggle in free roam, and the game's own drift events (career or network). The trainer keeps the pending points and the multiplier through wall hits and undoes a crash bank. In free roam it also banks 1,000,000 points at a time; a drift event keeps the game's own bank so the race score is not changed. It does not force the drift switch in other races or outruns; the game's style-points branch then uses a stale pointer and the WASM build crashes. Outside free roam, **X** toggles **DRIFT ASSIST (ALL MODES)**, which lowers the rear wheels' grip so the car slides in races. The assist stays on through wall hits. It does not show the game's drift score or drift camera outside free roam.
- **Anti-flip:** keeps the car from staying upside down after a high-speed wall hit. It turns the car back towards the world's up and damps the spin that keeps it over. On by default; the panel has an **ANTI-FLIP** toggle.
- **Low gravity:** reduces downward velocity while falling.
- **Spin:** holds the car at its current position and turns it around the world's vertical axis.
- **Barrel roll:** holds the car at its current position and turns it around its own forward axis. It can run together with spin. Turning it off puts the car back on its wheels, so the camera does not stay tilted.
- **Showoff:** writes tyre slip for the game's smoke effect and pulses the nitrous state for exhaust flames. It sends no game keys, so it cannot move the camera. The hydraulic dance (**H/J**) is a separate panel toggle, off by default, and needs the car parked. Turning it off zeroes the wheel lift and levels the body, so the camera returns to its normal angle. The game's own **O** hood/trunk/door showoff is left to the game; the trainer does not automate it because that broke the camera.
- **Career:** shows the bank and adds $100,000 or $1,000,000. It can open the five base garage slots and set the 32 bonus-part/cover-shoot flags. These buttons work only in career mode.
- **Rebindable keys:** click a key badge in the panel and press a new key. Bindings are saved in the browser. A key already in use is swapped, and **RESET KEY BINDINGS** restores the defaults. The defaults avoid the game's **1-4** quick-chat keys.
- **Panel:** compact window at the top-left, hidden by default. Open it with the **☰ TRAINER** tab or the panel key (**Insert** by default). Drag it by the header.
- **Screenshot mode:** **F8** hides the panel, the tab, the help and the toast. Press it again to restore them. Rebindable in the **KEYS** section.
- **Typing guard:** trainer keys do not fire while the game's text entry or a focused text field is open.
- **Both player addresses:** works with the old `0x008900AC` player base and the post-2026-11-03 `0x00D00000` base.

---

## Controls

### Keyboard

| Key | Action |
| :---: | :--- |
| **5** | Toggle NOS boost |
| **6** | Jump |
| **7** | Hard stop |
| **8** | Toggle stop lock |
| **9** | Save position |
| **0** | Load position |
| **- / =** | Boost power -/+ 50 km/h (**Num - / Num +** also work) |
| **, / .** | Jump power -/+ |
| **Z** | Toggle spin |
| **U** | Toggle barrel roll |
| **Y** | Toggle showoff |
| **K** | Show/hide help |
| **Insert** | Show/hide panel |
| **F8** | Hide the panel and tab for screenshots |
| **Alt (hold)** | Keep NOS active |

These are the defaults. Click a key badge in the panel to rebind any action. Bindings persist in the browser. **P** (pause), **Esc** and **F9** are reserved.

**HYDRAULIC DANCE** is panel-only; click its row in the **STUNTS** section. It has no default key.

**No Insert key?** Click the **☰ TRAINER** tab, click the **TRAINER PANEL** key badge, and press another key.

**X** is the game's drift toggle in free roam. Outside free roam, **X** toggles **DRIFT ASSIST (ALL MODES)** instead of showing the game's "Drift mode only works in free roam" message. In a drift event the trainer keeps the pending points and multiplier through wall hits, but it still does not force the game's drift switch in other races, because that crashes the WASM build.

### Gamepad

| Button | Action |
| :---: | :--- |
| **LB** | Toggle boost |
| **RB** | Jump |
| **A** | Toggle stop lock |
| **X** | Toggle low gravity |
| **Y** | Toggle spin |
| **D-Pad Left / Right** | Save / load position |
| **D-Pad Up / Down** | Boost power +/- |

Barrel roll, showoff, hydraulic dance, anti-flip, drift assist and career are on the panel; they have no default gamepad button.

### Panel

The panel starts hidden as a **☰ TRAINER** tab. Click the tab or press **Insert** to open it. The **–** button or the panel key hides it again. **F8** hides the panel, the tab, the help and the toast for a clean screenshot; press it again to bring them back. It can be rebound in the **KEYS** section. Sliders have **− / +** buttons, so the trainer can be used with a mouse or touchpad only.

---

## Usage

1. Open [nfsu2.xyz](https://nfsu2.xyz) in a browser that supports WebAssembly.
2. Open the developer console.
3. Paste the contents of `trainer.js` **before pressing Play**. The trainer hooks `WebAssembly.Memory`; the game's memory must be created after the hook.
4. Press **Play**. The **☰ TRAINER** tab appears at the top-left.
5. Click the tab or press **Insert** to open the panel.

### Install clip

![Installing the trainer](trainer-in-action.gif)

The clip shows the install: open nfsu2.xyz, press **F12**, paste `trainer.js` into the console, then press **Play**.

### Showoff

**SHOWOFF** writes tyre slip for the game's smoke effect and pulses the nitrous state for exhaust flames. It sends no game keys, so it works in every mode and cannot move the camera. Toggle it off to restore the fields it changed.

**HYDRAULIC DANCE** is a separate toggle in the **STUNTS** section. Stop the car, click it, and the trainer alternates **H** and **J** for the game's hydraulics. The game's lift moves the render body the camera follows, so this is off by default. Turning it off, or driving faster than about 10 mph, releases the keys, zeroes the wheel lift and levels the body.

The game's own **O** hood/trunk/door cycle is not automated by the trainer. Sending **O** from the trainer broke the camera, so use the game's own **O** key while parked in free roam.

### Drift assist and anti-flip

**DRIFT ASSIST (ALL MODES)** lowers the rear wheels' grip factor, the same field the game's drift handling changes. The car slides in races and free roam. Press **X** outside free roam to toggle it, or click its panel row. It keeps the lower grip through wall hits, so a scrape does not turn the assist off. It does not show the game's drift score or switch to the drift camera outside free roam, because forcing the game's drift switch in a race crashes the WASM build. Toggle it off to put the rear grip back.

**ANTI-FLIP** is on by default. When a wall hit turns the car past about 57 degrees, it turns the car back towards the world's up and damps the spin that keeps it over. It is skipped while spin, barrel roll or stop lock is active. Toggle it off if you want the game's full crash physics.

### Career

Open the panel in career mode. **ADD $100,000** and **ADD $1,000,000** write the career bank. **UNLOCK 5 BASE GARAGE SLOTS** clears the locked flag on the five slots the base game owns. **UNLOCK BONUS PARTS** sets the 32 flags for the unique parts and cover shoots. Use these in the garage or career menus, not during a race or save. The trainer does not touch the game's extra slots 6-10, because the web port keeps those outside the base career structure.

---

## Troubleshooting

- **About 1 second freeze the first time NOS kicks in:** the game is loading the NOS effect and streaming map assets. Lower the boost power with **-** if it bothers you.
- **Trainer does nothing:** it was injected after the game started. Reload the page and inject it again before pressing Play.
- **Drift mode in races:** the game's own drift mode is free roam only. The trainer does not force its switch in races because that crashes the game's WASM build. Press **X** outside free roam, or click **DRIFT ASSIST (ALL MODES)** in the panel, for sliding in races. It stays on through wall hits.
- **Car flips over after a wall hit:** **ANTI-FLIP** is on by default and should right it. If it still happens, note the car, speed and wall, and turn the toggle off and on once to confirm the state.
- **Pressing X in a race still shows the drift message:** an older `trainer.js` is loaded. Reload the page and inject this build before Play.
- **No Insert key / panel will not open:** click the **☰ TRAINER** tab, then rebind **TRAINER PANEL** to another key.
- **The 1-4 quick-chat picker is not from the trainer:** it belongs to nfsu2.xyz. The trainer's defaults avoid **1-4**. It can be turned off in the site's Settings, Online, Quick chat.
- **Stop lock still shakes:** report the car and location. The current build pins the render body and uses a 5 mm position deadband; a different camera path may need another field.

### Can the trainer hide my name or IP, or prevent a ban?

No. The trainer runs in your browser and only changes the game's local memory. The server still receives your account, name and IP. Bans on nfsu2.xyz are manual, and they can cover a network or VPN, not just one account. A client-side mode cannot hide that. Use a separate account and network if you accept the risk, or do not use the trainer around other players.

---

## Changelog

### v1.1

- **Fixed for the 2026-11-03 split-screen update.** The web build moved `PlayersByNumber[0]` from `0x008900AC` to `0x00D00000`. The trainer detects either address and checks the pointer chain.
- **Drift in every mode.** In free roam, **X** is the game's own toggle; the trainer keeps the pending points and the multiplier through wall hits, undoes a crash bank, and banks 1,000,000 points at a time. In a drift event (career or network) it keeps the points and multiplier through wall hits and leaves the game's own bank alone. Outside free roam, **X** toggles **DRIFT ASSIST (ALL MODES)**, which lowers the rear wheels' grip factor so the car slides in races too. The assist stays on through wall hits. Forcing the game's drift switch in a race makes the style-points branch use a stale pointer and crash, so the trainer never does that; the assist has no drift score or drift camera outside free roam.
- **Anti-flip added.** A high-speed wall hit no longer leaves the car upside down. The car is turned back towards the world's up and the spin is damped. On by default, with a panel toggle.
- **Stop lock no longer shakes the camera.** It uses a 5 mm position deadband, a 0.8-degree orientation deadband, and pins the render body's position and orientation.
- **Spin and barrel roll share one held pose.** Spin turns around the world's vertical axis; barrel roll turns around the car's forward axis. With both on, spin is applied first and the roll follows the new forward axis.
- **Showoff added.** It writes slip-based tyre smoke and the nitrous flame. The hydraulic dance is a separate panel toggle, off by default. Turning it off zeroes the wheel lift and levels the body, so the camera does not stay at a tilted angle. The trainer does not automate the game's **O** parts showoff because it broke the camera; the game's own **O** key still works.
- **Career controls added.** Bank display, +$100,000, +$1,000,000, five base garage slots, and the 32 bonus-part/cover-shoot flags.
- **Rebindable hotkeys.** Click any key badge, press a new key, and the binding is saved. A key already in use swaps with the old one. **RESET KEY BINDINGS** restores the defaults. Defaults avoid **1-4**, and the panel key can be moved off **Insert**.
- **Panel rebuilt.** Compact top-left layout, draggable header, ON/OFF states, grouped sections, and the **☰ TRAINER** tab. **P** and **F9** are left to the game.
- **Screenshot key added.** **F8** hides the panel, the tab, the help and the toast; press it again to restore them. Rebindable in the **KEYS** section.
- **Speedometer removed.** The game already has one.
- **Low gravity moved off G.** **G** toggles the game's headlights; low gravity is on the panel and gamepad **X**.
- **Typing guard.** Trainer keys do not fire while text entry is open.
- Adjustable jump power and gamepad bindings for spin, low gravity, save/load and boost power.

### v1.0

- Initial release: NOS boost, position save/load, stop lock, jump, HUD.

---

## Disclaimer

This software is provided for educational and research purposes, demonstrating WebAssembly memory hooks and runtime manipulation in a browser. Use it at your own risk.

---

## License

MIT. See `LICENSE`.

## Credits

- Background music: Marco Conti, [Pixabay](https://pixabay.com/users/velariomusic-54515099/)
