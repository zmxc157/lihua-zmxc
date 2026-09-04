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
  // 内嵌问卷（列表顶部/底部位置）
  renderInlineQuestionnaires();
  // 问卷弹窗
  checkModalQuestionnaire();
  // 问卷浮动按钮
  renderQuestionnaireFab();
  // 星辰NEWS 公告（每次访问弹窗，弹出前 1-3s 加载效果）
  initNewsSystem();
  // 事件监听
  setupEventListeners();
}

/* ---- 默认配置 ---- */
function getDefaultConfig() {
  return {
    title: '🌸 星辰桑切片站 🌸',
    description: '收录星辰桑的所有可爱切片，愿你喜欢 ✨',
    icon: 'assets/icons/default.svg',
    nowLoadingImage: '', // 详情加载提示自定义图（PNG URL，留空为 NowLoading 文本；仅 PC 生效）
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
  // 仅动态飘落樱花（不使用静态点缀花瓣）——密度按动漫盛开季效果
  const petals = document.getElementById('falling-petals');
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const count = isMobile ? 30 : 48; // 手机略减以保流畅，PC 满屏花海
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'petal';
    p.style.left = (Math.random() * 100) + '%';
    const size = (isMobile ? 6 : 8) + Math.random() * (isMobile ? 12 : 15); // 大小错落更自然
    p.style.width = size.toFixed(1) + 'px';
    p.style.height = Math.round(size * 0.72) + 'px';
    const fallDur = (isMobile ? 7 : 6.5) + Math.random() * (isMobile ? 7 : 6.5);
    const swayDur = 2.5 + Math.random() * 3.5;
    p.style.animationDuration = fallDur.toFixed(1) + 's,' + swayDur.toFixed(1) + 's';
    p.style.animationDelay = (Math.random() * 14).toFixed(1) + 's,0s';
    p.style.opacity = (0.4 + Math.random() * 0.45).toFixed(2);
    if (i % 3 === 0) p.style.filter = 'blur(' + (Math.random() * 1).toFixed(2) + 'px)'; // 三分之一带轻微景深
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

/* ---- 渲染切片（含翻页，每页 6 个） ---- */
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

/* ---- 切片详情弹窗（加载提示 → 自适应弹窗 + 滚动进度条） ---- */
let detailTimer = null;

function isMobileView() {
  return window.matchMedia('(max-width: 768px)').matches;
}

/* PC：右下角 NowLoading（文本或服务端指定 PNG，循环闪动为写死效果） */
function showNowLoading() {
  const box = document.getElementById('now-loading');
  if (!box) return;
  const img = (siteConfig.nowLoadingImage || '').trim();
  box.textContent = '';
  if (img) {
    const im = document.createElement('img');
    im.className = 'now-loading-img';
    im.src = img;
    im.alt = 'NowLoading';
    im.onerror = () => { box.textContent = 'NowLoading'; }; // 图片失效自动回退文本
    box.appendChild(im);
  } else {
    box.textContent = 'NowLoading';
  }
  box.classList.add('show');
}

function hideNowLoading() {
  const box = document.getElementById('now-loading');
  if (box) box.classList.remove('show');
}

/* 填充弹窗实际内容 */
function fillDetailContent(s) {
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
}

/* 显示弹窗（切到内容态）并校准滚动进度条 */
function showDetailModal() {
  document.getElementById('detail-loading').style.display = 'none';
  document.getElementById('detail-content').style.display = 'block';
  const modal = document.getElementById('detail-modal');
  modal.style.display = 'flex';
  const sc = document.getElementById('detail-scroll');
  sc.scrollTop = 0;
  requestAnimationFrame(updateDetailScroll);
  setTimeout(updateDetailScroll, 350); // 音频等延迟布局后再校准一次
}

function hideDetailModal() {
  const modal = document.getElementById('detail-modal');
  modal.style.display = 'none';
  const sc = document.getElementById('detail-scroll');
  if (sc) sc.scrollTop = 0;
  const bar = document.getElementById('detail-progress-bar');
  if (bar) bar.style.width = '0%';
}

function cancelPendingDetail() {
  if (detailTimer) { clearTimeout(detailTimer); detailTimer = null; }
  hideNowLoading();
}

/* 关闭详情（加载中也会取消定时器） */
function closeDetailModal() {
  cancelPendingDetail();
  hideDetailModal();
}

/* 滚动进度条：内容超高可滚动时显示，随滚动更新百分比 */
function updateDetailScroll() {
  const sc = document.getElementById('detail-scroll');
  const bar = document.getElementById('detail-progress-bar');
  const card = document.querySelector('#detail-modal .modal-card');
  if (!sc || !bar || !card) return;
  const maxScroll = sc.scrollHeight - sc.clientHeight;
  const overflow = maxScroll > 4;
  card.classList.toggle('has-scroll', overflow);
  bar.style.width = overflow ? (sc.scrollTop / maxScroll * 100).toFixed(2) + '%' : '0%';
}

/* 查看切片详情：先出 1-3s 加载提示（PC 右下角 NowLoading / 手机弹窗中央旋转），结束才显示弹窗内容 */
function openSliceDetail(id) {
  const s = slices.find(x => x.id === id);
  if (!s || detailTimer) return; // 加载提示期间忽略重复点击
  hideNowLoading();
  const delay = 1000 + Math.random() * 2000; // 1~3s
  if (isMobileView()) {
    // 手机版：弹窗中央 Windows 11 风格旋转动画 + 正在加载文本
    document.getElementById('detail-content').style.display = 'none';
    document.getElementById('detail-loading').style.display = 'flex';
    document.getElementById('detail-modal').style.display = 'flex';
    detailTimer = setTimeout(() => {
      detailTimer = null;
      fillDetailContent(s);
      showDetailModal();
    }, delay);
  } else {
    // PC 版：右下角 NowLoading（自定义 PNG 或默认同网页字体文本，闪动）
    showNowLoading();
    detailTimer = setTimeout(() => {
      detailTimer = null;
      hideNowLoading();
      fillDetailContent(s);
      showDetailModal();
    }, delay);
  }
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

  // 切片详情弹窗（含加载中取消）
  document.getElementById('detail-modal-close').onclick = closeDetailModal;
  document.getElementById('detail-cancel').onclick = closeDetailModal;
  document.getElementById('detail-modal').onclick = (e) => {
    if (e.target === e.currentTarget) closeDetailModal();
  };
  const detailScroll = document.getElementById('detail-scroll');
  if (detailScroll) detailScroll.addEventListener('scroll', updateDetailScroll, { passive: true });
  // Esc 关闭详情
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('detail-modal').style.display !== 'none') {
      closeDetailModal();
    }
  });

  // 问卷浮动按钮
  const fab = document.getElementById('questionnaire-fab');
  if (fab) {
    fab.onclick = () => {
      const activeQ = getActiveQuestionnaire();
      if (activeQ) openQuestionnaire(activeQ);
    };
  }

  // 星辰NEWS 弹窗关闭
  const newsModalClose = document.getElementById('news-modal-close');
  if (newsModalClose) newsModalClose.onclick = closeNewsModal;
  const newsModalEl = document.getElementById('news-modal');
  if (newsModalEl) {
    newsModalEl.onclick = (e) => {
      if (e.target === e.currentTarget) closeNewsModal();
    };
  }
  // Esc 关闭 NEWS（若开着）
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const nm = document.getElementById('news-modal');
      if (nm && nm.style.display !== 'none') closeNewsModal();
    }
  });
}

