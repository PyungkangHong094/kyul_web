/* ─────────────────────────────────────────────
   「결」 랜딩 — 인터랙션
   1) 두루마리 스크롤-스크럽 캔버스 (수묵 산수 횡권)
   2) 챕터 오버레이 (자모 → 글자 스밈)
   3) 놀이법 미니 데모 (물·불 두 단어)
   4) 리빌·내비·먹 파문
   ───────────────────────────────────────────── */
'use strict';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ══════════════ 1. 두루마리 캔버스 ══════════════ */
const N_CH = 6;                    // 챕터 수 (불 물 빛 돌 숨 결)
const journey = document.getElementById('journey');
const stageCv = document.getElementById('scrollCanvas');
const ctx = stageCv.getContext('2d');
const chapters = [...document.querySelectorAll('.chapter')];
const journeyBar = document.getElementById('journeyBar');

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
function makeRidge(seed, step, amp) {
  const rnd = seeded(seed);
  const pts = Array.from({ length: 220 }, () => rnd());
  return x => {
    const i = Math.floor(x / step), t = (x / step) - i;
    const a = pts[((i % pts.length) + pts.length) % pts.length];
    const b = pts[(((i + 1) % pts.length) + pts.length) % pts.length];
    return lerp(a, b, (1 - Math.cos(t * Math.PI)) / 2) * amp;
  };
}
const ridges = [
  { f: makeRidge(11, 340, 1), par: 0.22, base: 0.52, amp: 0.16, alpha: 0.07 },  // 원산(遠山)
  { f: makeRidge(47, 260, 1), par: 0.45, base: 0.62, amp: 0.20, alpha: 0.11 },
  { f: makeRidge(83, 210, 1), par: 0.85, base: 0.74, amp: 0.24, alpha: 0.17 },  // 근산(近山)
];

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = stageCv.clientWidth; H = stageCv.clientHeight;
  stageCv.width = W * DPR; stageCv.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawn = -1; // 강제 다시 그리기
}
addEventListener('resize', resize, { passive: true });

/* 챕터 로컬 진행률: p(0~1) → 챕터 i 중심 기준 t(-0.5~0.5) */
const chLocal = (p, i) => p * N_CH - (i + 0.5);

