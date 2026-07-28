/* ─────────────────────────────────────────────
   「결」 랜딩 — 인터랙션 v2
   1) 살아있는 두루마리: 시간 기반 수묵 캔버스 + 관성 스크럽
   2) 챕터 오버레이 (자모 → 글자 스밈 + 낙관 날인)
   3) 놀이법 데모: 2.5D 타일 + 드래그로 긋기
   4) 낙관 진행 도장 · 리빌 · 붓 궤적 · 먹 파문
   ───────────────────────────────────────────── */
'use strict';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* 모바일·터치 기기 = 저부하 모드 (SVG 필터·고해상도 캔버스 생략) */
const lowFX = matchMedia('(max-width:820px), (hover:none) and (pointer:coarse)').matches;

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/* ══════════════ 1. 두루마리 캔버스 ══════════════ */
const N_CH = 6;                    // 챕터: 불 물 빛 돌 숨 결
const journey = document.getElementById('journey');
const stage = document.querySelector('.journey-stage');
const stageCv = document.getElementById('scrollCanvas');
const ctx = stageCv.getContext('2d');
const chapters = [...document.querySelectorAll('.chapter')];
const jpDots = [...document.querySelectorAll('.jp-dot')];
const inkSpreadMap = document.getElementById('inkSpreadMap');

const INK = '32,32,28';
const SEAL = '154,51,36';

/* 시드 고정 유사난수 — 리사이즈에도 산맥이 흔들리지 않게 */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/* 능선 = 코사인 보간 밸류 노이즈 */
function makeRidge(seed, step) {
  const rnd = seeded(seed);
  const pts = Array.from({ length: 220 }, () => rnd());
  return x => {
    const i = Math.floor(x / step), t = (x / step) - i;
    const a = pts[((i % pts.length) + pts.length) % pts.length];
    const b = pts[(((i + 1) % pts.length) + pts.length) % pts.length];
    return lerp(a, b, (1 - Math.cos(t * Math.PI)) / 2);
  };
}
const ridges = [
  { f: makeRidge(11, 340), detail: makeRidge(311, 61), par: 0.22, base: 0.52, amp: 0.16, alpha: 0.075 },
  { f: makeRidge(47, 260), detail: makeRidge(347, 53), par: 0.45, base: 0.63, amp: 0.20, alpha: 0.12 },
  { f: makeRidge(83, 210), detail: makeRidge(383, 47), par: 0.85, base: 0.75, amp: 0.24, alpha: 0.19 },
];
/* 불씨 입자 — 시드 고정 배치 */
const emberRnd = seeded(777);
const EMBERS = Array.from({ length: 16 }, () => ({
  ox: emberRnd() * 2 - 1, speed: 0.05 + emberRnd() * 0.09,
  phase: emberRnd(), size: 1.2 + emberRnd() * 2.2, wob: 2 + emberRnd() * 5,
}));