/* ---- 星辰NEWS（公告/活动/异常弹窗，每次访问弹出，弹出前 1-3s 加载效果） ---- */
let newsData = null;      // { types:[{key,label}], items:[{id,type,title,date}] }
let newsActiveTab = 'all';
let newsTimer = null;

async function initNewsSystem() {
  try {
    const r = await fetch('_data/news/index.json?t=' + Date.now());
    if (!r.ok) return;
    newsData = await r.json();
  } catch(e) { newsData = null; }
  if (!newsData || !newsData.items || !newsData.items.length) return; // 无公告不打扰
  // 每次访问都弹（刷新也弹）；延迟 1-3s 先展示加载动画再显示内容
  const delay = 1000 + Math.random() * 2000;
  newsTimer = setTimeout(() => {
    newsTimer = null;
    attemptShowNews();
  }, delay);
}

/* 若用户正在看详情/问卷/外链弹窗，等它们关闭后再弹 NEWS，避免叠层遮挡 */
function attemptShowNews() {
  const busy = ['detail-modal', 'external-modal', 'modal-overlay'].some(id => {
    const el = document.getElementById(id);
    return el && el.style.display !== 'none';
  });
  if (busy) {
    newsTimer = setTimeout(attemptShowNews, 700); // 稍后再试
    return;
  }
  showNewsModal();
}