function drawScene(p) {
  ctx.clearRect(0, 0, W, H);
  const cam = p * W * (N_CH - 1);           // 카메라 x (가상 세계 폭 = N_CH 화면)

  /* 먹의 온도 — 여명(주홍 기운) → 낮 → 담묵 저녁 */
  const dawn = clamp(1 - p * 3, 0, 1);
  if (dawn > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(${SEAL},${0.05 * dawn})`);
    g.addColorStop(1, 'rgba(154,51,36,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  /* 해 — 불의 장에서 낮게 떠올라 여정 내내 흐른다 */
  const sunWX = W * 0.5;                     // 세계 좌표 (불 챕터 부근)
  const sx = sunWX - cam * 0.18;
  const sy = H * (0.42 - p * 0.20);
  const sunA = clamp(1.15 - p * 1.35, 0, 1);
  if (sunA > 0.01) {
    const r = Math.min(W, H) * 0.075;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.6);
    g.addColorStop(0, `rgba(${SEAL},${0.5 * sunA})`);
    g.addColorStop(0.45, `rgba(${SEAL},${0.32 * sunA})`);
    g.addColorStop(1, 'rgba(154,51,36,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, r * 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(${SEAL},${0.55 * sunA})`;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
  }

  /* 빛살 — 3번째 장(빛)에서 하늘로부터 */
  const tLight = chLocal(p, 2);
  const lightA = clamp(1 - Math.abs(tLight) / 0.5, 0, 1);
  if (lightA > 0.01) {
    ctx.save();
    ctx.globalAlpha = 0.06 * smooth(lightA);
    ctx.fillStyle = `rgb(${INK})`;
    for (let k = 0; k < 5; k++) {
      const bx = W * (0.18 + k * 0.16) - tLight * W * 0.3;
      ctx.beginPath();
      ctx.moveTo(bx, -10);
      ctx.lineTo(bx + W * 0.05, -10);
      ctx.lineTo(bx + W * 0.16, H * 0.8);
      ctx.lineTo(bx + W * 0.10, H * 0.8);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* 능선 3겹 — 시차(패럴랙스) */
  for (const rg of ridges) {
    const off = cam * rg.par;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const y = H * rg.base - rg.f(x + off) * H * rg.amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = `rgba(${INK},${rg.alpha})`;
    ctx.fill();
  }

  /* 강물 — 2번째 장(물) 하단에 흐르는 결 */
  const tWater = chLocal(p, 1);
  const waterA = clamp(1 - Math.abs(tWater) / 0.55, 0, 1);
  if (waterA > 0.01) {
    ctx.save();
    ctx.strokeStyle = `rgba(${INK},${0.28 * smooth(waterA)})`;
    ctx.lineWidth = 1.4;
    for (let row = 0; row < 4; row++) {
      const y0 = H * (0.82 + row * 0.045);
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 6) {
        const y = y0 + Math.sin((x + cam * 0.9) / 46 + row * 2.1) * 3.2;
        x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 1 - row * 0.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 바위 — 4번째 장(돌) */
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
    }
    ctx.restore();
  }

  /* 학(鶴) — 5번째 장(숨), 바람 따라 나는 새 */
  const tWind = chLocal(p, 4);
  const windA = clamp(1 - Math.abs(tWind) / 0.55, 0, 1);
  if (windA > 0.01) {
    ctx.save();
    ctx.strokeStyle = `rgba(${INK},${0.55 * smooth(windA)})`;
    ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (const [fx, fy, s] of [[0.30, 0.24, 1], [0.42, 0.31, 0.7], [0.55, 0.20, 0.85]]) {
      const bx = W * fx - tWind * W * 0.55;
      const by = H * fy + Math.sin(tWind * 9 + fx * 20) * 8;
      const w = 13 * s;
      ctx.beginPath();
      ctx.moveTo(bx - w, by);
      ctx.quadraticCurveTo(bx - w * 0.4, by - w * 0.7, bx, by);
      ctx.quadraticCurveTo(bx + w * 0.4, by - w * 0.7, bx + w, by);
      ctx.stroke();
    }
    /* 바람 획 */
    ctx.strokeStyle = `rgba(${INK},${0.14 * smooth(windA)})`;
    ctx.lineWidth = 1.1;
    for (let row = 0; row < 3; row++) {
      const y0 = H * (0.36 + row * 0.09);
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 8) {
        const y = y0 + Math.sin((x + cam) / 90 + row * 3) * 6;
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
    const sweep = clamp((tEnd + 0.5) / 0.72, 0, 1);   // 장 진입부터 획이 그어진다
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

/* 챕터 오버레이 — 자모가 모여 글자로 스민다 */
function layoutChapters(p) {
  chapters.forEach((el, i) => {
    const t = chLocal(p, i);
    const a = clamp(1 - Math.abs(t) / 0.42, 0, 1);
    if (a <= 0) { el.style.visibility = 'hidden'; el.style.opacity = 0; return; }
    el.style.visibility = 'visible';
    el.style.opacity = smooth(a);
    el.style.transform = `translate(-50%,-50%) translateX(${-t * 130}px)`;

    const word = el.querySelector('.ch-word');
    const arrive = clamp(1 - Math.abs(t) / 0.2, 0, 1);   // 중심 근접도
    word.style.filter = `blur(${(1 - smooth(arrive)) * 7}px)`;
    word.style.transform = `scale(${lerp(0.82, 1, smooth(arrive))})`;

    const jamo = el.querySelectorAll('.ch-jamo span');
    const spread = (1 - smooth(arrive)) * 34 + 10;
    jamo.forEach((s, k) => {
      s.style.transform = `translateX(${(k - 1) * spread - (k - 1) * 10}px)`;
      s.style.opacity = lerp(0.9, 0.4, smooth(arrive));
    });
  });
}

let drawn = -1, ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const rect = journey.getBoundingClientRect();
    const total = journey.offsetHeight - innerHeight;
    const p = clamp(-rect.top / total, 0, 1);
    if (Math.abs(p - drawn) < 0.0004) return;
    drawn = p;
    drawScene(p);
    layoutChapters(p);
    journeyBar.style.width = (p * 100).toFixed(2) + '%';
    nav.classList.toggle('scrolled', scrollY > 40);
  });
}
addEventListener('scroll', onScroll, { passive: true });

/* ══════════════ 2. 내비 & 리빌 ══════════════ */
const nav = document.getElementById('nav');

const io = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.18 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* 히어로 패럴랙스 — 마우스 따라 산과 엔소가 미세하게 흐른다 */
const heroMtn = document.querySelector('.hero-mtn');
const heroEnso = document.querySelector('.hero .enso');
if (!reduceMotion) {
  addEventListener('pointermove', e => {
    if (scrollY > innerHeight) return;
    const dx = (e.clientX / innerWidth - 0.5), dy = (e.clientY / innerHeight - 0.5);
    heroMtn.style.transform = `translate(${dx * -16}px, ${dy * -6}px)`;
    heroEnso.style.translate = `${dx * 10}px ${dy * 8}px`;
  }, { passive: true });
}

/* 먹 파문 — 클릭 지점에 번진다 */
addEventListener('pointerdown', e => {
  if (e.target.closest('a,button,.dcell')) return;
  const r = document.createElement('span');
  r.className = 'ink-ripple';
  const size = 90;
  r.style.cssText = `left:${e.clientX}px; top:${e.clientY}px; width:${size}px; height:${size}px`;
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 750);
}, { passive: true });

/* ══════════════ 3. 세계 그리드 ══════════════ */
const WORLDS = [
  { w: '불', g: '☲ 리(離)', d: '여명 — 첫 불씨가 어둠을 사른다' },
  { w: '물', g: '☵ 감(坎)', d: '강이 흐르고 안개가 피어난다' },
  { w: '빛', g: '☰ 건(乾)', d: '하늘이 트이고 빛살이 내린다' },
  { w: '돌', g: '☶ 간(艮)', d: '산이 솟고 바위가 자리 잡는다' },
  { w: '붓', g: '人 사람', d: '사람이 붓을 들어 세상을 긋는다' },
  { w: '길', g: '☷ 곤(坤)', d: '오솔길이 서로를 잇는다' },
  { w: '숨', g: '☴ 손(巽)', d: '바람이 불고 만물이 숨 쉰다' },
  { w: '못', g: '☱ 태(兌)', d: '고요한 수면에 파문이 번진다' },
  { w: '울', g: '☳ 진(震)', d: '우레가 하늘을 울린다' },
  { w: '씨', g: '種 씨앗', d: '흙 속에 생명이 심긴다' },
  { w: '싹', g: '芽 새싹', d: '잠든 씨앗이 눈을 뜬다' },
  { w: '눈', g: '雪 · 目', d: '한 글자 두 뜻 — 덮거나, 뜨거나' },
  { w: '끝', g: '循 순환', d: '끝은 다시 처음으로 — 준비 중', soon: true },
  { w: '꿈', g: '夢 꿈', d: '달과 별과 구름의 밤 — 준비 중', soon: true },
  { w: '결', g: '結 맺음', d: '마지막 단어는, 이 이름 — 준비 중', soon: true },
];
document.getElementById('worldGrid').innerHTML = WORLDS.map(o => `
  <div class="wcard${o.soon ? ' locked' : ''}">
    ${o.soon ? '<span class="w-soon">근일</span>' : ''}
    <p class="w-gua">${o.g}</p>
    <p class="w-word">${o.w}</p>
    <p class="w-desc">${o.d}</p>
  </div>`).join('');

/* ══════════════ 4. 놀이법 데모 ══════════════ */
/* 4×4 판 — 물(세로)·불(가로) + 노이즈 3
   물 완성 → ㄱ을 씻어냄 · 불 완성 → ㅅ·ㄷ을 태움 */
const LAYOUT = [
  ['ㅁ', null, 'ㄱ', null],
  ['ㅜ', null, null, 'ㅅ'],
  ['ㄹ', null, 'ㄷ', null],
  ['ㅂ', 'ㅜ', 'ㄹ', null],
];
const WORDS = {
  'ㅁㅜㄹ': { syll: '물', meaning: '물 수(水) — 곁의 노이즈를 씻어냅니다', extra: [[0, 2]] },
  'ㅂㅜㄹ': { syll: '불', meaning: '불 화(火) — 남은 노이즈를 태웁니다', extra: [[1, 3], [2, 2]] },
};

const board = document.getElementById('demoBoard');
const pathEl = document.getElementById('demoPath');
const meanEl = document.getElementById('demoMeaning');
const clearEl = document.getElementById('demoClear');

let cells = [], sel = [], burned = new Set(), busy = false;

function buildBoard() {
  board.innerHTML = ''; cells = []; sel = []; burned = new Set(); busy = false;
  clearEl.hidden = true;
  LAYOUT.forEach((row, r) => row.forEach((ch, c) => {
    const d = document.createElement('div');
    d.className = ch ? 'dcell glyph' : 'dcell';
    if (ch) {
      d.textContent = ch;
      d.dataset.ch = ch;
      d.dataset.r = r; d.dataset.c = c;
      d.addEventListener('click', () => tap(r, c, d));
    }
    board.appendChild(d);
    cells.push(d);
  }));
  updateComposer();
}
const cellAt = (r, c) => cells[r * 4 + c];
const key = (r, c) => r + ',' + c;

function tap(r, c, d) {
  if (busy || burned.has(key(r, c))) return;
  const idx = sel.findIndex(s => s.r === r && s.c === c);
  if (idx >= 0) { sel = sel.slice(0, idx); return render(); }   // 이미 고른 칸 → 거기까지 되돌림

  const ok = sel.length === 0 || isLineExtension(r, c);
  if (!ok) { sel = [{ r, c }]; return render(); }               // 일자가 아니면 새로 시작
  sel.push({ r, c });
  render();

  const word = sel.map(s => cellAt(s.r, s.c).dataset.ch).join('');
  if (WORDS[word]) return complete(WORDS[word]);
  if (sel.length >= 3) {                                        // 3자인데 단어가 아님
    sel.forEach(s => cellAt(s.r, s.c).classList.add('shake'));
    setTimeout(() => { cells.forEach(x => x.classList.remove('shake')); sel = []; render(); }, 330);
  }
}
function isLineExtension(r, c) {
  const last = sel[sel.length - 1];
  const adj = Math.abs(last.r - r) + Math.abs(last.c - c) === 1;
  if (!adj) return false;
  if (sel.length === 1) return true;
  const dr = sel[1].r - sel[0].r, dc = sel[1].c - sel[0].c;     // 기존 방향 유지
  return r - last.r === dr && c - last.c === dc;
}
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
    pathEl.textContent = '· · ·'; pathEl.classList.add('empty');
  } else {
    pathEl.textContent = sel.map(s => cellAt(s.r, s.c).dataset.ch).join(' · ');
    pathEl.classList.remove('empty');
  }
  meanEl.textContent = msg || ' ';
}
function complete(word) {
  busy = true;
  pathEl.textContent = word.syll;
  pathEl.classList.remove('empty');
  meanEl.textContent = word.meaning;
  const targets = [...sel.map(s => [s.r, s.c]), ...word.extra.filter(([r, c]) => !burned.has(key(r, c)))];
  targets.forEach(([r, c], i) => setTimeout(() => {
    burned.add(key(r, c));
    const d = cellAt(r, c);
    d.classList.remove('sel', 'glyph');
    const o = d.querySelector('.ord'); if (o) o.remove();
    d.classList.add('ink');
  }, 160 + i * 130));
  setTimeout(() => {
    sel = []; busy = false;
    const total = LAYOUT.flat().filter(Boolean).length;
    if (burned.size >= total) { clearEl.hidden = false; }
    else updateComposer();
  }, 160 + targets.length * 130 + 450);
}
document.getElementById('demoReset').addEventListener('click', buildBoard);
document.getElementById('demoAgain').addEventListener('click', buildBoard);
buildBoard();

/* 초기 렌더 */
resize();
drawScene(0);
layoutChapters(0);
onScroll();
