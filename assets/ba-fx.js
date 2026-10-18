/* ============================================================
   蔚蓝档案（Blue Archive）点击 / 滑动特效 · 忠实复刻 FX_Touch
   参考仓库：https://github.com/CialloKing/ba-click-fx
   本实现所有数值/配色严格取自参考仓库 src/config.js 的 UNITY_FX_TOUCH，
   仅将 Unity 粒子参数换算为 CSS 像素并按画面高度缩放（与参考一致）。

   组成（与官方 FX_Touch 一一对应）：
     · hit    中心极短白闪        (lifetime 80ms,  r 24)
     · flare   6 条放射星芒        (lifetime 150ms, r 36, rayCount 6)
     · disk    中心圆盘闪光        (lifetime 200ms, r≈64.8)
     · rings   2 圈青色扩散环(带旋转溶解) (lifetime 600ms, 青 #4ca7ff, HDR 发光)
     · shards  4 片三角碎片 + 拖尾  (lifetime 600~700ms, 青/白渐变, 三角 #Triangle_02_1)

   滑动 / 拖尾轨迹（对应官方 pointermove / touchmove 绑定的 trail 效果）：
     · trail   沿移动路径连续喷出的 BA 蓝色发光粒子（按下拖动 / 触摸上下滑 / 滚轮滚动）

   纯原生 JS / Canvas2D，无依赖；全站只挂一个覆盖层；
   空闲自动停 rAF 省电；尊重 prefers-reduced-motion。
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  /* ---- 取自参考仓库 config.js 的真实配色（RGB）---- */
  var C_WHITE   = [255, 255, 255];
  var C_LBLUE   = [180, 220, 255];   // 浅蓝
  var C_DBLUE   = [61, 100, 255];    // 深蓝
  var C_RING    = [76, 167, 255];    // #4ca7ff 环（DEFAULT_THEME_COLOR）
  var C_SHARD   = [95, 197, 255];    // #5fc5ff 碎片青
  var C_SHARD2  = [90, 186, 241];    // 碎片过渡蓝

  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) {
    return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
  }
  // 多段颜色梯度
  function grad(stops, t) {
    for (var i = 0; i < stops.length - 1; i++) {
      if (t <= stops[i + 1][0] || i === stops.length - 2) {
        var a = stops[i], b = stops[i + 1];
        var lt = (t - a[0]) / Math.max(1e-6, (b[0] - a[0]));
        lt = lt < 0 ? 0 : (lt > 1 ? 1 : lt);
        return mix(a[1], b[1], lt);
      }
    }
    return stops[stops.length - 1][1];
  }

  /* ---- 参考仓库的基准换算常量 ---- */
  var REF_H = 1080;
  var W2RPX = REF_H / 2;                 // 540
  var SHARD_SCALE = 0.3078824;
  var SHARD_U2RPX = W2RPX * SHARD_SCALE; // ≈166.26
  var RING_OUTER = 1.0636684;

  var canvas, ctx, dpr = 1, S = 1;
  var parts = [];
  var running = false, lastTs = 0;

  function scale() {
    S = window.innerHeight / REF_H;
    if (S < 0.45) S = 0.45;
    if (S > 1.7) S = 1.7;
  }
  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'ba-click-fx';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;left:0;top:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:2147483646;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    if (!canvas) return;
    scale();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  }

  function kick() {
    if (!running) { running = true; lastTs = now(); requestAnimationFrame(frame); }
  }

  /* ============ 一次点击爆发（严格按 UNITY_FX_TOUCH） ============ */
  function spawnBurst(x, y) {
    var t0 = now();

    // hit：中心极短白闪
    parts.push({ k: 'hit', x: x, y: y, born: t0, life: 80, r: 24 * S });

    // flare：6 条放射星芒
    parts.push({ k: 'flare', x: x, y: y, born: t0, life: 150, r: 36 * S, rays: 6 });

    // disk：中心圆盘
    parts.push({ k: 'disk', x: x, y: y, born: t0, life: 200, r: 0.12 * 2 * 0.5 * W2RPX * S });

    // rings：2 圈青色扩散旋转环
    for (var i = 0; i < 2; i++) {
      var rMin = (0.12 + i * 0.01) * W2RPX * RING_OUTER * S;
      var rMax = (0.14 + i * 0.01) * W2RPX * RING_OUTER * S;
      parts.push({
        k: 'ring', x: x, y: y, born: t0 + i * 60, life: 600,
        r0: rMin, r1: rMax, w: (3.4 - i * 0.9) * S,
        dir: (i % 2 ? -1 : 1), dash: i === 0
      });
    }

    // shards：4 片三角碎片（带拖尾）
    var n = 4;
    var base = Math.random() * Math.PI * 2;
    for (var s = 0; s < n; s++) {
      var ang = base + (Math.PI * 2 * s) / n + (Math.random() - 0.5) * 0.45;
      var emitR = 0.3 * SHARD_U2RPX * S;          // clickRadius
      var spd = (0.30 + Math.random() * 0.10) * SHARD_U2RPX * S; // clickSpeed 0.3~0.4
      parts.push({
        k: 'shard', x: x, y: y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        born: t0, life: 600 + Math.random() * 100,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 7,
        size: (0.10 + Math.random() * 0.10) * SHARD_U2RPX * S, // size 0.1~0.2
        trail: [], trailR: 0.15 * SHARD_U2RPX * S
      });
    }
    kick();
  }

  /* ============ 沿路径的滑动/拖尾粒子（轻量 BA 蓝点） ============ */
  function spawnTrail(x, y, dirx, diry) {
    var t0 = now();
    var cnt = 2;
    for (var i = 0; i < cnt; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = (0.04 + Math.random() * 0.06) * SHARD_U2RPX * S;
      // 跟随移动方向带一点初速，形成拖尾方向感
      var vx = Math.cos(a) * sp + (dirx || 0) * 0.5;
      var vy = Math.sin(a) * sp + (diry || 0) * 0.5;
      parts.push({
        k: 'trail', x: x + (Math.random() - 0.5) * 6 * S, y: y + (Math.random() - 0.5) * 6 * S,
        vx: vx, vy: vy, born: t0, life: 320 + Math.random() * 160,
        r: (2.2 + Math.random() * 2.6) * S
      });
    }
    kick();
  }

  function pointOf(e) {
    var x, y;
    if (e.touches && e.touches.length) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
    else if (e.changedTouches && e.changedTouches.length) { x = e.changedTouches[0].clientX; y = e.changedTouches[0].clientY; }
    else { x = e.clientX; y = e.clientY; }
    if (typeof x !== 'number' || isNaN(x)) return null;
    return { x: x, y: y };
  }

  /* ============ 渲染循环 ============ */
  function frame(ts) {
    if (!ctx) return;
    var dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalCompositeOperation = 'source-over';

    var alive = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var t = (now() - p.born) / p.life;
      if (t < 0) { alive.push(p); continue; }
      if (t >= 1) continue;

      if (p.k === 'hit') {
        var r = p.r * easeOut(t);
        var a = 1 - t * t;
        ctx.fillStyle = rgba(grad([[0, C_WHITE], [0.5, C_LBLUE], [1, C_DBLUE]], t), a * 0.95);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();

      } else if (p.k === 'flare') {
        var len = p.r * (0.35 + 0.65 * easeOut(t));
        var fa = (1 - t) * (1 - t) * 0.9;
        ctx.strokeStyle = rgba(grad([[0, C_WHITE], [0.3, C_LBLUE], [1, C_DBLUE]], t), fa);
        ctx.lineWidth = (3 - 2 * t) * S;
        ctx.lineCap = 'round';
        for (var ri = 0; ri < p.rays; ri++) {
          var ang2 = (Math.PI * 2 * ri) / p.rays;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(ang2) * p.r * 0.18, p.y + Math.sin(ang2) * p.r * 0.18);
          ctx.lineTo(p.x + Math.cos(ang2) * len, p.y + Math.sin(ang2) * len);
          ctx.stroke();
        }

      } else if (p.k === 'disk') {
        var rd = p.r * (0.2 + 0.8 * easeOut(t));
        var da = (1 - t);
        ctx.fillStyle = rgba(grad([[0, C_WHITE], [0.1205921, C_DBLUE]], t), da * 0.85);
        ctx.shadowColor = rgba(C_DBLUE, da * 0.6);
        ctx.shadowBlur = 14 * S * (1 - t);
        ctx.beginPath(); ctx.arc(p.x, p.y, rd, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

      } else if (p.k === 'ring') {
        var rr = p.r0 + (p.r1 - p.r0) * easeOut(t);
        var ra = (1 - t) * (1 - t);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.dir * t * 6.0);            // 旋转（参考 angularVelocityMultiplier≈11）
        ctx.strokeStyle = rgba(C_RING, ra * 0.9);
        ctx.lineWidth = p.w * (1 - t * 0.45);
        ctx.shadowColor = rgba(C_RING, ra);
        ctx.shadowBlur = 12 * S * (1 - t);
        if (p.dash) ctx.setLineDash([12 * (1 - t) + 3, 8 * (1 - t) + 4]); // 溶解感
        else ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);

      } else if (p.k === 'shard') {
        var age = (now() - p.born) / 1000;
        var px = p.x + p.vx * age;
        var py = p.y + p.vy * age;
        // 记录拖尾
        p.trail.push({ x: px, y: py });
        if (p.trail.length > 7) p.trail.shift();
        var shCol = grad([
          [0, C_WHITE], [0.182, C_WHITE], [0.282, C_SHARD],
          [0.462, C_SHARD], [0.662, C_SHARD2], [0.826, C_SHARD], [1, C_SHARD]
        ], t);
        var shA = (1 - t);
        // 拖尾
        for (var ti = 0; ti < p.trail.length - 1; ti++) {
          var tp = p.trail[ti];
          var ta = shA * (ti / p.trail.length) * 0.5;
          var ts = p.size * (ti / p.trail.length) * 0.7;
          ctx.fillStyle = rgba(shCol, ta);
          drawTri(tp.x, tp.y, ts, p.rot + p.vr * age, ctx);
        }
        // 主碎片
        ctx.fillStyle = rgba(shCol, shA);
        ctx.shadowColor = rgba(C_SHARD, shA * 0.85);
        ctx.shadowBlur = 9 * S * shA;
        drawTri(px, py, p.size * (0.35 + 0.65 * (1 - t)), p.rot + p.vr * age, ctx);
        ctx.shadowBlur = 0;

      } else if (p.k === 'trail') {
        var tr = (1 - t);
        var tx = p.x + p.vx * (now() - p.born) / 1000 * 0.6;
        var ty = p.y + p.vy * (now() - p.born) / 1000 * 0.6;
        var col = mix(C_SHARD, C_LBLUE, t);
        ctx.fillStyle = rgba(col, tr * 0.9);
        ctx.shadowColor = rgba(C_SHARD, tr * 0.9);
        ctx.shadowBlur = 8 * S * tr;
        ctx.beginPath(); ctx.arc(tx, ty, p.r * (0.4 + 0.6 * (1 - t)), 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      alive.push(p);
    }
    parts = alive;
    ctx.globalCompositeOperation = 'source-over';

    if (parts.length > 0) requestAnimationFrame(frame);
    else { running = false; if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
  }

  function drawTri(cx, cy, s, rot, c) {
    if (s <= 0.2) return;
    c.save();
    c.translate(cx, cy);
    c.rotate(rot);
    c.beginPath();
    c.moveTo(0, -s);
    c.lineTo(s * 0.42, s * 0.55);
    c.lineTo(0, s * 0.25);
    c.lineTo(-s * 0.42, s * 0.55);
    c.closePath();
    c.fill();
    c.restore();
  }

  /* ============ 事件 ============ */
  var pressed = false;
  var lastTrail = null;     // 上一次喷拖尾的位置（用于按距离节流）
  var lastWheel = 0;

  function maybeTrail(x, y, dx, dy) {
    if (lastTrail) {
      var d = Math.hypot(x - lastTrail.x, y - lastTrail.y);
      if (d < 14 * S) return;     // 移动不够远，跳过，避免粒子堆叠
    }
    lastTrail = { x: x, y: y };
    spawnTrail(x, y, dx, dy);
  }

  function onDown(e) {
    if (reduceMotion) return;
    if (!canvas) ensureCanvas();
    var pt = pointOf(e); if (!pt) return;
    pressed = true;
    spawnBurst(pt.x, pt.y);
  }
  function onMove(e) {
    if (reduceMotion) return;
    if (!canvas) ensureCanvas();
    var pt = pointOf(e); if (!pt) return;
    // 仅当「触摸滑动」或「鼠标/笔按住拖动」时出拖尾；普通 hover 保持安静
    var isTouch = e.pointerType === 'touch';
    var dragging = isTouch || (typeof e.buttons === 'number' && e.buttons > 0);
    if (!dragging) { lastTrail = null; return; }
    var dx = 0, dy = 0;
    if (e.movementX || e.movementY) { dx = e.movementX; dy = e.movementY; }
    maybeTrail(pt.x, pt.y, dx, dy);
  }
  function onUp() { pressed = false; lastTrail = null; }
  function onWheel(e) {
    if (reduceMotion) return;
    if (!canvas) ensureCanvas();
    var t = Date.now();
    if (t - lastWheel < 70) return;   // 节流：滚轮高频触发
    lastWheel = t;
    maybeTrail(e.clientX, e.clientY, 0, e.deltaY < 0 ? -1 : 1);
  }

  function init() {
    if (reduceMotion) return;
    scale();
    if (window.PointerEvent) {
      document.addEventListener('pointerdown', onDown, { passive: true });
      document.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerup', onUp, { passive: true });
      document.addEventListener('pointercancel', onUp, { passive: true });
    } else {
      // 旧浏览器降级
      document.addEventListener('mousedown', onDown, { passive: true });
      document.addEventListener('mousemove', function (e) {
        if (e.buttons > 0) onMove(e); else { lastTrail = null; }
      }, { passive: true });
      document.addEventListener('mouseup', onUp, { passive: true });
      document.addEventListener('touchstart', onDown, { passive: true });
      document.addEventListener('touchmove', function (e) {
        if (e.touches && e.touches.length) {
          var t = e.touches[0];
          maybeTrail(t.clientX, t.clientY, 0, 0);
        }
      }, { passive: true });   // passive：绝不阻止页面滚动（手机上下滑）
      document.addEventListener('touchend', onUp, { passive: true });
    }
    // 桌面鼠标滚轮（上下滚动）反馈
    document.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('beforeunload', function () {
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
