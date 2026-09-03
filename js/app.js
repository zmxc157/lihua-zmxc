/* ===================================================
   星辰桑切片站 · 主逻辑
   =================================================== */

let siteConfig = {};
let slices = [];
let currentFilter = '全部';
let searchQuery = '';
let currentPage = 1;
const PAGE_SIZE = 6;

const DARK_MODE_KEY = 'zmxc-dark';

/* ---- 初始化 ---- */
async function initSite() {
  // 初始化樱花飘落
  createSakuraPetals();
  // 加载 zt.ttf 字体（绕过 GitHub 的 octet-stream MIME 限制，Firefox 也能用）
  loadZtFont();
  // 加载配置
  try {
    siteConfig = await loadJSON('_data/config.json');
  } catch(e) {
    siteConfig = getDefaultConfig();
  }
  // 加载切片
  try {
    slices = await loadJSON('_data/slices.json');
  } catch(e) {
    slices = [];
  }
  // 应用站点配置
  applySiteConfig();
  // 渲染分类筛选
  renderFilters();
  // 渲染切片
  renderSlices();
  // 问卷弹窗
  checkModalQuestionnaire();
  // 问卷浮动按钮
  renderQuestionnaireFab();
  // 事件监听
  setupEventListeners();
}

/* ---- 默认配置 ---- */
function getDefaultConfig() {
  return {
    title: '🌸 星辰桑切片站 🌸',
    description: '收录星辰桑的所有可爱切片，愿你喜欢 ✨',
    icon: 'assets/icons/default.svg',
    password: '123456',
    passwordHash: '123456',
    questionnaires: []
  };
}

/* ---- 加载 JSON ---- */
async function loadJSON(url) {
  const r = await fetch(url + '?t=' + Date.now());
  if (!r.ok) throw new Error('fetch failed');
  return r.json();
}

/* ---- 应用站点配置 ---- */
function applySiteConfig() {
  if (siteConfig.title)
    document.getElementById('page-title').textContent = siteConfig.title;
  if (siteConfig.description)
    document.getElementById('hero-desc').textContent = siteConfig.description;
  if (siteConfig.icon) {
    document.getElementById('favicon-link').href = siteConfig.icon;
  }
  if (siteConfig.heroTitle)
    document.getElementById('hero-title').textContent = siteConfig.heroTitle;
}

/* ---- 创建樱花 ---- */
function createSakuraPetals() {
  const container = document.getElementById('sakura-container');
  for (let i = 0; i < 16; i++) {
    const petal = document.createElement('div');
    petal.style.cssText = `
      position:absolute;width:${8+i%4*4}px;height:${6+i%3*3}px;
      background:radial-gradient(ellipse at 40% 30%,rgba(255,200,212,${0.4+i%3*0.15}),rgba(255,179,193,${0.2+i%2*0.1}));
      border-radius:50% 0 50% 0;pointer-events:none;
      left:${i*6.5}%;top:${i*6}%;
      transform:rotate(${i*30}deg);
    `;
    container.appendChild(petal);
  }

  const petals = document.getElementById('falling-petals');
  const count = 20;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'petal';
    p.style.left = (Math.random() * 100) + '%';
    const size = 10 + Math.random() * 10;
    p.style.width = size + 'px';
    p.style.height = (size * 0.7) + 'px';
    p.style.animationDuration = (10 + Math.random() * 8) + 's,' + (3 + Math.random() * 3) + 's';
    p.style.animationDelay = (Math.random() * 12) + 's,0s';
    p.style.opacity = 0.3 + Math.random() * 0.4;
    p.style.filter = 'blur(' + (Math.random() * 0.5) + 'px)';
    petals.appendChild(p);
  }
}

/* ---- 渲染分类筛选 ---- */
function renderFilters() {
  const cats = ['全部', ...new Set(slices.map(s => s.category || '未分类'))];
  const container = document.getElementById('filter-tabs');
  container.innerHTML = '';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-tab' + (cat === currentFilter ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => {
      currentFilter = cat;
      currentPage = 1;
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSlices();
    };
    container.appendChild(btn);
  });
}

/* ---- 计算筛选结果（全局，跨全部切片） ---- */
function getFilteredSlices() {
  const q = searchQuery.toLowerCase().trim();
  return slices.filter(s => {
    const matchCat = currentFilter === '全部' || (s.category || '未分类') === currentFilter;
    const matchSearch = !q || [s.title, s.category, s.author, s.note]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    return matchCat && matchSearch;
  });
}