/* ── 먹 질감 — 얼룩 패턴 + 주묵 해 + 산 텍스처 오프스크린 ── */
const noisePat = (() => {           // 타일형 먹 얼룩 (128px)
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const rnd = seeded(999);
  for (let i = 0; i < 1100; i++) {
    g.fillStyle = `rgba(32,32,28,${(rnd() * 0.10).toFixed(3)})`;
    const s = 0.8 + rnd() * 2.4;
    g.fillRect(rnd() * 128, rnd() * 128, s, s);
  }
  for (let i = 0; i < 26; i++) {    // 큼직한 옅은 얼룩
    const x = rnd() * 128, y = rnd() * 128, r = 6 + rnd() * 16;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(32,32,28,${(rnd() * 0.05).toFixed(3)})`);
    rg.addColorStop(1, 'rgba(32,32,28,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  return c;
})();

let sunCv = null, sunSize = 0, landCv = null, landCtx = null, landPattern = null;

/* 주홍 잉크 해 — 한지에 촤악 스며 번진 워시: 겹겹의 무른 번짐 + 섬유 잔가지 */
function buildSun() {
  const r = Math.min(W, H) * 0.075;
  sunSize = Math.ceil(r * 4.2);
  sunCv = document.createElement('canvas');
  sunCv.width = sunCv.height = Math.ceil(sunSize * DPR);
  const g = sunCv.getContext('2d');
  g.scale(DPR, DPR);
  const cx = sunSize / 2, cy = sunSize / 2;
  const rnd = seeded(555);
  const blob = (rr, wob, ph1, ph2, ph3) => {
    g.beginPath();
    for (let i = 0; i <= 110; i++) {
      const th = (i / 110) * Math.PI * 2;
      const rad = rr * (1 + wob * (0.55 * Math.sin(3 * th + ph1) + 0.3 * Math.sin(5 * th + ph2) + 0.15 * Math.sin(9 * th + ph3)));
      i === 0 ? g.moveTo(cx + Math.cos(th) * rad, cy + Math.sin(th) * rad)
              : g.lineTo(cx + Math.cos(th) * rad, cy + Math.sin(th) * rad);
    }
    g.closePath();
  };

  /* 겹겹의 워시 — 바깥일수록 크고 옅고 무르게 (젖은 번짐) */
  const layers = [
    { rr: 1.62, a: 0.045, wob: 0.16, blur: 0.20 },
    { rr: 1.38, a: 0.075, wob: 0.13, blur: 0.14 },
    { rr: 1.18, a: 0.115, wob: 0.10, blur: 0.09 },
    { rr: 1.02, a: 0.16,  wob: 0.075, blur: 0.055 },
    { rr: 0.88, a: 0.21,  wob: 0.055, blur: 0.035 },
    { rr: 0.70, a: 0.24,  wob: 0.05,  blur: 0.025 },
  ];
  for (const L of layers) {
    const ph1 = rnd() * 6.28, ph2 = rnd() * 6.28, ph3 = rnd() * 6.28;
    const warm = rnd() * 20;                          // 층마다 미묘한 색 온도차
    g.save();
    try { g.filter = `blur(${(r * L.blur).toFixed(1)}px)`; } catch (e) {}
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r * L.rr);
    grad.addColorStop(0, `rgba(${154 + warm},${51 + warm * 0.4},36,${L.a})`);
    grad.addColorStop(0.72, `rgba(${154 + warm},${51 + warm * 0.4},36,${L.a * 0.8})`);
    grad.addColorStop(1, 'rgba(154,51,36,0)');
    blob(r * L.rr, L.wob, ph1, ph2, ph3);
    g.fillStyle = grad;
    g.fill();
    g.restore();
  }

  /* 섬유 잔가지 — 종이 결을 타고 삐져나간 가는 번짐 */
  g.save();
  try { g.filter = `blur(${(r * 0.02).toFixed(1)}px)`; } catch (e) {}
  g.lineCap = 'round';
  for (let i = 0; i < 48; i++) {
    const th = rnd() * Math.PI * 2;
    const r0 = r * (0.78 + rnd() * 0.3);
    const len = r * (0.12 + rnd() * 0.42);
    const bend = (rnd() - 0.5) * r * 0.22;
    const x0 = cx + Math.cos(th) * r0, y0 = cy + Math.sin(th) * r0;
    const x1 = cx + Math.cos(th) * (r0 + len), y1 = cy + Math.sin(th) * (r0 + len);
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 - Math.sin(th) * bend, (y0 + y1) / 2 + Math.cos(th) * bend, x1, y1);
    g.lineWidth = r * (0.008 + rnd() * 0.02);
    g.strokeStyle = `rgba(154,51,36,${0.03 + rnd() * 0.06})`;
    g.stroke();
  }
  g.restore();

  /* 중심 얼룩 몇 점 + 한지 그레인 */
  for (let i = 0; i < 40; i++) {
    const u = Math.sqrt(rnd()), th = rnd() * Math.PI * 2;
    const x = cx + Math.cos(th) * u * r * 0.8, y = cy + Math.sin(th) * u * r * 0.8;
    const br = r * (0.06 + rnd() * 0.16);
    const rg2 = g.createRadialGradient(x, y, 0, x, y, br);
    rg2.addColorStop(0, rnd() < 0.5 ? `rgba(120,32,20,${0.03 + rnd() * 0.05})` : `rgba(206,110,80,${0.03 + rnd() * 0.04})`);
    rg2.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg2; g.beginPath(); g.arc(x, y, br, 0, 7); g.fill();
  }
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.6;
  g.fillStyle = g.createPattern(noisePat, 'repeat');
  g.fillRect(0, 0, sunSize, sunSize);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
}

/* 능선 — 오프스크린에 그려 산 픽셀에만 먹 얼룩을 입힌다.
   카메라가 거의 안 움직였으면 캐시를 재사용한다 — 모바일 프레임 비용의 대부분을 아낀다 */
let lastLandCam = -1e9;
function drawLand(cam) {
  if (!landCv) { landCv = document.createElement('canvas'); landCtx = landCv.getContext('2d'); }
  const resized = landCv.width !== stageCv.width || landCv.height !== stageCv.height;
  if (resized) {
    landCv.width = stageCv.width; landCv.height = stageCv.height;
    landPattern = landCtx.createPattern(noisePat, 'repeat');
  }
  if (!resized && Math.abs(cam - lastLandCam) < (lowFX ? 1.2 : 0.35)) {
    ctx.drawImage(landCv, 0, 0, W, H);
    return;
  }
  lastLandCam = cam;
  const g = landCtx;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.clearRect(0, 0, W, H);
  for (const rg of ridges) {
    const off = cam * rg.par;
    const yAt = x => H * rg.base - rg.f(x + off) * H * rg.amp;
    const topY = H * (rg.base - rg.amp);
    const fill = g.createLinearGradient(0, topY, 0, H);
    fill.addColorStop(0, `rgba(${INK},${rg.alpha * 1.15})`);
    fill.addColorStop(0.5, `rgba(${INK},${rg.alpha})`);
    fill.addColorStop(1, `rgba(${INK},${rg.alpha * 0.75})`);
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, yAt(x));
    g.lineTo(W, H); g.closePath();
    g.fillStyle = fill; g.fill();
    /* 크레스트 밴드 — 마루가 짙고 아래로 바랜다 (먹 붓의 첫 획) */
    for (const [bh, ba] of [[0.016, 0.6], [0.045, 0.28]]) {
      g.beginPath();
      g.moveTo(0, yAt(0));
      for (let x = 0; x <= W; x += 8) g.lineTo(x, yAt(x));
      for (let x = W; x >= 0; x -= 8) g.lineTo(x, yAt(x) + H * bh);
      g.closePath();
      g.fillStyle = `rgba(${INK},${(rg.alpha * ba).toFixed(3)})`;
      g.fill();
    }
    /* 갈필 — 능선 위 마른 붓 자국 */
    g.lineWidth = 1.3;
    g.beginPath();
    let penDown = false;
    for (let x = 0; x <= W; x += 7) {
      const y = yAt(x);
      if (rg.detail((x + off) * 1.7) > 0.42) {
        penDown ? g.lineTo(x, y - 1) : g.moveTo(x, y - 1);
        penDown = true;
      } else penDown = false;
    }
    g.strokeStyle = `rgba(${INK},${rg.alpha * 1.7})`;
    g.stroke();
  }
  /* 산 픽셀에만 먹 얼룩 */
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = landPattern;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(landCv, 0, 0, W, H);
}

let W = 0, H = 0, DPR = 1;
function resize() {
  measure();
  const dpr = Math.min(devicePixelRatio || 1, lowFX ? 1.5 : 2);   // 모바일은 1.5로 캡 — 수묵 워시라 화질 차이 없음
  const w = stageCv.clientWidth, h = stageCv.clientHeight;
  /* 모바일 주소창 접힘/펼침 resize — 캔버스 크기가 그대로면 재빌드하지 않는다 (스크롤 중 히치 방지) */
  if (w === W && h === H && dpr === DPR && sunCv) return;
  DPR = dpr; W = w; H = h;
  stageCv.width = W * DPR; stageCv.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildSun();
  lastLandCam = -1e9;
  needsDraw = true;
  if (typeof wake === 'function') wake();
}
addEventListener('resize', resize, { passive: true });

/* 챕터 로컬 진행률: p(0~1) → 챕터 i 중심 기준 t */
const chLocal = (p, i) => p * N_CH - (i + 0.5);

function drawScene(p, time) {
  ctx.clearRect(0, 0, W, H);
  const cam = p * W * (N_CH - 1);

  /* 먹의 온도 — 여명(주홍 기운) → 낮 → 담묵 저녁 */
  const dawn = clamp(1 - p * 3, 0, 1);
  if (dawn > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(${SEAL},${0.05 * dawn})`);
    g.addColorStop(1, 'rgba(154,51,36,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  /* 해 — 주묵으로 찍은 원 (오프스크린 캐시) */
  const sx = W * 0.5 - cam * 0.18;
  const sy = H * (0.42 - p * 0.20) + Math.sin(time * 0.4) * 2;
  const sunA = clamp(1.15 - p * 1.35, 0, 1);
  if (sunA > 0.01) {
    const r = Math.min(W, H) * 0.075;
    const halo = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 2.9);
    halo.addColorStop(0, `rgba(${SEAL},${0.16 * sunA})`);
    halo.addColorStop(0.55, `rgba(${SEAL},${0.07 * sunA})`);
    halo.addColorStop(1, 'rgba(154,51,36,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(sx, sy, r * 2.9, 0, 7); ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.88 * sunA;
    ctx.drawImage(sunCv, sx - sunSize / 2, sy - sunSize / 2, sunSize, sunSize);
    ctx.restore();

    /* 불씨 — 해에서 피어오르는 잔불 (불의 장에서만) */
    const fireA = clamp(1 - Math.abs(chLocal(p, 0)) / 0.5, 0, 1);
    if (fireA > 0.01 && !reduceMotion) {
      for (const e of EMBERS) {
        const life = (time * e.speed + e.phase) % 1;
        const ex = sx + e.ox * r * 1.6 + Math.sin(time * 1.3 + e.phase * 9) * e.wob;
        const ey = sy - r * 0.4 - life * H * 0.24;
        const a = (1 - life) * 0.5 * fireA * sunA;
        if (a <= 0.01) continue;
        ctx.fillStyle = `rgba(${SEAL},${a})`;
        ctx.beginPath(); ctx.arc(ex, ey, e.size * (1 - life * 0.5), 0, 7); ctx.fill();
      }
    }
  }

  /* 빛살 — 3번째 장(빛) */
  const tLight = chLocal(p, 2);
  const lightA = clamp(1 - Math.abs(tLight) / 0.5, 0, 1);
  if (lightA > 0.01) {
    ctx.save();
    ctx.fillStyle = `rgb(${INK})`;
    for (let k = 0; k < 5; k++) {
      const sway = Math.sin(time * 0.5 + k * 1.7) * W * 0.008;
      const bx = W * (0.18 + k * 0.16) - tLight * W * 0.3 + sway;
      ctx.globalAlpha = 0.055 * smooth(lightA) * (0.75 + 0.25 * Math.sin(time * 0.8 + k * 2.4));
      ctx.beginPath();
      ctx.moveTo(bx, -10);
      ctx.lineTo(bx + W * 0.05, -10);
      ctx.lineTo(bx + W * 0.16, H * 0.8);
      ctx.lineTo(bx + W * 0.10, H * 0.8);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* 능선 3겹 — 오프스크린에서 크레스트 밴드·먹 얼룩 텍스처까지 입혀 합성 */
  drawLand(cam);

  /* 골안개 — 능선 사이를 떠도는 흰 띠 */
  if (!reduceMotion) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let m = 0; m < 3; m++) {
      const mx = ((time * 9 + m * W * 0.45 - cam * 0.1) % (W * 1.6)) - W * 0.3;
      const my = H * (0.55 + m * 0.1);
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, W * 0.28);
      g.addColorStop(0, 'rgba(239,234,224,0.10)');
      g.addColorStop(1, 'rgba(239,234,224,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(mx, my, W * 0.28, H * 0.06, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  /* 강물 — 2번째 장(물), 흐르는 결 + 해의 물그림자 */
  const tWater = chLocal(p, 1);
  const waterA = clamp(1 - Math.abs(tWater) / 0.55, 0, 1);
  if (waterA > 0.01) {
    ctx.save();
    for (let row = 0; row < 4; row++) {
      const y0 = H * (0.82 + row * 0.045);
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 6) {
        const y = y0 + Math.sin((x + cam * 0.9) / 46 + row * 2.1 + time * 1.4) * 3.2;
        x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.globalAlpha = (1 - row * 0.2) * smooth(waterA);
      ctx.strokeStyle = `rgba(${INK},0.28)`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    /* 물그림자 — 지는 해가 강에 어린다 */
    if (sunA > 0.02) {
      const g = ctx.createLinearGradient(0, H * 0.8, 0, H);
      g.addColorStop(0, `rgba(${SEAL},${0.10 * sunA * smooth(waterA)})`);
      g.addColorStop(1, 'rgba(154,51,36,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(sx - W * 0.06, H * 0.8, W * 0.12, H * 0.2);
    }
    ctx.restore();
  }

  /* 바위 — 4번째 장(돌), 먹 윤곽선을 두른 괴석 */
  const tStone = chLocal(p, 3);
  const stoneA = clamp(1 - Math.abs(tStone) / 0.5, 0, 1);
  if (stoneA > 0.01) {
    ctx.save();
    ctx.globalAlpha = smooth(stoneA);
    const bx = W * 0.5 - tStone * W * 0.9;
    for (const [dx, ry, rw, rh, a] of [[-0.26, 0.86, 0.09, 0.05, 0.22], [0.24, 0.83, 0.13, 0.075, 0.28], [0.05, 0.88, 0.06, 0.035, 0.18]]) {
      ctx.fillStyle = `rgba(${INK},${a})`;
      ctx.beginPath();
      ctx.ellipse(bx + dx * W, H * ry, W * rw, H * rh, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = `rgba(${INK},${a * 1.7})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(bx + dx * W, H * ry, W * rw, H * rh, 0, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 학(鶴) — 5번째 장(숨), 날갯짓하는 새 + 바람 획 */
  const tWind = chLocal(p, 4);
  const windA = clamp(1 - Math.abs(tWind) / 0.55, 0, 1);
  if (windA > 0.01) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const [fx, fy, s, ph] of [[0.30, 0.24, 1, 0], [0.42, 0.31, 0.7, 2.1], [0.55, 0.20, 0.85, 4.2]]) {
      const bx = W * fx - tWind * W * 0.55 + Math.sin(time * 0.3 + ph) * 6;
      const by = H * fy + Math.sin(time * 0.7 + ph) * 7;
      const w = 13 * s;
      const flap = 0.45 + 0.55 * Math.abs(Math.sin(time * 2.2 + ph));   // 날갯짓
      ctx.strokeStyle = `rgba(${INK},${0.55 * smooth(windA)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx - w, by);
      ctx.quadraticCurveTo(bx - w * 0.4, by - w * flap, bx, by);
      ctx.quadraticCurveTo(bx + w * 0.4, by - w * flap, bx + w, by);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(${INK},${0.14 * smooth(windA)})`;
    ctx.lineWidth = 1.1;
    for (let row = 0; row < 3; row++) {
      const y0 = H * (0.36 + row * 0.09);
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 8) {
        const y = y0 + Math.sin((x + cam) / 90 + row * 3 + time * 0.9) * 6;
        x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 엔소(圓相) — 마지막 장(결), 한 획이 원을 이룬다 */
  const tEnd = chLocal(p, 5);
  const endA = clamp(1 - Math.abs(tEnd) / 0.55, 0, 1);
  if (endA > 0.01) {
    const sweep = clamp((tEnd + 0.5) / 0.72, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.10 * smooth(endA);
    ctx.strokeStyle = `rgb(${INK})`;
    ctx.lineWidth = Math.min(W, H) * 0.028;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.44, Math.min(W, H) * 0.34, -Math.PI * 0.62, -Math.PI * 0.62 + Math.PI * 1.92 * smooth(sweep));
    ctx.stroke();
    ctx.restore();
  }

  /* 안개 — 하단 상시 */
  const mist = ctx.createLinearGradient(0, H * 0.7, 0, H);
  mist.addColorStop(0, 'rgba(231,226,214,0)');
  mist.addColorStop(1, 'rgba(231,226,214,0.85)');
  ctx.fillStyle = mist; ctx.fillRect(0, H * 0.7, W, H * 0.3);
}

/* 챕터 오버레이 — 자모가 모여 글자로 스미고, 낙관이 찍힌다 */
function layoutChapters(p) {
  chapters.forEach((el, i) => {
    const t = chLocal(p, i);
    const a = clamp(1 - Math.abs(t) / 0.42, 0, 1);
    if (a <= 0) { el.style.visibility = 'hidden'; el.style.opacity = 0; return; }
    el.style.visibility = 'visible';
    el.style.opacity = smooth(a);
    el.style.transform = `translate(-50%,-50%) translateX(${(-t * 130).toFixed(1)}px)`;

    const arrive = clamp(1 - Math.abs(t) / 0.2, 0, 1);
    const word = el.querySelector('.ch-word');
    /* 잉크 스밈 — 도착할수록 번짐(displacement)이 잦아들며 글자가 마른다 */
    if (lowFX) {
      if (word.style.filter) word.style.filter = '';   // 모바일: 매 프레임 SVG 필터 재계산이 최악의 잭 — 생략
    } else if (arrive > 0 && arrive < 0.97) {
      inkSpreadMap.setAttribute('scale', ((1 - smooth(arrive)) * 55).toFixed(1));
      word.style.filter = `url(#inkSpread) blur(${((1 - smooth(arrive)) * 5).toFixed(2)}px)`;
    } else {
      word.style.filter = arrive >= 0.97 ? '' : `blur(${((1 - smooth(arrive)) * 7).toFixed(2)}px)`;
    }
    word.style.transform = `scale(${lerp(0.82, 1, smooth(arrive)).toFixed(3)})`;

    const jamo = el.querySelectorAll('.ch-jamo span');
    const spread = (1 - smooth(arrive)) * 34 + 10;
    jamo.forEach((s, k) => {
      s.style.transform = `translateX(${((k - 1) * spread - (k - 1) * 10).toFixed(1)}px)`;
      s.style.opacity = lerp(0.9, 0.4, smooth(arrive)).toFixed(2);
    });

    /* 시행 — 한 행씩 스민다 (현재 언어의 행만) */
    let k = 0;
    el.querySelectorAll('.ch-poem .line').forEach(ln => {
      if (ln.offsetParent === null) return;   // 숨은 언어의 행 (display:none)
      const la = clamp((arrive - k * 0.18) / 0.5, 0, 1);
      ln.style.opacity = smooth(la).toFixed(2);
      ln.style.transform = `translateY(${((1 - smooth(la)) * 12).toFixed(1)}px)`;
      k++;
    });

    /* 낙관 날인 — 중심에 닿으면 쾅 */
    const stamp = el.querySelector('.ch-stamp');
    const st = clamp((arrive - 0.55) / 0.45, 0, 1);
    stamp.style.opacity = st.toFixed(2);
    stamp.style.transform = `rotate(-3deg) scale(${lerp(2.1, 1, smooth(st)).toFixed(3)})`;
  });

  jpDots.forEach((d, i) => d.classList.toggle('on', p * N_CH > i + 0.42));
}

/* 낙관 도장 → 해당 장으로 이동 */
jpDots.forEach(d => d.addEventListener('click', () => {
  const i = +d.dataset.i;
  scrollTo({ top: journeyTop + journeyTotal * ((i + 0.5) / N_CH), behavior: 'smooth' });
}));

/* ── 관성 스크럽 + 살아있는 캔버스 루프 ── */
let targetP = 0, curP = 0, needsDraw = true, rafId = null, stageVisible = false;

/* 레이아웃 치수는 resize 때만 측정 — 스크롤 핸들러에서 offsetHeight/scrollHeight 읽기 금지 */
let journeyTop = 0, journeyTotal = 1, docScrollable = 1;
function measure() {
  journeyTop = journey.offsetTop;
  journeyTotal = Math.max(1, journey.offsetHeight - innerHeight);
  docScrollable = Math.max(1, document.body.scrollHeight - innerHeight);
}
function computeTarget() {
  targetP = clamp((scrollY - journeyTop) / journeyTotal, 0, 1);
}
function tick(now) {
  rafId = null;
  const time = now / 1000;
  curP += (targetP - curP) * (reduceMotion ? 1 : 0.11);
  if (Math.abs(targetP - curP) < 0.0003) curP = targetP;
  drawScene(curP, time);
  layoutChapters(curP);
  needsDraw = false;
  /* 시간 기반 연출이 있는 한 살아 움직인다 (reduce-motion 은 정지화) */
  if (stageVisible && (!reduceMotion || Math.abs(targetP - curP) > 0.0003 || needsDraw)) {
    rafId = requestAnimationFrame(tick);
  }
}
function wake() { if (!rafId) rafId = requestAnimationFrame(tick); }

new IntersectionObserver(es => {
  stageVisible = es[0].isIntersecting;
  if (stageVisible) wake();
}, { threshold: 0 }).observe(stage);

addEventListener('scroll', () => {
  computeTarget();
  nav.classList.toggle('scrolled', scrollY > 40);
  navProgress.style.width = (scrollY / docScrollable * 100).toFixed(2) + '%';
  wake();
}, { passive: true });

/* ══════════════ 2. 내비 & 리빌 & 붓 궤적 ══════════════ */
const nav = document.getElementById('nav');
const navProgress = document.getElementById('navProgress');

/* 언어 토글 — EN ↔ KO */
const langToggle = document.getElementById('langToggle');
function setLang(lang) {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  try { localStorage.setItem('kyul-lang', lang); } catch (e) {}
}
setLang((() => {
  try { const s = localStorage.getItem('kyul-lang'); if (s === 'ko' || s === 'en') return s; } catch (e) {}
  return (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
})());
langToggle.addEventListener('click', () => {
  setLang(document.documentElement.dataset.lang === 'en' ? 'ko' : 'en');
});

/* 스토어 감지 — 기기에 맞는 다운로드 버튼 (iOS 미출시: iOS 기기엔 Play 버튼 대신 '준비 중') */
const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
document.documentElement.dataset.store = isIOS ? 'ios' : /Android/i.test(ua) ? 'android' : 'other';

const io = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
/* 형제 리빌 스태거 */
document.querySelectorAll('.pillars,.world-grid').forEach(group => {
  [...group.children].forEach((el, i) => el.style.setProperty('--rd', (i * 0.07) + 's'));
});

/* 히어로 패럴랙스 + 붓끝 자국 */
const hero = document.querySelector('.hero');
const heroMtn = document.querySelector('.hero-mtn');
const heroLogo = document.querySelector('.hero-logo');
let lastDot = { x: -99, y: -99 };
if (!reduceMotion) {
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;   // 터치 스크롤 중 먹 자국·패럴랙스 갱신 금지 (잭 유발)
    if (scrollY > innerHeight) return;
    const dx = (e.clientX / innerWidth - 0.5), dy = (e.clientY / innerHeight - 0.5);
    heroMtn.style.transform = `translate(${dx * -16}px, ${dy * -6}px)`;
    heroLogo.style.translate = `${dx * 8}px ${dy * 6}px`;
    /* 일정 거리마다 먹 자국 하나 */
    const d = Math.hypot(e.clientX - lastDot.x, e.clientY - lastDot.y);
    if (d > 34 && e.target.closest('.hero')) {
      lastDot = { x: e.clientX, y: e.clientY };
      const s = 8 + Math.min(d - 34, 30) * 0.5;
      const dot = document.createElement('span');
      dot.className = 'ink-dot';
      dot.style.cssText = `left:${e.clientX}px; top:${e.clientY}px; width:${s}px; height:${s}px`;
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 1050);
    }
  }, { passive: true });
}

/* 먹 파문 — 클릭 지점에 번진다 */
addEventListener('pointerdown', e => {
  if (e.target.closest('a,button,.dcell')) return;
  const r = document.createElement('span');
  r.className = 'ink-ripple';
  r.style.cssText = `left:${e.clientX}px; top:${e.clientY}px; width:90px; height:90px`;
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 750);
}, { passive: true });

/* ══════════════ 3. 세계 그리드 ══════════════ */
const WORLDS = [
  { w: '불', en: 'Fire', g: '☲ 리(離)', d: 'Dawn — the first spark sears the darkness', ko: '여명 — 첫 불씨가 어둠을 사른다' },
  { w: '물', en: 'Water', g: '☵ 감(坎)', d: 'Rivers flow and mist rises', ko: '강이 흐르고 안개가 피어난다' },
  { w: '빛', en: 'Light', g: '☰ 건(乾)', d: 'The sky opens; rays pour down', ko: '하늘이 트이고 빛살이 내린다' },
  { w: '돌', en: 'Stone', g: '☶ 간(艮)', d: 'Mountains rise; rocks settle in place', ko: '산이 솟고 바위가 자리 잡는다' },
  { w: '붓', en: 'Brush', g: '人 사람', d: 'A human lifts the brush and draws the world', ko: '사람이 붓을 들어 세상을 긋는다' },
  { w: '길', en: 'Road', g: '☷ 곤(坤)', d: 'Paths reach out and join one another', ko: '오솔길이 서로를 잇는다' },
  { w: '숨', en: 'Breath', g: '☴ 손(巽)', d: 'Wind blows; all things breathe', ko: '바람이 불고 만물이 숨 쉰다' },
  { w: '못', en: 'Pond', g: '☱ 태(兌)', d: 'Ripples spread across still water', ko: '고요한 수면에 파문이 번진다' },
  { w: '울', en: 'Thunder', g: '☳ 진(震)', d: 'Thunder shakes the open sky', ko: '우레가 하늘을 울린다' },
  { w: '씨', en: 'Seed', g: '種 씨앗', d: 'Life is sown deep into the soil', ko: '흙 속에 생명이 심긴다' },
  { w: '싹', en: 'Sprout', g: '芽 새싹', d: 'The sleeping seed opens its eyes', ko: '잠든 씨앗이 눈을 뜬다' },
  { w: '눈', en: 'Snow · Eye', g: '雪 · 目', d: 'One letter, two meanings — cover, or awaken', ko: '한 글자 두 뜻 — 덮거나, 뜨거나' },
  { w: '끝', en: 'End', g: '循 순환', d: 'The end returns to the beginning — coming soon', ko: '끝은 다시 처음으로 — 준비 중', soon: true },
  { w: '꿈', en: 'Dream', g: '夢 꿈', d: 'A night of moon, stars and clouds — coming soon', ko: '달과 별과 구름의 밤 — 준비 중', soon: true },
  { w: '결', en: 'Kyul', g: '結 맺음', d: 'The last word is this very name — coming soon', ko: '마지막 단어는, 이 이름 — 준비 중', soon: true },
];
document.getElementById('worldGrid').innerHTML = WORLDS.map((o, i) => `
  <div class="wcard${o.soon ? ' locked' : ''} reveal">
    ${o.soon ? '<span class="w-soon"><span class="l-en">soon</span><span class="l-ko">근일</span></span>' : ''}
    <p class="w-no"><span class="l-en">World ${i + 1}</span><span class="l-ko">제${i + 1}계</span></p>
    <p class="w-gua">${o.g}</p>
    <p class="w-word">${o.w}</p>
    <p class="w-en l-en">${o.en}</p>
    <p class="w-desc"><span class="l-en">${o.d}</span><span class="l-ko">${o.ko}</span></p>
  </div>`).join('');
document.querySelectorAll('.world-grid .reveal').forEach((el, i) => {
  el.style.setProperty('--rd', (i % 6) * 0.06 + 's');
  io.observe(el);
});

/* ══════════════ 4. 놀이법 데모 — 드래그로 긋기 ══════════════ */
/* 4×4 판 — 물(세로)·불(가로) + 노이즈 3 */
const LAYOUT = [
  ['ㅁ', null, 'ㄱ', null],
  ['ㅜ', null, null, 'ㅅ'],
  ['ㄹ', null, 'ㄷ', null],
  ['ㅂ', 'ㅜ', 'ㄹ', null],
];
const WORD_DEFS = {
  'ㅁㅜㄹ': { syll: '물', meaning: '<span class="l-en">water 水 — washes away the noise beside it</span><span class="l-ko">물 수(水) — 곁의 노이즈를 씻어냅니다</span>', extra: [[0, 2]] },
  'ㅂㅜㄹ': { syll: '불', meaning: '<span class="l-en">fire 火 — burns the remaining noise</span><span class="l-ko">불 화(火) — 남은 노이즈를 태웁니다</span>', extra: [[1, 3], [2, 2]] },
};

const board = document.getElementById('demoBoard');
const pathEl = document.getElementById('demoPath');
const meanEl = document.getElementById('demoMeaning');
const clearEl = document.getElementById('demoClear');

let cells = [], sel = [], burned = new Set(), busy = false, dragging = false;

function buildBoard() {
  board.innerHTML = ''; cells = []; sel = []; burned = new Set(); busy = false; dragging = false;
  clearEl.hidden = true;
  LAYOUT.forEach((row, r) => row.forEach((ch, c) => {
    const d = document.createElement('div');
    d.className = ch ? 'dcell glyph' : 'dcell';
    if (ch) {
      d.textContent = ch;
      d.dataset.ch = ch;
      d.dataset.r = r; d.dataset.c = c;
      d.setAttribute('role', 'button');
      d.setAttribute('tabindex', '0');
      d.setAttribute('aria-label', `자모 ${ch}`);
      d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addCell(r, c); } });
    }
    board.appendChild(d);
    cells.push(d);
  }));
  updateComposer();
}
const cellAt = (r, c) => cells[r * 4 + c];
const key = (r, c) => r + ',' + c;

/* 탭·드래그 공용 — 한 칸을 경로에 더한다 */
function addCell(r, c, fromMove) {
  if (busy || burned.has(key(r, c))) return;
  const idx = sel.findIndex(s => s.r === r && s.c === c);
  if (idx >= 0) {                                   // 이미 지난 칸 → 거기까지 되돌림
    if (idx === sel.length - 1) return;
    sel = sel.slice(0, idx + 1);
    return render();
  }
  const ok = sel.length === 0 || isLineExtension(r, c);
  if (!ok) {
    if (fromMove) return;                           // 드래그 이동 중 비인접 칸은 무시
    sel = [{ r, c }];                               // 탭·새 드래그 시작 → 경로 재시작
    return render();
  }
  sel.push({ r, c });
  render();

  const word = sel.map(s => cellAt(s.r, s.c).dataset.ch).join('');
  if (WORD_DEFS[word]) { dragging = false; return complete(WORD_DEFS[word]); }
  if (sel.length >= 3 && !dragging) failPath();     // 탭 모드: 3자 즉시 판정
}
function failPath() {
  sel.forEach(s => cellAt(s.r, s.c).classList.add('shake'));
  setTimeout(() => { cells.forEach(x => x.classList.remove('shake')); sel = []; render(); }, 330);
}
function isLineExtension(r, c) {
  const last = sel[sel.length - 1];
  const adj = Math.abs(last.r - r) + Math.abs(last.c - c) === 1;
  if (!adj) return false;
  if (sel.length === 1) return true;
  const dr = sel[1].r - sel[0].r, dc = sel[1].c - sel[0].c;
  return r - last.r === dr && c - last.c === dc;
}

/* 드래그로 긋기 */
board.addEventListener('pointerdown', e => {
  const d = e.target.closest('.dcell.glyph');
  if (!d || busy) return;
  dragging = true;
  addCell(+d.dataset.r, +d.dataset.c);
});
board.addEventListener('pointermove', e => {
  if (!dragging || busy) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const d = el && el.closest('.dcell.glyph');
  if (d) addCell(+d.dataset.r, +d.dataset.c, true);
});
addEventListener('pointerup', () => {
  if (!dragging) return;
  dragging = false;
  if (busy) return;
  if (sel.length >= 3) failPath();                  // 드래그를 놓았는데 단어가 아니면 판정
});

function render() {
  cells.forEach(d => { d.classList.remove('sel'); const o = d.querySelector('.ord'); if (o) o.remove(); });
  sel.forEach((s, i) => {
    const d = cellAt(s.r, s.c);
    d.classList.add('sel');
    const o = document.createElement('span');
    o.className = 'ord'; o.textContent = i + 1;
    d.appendChild(o);
  });
  updateComposer();
}
function updateComposer(msg) {
  if (sel.length === 0) {
    pathEl.textContent = '· · ·'; pathEl.classList.add('empty');
  } else {
    pathEl.textContent = sel.map(s => cellAt(s.r, s.c).dataset.ch).join(' · ');
    pathEl.classList.remove('empty');
  }
  meanEl.textContent = msg || ' ';
}
function complete(word) {
  busy = true;
  pathEl.textContent = word.syll;
  pathEl.classList.remove('empty');
  meanEl.innerHTML = word.meaning;
  const targets = [...sel.map(s => [s.r, s.c]), ...word.extra.filter(([r, c]) => !burned.has(key(r, c)))];
  targets.forEach(([r, c], i) => setTimeout(() => {
    burned.add(key(r, c));
    const d = cellAt(r, c);
    d.classList.remove('sel', 'glyph');
    const o = d.querySelector('.ord'); if (o) o.remove();
    d.classList.add('ink');
    d.removeAttribute('tabindex');
    splatter(d);
  }, 160 + i * 130));
  setTimeout(() => {
    sel = []; busy = false;
    const total = LAYOUT.flat().filter(Boolean).length;
    if (burned.size >= total) { clearEl.hidden = false; }
    else render();
  }, 160 + targets.length * 130 + 450);
}
/* 먹 튐 — 타는 칸 둘레로 잔먹이 튄다 */
function splatter(cell) {
  if (reduceMotion) return;
  const frame = cell.closest('.demo-board-frame');
  const fb = frame.getBoundingClientRect(), cb = cell.getBoundingClientRect();
  const cx = cb.left - fb.left + cb.width / 2, cy = cb.top - fb.top + cb.height / 2;
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('span');
    s.className = 'ink-splat';
    const ang = Math.random() * Math.PI * 2, dist = 24 + Math.random() * 34;
    const size = 4 + Math.random() * 9;
    s.style.cssText = `left:${cx}px; top:${cy}px; width:${size}px; height:${size}px;
      border-radius:${40 + Math.random() * 20}% ${40 + Math.random() * 20}% ${40 + Math.random() * 20}% ${40 + Math.random() * 20}%;
      --sx:${Math.cos(ang) * dist}px; --sy:${Math.sin(ang) * dist}px`;
    frame.appendChild(s);
    setTimeout(() => s.remove(), 650);
  }
}
document.getElementById('demoReset').addEventListener('click', buildBoard);
document.getElementById('demoAgain').addEventListener('click', buildBoard);
buildBoard();

/* 초기 렌더 */
resize();
computeTarget();
wake();
/* 폰트·이미지 로드 후 문서 높이가 바뀔 수 있다 — 치수만 재측정 */
addEventListener('load', () => { measure(); computeTarget(); }, { once: true });