/* 公告弹窗左上角图标：支持 Emoji/文字 或 图片直链 URL；留空用默认 🌸 */
function applyNewsLogo(logo) {
  const el = document.getElementById('news-logo');
  if (!el) return;
  logo = (logo || '').trim();
  if (!logo) { el.textContent = '🌸'; el.classList.remove('is-img'); return; }
  const isUrl = /^(https?:)?\/\//i.test(logo) || /^data:image\//i.test(logo) || /\.(png|jpe?g|gif|webp|svg|ico)(\?.*)?$/i.test(logo);
  if (isUrl) {
    el.innerHTML = '<img src="' + escHtml(logo) + '" alt="NEWS" onerror="this.outerHTML=&quot;🌸&quot;" />';
    el.classList.add('is-img');
  } else {
    el.textContent = logo;
    el.classList.remove('is-img');
  }
}

function showNewsModal() {
  const modal = document.getElementById('news-modal');
  if (!modal) return;
  const loading = document.getElementById('news-loading');
  const main = document.getElementById('news-main');
  if (loading) loading.style.display = 'flex';
  if (main) main.style.display = 'none';
  modal.style.display = 'flex';
  // 加载动画至少展示 1s，再填充内容
  setTimeout(() => {
    if (loading) loading.style.display = 'none';
    if (main) main.style.display = 'block';
    applyNewsLogo(newsData && newsData.logo);
    renderNewsTabs();
    renderNewsList();
    // 默认打开第一条（若有）
    const items = getNewsItems();
    if (items.length) openNewsDetail(items[0].id);
    else document.getElementById('news-detail').innerHTML = '<div class="news-detail-empty">暂无内容 ✨</div>';
  }, 1000);
}

function getNewsItems() {
  if (!newsData) return [];
  const all = newsData.items || [];
  if (newsActiveTab === 'all') return all;
  return all.filter(it => it.type === newsActiveTab);
}

function renderNewsTabs() {
  const box = document.getElementById('news-tabs');
  if (!box) return;
  const types = newsData.types || [];
  const typeLabel = {};
  types.forEach(t => { typeLabel[t.key] = t.label; });
  const typeEmoji = k => (typeLabel[k] || k).replace(/[^\p{Emoji}]/gu, '').trim() || '📌';
  const tabs = [{ key: 'all', label: '✨ 全部' }].concat(types.map(t => ({ key: t.key, label: t.label })));
  box.innerHTML = tabs.map(t => `
    <button type="button" class="news-tab ${newsActiveTab === t.key ? 'active' : ''}" data-k="${escAttr(t.key)}">${escHtml(t.label)}</button>`
  ).join('');
  box.querySelectorAll('.news-tab').forEach(btn => {
    btn.onclick = () => {
      newsActiveTab = btn.getAttribute('data-k');
      renderNewsTabs();
      renderNewsList();
      const items = getNewsItems();
      const detail = document.getElementById('news-detail');
      if (detail) detail.innerHTML = '<div class="news-detail-empty">👈 选择左侧一条消息查看详情</div>';
      if (items.length) openNewsDetail(items[0].id);
    };
  });
}

function renderNewsList() {
  const box = document.getElementById('news-list');
  if (!box) return;
  const items = getNewsItems();
  const types = newsData.types || [];
  const typeLabel = {};
  types.forEach(t => { typeLabel[t.key] = t.label; });
  if (!items.length) {
    box.innerHTML = '<div class="news-list-empty">该分类暂无消息</div>';
    return;
  }
  box.innerHTML = items.map(it => {
    const badge = typeLabel[it.type] || it.type || '📌';
    return `<div class="news-item" data-id="${escAttr(it.id)}" role="button" tabindex="0">
      <span class="news-item-badge">${escHtml(badge)}</span>
      <div class="news-item-main">
        <div class="news-item-title">${escHtml(it.title || '(无标题)')}</div>
        <div class="news-item-date">${escHtml(it.date || '')}</div>
      </div>
    </div>`;
  }).join('');
  box.querySelectorAll('.news-item').forEach(el => {
    el.onclick = () => openNewsDetail(el.getAttribute('data-id'));
    el.onkeydown = (e) => { if (e.key === 'Enter') openNewsDetail(el.getAttribute('data-id')); };
  });
}

async function openNewsDetail(id) {
  const detail = document.getElementById('news-detail');
  if (!detail) return;
  // 高亮当前项
  document.querySelectorAll('#news-list .news-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-id') === id);
  });
  const it = (newsData.items || []).find(x => x.id === id);
  if (!it) return;
  detail.innerHTML = '<div class="news-detail-loading"><div class="win-spinner"></div><p>正在加载正文…</p></div>';
  try {
    const r = await fetch('_data/news/' + encodeURIComponent(id) + '.html?t=' + Date.now());
    if (!r.ok) throw new Error('not found');
    const html = nl2brHtml(await r.text());
    detail.innerHTML = `<div class="news-article">
      <div class="news-article-meta">${escHtml(it.date || '')}</div>
      <h2 class="news-article-title">${escHtml(it.title || '')}</h2>
      <div class="news-article-body">${html}</div>
    </div>`;
  } catch(e) {
    detail.innerHTML = '<div class="news-detail-empty">正文加载失败（_data/news/' + escHtml(id) + '.html 不存在？）</div>';
  }
}