/* ---- 渲染切片（含翻页，每页 5 个） ---- */
function renderSlices() {
  const grid = document.getElementById('slices-grid');
  const empty = document.getElementById('empty-state');
  const loading = document.getElementById('loading-state');
  const countEl = document.getElementById('result-count');

  loading.style.display = 'none';

  const filtered = getFilteredSlices();
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  countEl.textContent = slices.length > 0
    ? `共 ${slices.length} 个切片${total !== slices.length ? `，匹配 ${total} 个` : ''}`
    : '';

  if (total === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    renderPagination(0);
    return;
  }
  empty.style.display = 'none';

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  grid.innerHTML = pageItems.map((s, i) => `
    <article class="slice-card" style="animation-delay:${i*0.05}s" data-id="${s.id}">
      <div class="slice-cover" style="${s.cover ? `background-image:url('${escAttr(s.cover)}')` : ''}"></div>
      <div class="slice-card-header">
        <span class="slice-category">${escHtml(s.category || '未分类')}</span>
        <span class="slice-date">${s.date || ''}</span>
      </div>
      <div class="slice-card-body">
        <div class="slice-title" onclick="openSliceDetail('${escAttr(s.id)}')">${escHtml(s.title)}</div>
        <div class="slice-author">👤 ${escHtml(s.author || 'admin')}</div>
        ${s.audio
          ? `<audio class="slice-audio" controls src="${escAttr(s.audio)}"><source src="${escAttr(s.audio)}" type="audio/mpeg"></audio>`
          : `<div class="slice-no-audio">🎧 暂无试听音频</div>`
        }
      </div>
      <div class="slice-card-footer">
        <button class="slice-watch-btn" onclick="openExternalLink('${escAttr(s.url)}')">
          🎬 观看切片 →
        </button>
      </div>
    </article>
  `).join('');

  renderPagination(totalPages);
}

