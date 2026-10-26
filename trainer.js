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
    "  0  show/hide this help",
    "  hold Alt  keep NOS active",
    "",
    "Gamepad",
    "  LB  boost on/off",
    "  RB  jump",
    "  A   stop lock on/off",
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

  const toast = msg => {
    console.log("[NOS] " + msg);
    hud.textContent = msg;
    show(hud);
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => hide(hud), 1500);
  };

  const refit = () => {
    if (hud.style.display === "block") place(hud);
    if (helpOn) place(help);
  };
  listen("fullscreenchange", refit);
  listen("webkitfullscreenchange", refit);

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
    }
    const p = u[0x8900AC >> 2];
    if (!p) return null;
    const c = u[(p + 4) >> 2];
    if (!c) return null;
    if (!carLogged) {
      carLogged = true;
      console.log("[NOS] car found at 0x" + c.toString(16));
    }
    return { u, f32, c };
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

  const jump = (u, f32, c) => {
    const rb = rbOf(u, c);
    if (!rb) return console.log("[NOS] no rb");
    const mass = massOf(u, f32, c);
    let ux = f32[(c + 0xB0) >> 2], uy = f32[(c + 0xB4) >> 2], uz = f32[(c + 0xB8) >> 2];
    const len = Math.hypot(ux, uy, uz) || 1;
    ux /= len; uy /= len; uz /= len;
    const j = 8;
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
  }, 8);

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

  const KEYS = {
    0: "help",
    1: "boost", 2: "jump", 3: "stop", 4: "lock",
    5: "savePos", 6: "loadPos", 7: "powerDown", 8: "powerUp"
  };

  listen("keydown", e => {
    if (isAlt(e)) { held = true; e.preventDefault(); return; }
    if (e.repeat) return;
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
    4: "boost", 5: "jump", 0: "lock",
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
      delete window.__nosCheat;
      console.log("[NOS] stopped");
    }
  };
  console.log("[NOS] running (press 0 for controls)");
})();