function closeNewsModal() {
  if (newsTimer) { clearTimeout(newsTimer); newsTimer = null; }
  const modal = document.getElementById('news-modal');
  if (modal) modal.style.display = 'none';
}

/* ---- 问卷处理 ---- */
function getActiveQuestionnaire() {
  if (!siteConfig.questionnaires) return null;
  return siteConfig.questionnaires.find(q => q.position === 'fab' || q.showFab);
}

/* 自动弹出：modal 位置的问卷，每天最多自动弹一次（避免骚扰，但关闭浏览器隔天再来会再弹） */
function checkModalQuestionnaire() {
  const qList = siteConfig.questionnaires || [];
  const modalQ = qList.find(q => q.position === 'modal');
  if (!modalQ) return;
  const today = new Date().toISOString().slice(0, 10);
  if (getStorage('zmxc_modal_' + modalQ.id + '_' + today)) return; // 今日已弹过
  setTimeout(() => openQuestionnaire(modalQ), 600);
  setStorage('zmxc_modal_' + modalQ.id + '_' + today, '1');
}

/* 打开问卷：统一弹窗展示（含说明与前往填写按钮） */
function openQuestionnaire(q) {
  if (!q.url) return;
  document.getElementById('modal-title').textContent = q.title || '问卷调查';
  document.getElementById('modal-body').textContent = q.description || '请填写以下问卷';
  document.getElementById('modal-link').href = q.url;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function renderQuestionnaireFab() {
  const fabQ = siteConfig.questionnaires?.find(q => q.position === 'fab' || q.showFab);
  if (!fabQ) return;
  const fab = document.getElementById('questionnaire-fab');
  if (!fab) return;
  fab.style.display = 'flex';
  fab.title = fabQ.title || '问卷';
  const txt = fab.querySelector('.q-fab-text');
  if (txt) txt.textContent = (fabQ.title || '问卷').slice(0, 6);
}

/* 内嵌问卷：list-top / list-bottom 位置渲染为页面内的问卷卡片（点击卡片弹窗） */
function renderInlineQuestionnaires() {
  const qList = siteConfig.questionnaires || [];
  const topBox = document.getElementById('inline-q-top');
  const bottomBox = document.getElementById('inline-q-bottom');
  if (!topBox && !bottomBox) return;
  if (topBox) topBox.innerHTML = '';
  if (bottomBox) bottomBox.innerHTML = '';
  qList.forEach(q => {
    const card = `<div class="inline-q-card" role="button" tabindex="0"
      data-qid="${escAttr(q.id || '')}">
      <div class="inline-q-ico">🌸</div>
      <div class="inline-q-info">
        <div class="inline-q-title">${escHtml(q.title || '问卷调查')}</div>
        <div class="inline-q-desc">${escHtml(q.description || '请填写以下问卷')}</div>
      </div>
      <button type="button" class="btn-pink inline-q-btn" onclick="openQuestionnaireById('${escAttr(q.id || '')}')">前往填写 →</button>
    </div>`;
    if (q.position === 'list-top' && topBox) topBox.insertAdjacentHTML('beforeend', card);
    else if (q.position === 'list-bottom' && bottomBox) bottomBox.insertAdjacentHTML('beforeend', card);
  });
}

/* 供内嵌卡片按钮调用：按 id 找问卷并弹窗 */
function openQuestionnaireById(id) {
  const q = (siteConfig.questionnaires || []).find(x => String(x.id) === String(id));
  if (q) openQuestionnaire(q);
  else window.open('#');
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

/* 把正文中的裸换行（标签外的 \n）转为 <br>，避免 HTML 渲染时换行丢失。幂等：已含 <br> 的内容不受影响 */
function nl2brHtml(html) {
  if (!html) return '';
  let s = String(html).replace(/\r\n/g, '\n');
  // 保护标签内部（属性）的换行，防止误转
  s = s.replace(/<[^>]*>/g, m => m.replace(/\n/g, '\u0000'));
  // 块级标签边界处的源码排版换行（> 与 < 之间）直接删除，不产生多余空行
  s = s.replace(/>\n(?=\s*<)/g, '>');
  // 其余换行 = 用户换行 → <br>
  s = s.replace(/\n/g, '<br>');
  return s.replace(/\u0000/g, '\n');
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
window.openQuestionnaireById = openQuestionnaireById;
window.closeNewsModal = closeNewsModal;
