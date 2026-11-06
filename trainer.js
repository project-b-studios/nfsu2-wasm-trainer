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
  let buf = null, u = null, f32 = null;

  let boostOn = false, boostBase = 0, boostKmh = 100;
  const BOOST_STEP = 50, BOOST_MIN = 50, BOOST_MAX = 500;

  let held = false, locked = false, lockState = null;
  let savedPos = null, loadState = null, loadUntil = 0, saveScan = null;
  let upAvg = null;

  let gravOn = false, spinOn = false;
  let jumpPower = 8, panelOn = false, teleOn = true;
  let paintAt = 0;
  let driftPrev = 0, driftBankAt = 0;

  const HELP_TEXT = [
    "NOS CONTROLS",
    "",
    "Keyboard (digit row or numpad)",
    "  1  boost on/off",
    "  2  jump",
    "  3  stop once",
    "  4  stop lock on/off",
    "  5  save position",
    "  6  load position",
    "  7  boost power -50 km/h",
    "  8  boost power +50 km/h",
    "  , / .  jump power -/+",
    "  PgUp/PgDn  jump power -/+",
    "  Z  spin on/off",
    "  F9 show/hide on-screen panel",
    "  T  show/hide speedometer",
    "  0  show/hide this help",
    "  hold Alt  keep NOS active",
    "",
    "GAME",
    "  X  drift mode on/off (free roam)",
    "",
    "Gamepad",
    "  LB  boost on/off",
    "  RB  jump",
    "  A   stop lock on/off",
    "  B   drift mode (X)",
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
  const help = mkBox(52);
  help.textContent = HELP_TEXT;
  let helpOn = false;
  let hudTimer = 0;

  const tele = mkBox(0);
  tele.style.top = "auto";
  tele.style.bottom = "8px";
  tele.style.left = "8px";
  tele.style.color = "#3cf";
  tele.style.font = "bold 18px monospace";
  tele.textContent = "waiting for car";

  const toast = msg => {
    console.log("[NOS] " + msg);
    hud.textContent = msg;
    show(hud);
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => hide(hud), 1500);
  };

  const refit = () => {
    if (hud.style.display === "block") place(hud);
    if (teleOn) place(tele);
    if (helpOn) place(help);
    if (panelOn) place(panel);
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
    return { u, f32, c };
  };

  // Drift mode in free roam is the game's own: X toggles it (runtime/drift.c).
  // These are the game's drift-score fields, so the trainer can keep the
  // streak alive through a wall hit and bank it every 1,000,000 points.
  const G_FORCEDRIFT = 0x00890104, G_RACE = 0x00890118;

  const driftInfo = () => {
    if (!u || !buf) return null;
    const none = { on: false, st: 0, dc: 0, state: 2, pend: 0, total: 0, level: 0 };
    const on = u[G_FORCEDRIFT >> 2] !== 0;
    const r = u[G_RACE >> 2];
    if (!r || (r & 3) || r + 0xBD4 > buf.byteLength) return { ...none, on };
    const rc = u[(r + 0xBD0) >> 2];
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

  const driftTick = () => {
    const d = driftInfo();
    if (!d || !d.on || !d.st) { driftPrev = 0; return; }
    if (d.state === 4) {
      // a wall took the drift: put its points back and keep counting
      const keep = Math.max(driftPrev, d.pend);
      if (keep > 0) {
        f32[(d.st + 0x24) >> 2] = keep;
        u[(d.st + 0x14) >> 2] = 0;
        driftPrev = keep;
      }
      return;
    }
    if (d.state === 0 || d.state === 1) {
      if (d.pend > 0) driftPrev = d.pend;
      if (d.pend >= 1000000 && performance.now() >= driftBankAt) {
        const banks = Math.floor(d.pend / 1000000) * 1000000;
        driftBankAt = performance.now() + 1000;
        f32[(d.st + 0x2C) >> 2] = d.total + banks;
        f32[(d.st + 0x24) >> 2] = d.pend - banks;
        driftPrev = d.pend - banks;
        toast("Drift: " + banks.toLocaleString("en-US") + " banked");
      }
      return;
    }
    driftPrev = 0;
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
    const v = [0, 0, 0];
    v[i] = upAvg[i] >= 0 ? 1 : -1;
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
    if (lockState)
      for (let i = 0; i < 3; i++) {
        f32[(c + 0x60 + 4 * i) >> 2] = lockState.p[i];
        f32[(c + 0x50 + 4 * i) >> 2] = lockState.com[i];
        f32[(c + 0x90 + 4 * i) >> 2] = lockState.f[i];
        f32[(c + 0xa0 + 4 * i) >> 2] = lockState.l[i];
        f32[(c + 0xb0 + 4 * i) >> 2] = lockState.u[i];
      }
    if (!quiet) console.log("[NOS] stop");
  };

  const hardStop = (u, f32, c) => stopCar(u, f32, c, false);

  const iv = setInterval(() => {
    const g = get();
    if (!g) return;
    const u = g.u, f32 = g.f32, c = g.c, n = c + 0x40;

    driftTick();

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

      if (spinOn) {
        // spin in place: yaw the car around its own up axis, kill sideways motion
        const own = vecAt(f32, c, 0xB0);
        const ol = Math.hypot(own[0], own[1], own[2]);
        const axis = ol > 0.5 && ol < 1.5 ? [own[0] / ol, own[1] / ol, own[2] / ol] : w;
        const ang = 0.09;
        for (const off of [0x90, 0xA0, 0xB0]) putVec(f32, c, off, rot(vecAt(f32, c, off), axis, ang));
        for (const [base, off] of [[c, 0x70], [rb, 0xA0]]) {
          if (!base) continue;
          const v = vecAt(f32, base, off);
          const vy = dot(v, w);
          putVec(f32, base, off, [w[0] * vy, w[1] * vy, w[2] * vy]);
        }
        for (let i = 0; i < 3; i++) f32[(c + 0x110 + 4 * i) >> 2] = 0;
        f32[(c + 0x42C) >> 2] = 0;
        f32[(c + 0x430) >> 2] = 0;
      }
    }

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
      speed: speedOf(u, f32, c),
      hspeed: hspeedOf(u, f32, c),
      up: wUpVec(),
      boostOn,
      boostKmh,
      hasSavedPos: !!savedPos,
      slots: savedPos && savedPos.slots ? savedPos.slots.length : 0,
      locked
    };

    paint(performance.now());
  }, 8);

  const pressX = () => {
    const o = { key: "x", code: "KeyX", keyCode: 88, which: 88, bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent("keydown", o));
    document.dispatchEvent(new KeyboardEvent("keyup", o));
  };

  const act = name => {
    if (name === "help") {
      helpOn = !helpOn;
      if (helpOn) show(help);
      else hide(help);
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

    if (name === "drift") {
      pressX();
      toast("Drift: X (free roam)");
      return;
    }

    if (name === "grav" || name === "spin") {
      const label = name === "grav" ? "Low gravity" : "Spin";
      let on;
      if (name === "grav") { gravOn = !gravOn; on = gravOn; }
      else {
        spinOn = !spinOn;
        on = spinOn;
        if (spinOn) {
          const gg = get();
          if (gg) jump(gg.u, gg.f32, gg.c, 5);
        }
      }
      toast(label + (on ? " ON" : " OFF"));
      paint(performance.now(), true);
      return;
    }

    if (name === "panel") {
      panelOn = !panelOn;
      if (panelOn) show(panel); else hide(panel);
      paint(performance.now(), true);
      return;
    }

    if (name === "tele") {
      teleOn = !teleOn;
      if (teleOn) show(tele); else hide(tele);
      return;
    }

    const g = get();
    if (!g) return;
    const u = g.u, f32 = g.f32, c = g.c;

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
  panel.style.top = "auto";
  panel.style.right = "10px";
  panel.style.bottom = "10px";
  panel.style.left = "auto";
  panel.style.padding = "10px";
  panel.style.color = "#0f0";
  panel.style.background = "rgba(0,0,0,.86)";
  panel.style.border = "1px solid #0f0";
  panel.style.borderRadius = "10px";
  panel.style.font = "bold 11px monospace";
  panel.style.pointerEvents = "auto";
  panel.style.width = "268px";

  const panelTitle = document.createElement("div");
  panelTitle.textContent = "NFSU2 TRAINER v1.1";
  panelTitle.style.cssText = "text-align:center;letter-spacing:1px;margin-bottom:2px;color:#0f0;font-size:12px";
  panel.appendChild(panelTitle);

  const panelSub = document.createElement("div");
  panelSub.textContent = "F9 panel · X = drift (game)";
  panelSub.style.cssText = "text-align:center;color:#777;font-size:9px;margin-bottom:4px";
  panel.appendChild(panelSub);

  const pbtn = {};
  const section = title => {
    const h = document.createElement("div");
    h.textContent = title;
    h.style.cssText = "margin:8px 0 4px;padding-top:6px;border-top:1px solid #243;color:#8f8;font-size:9px;letter-spacing:1px";
    panel.appendChild(h);
    const g = document.createElement("div");
    g.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:5px";
    panel.appendChild(g);
    return g;
  };
  const mkBtn = (parent, label, action, wide) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = "padding:8px 2px;background:#111;color:#0f0;border:1px solid #555;border-radius:5px;font:bold 10px monospace;cursor:pointer" + (wide ? ";grid-column:span 3" : "");
    b.addEventListener("click", ev => { ev.preventDefault(); act(action); b.blur(); });
    parent.appendChild(b);
    pbtn[action] = b;
    return b;
  };
  const mkSlider = (parent, min, max, step, value, format, onInput) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "margin-top:6px;grid-column:span 3";
    const lab = document.createElement("div");
    lab.style.cssText = "margin-bottom:2px;color:#8f8";
    lab.textContent = format(value);
    wrap.appendChild(lab);
    const r = document.createElement("input");
    r.type = "range";
    r.min = min;
    r.max = max;
    r.step = step;
    r.value = value;
    r.style.cssText = "width:100%;accent-color:#0f0";
    r.addEventListener("input", () => {
      const v = +r.value;
      lab.textContent = format(v);
      onInput(v);
    });
    wrap.appendChild(r);
    parent.appendChild(wrap);
    return { r, lab, format };
  };

  const gNos = section("NOS");
  mkBtn(gNos, "NOS ON / OFF", "boost", true);
  const boostS = mkSlider(gNos, BOOST_MIN, BOOST_MAX, BOOST_STEP, boostKmh,
    v => "NOS power: +" + v + " km/h", v => { boostKmh = v; });

  const gMove = section("MOVE");
  mkBtn(gMove, "JUMP", "jump");
  mkBtn(gMove, "STOP", "stop");
  mkBtn(gMove, "LOCK", "lock");

  const gDrift = section("DRIFT (GAME)");
  const driftBtn = mkBtn(gDrift, "DRIFT ON / OFF  (X)", "drift", true);
  const driftStat = document.createElement("div");
  driftStat.style.cssText = "grid-column:span 3;color:#8f8;font-size:10px;text-align:center;min-height:14px";
  driftStat.textContent = "X in free roam";
  gDrift.appendChild(driftStat);

  const gPos = section("POSITION");
  mkBtn(gPos, "SAVE", "savePos");
  mkBtn(gPos, "LOAD", "loadPos");
  mkBtn(gPos, "HELP", "help");

  const gMore = section("MORE");
  mkBtn(gMore, "SPIN", "spin");
  mkBtn(gMore, "LOW-G", "grav");
  mkBtn(gMore, "HIDE", "panel");
  const jumpS = mkSlider(gMore, 6, 60, 4, jumpPower,
    v => "Jump power: " + v, v => { jumpPower = v; });

  const hint = document.createElement("div");
  hint.textContent = "Alt = hold NOS · , . jump power";
  hint.style.cssText = "margin-top:8px;text-align:center;color:#666;font-size:9px";
  panel.appendChild(hint);

  const paint = (now, force) => {
    if (!force && now < paintAt) return;
    paintAt = now + 120;
    const d = driftInfo();

    if (teleOn) {
      const g = get();
      if (g) {
        const tags = [];
        if (boostOn) tags.push("NOS");
        if (d && d.on) tags.push("DRIFT");
        if (gravOn) tags.push("LOW-G");
        if (spinOn) tags.push("SPIN");
        if (locked) tags.push("LOCK");
        tele.textContent = Math.round(hspeedOf(g.u, g.f32, g.c) * 3.6) + " km/h" +
          (tags.length ? "   " + tags.join(" ") : "");
      } else {
        tele.textContent = "waiting for car";
      }
    }

    if (panelOn) {
      const states = [
        [pbtn.boost, boostOn], [pbtn.lock, locked],
        [pbtn.grav, gravOn], [pbtn.spin, spinOn]
      ];
      for (const [el, on] of states) {
        el.style.borderColor = on ? "#0f0" : "#555";
        el.style.background = on ? "#063" : "#111";
      }
      const don = !!(d && d.on);
      driftBtn.style.borderColor = don ? "#0f0" : "#555";
      driftBtn.style.background = don ? "#063" : "#111";
      driftStat.textContent = don
        ? "x" + (d.level || 1) + "  " + Math.round(d.pend).toLocaleString("en-US") +
          "  ·  total " + Math.round(d.total).toLocaleString("en-US")
        : "X in free roam";
      if (document.activeElement !== boostS.r) {
        boostS.r.value = boostKmh;
        boostS.lab.textContent = boostS.format(boostKmh);
      }
      if (document.activeElement !== jumpS.r) {
        jumpS.r.value = jumpPower;
        jumpS.lab.textContent = jumpS.format(jumpPower);
      }
    }
  };

  panelOn = true;
  teleOn = true;
  show(panel);
  show(tele);

  const KEYS = {
    0: "help",
    1: "boost", 2: "jump", 3: "stop", 4: "lock",
    5: "savePos", 6: "loadPos", 7: "powerDown", 8: "powerUp"
  };

  const typing = () => {
    if (!u) return false;
    return (u[0x0083A9C0 >> 2] & 0xff) !== 0 || (u[0x0083A9C4 >> 2] & 0xff) !== 0;
  };

  listen("keydown", e => {
    if (isAlt(e)) {
      if (typing()) return;
      held = true;
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    if (e.key === "F9") { e.preventDefault(); return act("panel"); }
    if (typing()) return;
    if (e.code === "BracketLeft" || e.key === "[" || e.key === "," ||
        e.key === "PageDown" || e.code === "NumpadSubtract" || e.key === "-") return act("jumpDown");
    if (e.code === "BracketRight" || e.key === "]" || e.key === "." ||
        e.key === "PageUp" || e.code === "NumpadAdd" || e.key === "+" || e.key === "=") return act("jumpUp");
    if (e.key.length === 1) {
      const l = { z: "spin", t: "tele" }[e.key.toLowerCase()];
      if (l) return act(l);
    }
    for (const k in KEYS) {
      if (e.key === k || e.code === "Digit" + k || e.code === "Numpad" + k) return act(KEYS[k]);
    }
  });

  listen("keyup", e => {
    if (!isAlt(e)) return;
    held = false;
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
    4: "boost", 5: "jump", 0: "lock", 1: "drift", 2: "grav", 3: "spin",
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
      offs.forEach(fn => fn());
      hud.remove();
      help.remove();
      panel.remove();
      tele.remove();
      delete window.__nosCheat;
      console.log("[NOS] stopped");
    }
  };
  console.log("[NOS] running v1.1 (press F9 for the panel, 0 for controls)");
})();