/* ---- 翻页控件（用户端） ---- */
function renderPagination(totalPages) {
  const el = document.getElementById('pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const win = getPageWindow(currentPage, totalPages);
  let html = `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goPage(${currentPage - 1})">‹</button>`;
  let prev = 0;
  win.forEach(p => {
    if (p - prev > 1) html += '<span class="page-ellipsis">…</span>';
    html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
    prev = p;
  });
  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goPage(${currentPage + 1})">›</button>`;
  el.innerHTML = html;
}

function getPageWindow(cur, total) {
  const arr = [1, total];
  for (let p = cur - 1; p <= cur + 1; p++) if (p >= 1 && p <= total) arr.push(p);
  return [...new Set(arr)].sort((a, b) => a - b);
}

function goPage(p) {
  if (p < 1) return;
  currentPage = p;
  renderSlices();
  const grid = document.getElementById('slices-grid');
  if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---- 运行时加载 zt.ttf（绕过 MIME 限制） ---- */
async function loadZtFont() {
  const candidates = ['zt.ttf', '../zt.ttf'];
  for (const u of candidates) {
    try {
      const r = await fetch(u, { cache: 'force-cache' });
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      const f = new FontFace('ZTCustom', buf);
      await f.load();
      document.fonts.add(f);
      return;
    } catch (e) { /* 尝试下一个候选路径 */ }
  }
}

/* ---- 切片详情弹窗 ---- */
function openSliceDetail(id) {
  const s = slices.find(x => x.id === id);
  if (!s) return;
  const modal = document.getElementById('detail-modal');
  const cover = document.getElementById('detail-cover');
  if (s.cover) {
    cover.style.backgroundImage = `url('${escAttr(s.cover)}')`;
    cover.style.display = 'block';
  } else {
    cover.style.backgroundImage = '';
    cover.style.display = 'none';
  }
  document.getElementById('detail-title').textContent = s.title;
  const meta = [];
  if (s.category) meta.push('🏷️ ' + s.category);
  if (s.author) meta.push('👤 ' + s.author);
  if (s.date) meta.push('📅 ' + s.date);
  document.getElementById('detail-meta').innerHTML = meta.map(m => `<span class="detail-tag">${escHtml(m)}</span>`).join('');
  document.getElementById('detail-note').textContent = s.note || '（暂无简介）';
  document.getElementById('detail-audio').innerHTML = s.audio
    ? `<audio class="slice-audio" controls src="${escAttr(s.audio)}"><source src="${escAttr(s.audio)}" type="audio/mpeg"></audio>`
    : `<div class="slice-no-audio">🎧 暂无试听音频</div>`;
  document.getElementById('detail-watch').onclick = () => openExternalLink(s.url);
  modal.style.display = 'flex';
}

/* ---- 外部链接提示 ---- */
function openExternalLink(url) {
  if (!url) return;
  const modal = document.getElementById('external-modal');
  const confirmBtn = document.getElementById('external-confirm');
  confirmBtn.href = url;
  modal.style.display = 'flex';
}

function setupEventListeners() {
  // 搜索
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');

  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = searchInput.value;
      currentPage = 1;
      clearBtn.style.display = searchQuery ? 'inline' : 'none';
      renderSlices();
    }, 200);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    currentPage = 1;
    clearBtn.style.display = 'none';
    renderSlices();
  });

  // 问卷弹窗关闭
  document.getElementById('modal-close').onclick = () => {
    document.getElementById('modal-overlay').style.display = 'none';
  };
  document.getElementById('modal-overlay').onclick = (e) => {
    if (e.target === e.currentTarget)
      document.getElementById('modal-overlay').style.display = 'none';
  };

  // 外部链接弹窗关闭
  document.getElementById('external-modal-close').onclick = () => {
    document.getElementById('external-modal').style.display = 'none';
  };
  document.getElementById('external-cancel').onclick = () => {
    document.getElementById('external-modal').style.display = 'none';
  };
  document.getElementById('external-modal').onclick = (e) => {
    if (e.target === e.currentTarget)
      document.getElementById('external-modal').style.display = 'none';
  };

  // 切片详情弹窗
  document.getElementById('detail-modal-close').onclick = () => {
    document.getElementById('detail-modal').style.display = 'none';
  };
  document.getElementById('detail-cancel').onclick = () => {
    document.getElementById('detail-modal').style.display = 'none';
  };
  document.getElementById('detail-modal').onclick = (e) => {
    if (e.target === e.currentTarget)
      document.getElementById('detail-modal').style.display = 'none';
  };

  // 问卷浮动按钮
  const fab = document.getElementById('questionnaire-fab');
  if (fab) {
    fab.onclick = () => {
      const activeQ = getActiveQuestionnaire();
      if (activeQ) openQuestionnaire(activeQ);
    };
  }
}

/* ---- 问卷处理 ---- */
function getActiveQuestionnaire() {
  if (!siteConfig.questionnaires) return null;
  return siteConfig.questionnaires.find(q => q.showFab);
}

function checkModalQuestionnaire() {
  const qList = siteConfig.questionnaires || [];
  const modalQ = qList.find(q => q.position === 'modal');
  if (!modalQ) return;
  if (getStorage('zmxc_modal_' + modalQ.id)) return; // 已弹过
  setTimeout(() => openQuestionnaire(modalQ), 600);
  setStorage('zmxc_modal_' + modalQ.id, '1');
}

function openQuestionnaire(q) {
  if (!q.url) return;
  if (q.position === 'modal') {
    document.getElementById('modal-title').textContent = q.title || '问卷调查';
    document.getElementById('modal-body').textContent = q.description || '请填写以下问卷';
    document.getElementById('modal-link').href = q.url;
    document.getElementById('modal-overlay').style.display = 'flex';
  } else {
    window.open(q.url, '_blank', 'noopener,noreferrer');
  }
}

function renderQuestionnaireFab() {
  const fabQ = siteConfig.questionnaires?.find(q => q.position === 'fab');
  if (!fabQ) return;
  const fab = document.getElementById('questionnaire-fab');
  if (!fab) return;
  fab.style.display = 'flex';
  fab.title = fabQ.title || '问卷';
}

/* ---- 工具函数 ---- */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#x27;');
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;');
}

function setStorage(k, v) {
  try { localStorage.setItem(k, v); } catch(e) {}
}
function getStorage(k) {
  try { return localStorage.getItem(k); } catch(e) { return null; }
}

/* ---- 全局暴露 ---- */
window.openExternalLink = openExternalLink;
window.openSliceDetail = openSliceDetail;
window.escHtml = escHtml;
