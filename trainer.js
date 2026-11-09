(() => {
  if (window.__nosCheat) return console.log("[NOS] already running");

  const O = WebAssembly.Memory, ms = [];
  WebAssembly.Memory = class extends O {
    constructor(o) {
      super(o);
      if (o && o.shared) ms.push(this);
    }
  };

  let last = {}, memLogged = false, carLogged = false;
  let buf = null, u = null, f32 = null, u8 = null;

  let boostOn = false, boostBase = 0, boostKmh = 100;
  const BOOST_STEP = 50, BOOST_MIN = 50, BOOST_MAX = 500;

  let held = false, locked = false, lockState = null;
  let savedPos = null, loadState = null, loadUntil = 0, saveScan = null;
  let upAvg = null;

  let gravOn = false, spinOn = false, barrelOn = false, airState = null;
  let antiFlipOn = true, driftAssistOn = false;
  let driftAssistCar = 0, driftAssistPo = 0, driftAssistSaved = null;
  let showoffOn = false, showoffSaved = null;
  let hydShowoffOn = false, hydAt = 0, hydStep = 0, hydPrev = null, hydSaved = null, hydEngaged = false;
  let synthKeys = 0;
  let jumpPower = 8, panelOn = false;
  let uiHidden = false;
  let paintAt = 0;
  let driftPrev = 0, driftBankAt = 0, driftLostAt = 0;
  let driftLevel = 0, driftGain = 0, driftCrashAt = 0, driftTotalSeen = 0;
  let driftMarkPrev = false;

  // The game's quick chat uses 1-4 (twice) in free roam, so the trainer's
  // defaults stay on 5-0. Every action can be rebound from the panel.
  const DEFAULT_BINDS = {
    boost: "Digit5",
    jump: "Digit6",
    stop: "Digit7",
    lock: "Digit8",
    savePos: "Digit9",
    loadPos: "Digit0",
    powerDown: "Minus",
    powerUp: "Equal",
    jumpDown: "Comma",
    jumpUp: "Period",
    spin: "KeyZ",
    barrel: "KeyU",
    showoff: "KeyY",
    help: "KeyK",
    panel: "Insert",
    shot: "F8"
  };
  const BIND_ACTIONS = [
    ["boost", "NOS BOOST"],
    ["jump", "JUMP"],
    ["stop", "HARD STOP"],
    ["lock", "STOP LOCK"],
    ["savePos", "SAVE POSITION"],
    ["loadPos", "LOAD POSITION"],
    ["powerDown", "BOOST POWER -"],
    ["powerUp", "BOOST POWER +"],
    ["jumpDown", "JUMP POWER -"],
    ["jumpUp", "JUMP POWER +"],
    ["spin", "SPIN"],
    ["barrel", "BARREL ROLL"],
    ["showoff", "SHOWOFF"],
    ["help", "HELP"],
    ["panel", "TRAINER PANEL"],
    ["shot", "HIDE UI (SCREENSHOT)"]
  ];
  const BIND_LABEL = Object.fromEntries(BIND_ACTIONS);
  const BINDS = { ...DEFAULT_BINDS };

  const CODE_LABELS = {
    Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
    Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/",
    Space: "Space", Enter: "Enter", NumpadEnter: "Num Enter", Tab: "Tab",
    Backspace: "Backspace", Delete: "Del", Insert: "Insert", Home: "Home", End: "End",
    PageUp: "PgUp", PageDown: "PgDn",
    ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
    NumpadAdd: "Num +", NumpadSubtract: "Num -", NumpadMultiply: "Num *",
    NumpadDivide: "Num /", NumpadDecimal: "Num .", NumpadEqual: "Num =",
    ShiftLeft: "LShift", ShiftRight: "RShift", ControlLeft: "LCtrl", ControlRight: "RCtrl",
    AltLeft: "LAlt", AltRight: "RAlt"
  };
  for (let i = 0; i <= 9; i++) {
    CODE_LABELS["Digit" + i] = String(i);
    CODE_LABELS["Numpad" + i] = "Num " + i;
  }
  for (let i = 1; i <= 12; i++) CODE_LABELS["F" + i] = "F" + i;
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    CODE_LABELS["Key" + ch] = ch;
  }

  const codeLabel = code => code ? (CODE_LABELS[code] || code) : "—";
  const isModifierCode = code => /^(Shift|Control|Alt|Meta)(Left|Right)?$/.test(code || "");
  const eventCode = e => {
    if (e.code) return e.code;
    if (e.key && e.key.length === 1) {
      const ch = e.key.toUpperCase();
      if (ch >= "A" && ch <= "Z") return "Key" + ch;
      if (ch >= "0" && ch <= "9") return "Digit" + ch;
      const m = {
        "`": "Backquote", "-": "Minus", "=": "Equal", "[": "BracketLeft",
        "]": "BracketRight", "\\": "Backslash", ";": "Semicolon", "'": "Quote",
        ",": "Comma", ".": "Period", "/": "Slash", " ": "Space"
      };
      if (m[e.key]) return m[e.key];
    }
    return e.key || "";
  };

  const loadBinds = () => {
    try {
      const raw = JSON.parse(localStorage.getItem("nfsu2TrainerBinds") || "null");
      if (!raw || typeof raw !== "object") return;
      const seen = new Set();
      for (const [action] of BIND_ACTIONS) {
        const v = raw[action];
        if (typeof v === "string" && v && v !== "none" && !seen.has(v)) {
          BINDS[action] = v;
          seen.add(v);
        } else if (v === null || v === "none") {
          BINDS[action] = null;
        }
      }
    } catch (e) {}
  };
  const saveBinds = () => {
    try { localStorage.setItem("nfsu2TrainerBinds", JSON.stringify(BINDS)); } catch (e) {}
  };
  loadBinds();

  const helpText = () => [
    "NFSU2 TRAINER v1.1",
    "",
    "Keyboard (click a key badge in the panel to rebind)",
    "  " + codeLabel(BINDS.boost) + "  NOS boost on/off",
    "  " + codeLabel(BINDS.jump) + "  jump",
    "  " + codeLabel(BINDS.stop) + "  stop once",
    "  " + codeLabel(BINDS.lock) + "  stop lock on/off",
    "  " + codeLabel(BINDS.savePos) + "  save position",
    "  " + codeLabel(BINDS.loadPos) + "  load position",
    "  " + codeLabel(BINDS.powerDown) + " / " + codeLabel(BINDS.powerUp) + "  boost power -/+ 50 km/h",
    "  " + codeLabel(BINDS.jumpDown) + " / " + codeLabel(BINDS.jumpUp) + "  jump power -/+",
    "  " + codeLabel(BINDS.panel) + "  show/hide panel",
    "  " + codeLabel(BINDS.spin) + "  spin on/off",
    "  " + codeLabel(BINDS.barrel) + "  barrel roll on/off",
    "  " + codeLabel(BINDS.showoff) + "  showoff on/off (smoke, flames)",
    "  " + codeLabel(BINDS.help) + "  show/hide this help",
    "  hold Alt  keep NOS active",
    "",
    "PANEL",
    "  " + codeLabel(BINDS.shot) + "  hide the panel and tab for screenshots",
    "  HYDRAULIC DANCE  the game's H/J hydraulics (parked; off resets the body)",
    "  ANTI-FLIP  keep the car from staying upside down after a wall hit",
    "  DRIFT ASSIST  lower rear grip in every mode (no drift score/camera)",
    "",
    "GAME",
    "  1-4 twice  quick chat in free roam (left to the game)",
    "  X  drift: the game's own toggle in free roam; drift assist elsewhere",
    "",
    "CAREER (panel buttons)",
    "  add money, open the 5 base garage slots, unlock bonus parts",
    "",
    "Gamepad",
    "  LB  boost on/off",
    "  RB  jump",
    "  A   stop lock on/off",
    "  X   low gravity",
    "  Y   spin",
    "  D-pad left/right  save/load position",
    "  D-pad up/down     boost power +/-50 km/h"
  ].join("\n");

  const offs = [];
  const listen = (type, fn) => {
    addEventListener(type, fn, true);
    offs.push(() => removeEventListener(type, fn, true));
  };

  const NO_CHILDREN = /^(CANVAS|VIDEO|IMG|IFRAME|EMBED|OBJECT|INPUT|SELECT|TEXTAREA|BUTTON)$/;

  const mkBox = top => {
    const el = document.createElement("div");
    el.setAttribute("popover", "manual");
    el.style.cssText =
      "position:fixed;inset:auto;top:" + top + "px;left:8px;margin:0;border:0;width:auto;height:auto;" +
      "overflow:visible;z-index:2147483647;font:bold 14px monospace;color:#0f0;" +
      "background:rgba(0,0,0,.65);padding:6px 10px;border-radius:4px;" +
      "pointer-events:none;white-space:pre;display:none";
    document.body.appendChild(el);
    return el;
  };

  const place = el => {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    const host = fs && !NO_CHILDREN.test(fs.tagName) ? fs : document.body;
    if (el.parentNode !== host) host.appendChild(el);
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      el.showPopover();
    } catch (e) {}
  };

  const show = el => {
    el.style.display = "block";
    place(el);
  };

  const hide = el => {
    el.style.display = "none";
    try {
      if (el.matches(":popover-open")) el.hidePopover();
    } catch (e) {}
  };

  const hud = mkBox(8);
  hud.style.left = "50%";
  hud.style.transform = "translateX(-50%)";
  hud.style.textAlign = "center";
  const help = mkBox(52);
  help.textContent = helpText();
  help.style.top = "50%";
  help.style.left = "50%";
  help.style.transform = "translate(-50%,-50%)";
  help.style.maxHeight = "80vh";
  help.style.overflow = "auto";
  let helpOn = false;
  let hudTimer = 0;

  const toast = msg => {
    console.log("[NOS] " + msg);
    hud.textContent = msg;
    if (uiHidden) return;
    show(hud);
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => hide(hud), 1500);
  };

  const refit = () => {
    if (hud.style.display === "block") place(hud);
    if (helpOn) place(help);
    if (panelOn) place(panel);
    else place(tab);
  };
  listen("fullscreenchange", refit);
  listen("webkitfullscreenchange", refit);

  // The web build moved PlayersByNumber[0] to 0x00D00000 with the
  // split-screen update (2026-11-03). Older builds used 0x008900AC.
  const PLAYER_BASES = [0xD00000, 0x8900AC];

  const carAt = base => {
    if (!base || (base & 3) || base + 8 > buf.byteLength) return 0;
    const p = u[base >> 2];
    if (!p || (p & 3) || p + 8 > buf.byteLength) return 0;
    const c = u[(p + 4) >> 2];
    if (!c || (c & 3) || c + 0x500 > buf.byteLength) return 0;
    const x = f32[(c + 0x60) >> 2], y = f32[(c + 0x64) >> 2], z = f32[(c + 0x68) >> 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return 0;
    return c;
  };

  const get = () => {
    const m = ms.find(x => x.buffer.byteLength >= 1 << 30);
    if (!m) return null;
    if (!memLogged) {
      memLogged = true;
      console.log("[NOS] memory captured:", m.buffer.byteLength, "bytes");
    }
    if (m.buffer !== buf) {
      buf = m.buffer;
      u = new Int32Array(buf);
      f32 = new Float32Array(buf);
      u8 = new Uint8Array(buf);
      carLogged = false;
    }
    let c = 0, base = 0;
    for (const b of PLAYER_BASES) {
      c = carAt(b);
      if (c) { base = b; break; }
    }
    if (!c) return null;
    if (!carLogged) {
      carLogged = true;
      console.log("[NOS] car found at 0x" + c.toString(16) + " (player base 0x" + base.toString(16) + ")");
    }
    return { u, f32, u8, c };
  };

  // Drift mode in free roam is the game's own: X toggles it (runtime/drift.c).
  // These are the game's drift-score fields, so the trainer can keep the
  // streak alive through a wall hit and bank it every 1,000,000 points.
  const G_FORCEDRIFT = 0x00890104, G_RACE = 0x00890118;
  const G_FLOW = 0x008654A4, G_RACEKIND = 0x0089E7B0;
  const G_CAREER_RACE = 0x00863470, G_GAMEMODE = 0x00850078;
  const G_RACEFLAGS = 0x0089E7D8; // byte +1 is G_DRIFTRACE

  // Career and garage fields, checked against the web build's career.c and
  // garage.c. The bank is a u32; the garage's first five slots sit at
  // CARS0 + 0x5954, 0x7F8 bytes each, with R_LOCKED at +0x7F4.
  const G_CAREER = 0x0085AD40, GARAGE = 0x0083AD90;
  const CAREER_BANK = 0x7134, CAREER_OPEN = 0x7148;
  const GARAGE_SLOTS = 0x5954, GARAGE_REC = 0x7F8, GARAGE_COUNT = 5;
  const R_LOCKED = 0x7F4;
  const G_HYD_LEVEL = 0x007E949C, G_HYD_ON = 0x007E94A0;
  const CAR_NOS = 0x40, CAR_SLIP = 0x3B4, CAR_GROUND = 0x390, CAR_SURF = 0x394;

  const inWorld = () => !!(u && u[G_FLOW >> 2] === 6);

  const inFreeRoam = () => {
    if (!inWorld()) return false;
    const r = u[G_RACE >> 2];
    if (!r || (r & 3) || r + 0xC00 > buf.byteLength) return false;
    const state = u[r >> 2];
    return (state === 4 || state === 6) &&
      (u[(r + 0x24) >> 2] | 0) === 1 &&
      u[G_CAREER_RACE >> 2] === 0 &&
      u[G_RACEKIND >> 2] === 0 &&
      ((u[G_RACEFLAGS >> 2] >>> 8) & 0xFF) === 0 &&
      (u[G_GAMEMODE >> 2] & 0x208) === 0;
  };

  const inCareer = () => !!(u && (u[G_GAMEMODE >> 2] & 1) !== 0);

  const careerBank = () => {
    if (!u || !buf || !inCareer()) return null;
    const a = G_CAREER + CAREER_BANK;
    if (a + 4 > buf.byteLength) return null;
    return u[a >> 2] >>> 0;
  };

  const addMoney = amount => {
    if (!u || !buf) return toast("Game not ready");
    if (!inCareer()) return toast("Career mode only");
    const a = G_CAREER + CAREER_BANK;
    if (a + 4 > buf.byteLength) return toast("Career data not found");
    const cur = u[a >> 2] >>> 0;
    const next = Math.min(999999999, cur + amount);
    u[a >> 2] = next;
    toast("Bank: $" + next.toLocaleString("en-US"));
    paint(performance.now(), true);
  };

  const unlockGarage = () => {
    if (!u || !buf || !u8) return toast("Game not ready");
    if (!inCareer()) return toast("Career mode only");
    let n = 0;
    for (let i = 0; i < GARAGE_COUNT; i++) {
      const r = GARAGE + GARAGE_SLOTS + i * GARAGE_REC;
      if (r + R_LOCKED + 1 > buf.byteLength) continue;
      if (u8[r + R_LOCKED]) {
        u8[r + R_LOCKED] = 0;
        n++;
      }
    }
    toast(n ? "Opened " + n + " of the 5 base garage slots" : "The 5 base garage slots are already open");
  };

  const unlockBonus = () => {
    if (!u || !buf || !u8) return toast("Game not ready");
    if (!inCareer()) return toast("Career mode only");
    const a = G_CAREER + CAREER_OPEN;
    if (a + 32 > buf.byteLength) return toast("Career data not found");
    for (let i = 0; i < 32; i++) u8[a + i] = 1;
    toast("Bonus parts and cover shoots unlocked");
  };

  // The game reads its own key events from window. Synthetic events let the
  // trainer use the game's hydraulics and showoff without guessing physics
  // fields. The trainer's own listener ignores events marked __nosSynth.
  const synthKey = (type, code, key) => {
    try {
      if (typeof KeyboardEvent !== "function") return;
      const e = new KeyboardEvent(type, {
        code, key: key || code, bubbles: true, cancelable: true
      });
      try { e.__nosSynth = true; } catch (err) {}
      // The game's input layer listens on window; dispatching on the canvas
      // (when there is one) still reaches window through bubbling, and also
      // covers a build that attached the listener to the canvas itself.
      const target = (document.querySelector && (document.querySelector("canvas") || document.body)) || window;
      if (!target || typeof target.dispatchEvent !== "function") return;
      synthKeys++;
      try { target.dispatchEvent(e); }
      finally { synthKeys--; }
    } catch (err) {}
  };

  // The racers are sorted by position at race +0xBD0. In a race the player is
  // usually not the first one, so find the racer whose car is the player's car.
  const driftInfo = car => {
    if (!u || !buf) return null;
    const none = { on: false, st: 0, dc: 0, state: 2, pend: 0, total: 0, level: 0 };
    const on = u[G_FORCEDRIFT >> 2] !== 0;
    const r = u[G_RACE >> 2];
    if (!r || (r & 3) || r + 0xC00 > buf.byteLength) return { ...none, on };
    const n = Math.min(Math.max(u[(r + 0x24) >> 2] | 0, 0), 8);
    let rc = 0;
    if (car) {
      for (let i = 0; i < n; i++) {
        const p = u[(r + 0xBD0 + 4 * i) >> 2];
        if (p && !(p & 3) && p + 0x20 <= buf.byteLength && u[p >> 2] === car) {
          rc = p;
          break;
        }
      }
    }
    if (!rc) rc = u[(r + 0xBD0) >> 2];
    if (!rc || (rc & 3) || rc + 0x1DC > buf.byteLength) return { ...none, on };
    const ds = u[(rc + 0x1D4) >> 2], dc = u[(rc + 0x1D8) >> 2];
    if (!ds || (ds & 3) || ds + 4 > buf.byteLength) return { ...none, on };
    const st = u[ds >> 2];
    if (!st || (st & 3) || st + 0x30 > buf.byteLength) return { ...none, on };
    const state = u[(st + 0x14) >> 2];
    const pend = f32[(st + 0x24) >> 2], total = f32[(st + 0x2C) >> 2];
    const level = dc && !(dc & 3) && dc + 0x20 <= buf.byteLength ? u[(dc + 0x1C) >> 2] : 0;
    return {
      on, st, dc, state,
      pend: Number.isFinite(pend) ? pend : 0,
      total: Number.isFinite(total) ? total : 0,
      level: level >= 1 && level <= 5 ? level : 1
    };
  };

  const driftTick = car => {
    // Drift is the game's own X toggle in free roam. The trainer only reads
    // the switch; writing G_FORCEDRIFT outside the game's drift mode makes the
    // style-points branch use a stale pointer and the WASM build crashes.
    const d = driftInfo(car);
    const now = performance.now();
    // The car's crash mark (car + 0x38) is set by the game's physics on a wall
    // hit. While it is set, the game can zero the pending points and the
    // multiplier; the trainer keeps them and undoes a crash bank.
    const mark = u8 && car + 0x38 < buf.byteLength ? u8[car + 0x38] : 0;
    const crashed = !!mark;
    if (crashed && !driftMarkPrev) console.log("[NOS] drift: crash mark " + mark + " (state " + (d ? d.state : -1) + ")");
    driftMarkPrev = crashed;
    if (crashed || (d && d.state === 4)) driftCrashAt = now;
    const recentCrash = crashed || (driftCrashAt > 0 && now - driftCrashAt < 1500);
    const recentBankCrash = crashed || (driftCrashAt > 0 && now - driftCrashAt < 600);
    if (!d || !d.on || !d.st) {
      // A crash can null the style pointer for a frame or two. Keep the last
      // points for the grace window so they can go into the new style.
      if (recentCrash && driftPrev > 0) return;
      driftPrev = 0;
      driftLostAt = 0;
      driftLevel = 0;
      driftGain = 0;
      driftCrashAt = 0;
      driftTotalSeen = 0;
      return;
    }
    const dcOk = d.dc && !(d.dc & 3) && d.dc + 0x24 <= buf.byteLength;
    const level = dcOk ? u[(d.dc + 0x1C) >> 2] : 0;
    const gain = dcOk ? u[(d.dc + 0x20) >> 2] : 0;
    const prevLevel = driftLevel, prevGain = driftGain;
    const total = d.total;
    const totalUp = total - driftTotalSeen;
    driftTotalSeen = total;
    const keepLevel = () => {
      if (!dcOk || prevLevel < 1 || prevLevel > 5 || level >= prevLevel) return;
      u[(d.dc + 0x1C) >> 2] = prevLevel;
      if (prevGain > 0) u[(d.dc + 0x20) >> 2] = prevGain;
    };
    const trackLevel = () => {
      if (level >= 1 && level <= 5) {
        driftLevel = level;
        driftGain = gain;
      }
    };
    const restore = (keep, undoBank) => {
      if (!(keep > 0)) return false;
      if (undoBank && totalUp > 0 && Math.abs(totalUp - keep) <= 2) {
        f32[(d.st + 0x2C) >> 2] = total - totalUp;
        driftTotalSeen = total - totalUp;
      }
      f32[(d.st + 0x24) >> 2] = keep;
      u[(d.st + 0x14) >> 2] = 0;
      driftPrev = keep;
      driftLostAt = now;
      keepLevel();
      if (level >= prevLevel) trackLevel();
      return true;
    };
    if (d.state === 4) {
      // a wall took the drift: put its points back and keep counting
      restore(Math.max(driftPrev, d.pend), true);
      return;
    }
    if (d.state === 3) {
      // a normal bank stands. A crash can bank the points before the next
      // tick; undo that bank so the streak stays in the pending counter.
      if (recentBankCrash && driftPrev > 0) {
        restore(driftPrev, true);
        return;
      }
      trackLevel();
      driftPrev = 0;
      driftLostAt = 0;
      return;
    }
    if (d.state === 0 || d.state === 1) {
      if (driftPrev > 0 && d.pend + 1 < driftPrev) {
        // the game reset the drift between two ticks (a crash): restore it
        restore(driftPrev, true);
      } else {
        if (d.pend > 0) driftPrev = d.pend;
        trackLevel();
      }
      if (d.pend >= 1000000 && now >= driftBankAt) {
        const banks = Math.floor(d.pend / 1000000) * 1000000;
        driftBankAt = now + 1000;
        f32[(d.st + 0x2C) >> 2] = d.total + banks;
        f32[(d.st + 0x24) >> 2] = d.pend - banks;
        driftPrev = d.pend - banks;
        toast("Drift: " + banks.toLocaleString("en-US") + " banked");
      }
      return;
    }
    if (d.state === 2 && driftPrev > 0 && recentCrash) {
      // a crash can go 4 -> 2 before the next tick; keep the points and the
      // multiplier through a wall scrape
      restore(driftPrev, true);
      return;
    }
    trackLevel();
    driftPrev = 0;
    driftLostAt = 0;
  };

  const isAlt = e => e.key === "Alt" || e.key === "AltGraph" || e.code === "AltLeft" || e.code === "AltRight";

  const rbOf = (u, c) => {
    const b = u[(c + 0x3C) >> 2];
    return b ? u[(b + 0x68) >> 2] : 0;
  };

  const velOf = (u, f32, c) => {
    const rb = rbOf(u, c);
    return rb
      ? [f32[(rb + 0xA0) >> 2], f32[(rb + 0xA4) >> 2], f32[(rb + 0xA8) >> 2]]
      : [f32[(c + 0x70) >> 2], f32[(c + 0x74) >> 2], f32[(c + 0x78) >> 2]];
  };

  const speedOf = (u, f32, c) => Math.hypot(...velOf(u, f32, c));

  const massOf = (u, f32, c) => {
    const ti = u[(c + 0xC) >> 2], m = ti ? f32[(ti + 0x220) >> 2] : 0;
    return m > 0.3 && m < 20 ? m : 1.4;
  };

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const horiz = (v, w) => { const d = dot(v, w); return [v[0] - d * w[0], v[1] - d * w[1], v[2] - d * w[2]]; };

  const wUpVec = () => {
    if (!upAvg) return [0, 1, 0];
    const a = upAvg.map(Math.abs);
    const i = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
    // The world's up axis never flips. Deriving its sign from the car's
    // averaged up vector made spin and the barrel-roll leveling turn upside
    // down after a roll.
    const v = [0, 0, 0];
    v[i] = 1;
    return v;
  };

  const rot = (v, w, a) => {
    const c = Math.cos(a), s = Math.sin(a), d = dot(v, w);
    const x = w[1] * v[2] - w[2] * v[1];
    const y = w[2] * v[0] - w[0] * v[2];
    const z = w[0] * v[1] - w[1] * v[0];
    return [
      v[0] * c + x * s + w[0] * d * (1 - c),
      v[1] * c + y * s + w[1] * d * (1 - c),
      v[2] * c + z * s + w[2] * d * (1 - c)
    ];
  };

  const vecAt = (f32, base, off) => [f32[(base + off) >> 2], f32[(base + off + 4) >> 2], f32[(base + off + 8) >> 2]];
  const putVec = (f32, base, off, v) => {
    f32[(base + off) >> 2] = v[0];
    f32[(base + off + 4) >> 2] = v[1];
    f32[(base + off + 8) >> 2] = v[2];
  };

  const hspeedOf = (u, f32, c) => Math.hypot(...horiz(velOf(u, f32, c), wUpVec()));

  const snap = (f32, c) => ({
    p: [f32[(c + 0x60) >> 2], f32[(c + 0x64) >> 2], f32[(c + 0x68) >> 2]],
    com: [f32[(c + 0x50) >> 2], f32[(c + 0x54) >> 2], f32[(c + 0x58) >> 2]],
    f: [f32[(c + 0x90) >> 2], f32[(c + 0x94) >> 2], f32[(c + 0x98) >> 2]],
    l: [f32[(c + 0xa0) >> 2], f32[(c + 0xa4) >> 2], f32[(c + 0xa8) >> 2]],
    u: [f32[(c + 0xb0) >> 2], f32[(c + 0xb4) >> 2], f32[(c + 0xb8) >> 2]]
  });

  const baseOf = (u, c, k) => k === "c" ? c : k === "b" ? u[(c + 0x3C) >> 2] : rbOf(u, c);

  const regionList = (u, c) => {
    const b = u[(c + 0x3C) >> 2], rb = rbOf(u, c);
    const L = [{ k: "c", base: c, from: 0, to: 0x800 }];
    if (b) L.push({ k: "b", base: b, from: 0, to: 0x400 });
    if (rb) L.push({ k: "rb", base: rb, from: -0x40, to: 0x800 });
    return L;
  };

  const scanPos = (u, f32, c, found) => {
    const s = snap(f32, c);
    const sp = speedOf(u, f32, c);
    const tol = 0.002 + 0.002 * (isFinite(sp) ? sp : 0);
    const mag = v => Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]);
    const needles = [["p", s.p], ["com", s.com]].filter(n => mag(n[1]) > 0.01);
    if (!needles.length) return;
    const err = (i, v) => Math.max(Math.abs(f32[i] - v[0]), Math.abs(f32[i + 1] - v[1]), Math.abs(f32[i + 2] - v[2]));
    for (const r of regionList(u, c)) {
      for (let off = r.from; off <= r.to - 12; off += 4) {
        const a = r.base + off;
        if (a < 0x100 || a + 12 > buf.byteLength) continue;
        const key = r.k + ":" + off;
        if (found.has(key)) continue;
        const i = a >> 2;
        let best = null, bestErr = tol;
        for (const [nm, v] of needles) {
          const e = err(i, v);
          if (e <= bestErr) { best = nm; bestErr = e; }
        }
        if (best) found.set(key, { k: r.k, off, needle: best });
      }
    }
  };

  const writeSlots = (u, f32, c, st) => {
    for (const sl of st.slots) {
      const base = baseOf(u, c, sl.k);
      if (!base) continue;
      const a = base + sl.off;
      if (a < 0x100 || a + 12 > buf.byteLength) continue;
      const v = sl.needle === "com" ? st.com : st.p;
      const i = a >> 2;
      f32[i] = v[0]; f32[i + 1] = v[1]; f32[i + 2] = v[2];
    }
  };

  const jump = (u, f32, c, power) => {
    const rb = rbOf(u, c);
    if (!rb) return console.log("[NOS] no rb");
    const mass = massOf(u, f32, c);
    let ux = f32[(c + 0xB0) >> 2], uy = f32[(c + 0xB4) >> 2], uz = f32[(c + 0xB8) >> 2];
    const len = Math.hypot(ux, uy, uz) || 1;
    ux /= len; uy /= len; uz /= len;
    const j = power || jumpPower;
    f32[(rb + 0xA0) >> 2] += ux * j;
    f32[(rb + 0xA4) >> 2] += uy * j;
    f32[(rb + 0xA8) >> 2] += uz * j;
    f32[(rb + 0x70) >> 2] += ux * j * mass;
    f32[(rb + 0x74) >> 2] += uy * j * mass;
    f32[(rb + 0x78) >> 2] += uz * j * mass;
    const nvx = f32[(rb + 0xA0) >> 2], nvy = f32[(rb + 0xA4) >> 2], nvz = f32[(rb + 0xA8) >> 2];
    f32[(c + 0x70) >> 2] = nvx;
    f32[(c + 0x74) >> 2] = nvy;
    f32[(c + 0x78) >> 2] = nvz;
    const ns = Math.hypot(nvx, nvy, nvz);
    f32[(c + 0x42C) >> 2] = ns;
    f32[(c + 0x430) >> 2] = ns;
    console.log("[NOS] jump");
  };

  const stopCar = (u, f32, c, quiet) => {
    const rb = rbOf(u, c);
    if (!rb) {
      if (!quiet) console.log("[NOS] no rb");
      return;
    }
    for (const off of [0xA0, 0x70, 0x80, 0xC0])
      for (let i = 0; i < 3; i++) f32[(rb + off + 4 * i) >> 2] = 0;
    for (let i = 0; i < 3; i++) {
      f32[(c + 0x70 + 4 * i) >> 2] = 0;
      f32[(c + 0x110 + 4 * i) >> 2] = 0;
    }
    f32[(c + 0x42C) >> 2] = 0;
    f32[(c + 0x430) >> 2] = 0;
    if (lockState) {
      const st = lockState;
      // Deadband: let physics settle within 5 mm instead of snapping the car
      // every 8 ms. The render body is pinned every tick because the camera
      // reads that position, not the physics position.
      const dx = f32[(c + 0x60) >> 2] - st.p[0];
      const dy = f32[(c + 0x64) >> 2] - st.p[1];
      const dz = f32[(c + 0x68) >> 2] - st.p[2];
      if (dx * dx + dy * dy + dz * dz > 0.000025) {
        putVec(f32, c, 0x60, st.p);
        putVec(f32, c, 0x50, st.com);
      }
      if (!spinOn && !barrelOn) {
        const f = vecAt(f32, c, 0x90);
        if (dot(f, st.f) < 0.9999) {
          putVec(f32, c, 0x90, st.f);
          putVec(f32, c, 0xA0, st.l);
          putVec(f32, c, 0xB0, st.u);
        }
      }
      putVec(f32, rb, 0x20, st.p);
      if (!spinOn && !barrelOn) {
        putVec(f32, rb, 0x30, st.f);
        putVec(f32, rb, 0x40, st.l);
        putVec(f32, rb, 0x50, st.u);
      }
    }
    if (!quiet) console.log("[NOS] stop");
  };

  const hardStop = (u, f32, c) => stopCar(u, f32, c, false);

  // Spin and barrel roll share one held pose. Spin turns the frame around the
  // world's up axis; barrel roll turns it around the car's own forward axis.
  // With both on, the spin is applied first and the roll follows the new
  // forward axis, so the two combine instead of overwriting each other.
  const airTick = (u, f32, c, rb) => {
    if (!spinOn && !barrelOn) {
      airState = null;
      return;
    }
    if (!airState || airState.car !== c) {
      airState = {
        car: c,
        p: vecAt(f32, c, 0x60),
        off: [
          f32[(c + 0x60) >> 2] - f32[(c + 0x50) >> 2],
          f32[(c + 0x64) >> 2] - f32[(c + 0x54) >> 2],
          f32[(c + 0x68) >> 2] - f32[(c + 0x58) >> 2]
        ],
        rb,
        rbP: rb ? vecAt(f32, rb, 0x20) : null
      };
    }
    const st = airState;
    if (rb && st.rb !== rb) {
      st.rb = rb;
      st.rbP = vecAt(f32, rb, 0x20);
    }
    const up = wUpVec();
    if (spinOn) {
      const ang = 0.06;
      for (const off of [0x90, 0xA0, 0xB0])
        putVec(f32, c, off, rot(vecAt(f32, c, off), up, ang));
      if (st.rb)
        for (const off of [0x30, 0x40, 0x50])
          putVec(f32, st.rb, off, rot(vecAt(f32, st.rb, off), up, ang));
      st.off = rot(st.off, up, ang);
    }
    if (barrelOn) {
      let fwd = vecAt(f32, c, 0x90);
      const len = Math.hypot(fwd[0], fwd[1], fwd[2]);
      if (!Number.isFinite(len) || len < 0.0001) fwd = [1, 0, 0];
      else fwd = [fwd[0] / len, fwd[1] / len, fwd[2] / len];
      const ang = 0.08;
      for (const off of [0x90, 0xA0, 0xB0])
        putVec(f32, c, off, rot(vecAt(f32, c, off), fwd, ang));
      if (st.rb)
        for (const off of [0x30, 0x40, 0x50])
          putVec(f32, st.rb, off, rot(vecAt(f32, st.rb, off), fwd, ang));
      st.off = rot(st.off, fwd, ang);
    }
    putVec(f32, c, 0x60, st.p);
    putVec(f32, c, 0x50, [
      st.p[0] - st.off[0],
      st.p[1] - st.off[1],
      st.p[2] - st.off[2]
    ]);
    if (st.rb) putVec(f32, st.rb, 0x20, st.rbP || st.p);
    for (const [base, off] of [[c, 0x70], [c, 0x110], [st.rb, 0x70], [st.rb, 0x80], [st.rb, 0xA0], [st.rb, 0xC0]]) {
      if (!base) continue;
      for (let i = 0; i < 3; i++) f32[(base + off + 4 * i) >> 2] = 0;
    }
    f32[(c + 0x42C) >> 2] = 0;
    f32[(c + 0x430) >> 2] = 0;
  };

  // A barrel roll leaves the car's up vector rotated. The game's camera reads
  // that vector, so the screen would stay tilted after the roll is turned off.
  // Rebuild the frame upright, keeping the car's current heading.
  const levelCar = (f32, c, rb) => {
    const f0 = vecAt(f32, c, 0x90);
    const fl = Math.hypot(f0[0], f0[1], f0[2]);
    if (!Number.isFinite(fl) || fl < 0.0001) return;
    const f = [f0[0] / fl, f0[1] / fl, f0[2] / fl];
    const w = wUpVec();
    let l = [
      w[1] * f[2] - w[2] * f[1],
      w[2] * f[0] - w[0] * f[2],
      w[0] * f[1] - w[1] * f[0]
    ];
    let ll = Math.hypot(l[0], l[1], l[2]);
    if (!Number.isFinite(ll) || ll < 0.0001) {
      // The car points straight up or down: keep its current left vector.
      const l0 = vecAt(f32, c, 0xA0);
      ll = Math.hypot(l0[0], l0[1], l0[2]);
      if (!Number.isFinite(ll) || ll < 0.0001) return;
      l = [l0[0] / ll, l0[1] / ll, l0[2] / ll];
    } else {
      l = [l[0] / ll, l[1] / ll, l[2] / ll];
    }
    const up = [
      f[1] * l[2] - f[2] * l[1],
      f[2] * l[0] - f[0] * l[2],
      f[0] * l[1] - f[1] * l[0]
    ];
    putVec(f32, c, 0x90, f);
    putVec(f32, c, 0xA0, l);
    putVec(f32, c, 0xB0, up);
    if (rb) {
      putVec(f32, rb, 0x30, f);
      putVec(f32, rb, 0x40, l);
      putVec(f32, rb, 0x50, up);
    }
  };

  // Wall hits at boost speed can pitch or roll the car over. While the car is
  // tilted past about 57 degrees, turn its frame back towards the world's up
  // and damp the spin that keeps it over. Spin and barrel roll own the frame
  // while they are on.
  const antiFlipTick = (f32, c, rb) => {
    if (!antiFlipOn || spinOn || barrelOn || locked) return;
    const w = wUpVec();
    const up0 = vecAt(f32, c, 0xB0);
    const ul = Math.hypot(up0[0], up0[1], up0[2]);
    if (!Number.isFinite(ul) || ul < 0.1) return;
    const up = [up0[0] / ul, up0[1] / ul, up0[2] / ul];
    const d = dot(up, w);
    if (d > 0.55) return;
    let axis = [
      up[1] * w[2] - up[2] * w[1],
      up[2] * w[0] - up[0] * w[2],
      up[0] * w[1] - up[1] * w[0]
    ];
    let al = Math.hypot(axis[0], axis[1], axis[2]);
    if (!Number.isFinite(al) || al < 0.001) {
      // Exactly upside down: roll around the car's forward axis.
      const f0 = vecAt(f32, c, 0x90);
      const fl = Math.hypot(f0[0], f0[1], f0[2]);
      if (!Number.isFinite(fl) || fl < 0.001) return;
      axis = [f0[0] / fl, f0[1] / fl, f0[2] / fl];
    } else {
      axis = [axis[0] / al, axis[1] / al, axis[2] / al];
    }
    const ang = Math.min(0.07, 0.025 + (0.55 - d) * 0.09);
    for (const off of [0x90, 0xA0, 0xB0])
      putVec(f32, c, off, rot(vecAt(f32, c, off), axis, ang));
    if (rb)
      for (const off of [0x30, 0x40, 0x50])
        putVec(f32, rb, off, rot(vecAt(f32, rb, off), axis, ang));
    for (const [base, off] of [[c, 0x110], [rb, 0x80], [rb, 0xC0]]) {
      if (!base) continue;
      for (let i = 0; i < 3; i++) f32[(base + off + 4 * i) >> 2] *= 0.7;
    }
  };

  // A race-safe drift assist: the game's own drift switch only exists in free
  // roam and forcing it in a race crashes the WASM build. This lowers the rear
  // wheels' grip factor (the same field the game's drift assist changes) so the
  // car slides in any mode, without the game's drift camera or score.
  const restoreDriftAssist = f32 => {
    if (!driftAssistSaved) return;
    const live = u && driftAssistCar && u[(driftAssistCar + 0x34) >> 2] === driftAssistPo;
    if (live && f32) {
      for (const s of driftAssistSaved) {
        if (s.addr + 4 <= buf.byteLength) f32[s.addr >> 2] = s.value;
      }
    }
    driftAssistSaved = null;
    driftAssistCar = 0;
    driftAssistPo = 0;
  };

  const driftAssistTick = (u, f32, c) => {
    if (!driftAssistOn) {
      if (driftAssistSaved) restoreDriftAssist(f32);
      return;
    }
    if (!inWorld() || spinOn || barrelOn) return;
    const d = driftInfo(c);
    if (d && d.on) return; // free roam's own drift already changes the grip
    const po = u[(c + 0x34) >> 2] >>> 0;
    if (!po || po + 0x48 > buf.byteLength) return;
    if (driftAssistPo && driftAssistPo !== po) restoreDriftAssist(f32);
    if (!driftAssistSaved) driftAssistSaved = [];
    driftAssistCar = c;
    driftAssistPo = po;
    for (const off of [0x40, 0x44]) {
      const w = u[(po + off) >> 2] >>> 0;
      if (!w || w + 0x18C > buf.byteLength) continue;
      const a = w + 0x188;
      if (!driftAssistSaved.some(s => s.addr === a))
        driftAssistSaved.push({ addr: a, value: f32[a >> 2] });
      f32[a >> 2] = 0.86;
    }
  };

  // Showoff is memory-only: tyre smoke and exhaust flames. It sends no keys,
  // so it cannot move the game's camera.
  const startShowoff = g => {
    const { u, f32, u8, c } = g;
    if (showoffSaved) stopShowoff(g);
    const st = {
      car: c,
      slip: [],
      ground: [],
      surf: [],
      nos: [
        u[(c + CAR_NOS + 0x414) >> 2],
        u[(c + CAR_NOS + 0x41C) >> 2],
        u[(c + CAR_NOS + 0x420) >> 2]
      ]
    };
    for (let i = 0; i < 8; i++) st.slip.push(f32[(c + CAR_SLIP + 4 * i) >> 2]);
    for (let i = 0; i < 4; i++) {
      st.ground.push(u8[c + CAR_GROUND + i]);
      st.surf.push(u[(c + CAR_SURF + 4 * i) >> 2]);
    }
    showoffSaved = st;
    showoffOn = true;
  };

  const stopShowoff = g => {
    showoffOn = false;
    const st = showoffSaved;
    showoffSaved = null;
    if (!st) return;
    if (!g || !u || !f32 || !u8 || g.c !== st.car) return;
    const c = g.c;
    for (let i = 0; i < 8; i++) f32[(c + CAR_SLIP + 4 * i) >> 2] = st.slip[i] || 0;
    for (let i = 0; i < 4; i++) {
      u8[c + CAR_GROUND + i] = st.ground[i] || 0;
      u[(c + CAR_SURF + 4 * i) >> 2] = st.surf[i] || 0;
    }
    u[(c + CAR_NOS + 0x414) >> 2] = st.nos[0];
    u[(c + CAR_NOS + 0x41C) >> 2] = st.nos[1];
    u[(c + CAR_NOS + 0x420) >> 2] = 0;
  };

  // The game's hydraulics lift the car's render body, and the chase camera
  // follows that body. If the hydraulics are cut while the body is lifted or
  // tilted, the screen can stay at that angle. Zeroing the wheel hydraulics
  // and leveling the body puts the camera back.
  const resetHydraulics = (g, level) => {
    if (!g) return;
    const { u, f32, c } = g;
    if (u[(c + 0x28) >> 2] === 1) {
      const po = u[(c + 0x34) >> 2] >>> 0;
      if (po && po + 0x84 <= buf.byteLength) {
        for (let k = 0; k < 4; k++) u[(po + 0x74 + 4 * k) >> 2] = 0;
      }
    }
    if (level) levelCar(f32, c, rbOf(u, c));
  };

  const startHydShowoff = g => {
    if (hydSaved) return;
    const { u, u8, c } = g;
    hydSaved = { car: c, hydLevel: u[G_HYD_LEVEL >> 2], hydOn: u8[G_HYD_ON] };
    u[G_HYD_LEVEL >> 2] = 2;
    u8[G_HYD_ON] = 1;
    hydShowoffOn = true;
    hydAt = 0;
    hydStep = 0;
    hydEngaged = false;
    if (hydPrev) {
      synthKey("keyup", hydPrev.code, hydPrev.key);
      hydPrev = null;
    }
  };

  const stopHydShowoff = g => {
    if (hydPrev) {
      synthKey("keyup", hydPrev.code, hydPrev.key);
      hydPrev = null;
    }
    hydShowoffOn = false;
    hydEngaged = false;
    const st = hydSaved;
    hydSaved = null;
    if (st && u && u8) {
      u[G_HYD_LEVEL >> 2] = st.hydLevel;
      u8[G_HYD_ON] = st.hydOn;
    }
    // Only touch the car the hydraulics were started on. A car change means
    // the old body is gone and the new one is already where the game put it.
    if (st && g && g.c === st.car) resetHydraulics(g, true);
  };

  const stopAllShowoff = g => {
    if (showoffOn) stopShowoff(g);
    if (hydShowoffOn) stopHydShowoff(g);
  };

  const showoffTick = (now, g) => {
    if (!showoffOn && !hydShowoffOn) return;
    const { u, f32, u8, c } = g;
    if ((showoffSaved && c !== showoffSaved.car) || (hydSaved && c !== hydSaved.car)) {
      stopAllShowoff(g);
      return;
    }
    const speed = speedOf(u, f32, c);
    if (showoffOn) {
      // Tyre smoke: the game's effects update reads CAR_SLIP every frame. Only
      // write it while the car is nearly stopped, so a moving car's handling is
      // never touched.
      if (speed <= 3.0) {
        for (let i = 0; i < 4; i++) {
          f32[(c + CAR_SLIP + 8 * i) >> 2] = 6.5;
          f32[(c + CAR_SLIP + 8 * i + 4) >> 2] = 2.0;
          u8[c + CAR_GROUND + i] = 1;
          u[(c + CAR_SURF + 4 * i) >> 2] = 0;
        }
      }
      // Exhaust flame: pulse the nitrous state unless the player is already
      // using NOS, in which case leave it on.
      const tick = u[0x86518C >> 2];
      if (boostOn || held || (now % 600) < 380) {
        u[(c + CAR_NOS + 0x414) >> 2] = 40000;
        u[(c + CAR_NOS + 0x41C) >> 2] = 40000;
        u[(c + CAR_NOS + 0x420) >> 2] = tick || 1;
      } else {
        u[(c + CAR_NOS + 0x420) >> 2] = 0;
      }
    }

    const canKeys = inWorld() && !typing() && !rebindAction;

    // Hydraulic dance: the game starts hydraulics 0.22 s after H or J if the
    // car is at 10 mph or less. Hold one, then the other. This is separate
    // from showoff because the lift moves the camera.
    if (hydShowoffOn) {
      const canHyd = canKeys && speed <= 4.4;
      if (canHyd) {
        hydEngaged = true;
        if (now >= hydAt) {
          if (hydPrev) synthKey("keyup", hydPrev.code, hydPrev.key);
          hydPrev = (hydStep % 2) === 0
            ? { code: "KeyH", key: "h" }
            : { code: "KeyJ", key: "j" };
          synthKey("keydown", hydPrev.code, hydPrev.key);
          hydAt = now + 900;
          hydStep++;
        }
      } else {
        if (hydPrev) {
          synthKey("keyup", hydPrev.code, hydPrev.key);
          hydPrev = null;
          hydAt = now + 500;
        }
        if (hydEngaged) {
          // Put the body back on its wheels when the car starts moving, so
          // the camera is not left at the lifted angle.
          hydEngaged = false;
          resetHydraulics(g, false);
        }
      }
    }
  };

  const iv = setInterval(() => {
    const g = get();
    if (!g) return;
    const f32 = g.f32, c = g.c, n = c + 0x40;

    driftTick(c);
    driftAssistTick(u, f32, c);

    {
      const up = [f32[(c + 0xB0) >> 2], f32[(c + 0xB4) >> 2], f32[(c + 0xB8) >> 2]];
      const ul = Math.hypot(up[0], up[1], up[2]);
      if (ul > 0.5 && ul < 1.5) {
        if (!upAvg) upAvg = [up[0] / ul, up[1] / ul, up[2] / ul];
        else for (let i = 0; i < 3; i++) upAvg[i] += (up[i] / ul - upAvg[i]) * 0.003;
      }
    }

    let f = u[(n + 0x414) >> 2];
    if (!f || f === 0x7fffffff || f < 0) {
      f = 40000;
      u[(n + 0x414) >> 2] = f;
    }
    u[(n + 0x41C) >> 2] = f;

    if (held) {
      u[(n + 0x420) >> 2] = u[0x86518C >> 2];
    } else {
      const s = u[(n + 0x420) >> 2];
      if (s && s !== 0x7fffffff) u[(n + 0x420) >> 2] = u[0x86518C >> 2];
    }

    showoffTick(performance.now(), g);

    if (boostOn) {
      const w = wUpVec();
      const rb = rbOf(u, c);
      const fwd = [f32[(c + 0x90) >> 2], f32[(c + 0x94) >> 2], f32[(c + 0x98) >> 2]];
      const up = [f32[(c + 0xB0) >> 2], f32[(c + 0xB4) >> 2], f32[(c + 0xB8) >> 2]];
      const h = horiz(fwd, w), hl = Math.hypot(h[0], h[1], h[2]);
      const upright = dot(up, w);
      const v = velOf(u, f32, c);
      const curH = Math.hypot(...horiz(v, w));
      const target = boostBase + boostKmh / 3.6;

      if (upright > 0.5 && hl > 0.3 && curH < target) {
        const dv = Math.min(target - curH, 0.28);
        const dir = [h[0] / hl, h[1] / hl, h[2] / hl];
        if (rb) {
          const mass = massOf(u, f32, c);
          for (let i = 0; i < 3; i++) {
            f32[(rb + 0xA0 + 4 * i) >> 2] = v[i] + dir[i] * dv;
            f32[(rb + 0x70 + 4 * i) >> 2] += dir[i] * dv * mass;
          }
          for (let i = 0; i < 3; i++) f32[(c + 0x70 + 4 * i) >> 2] = f32[(rb + 0xA0 + 4 * i) >> 2];
        } else {
          for (let i = 0; i < 3; i++) f32[(c + 0x70 + 4 * i) >> 2] += dir[i] * dv;
        }
      }
      const ns = speedOf(u, f32, c);
      f32[(c + 0x42C) >> 2] = ns;
      f32[(c + 0x430) >> 2] = ns;
    }

    {
      const w = wUpVec();
      const rb = rbOf(u, c);

      if (gravOn) {
        for (const [base, off] of [[c, 0x70], [rb, 0xA0]]) {
          if (!base) continue;
          const v = vecAt(f32, base, off);
          const vy = dot(v, w);
          if (vy < -1.5) {
            const d = -vy * 0.85;
            putVec(f32, base, off, [v[0] + w[0] * d, v[1] + w[1] * d, v[2] + w[2] * d]);
          }
        }
        const ns = speedOf(u, f32, c);
        f32[(c + 0x42C) >> 2] = ns;
        f32[(c + 0x430) >> 2] = ns;
      }

      airTick(u, f32, c, rb);
    }

    antiFlipTick(f32, c, rbOf(u, c));

    if (loadState) {
      if (performance.now() < loadUntil) {
        writeSlots(u, f32, c, loadState);
        const keep = lockState;
        lockState = null;
        stopCar(u, f32, c, true);
        lockState = keep;
      } else {
        loadState = null;
        if (locked) lockState = snap(f32, c);
      }
    } else if (locked) {
      stopCar(u, f32, c, true);
    }

    if (saveScan) {
      scanPos(u, f32, c, saveScan.found);
      saveScan.st.slots = [...saveScan.found.values()];
      if (--saveScan.left <= 0) {
        const cnt = saveScan.found.size;
        toast(cnt > 2
          ? "Position saved (" + cnt + " slots)"
          : "Position saved, but no in-game copy was found");
        saveScan = null;
      }
    }

    last = {
      car: c,
      full: f,
      left: u[(n + 0x41C) >> 2],
      since: u[(n + 0x420) >> 2],
      ticks: u[0x86518C >> 2],
      up: wUpVec(),
      boostOn,
      boostKmh,
      showoffOn,
      hydShowoffOn,
      spinOn,
      barrelOn,
      antiFlipOn,
      driftAssistOn,
      hasSavedPos: !!savedPos,
      slots: savedPos && savedPos.slots ? savedPos.slots.length : 0,
      locked
    };

    paint(performance.now());
  }, 8);

  const setDriftAssist = on => {
    driftAssistOn = !!on;
    if (!driftAssistOn) {
      const g = get();
      restoreDriftAssist(g ? g.f32 : null);
    }
    toast("Drift assist " + (driftAssistOn ? "ON" : "OFF"));
    paint(performance.now(), true);
  };

  const act = name => {
    if (name === "help") {
      helpOn = !helpOn;
      if (uiHidden) return;
      if (helpOn) show(help);
      else hide(help);
      return;
    }

    if (name === "antiFlip") {
      antiFlipOn = !antiFlipOn;
      toast("Anti-flip " + (antiFlipOn ? "ON" : "OFF"));
      paint(performance.now(), true);
      return;
    }

    if (name === "driftAssist") {
      setDriftAssist(!driftAssistOn);
      return;
    }

    if (name === "powerUp" || name === "powerDown") {
      const d = name === "powerUp" ? BOOST_STEP : -BOOST_STEP;
      boostKmh = Math.max(BOOST_MIN, Math.min(BOOST_MAX, boostKmh + d));
      toast("Boost power: +" + boostKmh + " km/h");
      paint(performance.now(), true);
      return;
    }

    if (name === "jumpUp" || name === "jumpDown") {
      jumpPower = Math.max(6, Math.min(60, jumpPower + (name === "jumpUp" ? 4 : -4)));
      toast("Jump power: " + jumpPower);
      paint(performance.now(), true);
      return;
    }

    if (name === "grav" || name === "spin" || name === "barrel") {
      const label = name === "grav" ? "Low gravity" : name === "spin" ? "Spin" : "Barrel roll";
      let on;
      if (name === "grav") { gravOn = !gravOn; on = gravOn; }
      else if (name === "spin") { spinOn = !spinOn; on = spinOn; }
      else {
        const was = barrelOn;
        barrelOn = !barrelOn;
        on = barrelOn;
        // Put the car back on its wheels when the roll ends. Without this the
        // game camera keeps the rolled angle because the car's up vector is
        // still tilted.
        if (was && !barrelOn) {
          const g = get();
          if (g) levelCar(g.f32, g.c, rbOf(g.u, g.c));
        }
      }
      toast(label + (on ? " ON" : " OFF"));
      paint(performance.now(), true);
      return;
    }

    if (name === "money100" || name === "money1m") {
      addMoney(name === "money100" ? 100000 : 1000000);
      return;
    }
    if (name === "unlockGarage") {
      unlockGarage();
      return;
    }
    if (name === "unlockBonus") {
      unlockBonus();
      return;
    }

    if (name === "panel") {
      setPanel(!panelOn);
      return;
    }

    if (name === "shot") {
      setUiHidden(!uiHidden);
      if (uiHidden) console.log("[NOS] UI hidden");
      else toast("UI visible");
      return;
    }

    const g = get();
    if (!g) return;
    const u = g.u, f32 = g.f32, c = g.c;

    if (name === "showoff") {
      if (showoffOn) {
        stopShowoff(g);
        toast("Showoff OFF");
      } else {
        startShowoff(g);
        toast("Showoff ON (smoke, flames)");
      }
      paint(performance.now(), true);
      return;
    }

    if (name === "hydShowoff") {
      if (hydShowoffOn) {
        stopHydShowoff(g);
        toast("Hydraulic dance OFF");
      } else {
        startHydShowoff(g);
        toast("Hydraulic dance ON (parked, H/J)");
      }
      paint(performance.now(), true);
      return;
    }

    if (name === "boost") {
      boostOn = !boostOn;
      if (boostOn) boostBase = hspeedOf(u, f32, c);
      toast(boostOn ? "Boost ON (+" + boostKmh + " km/h)" : "Boost OFF");
      return;
    }
    if (name === "jump") {
      jump(u, f32, c);
      return;
    }
    if (name === "stop") {
      hardStop(u, f32, c);
      return;
    }
    if (name === "lock") {
      locked = !locked;
      if (locked) {
        lockState = snap(f32, c);
        stopCar(u, f32, c, true);
      } else {
        lockState = null;
      }
      toast("Stop lock " + (locked ? "ON" : "OFF"));
      return;
    }
    if (name === "savePos") {
      const st = snap(f32, c);
      const found = new Map([
        ["c:" + 0x60, { k: "c", off: 0x60, needle: "p" }],
        ["c:" + 0x50, { k: "c", off: 0x50, needle: "com" }]
      ]);
      scanPos(u, f32, c, found);
      st.slots = [...found.values()];
      savedPos = st;
      saveScan = { left: 5, found, st };
      toast("Position saved");
      return;
    }
    if (name === "loadPos") {
      if (!savedPos) return toast("No saved position");
      loadState = savedPos;
      loadUntil = performance.now() + 250;
      toast("Position loaded");
    }
  };

  const panel = mkBox(0);
  panel.style.cssText =
    "position:fixed;inset:auto;top:12px;left:12px;margin:0;width:min(292px,calc(100vw - 24px));max-height:calc(100vh - 24px);" +
    "overflow:auto;background:rgba(9,11,13,.94);color:#c9d1d9;border:1px solid #2a3037;" +
    "border-radius:10px;box-shadow:0 14px 44px rgba(0,0,0,.7);" +
    "font:12px/1.35 'Segoe UI',system-ui,sans-serif;pointer-events:auto;z-index:2147483647;display:none";

  const head = document.createElement("div");
  head.style.cssText =
    "display:flex;align-items:center;gap:7px;padding:9px 10px;cursor:move;user-select:none;" +
    "position:sticky;top:0;z-index:1;" +
    "background:linear-gradient(180deg,#181d23,#101419);border-bottom:1px solid #232a31;" +
    "border-radius:9px 9px 0 0";
  const headTitle = document.createElement("div");
  headTitle.style.cssText = "flex:1;font-weight:700;letter-spacing:.7px;color:#39ff88;font-size:12px";
  headTitle.textContent = "NFSU2 TRAINER";
  const headVer = document.createElement("span");
  headVer.textContent = "v1.1";
  headVer.style.cssText = "margin-left:6px;color:#5f6a75;font-weight:400;font-size:10px";
  headTitle.appendChild(headVer);
  head.appendChild(headTitle);

  const helpBtn = document.createElement("button");
  helpBtn.type = "button";
  helpBtn.textContent = "?";
  helpBtn.title = "Help (0)";
  helpBtn.style.cssText = "width:22px;height:22px;padding:0;background:#14181d;color:#8a95a1;border:1px solid #2a3037;border-radius:5px;font:700 11px monospace;cursor:pointer";
  helpBtn.addEventListener("click", ev => { ev.preventDefault(); act("help"); helpBtn.blur(); });
  head.appendChild(helpBtn);

  const minBtn = document.createElement("button");
  minBtn.type = "button";
  minBtn.textContent = "–";
  minBtn.title = "Hide panel (Insert)";
  minBtn.style.cssText = "width:22px;height:22px;padding:0;background:#14181d;color:#8a95a1;border:1px solid #2a3037;border-radius:5px;font:700 13px monospace;cursor:pointer";
  minBtn.addEventListener("click", ev => { ev.preventDefault(); setPanel(false); minBtn.blur(); });
  head.appendChild(minBtn);
  panel.appendChild(head);

  const body = document.createElement("div");
  body.style.cssText = "padding:8px 10px 10px";
  panel.appendChild(body);

  const pbtn = {};

  // Key badges are clickable: click one, press a key. A key already used by
  // another action swaps with it, so no action is left without a key.
  let rebindAction = null;
  const bindBadge = {};

  const updateBindBadges = () => {
    for (const action in bindBadge) {
      const el = bindBadge[action];
      if (!el) continue;
      const active = rebindAction === action;
      el.textContent = active ? "..." : codeLabel(BINDS[action]);
      el.style.borderColor = active ? "#39ff88" : "#2a3037";
      el.style.color = active ? "#39ff88" : "#8a95a1";
      el.style.background = active ? "rgba(24,64,42,.55)" : "#0d1014";
    }
    help.textContent = helpText();
    helpBtn.title = "Help (" + codeLabel(BINDS.help) + ")";
    minBtn.title = "Hide panel (" + codeLabel(BINDS.panel) + ")";
    if (tab) tab.title = "Show panel (" + codeLabel(BINDS.panel) + ")";
    if (foot) foot.textContent = codeLabel(BINDS.panel) + " = hide | drag the header to move";
  };

  const cancelRebind = () => {
    if (!rebindAction) return;
    rebindAction = null;
    updateBindBadges();
  };

  const beginRebind = action => {
    if (!BIND_LABEL[action]) return;
    rebindAction = action;
    try { if (document.activeElement) document.activeElement.blur(); } catch (e) {}
    updateBindBadges();
    toast("Press a key for " + BIND_LABEL[action] + " (Esc cancels)");
  };

  const applyBind = code => {
    const action = rebindAction;
    if (!action) return;
    const old = BINDS[action];
    let other = null;
    for (const [a] of BIND_ACTIONS) {
      if (a !== action && BINDS[a] === code) { other = a; break; }
    }
    if (other) BINDS[other] = old;
    BINDS[action] = code;
    rebindAction = null;
    saveBinds();
    updateBindBadges();
    const label = BIND_LABEL[action] || action;
    toast(label + " = " + codeLabel(code) +
      (other ? " (swapped with " + (BIND_LABEL[other] || other) + ")" : ""));
  };

  const mkBindBadge = action => {
    const k = document.createElement("span");
    k.setAttribute("role", "button");
    k.tabIndex = 0;
    k.title = "Click to rebind " + (BIND_LABEL[action] || action);
    k.style.cssText =
      "min-width:20px;padding:2px 5px;border:1px solid #2a3037;border-radius:4px;" +
      "background:#0d1014;color:#8a95a1;font:700 10px monospace;text-align:center;" +
      "cursor:pointer;user-select:none;pointer-events:auto";
    const start = ev => {
      ev.preventDefault();
      ev.stopPropagation();
      beginRebind(action);
    };
    k.addEventListener("click", start);
    k.addEventListener("keydown", ev => {
      if (ev.key === "Enter" || ev.key === " ") start(ev);
    });
    bindBadge[action] = k;
    k.textContent = codeLabel(BINDS[action]);
    return k;
  };

  const section = title => {
    const h = document.createElement("div");
    h.textContent = title;
    h.style.cssText = "margin:10px 0 5px;color:#6f7a86;font-size:9px;font-weight:700;letter-spacing:1.3px";
    body.appendChild(h);
    const g = document.createElement("div");
    g.style.cssText = "display:flex;flex-direction:column;gap:4px";
    body.appendChild(g);
    return g;
  };

  const mkRow = (parent, label, action, opts = {}) => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.cssText =
      "display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;text-align:left;" +
      "background:#14181d;color:#c9d1d9;border:1px solid #262d34;border-radius:6px;" +
      "font:600 11px 'Segoe UI',system-ui,sans-serif;cursor:pointer";
    const lab = document.createElement("span");
    lab.textContent = label;
    lab.style.cssText = "flex:1";
    b.appendChild(lab);
    if (opts.bind) {
      b.appendChild(mkBindBadge(opts.bind));
    } else if (opts.key) {
      const k = document.createElement("span");
      k.textContent = opts.key;
      k.style.cssText = "color:#59636e;font:10px monospace";
      b.appendChild(k);
    }
    if (opts.state) {
      const s = document.createElement("span");
      s.textContent = opts.state;
      s.style.cssText = "color:#6b7480;font:700 10px monospace;min-width:24px;text-align:right";
      b._state = s;
      b.appendChild(s);
    }
    b.addEventListener("click", ev => { ev.preventDefault(); act(action); b.blur(); });
    parent.appendChild(b);
    pbtn[action] = b;
    return b;
  };

  const setOn = (b, on) => {
    if (!b) return;
    b.style.borderColor = on ? "#2f7d4f" : "#262d34";
    b.style.background = on ? "rgba(24,64,42,.55)" : "#14181d";
    if (b._state) {
      b._state.textContent = on ? "ON" : "OFF";
      b._state.style.color = on ? "#39ff88" : "#6b7480";
    }
  };

  const mkSlider = (parent, label, min, max, step, value, format, onInput, binds) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "padding:3px 2px 2px";
    const top = document.createElement("div");
    top.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;color:#7f8a96;font-size:10px;margin-bottom:2px";
    const lab = document.createElement("span");
    const val = document.createElement("span");
    val.style.cssText = "color:#aeb8c2;font-family:monospace";
    top.appendChild(lab);
    top.appendChild(val);
    if (binds) {
      const keys = document.createElement("span");
      keys.style.cssText = "display:flex;gap:3px;margin-left:auto;align-items:center";
      for (const action of binds) keys.appendChild(mkBindBadge(action));
      // Mouse/touchpad fallback: laptops without -/= or with a layout that
      // hides them can step the value without any keyboard at all.
      for (const [action, text] of [[binds[0], "−"], [binds[1], "+"]]) {
        const step = document.createElement("button");
        step.type = "button";
        step.textContent = text;
        step.title = (text === "−" ? "Decrease " : "Increase ") + label.toLowerCase();
        step.style.cssText =
          "width:18px;height:18px;padding:0;background:#0d1014;color:#8a95a1;" +
          "border:1px solid #2a3037;border-radius:4px;font:700 12px monospace;" +
          "line-height:1;cursor:pointer";
        step.addEventListener("click", ev => { ev.preventDefault(); act(action); step.blur(); });
        keys.appendChild(step);
      }
      top.appendChild(keys);
    }
    wrap.appendChild(top);
    const r = document.createElement("input");
    r.type = "range";
    r.min = min;
    r.max = max;
    r.step = step;
    r.value = value;
    r.style.cssText = "width:100%;height:14px;accent-color:#39ff88;cursor:pointer";
    const sync = v => { lab.textContent = label; val.textContent = format(v); };
    sync(value);
    r.addEventListener("input", () => { const v = +r.value; sync(v); onInput(v); });
    r.addEventListener("change", () => r.blur());
    wrap.appendChild(r);
    parent.appendChild(wrap);
    return { r, lab, val, format };
  };

  const gNos = section("NOS");
  const boostBtn = mkRow(gNos, "NOS BOOST", "boost", { bind: "boost", state: "OFF" });
  const boostS = mkSlider(gNos, "Power", BOOST_MIN, BOOST_MAX, BOOST_STEP, boostKmh,
    v => "+" + v + " km/h", v => { boostKmh = v; }, ["powerDown", "powerUp"]);

  const gMove = section("MOVEMENT");
  mkRow(gMove, "JUMP", "jump", { bind: "jump" });
  mkRow(gMove, "HARD STOP", "stop", { bind: "stop" });
  const lockBtn = mkRow(gMove, "STOP LOCK", "lock", { bind: "lock", state: "OFF" });
  const jumpS = mkSlider(gMove, "Jump power", 6, 60, 4, jumpPower,
    v => String(v), v => { jumpPower = v; }, ["jumpDown", "jumpUp"]);

  const gDrift = section("DRIFT");
  const driftStat = document.createElement("div");
  driftStat.style.cssText =
    "padding:6px 8px;margin-top:2px;background:#0d1014;border:1px solid #1f262d;border-radius:5px;" +
    "color:#6f7a86;font:10px/1.5 monospace;white-space:pre";
  driftStat.textContent = "waiting for car";
  gDrift.appendChild(driftStat);
  mkRow(gDrift, "DRIFT ASSIST (ALL MODES)", "driftAssist", { state: "OFF" });
  const driftHint = document.createElement("div");
  driftHint.textContent = "Lowers rear grip so the car slides in races too. Press X outside free roam to toggle it. No drift score or drift camera outside free roam.";
  driftHint.style.cssText = "color:#5f6a75;font-size:9px;line-height:1.45;padding:2px 2px 0";
  gDrift.appendChild(driftHint);

  const gPos = section("POSITION");
  mkRow(gPos, "SAVE POSITION", "savePos", { bind: "savePos" });
  mkRow(gPos, "LOAD POSITION", "loadPos", { bind: "loadPos" });

  const gStunt = section("STUNTS");
  mkRow(gStunt, "SHOWOFF", "showoff", { bind: "showoff", state: "OFF" });
  mkRow(gStunt, "HYDRAULIC DANCE", "hydShowoff", { state: "OFF" });
  mkRow(gStunt, "BARREL ROLL", "barrel", { bind: "barrel", state: "OFF" });
  mkRow(gStunt, "SPIN", "spin", { bind: "spin", state: "OFF" });
  mkRow(gStunt, "ANTI-FLIP", "antiFlip", { state: "ON" });
  const stuntHint = document.createElement("div");
  stuntHint.textContent = "Showoff is smoke and flames. Hydraulics are separate because the camera follows the lifted body.";
  stuntHint.style.cssText = "color:#5f6a75;font-size:9px;line-height:1.45;padding:2px 2px 0";
  gStunt.appendChild(stuntHint);

  const gCareer = section("CAREER");
  const careerStat = document.createElement("div");
  careerStat.style.cssText =
    "padding:6px 8px;margin-top:2px;background:#0d1014;border:1px solid #1f262d;border-radius:5px;" +
    "color:#6f7a86;font:10px/1.5 monospace;white-space:pre";
  careerStat.textContent = "career mode only";
  gCareer.appendChild(careerStat);
  mkRow(gCareer, "ADD $100,000", "money100");
  mkRow(gCareer, "ADD $1,000,000", "money1m");
  mkRow(gCareer, "UNLOCK 5 BASE GARAGE SLOTS", "unlockGarage");
  mkRow(gCareer, "UNLOCK BONUS PARTS", "unlockBonus");

  const gMore = section("EXTRAS");
  const gravBtn = mkRow(gMore, "LOW GRAVITY", "grav", { state: "OFF" });
  mkRow(gMore, "HELP", "help", { bind: "help" });

  const gKeys = section("KEYS");
  const keyHint = document.createElement("div");
  keyHint.textContent = "Click a key badge to rebind. Esc cancels; a key already in use is swapped.";
  keyHint.style.cssText = "color:#5f6a75;font-size:9px;line-height:1.45;padding:0 2px 4px";
  gKeys.appendChild(keyHint);
  const resetKeys = document.createElement("button");
  resetKeys.type = "button";
  resetKeys.textContent = "RESET KEY BINDINGS";
  resetKeys.style.cssText =
    "width:100%;padding:6px 8px;background:#14181d;color:#8a95a1;border:1px solid #2a3037;" +
    "border-radius:5px;font:700 10px 'Segoe UI',system-ui,sans-serif;cursor:pointer";
  resetKeys.addEventListener("click", ev => {
    ev.preventDefault();
    Object.assign(BINDS, DEFAULT_BINDS);
    rebindAction = null;
    saveBinds();
    updateBindBadges();
    toast("Key bindings reset");
    resetKeys.blur();
  });
  mkRow(gKeys, "TRAINER PANEL", "panel", { bind: "panel" });
  mkRow(gKeys, "HIDE UI (SCREENSHOT)", "shot", { bind: "shot" });
  gKeys.appendChild(resetKeys);

  const foot = document.createElement("div");
  foot.textContent = "Insert = hide | drag the header to move";
  foot.style.cssText = "margin-top:9px;padding-top:7px;border-top:1px solid #1e252c;color:#4f5963;font-size:9px;text-align:center";
  body.appendChild(foot);

  const tab = document.createElement("button");
  tab.type = "button";
  tab.textContent = "☰ TRAINER";
  tab.title = "Show panel (" + codeLabel(BINDS.panel) + ")";
  tab.setAttribute("popover", "manual");
  tab.style.cssText =
    "position:fixed;inset:auto;top:12px;left:12px;margin:0;z-index:2147483647;padding:9px 12px;" +
    "background:rgba(9,11,13,.92);color:#39ff88;border:1px solid #2a3037;border-radius:7px;" +
    "font:700 11px monospace;letter-spacing:.6px;cursor:pointer;display:none;pointer-events:auto";
  tab.addEventListener("click", ev => { ev.preventDefault(); setPanel(true); });
  document.body.appendChild(tab);
  updateBindBadges();

  const clampPanel = () => {
    const w = panel.offsetWidth || 292, h = panel.offsetHeight || 400;
    const x = parseFloat(panel.style.left), y = parseFloat(panel.style.top);
    const px = Number.isFinite(x) ? x : 12, py = Number.isFinite(y) ? y : 12;
    panel.style.left = Math.max(0, Math.min(innerWidth - w, px)) + "px";
    panel.style.top = Math.max(0, Math.min(innerHeight - h, py)) + "px";
  };

  const setPanel = on => {
    panelOn = on;
    if (on) {
      hide(tab);
      if (!uiHidden) show(panel);
      place(panel);
      clampPanel();
      paint(performance.now(), true);
    } else {
      hide(panel);
      if (!uiHidden) {
        show(tab);
        place(tab);
      }
    }
  };

  // Hide every trainer element for a clean screenshot. The game's own HUD is
  // left alone. Pressing the key again puts the panel or tab back as it was.
  const setUiHidden = on => {
    if (on === uiHidden) return;
    uiHidden = on;
    if (on) {
      hide(panel);
      hide(tab);
      hide(help);
      hide(hud);
      clearTimeout(hudTimer);
    } else {
      if (helpOn) show(help);
      if (panelOn) setPanel(true);
      else {
        hide(panel);
        show(tab);
        place(tab);
      }
    }
  };

  try {
    const p = JSON.parse(localStorage.getItem("nfsu2TrainerPanel") || "null");
    if (p && typeof p.left === "number" && typeof p.top === "number") {
      panel.style.left = p.left + "px";
      panel.style.top = p.top + "px";
    }
  } catch (e) {}

  let drag = null;
  head.addEventListener("pointerdown", e => {
    if (e.target.closest("button")) return;
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    try { head.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  head.addEventListener("pointermove", e => {
    if (!drag) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    panel.style.left = Math.max(0, Math.min(innerWidth - w, e.clientX - drag.dx)) + "px";
    panel.style.top = Math.max(0, Math.min(innerHeight - h, e.clientY - drag.dy)) + "px";
  });
  const endDrag = e => {
    if (!drag) return;
    drag = null;
    try { head.releasePointerCapture(e.pointerId); } catch (err) {}
    try {
      const left = parseFloat(panel.style.left), top = parseFloat(panel.style.top);
      localStorage.setItem("nfsu2TrainerPanel", JSON.stringify({
        left: Number.isFinite(left) ? left : 12,
        top: Number.isFinite(top) ? top : 12
      }));
    } catch (err) {}
  };
  head.addEventListener("pointerup", endDrag);
  head.addEventListener("pointercancel", endDrag);

  const paint = (now, force) => {
    if (!force && now < paintAt) return;
    paintAt = now + 120;
    const d = driftInfo(last.car);

    if (panelOn) {
      setOn(boostBtn, boostOn);
      setOn(lockBtn, locked);
      setOn(gravBtn, gravOn);
      setOn(pbtn.spin, spinOn);
      setOn(pbtn.barrel, barrelOn);
      setOn(pbtn.showoff, showoffOn);
      setOn(pbtn.hydShowoff, hydShowoffOn);
      setOn(pbtn.antiFlip, antiFlipOn);
      setOn(pbtn.driftAssist, driftAssistOn);
      const bank = careerBank();
      careerStat.textContent = bank == null
        ? "career mode only"
        : "Bank: $" + bank.toLocaleString("en-US");
      const don = !!(d && d.on);
      driftStat.textContent = don
        ? "x" + (d.level || 1) + "  " + Math.round(d.pend).toLocaleString("en-US") +
          "  |  total " + Math.round(d.total).toLocaleString("en-US")
        : inFreeRoam()
          ? "free roam: press X for the game's drift"
          : driftAssistOn
            ? "drift assist ON (no score here)"
            : "press X for drift assist";
      if (document.activeElement !== boostS.r) {
        boostS.r.value = boostKmh;
        boostS.val.textContent = boostS.format(boostKmh);
      }
      if (document.activeElement !== jumpS.r) {
        jumpS.r.value = jumpPower;
        jumpS.val.textContent = jumpS.format(jumpPower);
      }
    }
  };

  setPanel(false);
  toast("Trainer ready | " + codeLabel(BINDS.panel) + " for panel");

  const domTyping = () => {
    const a = document.activeElement;
    if (!a) return false;
    if (a.isContentEditable) return true;
    const tag = a.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag === "INPUT") {
      const t = (a.type || "text").toLowerCase();
      return !/^(range|checkbox|radio|button|submit|reset|color|file|image)$/.test(t);
    }
    return false;
  };

  const gameTyping = () => {
    if (!u) return false;
    return (u[0x0083A9C0 >> 2] & 0xff) !== 0 || (u[0x0083A9C4 >> 2] & 0xff) !== 0;
  };

  const typing = () => domTyping() || gameTyping();

  const exactAction = code => {
    for (const [action] of BIND_ACTIONS) {
      if (BINDS[action] && BINDS[action] === code) return action;
    }
    return null;
  };
  const actionFor = code => {
    const exact = exactAction(code);
    if (exact) return exact;
    if (/^Digit[0-9]$/.test(code)) return exactAction("Numpad" + code.slice(5));
    if (/^Numpad[0-9]$/.test(code)) return exactAction("Digit" + code.slice(6));
    // Numpad +/- mirrors the -/= power keys on keyboards that have a numpad.
    if (code === "NumpadAdd") return exactAction("Equal");
    if (code === "NumpadSubtract") return exactAction("Minus");
    return null;
  };

  const RESERVED_BINDS = {
    Escape: "Escape is reserved for the game menu",
    KeyP: "P is the game's pause key",
    F9: "F9 is reserved"
  };

  listen("keydown", e => {
    if (synthKeys || e.__nosSynth) return;
    if (rebindAction) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") { cancelRebind(); return; }
      const code = eventCode(e);
      if (isModifierCode(code) || isAlt(e)) return;
      if (RESERVED_BINDS[code]) { toast(RESERVED_BINDS[code]); return; }
      if (!code) return;
      applyBind(code);
      return;
    }
    if (isAlt(e)) {
      if (typing()) return;
      held = true;
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    if (typing()) return;
    const code = eventCode(e);
    const bound = actionFor(code);
    if (bound) {
      e.preventDefault();
      // The game's input listens on window too. stopImmediatePropagation keeps
      // it from seeing trainer keys (and from showing its own drift error).
      e.stopImmediatePropagation();
      return act(bound);
    }
    // X is the game's own drift toggle in free roam. Elsewhere the game would
    // only show "Drift mode only works in free roam", so X toggles the safe
    // grip-based drift assist instead. Never force the game's drift switch
    // outside free roam: its style-points branch uses a stale pointer and the
    // WASM build crashes.
    if (code === "KeyX") {
      if (!inWorld() || inFreeRoam()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setDriftAssist(!driftAssistOn);
      return;
    }
  });

  listen("keyup", e => {
    if (synthKeys || e.__nosSynth) return;
    if (!isAlt(e)) return;
    held = false;
    if (typing()) return;
    e.preventDefault();
    const g = get();
    if (g) {
      const n = g.c + 0x40;
      g.u[(n + 0x420) >> 2] = 0;
    }
  });

  listen("blur", () => {
    held = false;
    const g = get();
    if (g) {
      const n = g.c + 0x40;
      g.u[(n + 0x420) >> 2] = 0;
    }
  });

  const PAD_MAP = {
    4: "boost", 5: "jump", 0: "lock", 2: "grav", 3: "spin",
    12: "powerUp", 13: "powerDown", 14: "savePos", 15: "loadPos"
  };
  const padPrev = {};
  const padIv = setInterval(() => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const st = padPrev[p.index] || (padPrev[p.index] = {});
      if (!st.seen) {
        st.seen = true;
        console.log("[NOS] gamepad:", p.id, "mapping=" + (p.mapping || "none"));
      }
      for (const b in PAD_MAP) {
        const down = !!(p.buttons[b] && p.buttons[b].pressed);
        if (down && !st[b]) act(PAD_MAP[b]);
        st[b] = down;
      }
    }
  }, 16);

  const dump = () => {
    const g = get();
    if (!g) return "no car";
    const { u, f32, c } = g;
    const b = u[(c + 0x3C) >> 2], rb = rbOf(u, c);
    const L = [];
    L.push("car 0x" + c.toString(16) + "  b 0x" + (b >>> 0).toString(16) + "  rb 0x" + (rb >>> 0).toString(16));
    L.push("saved slots: " + (savedPos && savedPos.slots ? JSON.stringify(savedPos.slots) : "none"));
    const row = (name, base, from, to) => {
      for (let off = from; off < to; off += 16) {
        const a = base + off;
        if (a < 0x100 || a + 16 > buf.byteLength) continue;
        L.push(name + "+" + (off < 0 ? "-" : "") + Math.abs(off).toString(16) + ": " +
          [0, 4, 8, 12].map(d => f32[(a + d) >> 2].toFixed(3)).join(" "));
      }
    };
    row("c", c, 0x40, 0x120);
    if (rb) row("rb", rb, -0x40, 0x240);
    return L.join("\n");
  };

  window.__nosCheat = {
    mem: () => ms.find(x => x.buffer.byteLength >= 1 << 30),
    status: () => last,
    dump,
    stop() {
      clearInterval(iv);
      clearInterval(padIv);
      clearTimeout(hudTimer);
      {
        const g = get();
        if (g) stopAllShowoff(g);
        else {
          if (showoffOn) stopShowoff(null);
          if (hydShowoffOn) stopHydShowoff(null);
        }
      }
      offs.forEach(fn => fn());
      hud.remove();
      help.remove();
      panel.remove();
      tab.remove();
      delete window.__nosCheat;
      console.log("[NOS] stopped");
    }
  };
  console.log("[NOS] running v1.1 (press " + codeLabel(BINDS.panel) + " for the panel, " + codeLabel(BINDS.help) + " for controls)");
})();
