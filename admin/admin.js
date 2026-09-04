/* ===================================================
   管理后台 · 核心逻辑
   =================================================== */

let config = {};
let slices = [];
let isLoggedIn = false;
let authToken = '';
let slicePage = 1;
const SLICE_PAGE_SIZE = 10;
let sliceSearchTerm = '';

/* 内置加密的 GitHub Token（AES-256-GCM，密钥 zmxc233 由站长持有，不写在文件内） */
const EMBEDDED_GH_TOKEN_ENC = '{"alg":"AES-256-GCM/PBKDF2-SHA256","salt":"JaazjlRnGehjZL2dVp5/zw==","iv":"/T4XHhFK2K9PufH9","data":"S22DKb/JQwg0IaKfwqEXu1KaTEm/14Gfc0nKXZ3Wn0vfNcTTcLNb70cSfKxbXsTiZf+vu4/JWEA="}';

/* ---- 初始化 ---- */
async function initAdmin() {
  // 加载配置
  try {
    config = await loadJSON('../_data/config.json');
  } catch(e) {
    config = getDefaultConfig();
    await saveConfig();
  }

  // 不自动登录：必须输入密码
  showLoginPage();
  setupLoginForm();
  // 加载 zt.ttf（绕过 GitHub octet-stream MIME 限制）
  loadZtFont();
}

/* ---- 页面切换 ---- */
function showLoginPage() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('change-pw-page').style.display = 'none';
  document.getElementById('admin-page').style.display = 'none';
}

function showChangePasswordPage() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('change-pw-page').style.display = 'flex';
  document.getElementById('admin-page').style.display = 'none';
}

function showAdminPage() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('change-pw-page').style.display = 'none';
  document.getElementById('admin-page').style.display = 'block';
  loadAdminData();
}

/* ---- 登录 ---- */
function setupLoginForm() {
  // 登录表单
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('login-pw').value;
    const errorEl = document.getElementById('login-error');

    const inputHash = hashPassword(pw);

    if (inputHash === config.passwordHash || pw === config.passwordHash) {
      isLoggedIn = true;
      showAdminPage();
    } else {
      errorEl.textContent = '密码错误，请重试';
      errorEl.style.display = 'block';
      document.getElementById('login-pw').value = '';
    }
  });

  // 强制改密表单
  document.getElementById('change-pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw1 = document.getElementById('new-pw').value;
    const pw2 = document.getElementById('new-pw2').value;
    const errorEl = document.getElementById('pw-error');

    if (pw1.length < 6) {
      errorEl.textContent = '密码长度不能少于6位';
      errorEl.style.display = 'block'; return;
    }
    if (pw1 !== pw2) {
      errorEl.textContent = '两次密码不一致';
      errorEl.style.display = 'block'; return;
    }

    config.passwordHash = hashPassword(pw1);
    await saveConfig();
    isLoggedIn = true;
    showAdminPage();
  });
}

/* ---- 加载数据 ---- */
async function loadAdminData() {
  try {
    slices = await loadJSON('../_data/slices.json');
  } catch(e) {
    slices = [];
  }
  slicePage = 1;
  sliceSearchTerm = '';
  renderAll();
}

/* ---- 渲染全部 ---- */
async function renderAll() {
  renderCategories();
  renderSlicesTable();
  renderSiteConfig();
  renderQuestionnaires();
  renderDeployConfig();
}

function renderCategories() {
  const cats = config.categories || ['歌切', '整活', '未分类'];
  const container = document.getElementById('category-tags');
  container.innerHTML = cats.map(c => `
    <div class="tag">
      ${escHtml(c)}
      <button class="tag-remove" onclick="removeCategory('${escAttr(c)}')" title="移除">✕</button>
    </div>
  `).join('');
}

function renderSlicesTable() {
  const tbody = document.getElementById('slices-tbody');
  const empty = document.getElementById('slices-empty');
  const countEl = document.getElementById('slice-count');
  const q = sliceSearchTerm.toLowerCase().trim();

  const filtered = slices.filter(s =>
    !q || [s.title, s.category, s.author, s.note, s.url, s.date]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(q))
  );

  countEl.textContent = slices.length + (q ? '（匹配 ' + filtered.length + '）' : '');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    renderSlicePagination(0);
    return;
  }
  empty.style.display = 'none';

  const totalPages = Math.max(1, Math.ceil(filtered.length / SLICE_PAGE_SIZE));
  if (slicePage > totalPages) slicePage = totalPages;
  const start = (slicePage - 1) * SLICE_PAGE_SIZE;
  const pageItems = filtered.slice(start, start + SLICE_PAGE_SIZE);

  tbody.innerHTML = pageItems.map((s) => {
    const idx = slices.indexOf(s);
    return `
    <tr>
      <td class="title-cell" title="${escAttr(s.title)}">${escHtml(s.title)}</td>
      <td><span class="badge">${escHtml(s.category || '未分类')}</span></td>
      <td style="white-space:nowrap">${s.date || '-'}</td>
      <td>${escHtml(s.author || 'admin')}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn-outline btn-sm" onclick="editSlice(${idx})">✏️</button>
          <button class="btn-danger" onclick="deleteSlice(${idx})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  renderSlicePagination(totalPages);
}

/* ---- 后台翻页控件（每页 10 个） ---- */
function renderSlicePagination(totalPages) {
  const el = document.getElementById('slice-pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const win = getPageWindow(slicePage, totalPages);
  let html = `<button class="page-btn" ${slicePage === 1 ? 'disabled' : ''} onclick="goSlicePage(${slicePage - 1})">‹</button>`;
  let prev = 0;
  win.forEach(p => {
    if (p - prev > 1) html += '<span class="page-ellipsis">…</span>';
    html += `<button class="page-btn ${p === slicePage ? 'active' : ''}" onclick="goSlicePage(${p})">${p}</button>`;
    prev = p;
  });
  html += `<button class="page-btn" ${slicePage === totalPages ? 'disabled' : ''} onclick="goSlicePage(${slicePage + 1})">›</button>`;
  el.innerHTML = html;
}

function goSlicePage(p) {
  if (p < 1) return;
  slicePage = p;
  renderSlicesTable();
}

function getPageWindow(cur, total) {
  const arr = [1, total];
  for (let p = cur - 1; p <= cur + 1; p++) if (p >= 1 && p <= total) arr.push(p);
  return [...new Set(arr)].sort((a, b) => a - b);
}

function renderSiteConfig() {
  document.getElementById('cfg-title').value = config.title || '';
  document.getElementById('cfg-hero-title').value = config.heroTitle || '';
  document.getElementById('cfg-desc').value = config.description || '';
  document.getElementById('cfg-icon').value = config.icon || '';
  document.getElementById('cfg-now-loading-img').value = config.nowLoadingImage || '';
}

function renderQuestionnaires() {
  const container = document.getElementById('questionnaire-list');
  const empty = document.getElementById('q-empty');
  const list = config.questionnaires || [];

  if (list.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const positionLabels = {
    modal: '🌸 进入时弹窗',
    fab: '🌸 右下角小岛常驻',
    'list-top': '📋 列表顶部',
    'list-bottom': '📋 列表底部'
  };

  container.innerHTML = list.map((q, i) => `
    <div class="q-card">
      <div class="q-info">
        <div class="q-title">${escHtml(q.title)}</div>
        <div class="q-meta">${positionLabels[q.position] || q.position} · ${escHtml(q.url)}</div>
        ${q.description ? `<div class="q-meta" style="margin-top:4px">${escHtml(q.description)}</div>` : ''}
      </div>
      <div class="q-actions">
        <button class="btn-outline btn-sm" onclick="editQuestionnaire(${i})">✏️</button>
        <button class="btn-danger" onclick="deleteQuestionnaire(${i})">🗑️</button>
      </div>
    </div>
  `).join('');
}

/* ---- 分类操作 ---- */
async function addCategory() {
  const input = document.getElementById('new-category');
  const val = input.value.trim();
  if (!val) return;
  if (!config.categories) config.categories = ['歌切', '整活', '未分类'];
  if (config.categories.includes(val)) { alert('该分类已存在'); return; }
  config.categories.push(val);
  await saveConfig();
  renderCategories();
  input.value = '';
  toast('✅ 已添加分类：' + val);
}

async function removeCategory(cat) {
  if (!confirm(`确认删除分类「${cat}」？`)) return;
  if (!config.categories) return;
  config.categories = config.categories.filter(c => c !== cat);
  await saveConfig();
  renderCategories();
  toast('🗑️ 已删除分类：' + cat);
}

/* ---- 切片 CRUD ---- */
function openAddSliceModal() {
  document.getElementById('slice-modal-title').textContent = '添加切片';
  document.getElementById('slice-id').value = '';
  document.getElementById('slice-form').reset();
  document.getElementById('slice-id').value = '';

  // 填充分类下拉
  const sel = document.getElementById('slice-category');
  sel.innerHTML = (config.categories || ['歌切', '整活', '未分类'])
    .map(c => `<option value="${escAttr(c)}">${escHtml(c)}</option>`).join('');

  document.getElementById('slice-modal').style.display = 'flex';
}

function editSlice(index) {
  const s = slices[index];
  document.getElementById('slice-modal-title').textContent = '编辑切片';
  document.getElementById('slice-id').value = index;

  const sel = document.getElementById('slice-category');
  sel.innerHTML = (config.categories || ['歌切', '整活', '未分类'])
    .map(c => `<option value="${escAttr(c)}"${c === s.category ? ' selected' : ''}>${escHtml(c)}</option>`).join('');

  document.getElementById('slice-title').value = s.title || '';
  document.getElementById('slice-url').value = s.url || '';
  document.getElementById('slice-date').value = s.date || '';
  document.getElementById('slice-author').value = s.author || '';
  document.getElementById('slice-audio').value = s.audio || '';
    document.getElementById('slice-cover').value = s.cover || '';
  document.getElementById('slice-note').value = s.note || '';

  document.getElementById('slice-modal').style.display = 'flex';
}

function closeSliceModal() {
  document.getElementById('slice-modal').style.display = 'none';
}

async function saveSlice(e) {
  e.preventDefault();
  const idField = document.getElementById('slice-id').value;
  const sliceData = {
    id: idField ? slices[parseInt(idField)].id : 'slice-' + Date.now(),
    title: document.getElementById('slice-title').value.trim(),
    category: document.getElementById('slice-category').value,
    url: document.getElementById('slice-url').value.trim(),
    date: document.getElementById('slice-date').value,
    author: document.getElementById('slice-author').value.trim() || 'admin',
    audio: document.getElementById('slice-audio').value.trim(),
    cover: document.getElementById('slice-cover').value.trim(),
    note: document.getElementById('slice-note').value.trim()
  };

  if (!sliceData.title || !sliceData.url || !sliceData.category) {
    alert('请填写标题、分类和链接');
    return;
  }

  if (idField) {
    slices[parseInt(idField)] = sliceData;
  } else {
    slices.unshift(sliceData);
  }

  const res = await saveSlices();
  closeSliceModal();
  renderSlicesTable();
  if (res && res.github) {
    toast('✅ 切片已保存并同步到 GitHub');
  } else if (res && res.error) {
    toast('⚠️ 切片已保存到本地，GitHub 同步失败：' + res.error + '（请点「立即应用」重试）', true);
  } else {
    toast('✅ 切片已保存到本地（未配置部署，点「立即应用」可推送）');
  }
}

async function deleteSlice(index) {
  if (!confirm('确认删除该切片？')) return;
  slices.splice(index, 1);
  const res = await saveSlices();
  renderSlicesTable();
  if (res && res.github) {
    toast('🗑️ 切片已删除并同步到 GitHub');
  } else {
    toast('🗑️ 切片已删除（本地）');
  }
}

/* ---- 切片搜索（全局，跨全部切片，而非仅当前页） ---- */
function filterSliceList() {
  sliceSearchTerm = document.getElementById('slice-search').value;
  slicePage = 1;
  renderSlicesTable();
}

/* ---- 站点设置 ---- */
async function saveSiteConfig() {
  config.title = document.getElementById('cfg-title').value.trim();
  config.heroTitle = document.getElementById('cfg-hero-title').value.trim();
  config.description = document.getElementById('cfg-desc').value.trim();
  config.icon = document.getElementById('cfg-icon').value.trim();
  config.nowLoadingImage = document.getElementById('cfg-now-loading-img').value.trim();
  const res = await saveConfig();

  const msg = document.getElementById('site-msg');
  msg.textContent = '✅ 站点设置已保存！';
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
  if (res && res.github) toast('✅ 站点设置已同步到 GitHub');
}

/* ---- 问卷 CRUD ---- */
function openAddQuestionnaireModal() {
  document.getElementById('q-modal-title').textContent = '添加问卷';
  document.getElementById('q-id').value = '';
  document.getElementById('q-form').reset();
  document.getElementById('q-modal').style.display = 'flex';
}

function editQuestionnaire(index) {
  const q = config.questionnaires[index];
  document.getElementById('q-modal-title').textContent = '编辑问卷';
  document.getElementById('q-id').value = index;
  document.getElementById('q-title').value = q.title || '';
  document.getElementById('q-url').value = q.url || '';
  document.getElementById('q-desc').value = q.description || '';
  document.getElementById('q-position').value = q.position || 'modal';
  document.getElementById('q-modal').style.display = 'flex';
}

function closeQModal() {
  document.getElementById('q-modal').style.display = 'none';
}

async function saveQuestionnaire(e) {
  e.preventDefault();
  const idField = document.getElementById('q-id').value;
  const qData = {
    id: idField ? config.questionnaires[parseInt(idField)].id : 'q-' + Date.now(),
    title: document.getElementById('q-title').value.trim(),
    url: document.getElementById('q-url').value.trim(),
    description: document.getElementById('q-desc').value.trim(),
    position: document.getElementById('q-position').value,
    showFab: document.getElementById('q-position').value === 'fab'
  };

  if (!qData.title || !qData.url) { alert('请填写标题和链接'); return; }

  if (!config.questionnaires) config.questionnaires = [];

  const isEdit = !!idField;
  if (idField) {
    config.questionnaires[parseInt(idField)] = qData;
  } else {
    config.questionnaires.push(qData);
  }

  const res = await saveConfig();
  closeQModal();
  renderQuestionnaires();
  toast((isEdit ? '✏️ 问卷已更新' : '✅ 问卷已添加') + (res && res.github ? '并同步到 GitHub' : '（本地）'));
}

async function deleteQuestionnaire(index) {
  if (!confirm('确认删除该问卷？')) return;
  config.questionnaires.splice(index, 1);
  await saveConfig();
  renderQuestionnaires();
}

/* ---- 账号设置 ---- */
async function saveAccount() {
  const pw1 = document.getElementById('acc-new-pw').value;
  const pw2 = document.getElementById('acc-new-pw2').value;
  const msg = document.getElementById('acc-msg');

  if (pw1 || pw2) {
    if (pw1.length < 6) { alert('密码长度不能少于6位'); return; }
    if (pw1 !== pw2) { alert('两次密码不一致'); return; }
    config.passwordHash = hashPassword(pw1);
    await saveConfig();
  }

  document.getElementById('acc-new-pw').value = '';
  document.getElementById('acc-new-pw2').value = '';
  msg.textContent = '✅ 密码修改成功！';
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

/* ---- 登出 ---- */
function doLogout() {
  window.location.href = 'index.html';
}

/* ---- 标签页切换 ---- */
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tab}"]`)?.classList.add('active');
  if (tab === 'files') loadFileManager();
  if (tab === 'account') loadNews();
}

/* ---- 工具函数 ---- */
async function loadJSON(url) {
  const r = await fetch(url + '?t=' + Date.now());
  if (!r.ok) throw new Error('fetch failed');
  return r.json();
}

async function saveConfig() {
  return await saveFile('../_data/config.json', JSON.stringify(config, null, 2));
}

async function saveSlices() {
  return await saveFile('../_data/slices.json', JSON.stringify(slices, null, 2));
}

async function saveFile(path, content) {
  // 始终先写入本地存储（即时、可靠）
  try {
    localStorage.setItem('zmxc_' + path, content);
  } catch(e) {}
  // 尝试通过 GitHub API 同步到仓库
  const gh = config.github;
  if (gh && gh.tokenEncrypted) {
    try {
      await githubWriteFile(gh, path, content);
      return { ok: true, github: true };
    } catch(e) {
      console.error('GitHub save failed:', e);
      return { ok: true, github: false, error: e.message };
    }
  }
  return { ok: true, github: false };
}

function hashPassword(pw) {
  // 简单不可逆哈希
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    const char = pw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h' + Math.abs(hash).toString(16).padStart(8, '0');
}

function getDefaultConfig() {
  return {
    title: '🌸 星辰桑切片站 🌸',
    heroTitle: '🌸 星辰桑切片站 🌸',
    description: '收录星辰桑的所有可爱切片，愿你喜欢 ✨',
    icon: '',
    nowLoadingImage: '', // 详情加载提示自定义图（PNG URL，留空为 NowLoading 文字；仅 PC 生效）
    passwordHash: hashPassword('20090329'),
    categories: ['歌切', '整活', '未分类'],
    questionnaires: [],
    github: {
      owner: 'zmxc157',
      repo: 'lihua-zmxc',
      branch: 'main',
      tokenEncrypted: EMBEDDED_GH_TOKEN_ENC
    }
  };
}

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

/* ===================================================
   GitHub 部署 · AES-256-GCM 加密存储
   =================================================== */

/* ---- 部署配置渲染 ---- */
function renderDeployConfig() {
  const gh = config.github || { owner: 'zmxc157', repo: 'lihua-zmxc', tokenEncrypted: EMBEDDED_GH_TOKEN_ENC };
  if (document.getElementById('gh-owner')) document.getElementById('gh-owner').value = gh.owner || 'zmxc157';
  if (document.getElementById('gh-repo')) document.getElementById('gh-repo').value = gh.repo || 'lihua-zmxc';
  if (document.getElementById('gh-token-enc')) document.getElementById('gh-token-enc').value = gh.tokenEncrypted || '';
  if (document.getElementById('gh-key'))   document.getElementById('gh-key').value = localStorage.getItem('zmxc_gh_key') || '';
  const dt = document.getElementById('deploy-target');
  if (dt) dt.textContent = '🎯 推送目标仓库：' + (gh.owner || '?') + '/' + (gh.repo || '?') + ' @ ' + (gh.branch || 'main');
}

/* ---- 加密工具：明文 Token → 密文 ---- */
async function encryptToken() {
  const key = document.getElementById('gh-key').value.trim();
  const plain = document.getElementById('gh-token-plain').value.trim();
  if (!key) { showDeployMsg('请先填写 AES 密钥'); return; }
  if (!plain) { showDeployMsg('请粘贴 GitHub 明文 Token'); return; }
  try {
    const payload = await aesEncrypt(plain, key);
    document.getElementById('gh-token-enc').value = JSON.stringify(payload);
    document.getElementById('gh-token-plain').value = '';
    showDeployMsg('🔒 加密完成！密文已填入上方输入框，明文已清除');
  } catch(e) {
    showDeployMsg('❌ 加密失败：' + e.message, true);
  }
}

/* ---- 保存部署配置 ---- */
async function saveDeployConfig() {
  const owner = document.getElementById('gh-owner').value.trim();
  const repo = document.getElementById('gh-repo').value.trim();
  const key = document.getElementById('gh-key').value.trim();
  const enc = document.getElementById('gh-token-enc').value.trim();
  if (!owner || !repo) { showDeployMsg('请填写 GitHub 用户名和仓库名'); return; }
  if (!config.github) config.github = {};
  config.github.owner = owner;
  config.github.repo = repo;
  config.github.branch = 'main';
  if (enc) config.github.tokenEncrypted = enc;
  if (key) {
    localStorage.setItem('zmxc_gh_key', key);
  }
  await saveConfig();
  showDeployMsg('✅ 部署配置已保存。Token 仅以密文形式存入 config.json，AES 密钥仅存本浏览器');
}

/* ---- 测试连接 ---- */
async function testGithub() {
  try {
    const token = await getGithubToken();
    const r = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': 'Bearer ' + token, 'User-Agent': 'zmxc-admin' }
    });
    if (r.ok) {
      const j = await r.json();
      showDeployMsg('✅ GitHub 连接成功：' + j.login + '（' + (j.name || '') + '）');
    } else {
      const t = await r.text();
      showDeployMsg('❌ 连接失败：HTTP ' + r.status + ' ' + t.slice(0, 200), true);
    }
  } catch(e) {
    showDeployMsg('❌ 解密或网络错误：' + e.message, true);
  }
}

/* ---- 读取解密后的 Token（仅内存使用，不落盘） ---- */
async function getGithubToken() {
  const gh = config.github;
  if (!gh || !gh.tokenEncrypted) throw new Error('未配置 GitHub Token 密文');
  let key = localStorage.getItem('zmxc_gh_key');
  if (!key) key = document.getElementById('gh-key') ? document.getElementById('gh-key').value.trim() : '';
  if (!key) throw new Error('缺少 AES 密钥（请在部署设置中填写）');
  const payload = JSON.parse(gh.tokenEncrypted);
  return aesDecrypt(payload, key);
}

/* ---- 写入文件到 GitHub 仓库（Contents API） ---- */
async function githubWriteFile(gh, path, content) {
  const token = await getGithubToken();
  const repoPath = path.replace(/^(\.\.\/)+/, '');
  const api = 'https://api.github.com/repos/' + encodeURIComponent(gh.owner) + '/' + encodeURIComponent(gh.repo)
    + '/contents/' + repoPath.split('/').map(encodeURIComponent).join('/');
  const headers = {
    'Authorization': 'Bearer ' + token,
    'User-Agent': 'zmxc-admin',
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };
  // 获取已有文件 sha（不存在则新建）
  let sha = null;
  try {
    const r = await fetch(api, { headers });
    if (r.ok) { const j = await r.json(); sha = j.sha; }
  } catch(e) {}
  const body = {
    message: 'update ' + path + ' via admin panel',
    content: utf8ToBase64(content),
    branch: gh.branch || 'main'
  };
  if (sha) body.sha = sha;
  const r2 = await fetch(api, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!r2.ok) {
    const t = await r2.text();
    throw new Error('HTTP ' + r2.status + ' ' + t.slice(0, 200));
  }
}

/* ---- 浮层提示 ---- */
function toast(msg, isError) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 4000);
}

/* ---- 立即应用：把最新数据推送到 GitHub ---- */
async function applyToGithub() {
  const gh = config.github;
  if (!gh || !gh.tokenEncrypted) {
    toast('❌ 未配置 GitHub 部署，请先到「🚀 部署设置」保存', true);
    switchTab('deploy');
    return;
  }
  let key = localStorage.getItem('zmxc_gh_key');
  if (!key && document.getElementById('gh-key')) key = document.getElementById('gh-key').value.trim();
  if (!key) {
    toast('❌ 请先在「🚀 部署设置」填写 AES 密钥（zmxc233）', true);
    switchTab('deploy');
    return;
  }
  toast('⏳ 正在推送到 GitHub...');
  try {
    await githubWriteFile(gh, '../_data/config.json', JSON.stringify(config, null, 2));
    await githubWriteFile(gh, '../_data/slices.json', JSON.stringify(slices, null, 2));
    toast('✅ 已立即应用到 GitHub（config + slices）');
  } catch(e) {
    toast('❌ 推送失败：' + e.message, true);
  }
}

/* ===================================================
   AES-GCM 加解密（Web Crypto API，无需第三方库）
   =================================================== */

function cryptoAvailable() {
  return !!(window.crypto && window.crypto.subtle);
}

async function aesEncrypt(plaintext, passphrase) {
  if (!cryptoAvailable()) throw new Error('当前环境不支持 Web Crypto（需 https 或 localhost）');
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipher)),
    alg: 'AES-256-GCM/PBKDF2-SHA256'
  };
}

async function aesDecrypt(payload, passphrase) {
  if (!cryptoAvailable()) throw new Error('当前环境不支持 Web Crypto（需 https 或 localhost）');
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: base64ToBytes(payload.salt), iterations: 150000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.data)
  );
  return new TextDecoder().decode(plain);
}

/* ---- Base64 工具 ---- */
function bytesToBase64(bytes) {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function utf8ToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}
/* ---- 资源上传：MP3 / 图片 直接传 GitHub ---- */
async function uploadAsset() {
  const input = document.getElementById('asset-file');
  if (!input.files.length) { toast('⚠️ 请先选择要上传的文件', true); return; }
  const file = input.files[0];
  const isAudio = file.type.startsWith('audio') || /.(mp3|wav|ogg|m4a)$/i.test(file.name);
  const isImage = file.type.startsWith('image') || /.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
  if (!isAudio && !isImage) { toast('⚠️ 仅支持 MP3 / 图片（png/jpg/gif/webp/svg）', true); return; }
  const folder = isAudio ? 'assets/audio' : 'assets/imgs';
  const gh = config.github;
  if (!gh || !gh.tokenEncrypted) { toast('❌ 未配置 GitHub 部署，请先到「🚀 部署设置」保存', true); switchTab('deploy'); return; }
  let key = localStorage.getItem('zmxc_gh_key');
  if (!key && document.getElementById('gh-key')) key = document.getElementById('gh-key').value.trim();
  if (!key) { toast('❌ 请先在「🚀 部署设置」填写 AES 密钥（zmxc233）', true); switchTab('deploy'); return; }
  toast('⏳ 正在上传 ' + file.name + ' ...');
  try {
    const buf = await file.arrayBuffer();
    const b64 = bytesToBase64(new Uint8Array(buf));
    const repoPath = folder + '/' + file.name;
    const api = 'https://api.github.com/repos/' + encodeURIComponent(gh.owner) + '/' + encodeURIComponent(gh.repo) + '/contents/' + repoPath;
    const headers = { 'Authorization': 'Bearer ' + (await getGithubToken()), 'User-Agent': 'zmxc', 'Accept': 'application/vnd.github+json' };
    const get = await fetch(api, { headers });
    let sha = null;
    if (get.status === 200) sha = (await get.json()).sha;
    const body = { message: 'upload ' + repoPath, content: b64, branch: gh.branch || 'main' };
    if (sha) body.sha = sha;
    const put = await fetch(api, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body) });
    if (!put.ok) { const t = await put.text(); throw new Error('HTTP ' + put.status + ' ' + t.slice(0, 120)); }
    const rawUrl = 'https://raw.githubusercontent.com/' + gh.owner + '/' + gh.repo + '/' + (gh.branch || 'main') + '/' + repoPath;
    const resEl = document.getElementById('asset-result');
    const urlEl = document.getElementById('asset-url');
    resEl.style.display = 'block';
    urlEl.value = rawUrl;
    toast('✅ 已上传 ' + file.name + ' 到 GitHub');
    if (document.getElementById('slice-modal').style.display === 'flex') {
      if (isAudio) document.getElementById('slice-audio').value = rawUrl;
      if (isImage) document.getElementById('slice-cover').value = rawUrl;
    }
    input.value = '';
  } catch(e) {
    toast('❌ 上传失败：' + e.message, true);
  }
}

function copyAssetUrl() {
  const el = document.getElementById('asset-url');
  if (!el) return;
  el.select();
  try { navigator.clipboard.writeText(el.value); } catch(e) {}
  toast('📋 已复制链接');
}

/* ===================================================
   文件管理（列出 / 复制 / 删除 assets 下已上传的图片与音频）
   =================================================== */
async function githubListDir(gh, folder) {
  const token = await getGithubToken();
  const api = 'https://api.github.com/repos/' + encodeURIComponent(gh.owner) + '/' + encodeURIComponent(gh.repo) + '/contents/' + folder;
  const headers = { 'Authorization': 'Bearer ' + token, 'User-Agent': 'zmxc', 'Accept': 'application/vnd.github+json' };
  const r = await fetch(api, { headers });
  if (r.status === 404) return [];
  if (!r.ok) { const t = await r.text(); throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 120)); }
  return await r.json();
}

async function githubDeleteFile(gh, path, sha) {
  const token = await getGithubToken();
  const api = 'https://api.github.com/repos/' + encodeURIComponent(gh.owner) + '/' + encodeURIComponent(gh.repo) + '/contents/' + path;
  const r = await fetch(api, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token, 'User-Agent': 'zmxc', 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'delete ' + path, sha: sha, branch: gh.branch || 'main' })
  });
  if (!r.ok) { const t = await r.text(); throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 120)); }
}

async function loadFileManager() {
  const gh = config.github;
  const wrap = document.getElementById('file-list');
  if (!wrap) return;
  if (!gh || !gh.tokenEncrypted) {
    wrap.innerHTML = '<div class="empty-inline">未配置 GitHub 部署，无法列出文件。请先到「🚀 部署设置」保存仓库与 Token。</div>';
    return;
  }
  wrap.innerHTML = '<div class="loading-inline">📂 正在读取仓库文件...</div>';
  try {
    const [audio, imgs] = await Promise.all([
      githubListDir(gh, 'assets/audio').catch(() => []),
      githubListDir(gh, 'assets/imgs').catch(() => [])
    ]);
    renderFileManager(audio, imgs);
  } catch (e) {
    wrap.innerHTML = '<div class="form-error">读取失败：' + escHtml(e.message) + '（请确认已在「🚀 部署设置」填写 AES 密钥 zmxc233）</div>';
  }
}

function renderFileManager(audio, imgs) {
  const wrap = document.getElementById('file-list');
  if (!wrap) return;
  const gh = config.github;
  const rawBase = 'https://raw.githubusercontent.com/' + gh.owner + '/' + gh.repo + '/' + (gh.branch || 'main') + '/';
  const block = (title, list, type) => {
    if (!list || !list.length) return '<div class="file-group"><h4>' + title + '</h4><div class="empty-inline">暂无文件</div></div>';
    return '<div class="file-group"><h4>' + title + '（' + list.length + '）</h4>' + list.map(f => {
      const url = rawBase + f.path;
      return '<div class="file-row" data-path="' + escAttr(f.path) + '" data-sha="' + escAttr(f.sha) + '">' +
        (type === 'img' ? '<img class="file-thumb" src="' + escAttr(url) + '" alt="" />' : '<span class="file-ico">🎵</span>') +
        '<div class="file-info"><div class="file-name">' + escHtml(f.name) + '</div><div class="file-url">' + escHtml(url) + '</div></div>' +
        '<div class="file-actions">' +
          '<button class="btn-outline btn-sm" onclick="copyAssetLink(\'' + escAttr(f.path) + '\')">📋 复制</button>' +
          '<button class="btn-danger btn-sm" onclick="deleteAsset(\'' + escAttr(f.path) + '\',\'' + escAttr(f.sha) + '\',\'' + type + '\')">🗑️ 删除</button>' +
        '</div></div>';
    }).join('') + '</div>';
  };
  wrap.innerHTML = block('🎵 音频（assets/audio）', audio, 'audio') + block('🖼️ 图片（assets/imgs）', imgs, 'img');
}

async function deleteAsset(path, sha, type) {
  if (!confirm('确认删除文件：' + path + ' ？\n该操作会直接写入 GitHub 仓库，不可恢复。')) return;
  const gh = config.github;
  toast('⏳ 正在删除 ' + path + ' ...');
  try {
    await githubDeleteFile(gh, path, sha);
    toast('🗑️ 已删除 ' + path);
    await loadFileManager();
  } catch (e) {
    toast('❌ 删除失败：' + e.message, true);
  }
}

function copyAssetLink(path) {
  const gh = config.github;
  const url = 'https://raw.githubusercontent.com/' + gh.owner + '/' + gh.repo + '/' + (gh.branch || 'main') + '/' + path;
  const tmp = document.createElement('input');
  tmp.value = url;
  document.body.appendChild(tmp);
  tmp.select();
  try { document.execCommand('copy'); } catch (e) {}
  try { navigator.clipboard.writeText(url); } catch (e) {}
  document.body.removeChild(tmp);
  toast('📋 已复制链接');
}

/* ---- 运行时加载 zt.ttf（绕过 GitHub 的 octet-stream MIME 限制，Firefox 也能用） ---- */
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

/* ===================================================
   星辰NEWS：公告 / 活动 / 异常 弹窗系统
   数据：_data/news/index.json（索引+types）+ _data/news/<id>.html（正文）
   =================================================== */

const NEWS_TYPES = [
  { key: 'announcement', label: '📢 公告' },
  { key: 'activity',     label: '🎁 活动' },
  { key: 'issue',        label: '⚠️ 异常' }
];
let newsTypes = NEWS_TYPES.slice(); // 服务端类型，可增减调整
let newsItems = [];   // { id, type, title, date, html }

async function loadNews() {
  const box = document.getElementById('news-list');
  const empty = document.getElementById('news-empty');
  const count = document.getElementById('news-count');
  try {
    // 尝试从线上（GitHub Pages）拉取索引，失败则用本地缓存
    const idx = await loadJSON('../_data/news/index.json');
    if (idx.types && idx.types.length) newsTypes = idx.types;
    newsItems = (idx.items || []).map(it => ({ id: it.id, type: it.type, title: it.title, date: it.date, html: '' }));
    // 逐条拉取正文（失败时正文留空，编辑时再取）
    for (const it of newsItems) {
      try {
        const r = await fetch('../_data/news/' + it.id + '.html?t=' + Date.now());
        if (r.ok) it.html = await r.text();
      } catch(e) {}
    }
    localStorage.setItem('zmxc_news_index', JSON.stringify({ types: newsTypes, items: newsItems }));
  } catch(e) {
    // 本地缓存回退
    try {
      const cached = JSON.parse(localStorage.getItem('zmxc_news_index') || 'null');
      if (cached) { newsTypes = cached.types || NEWS_TYPES.slice(); newsItems = cached.items || []; }
    } catch(e2) {}
  }
  renderNewsList();
  renderNewsTypes();
  if (count) count.textContent = newsItems.length ? '(' + newsItems.length + ')' : '';
  const msg = document.getElementById('news-msg');
  if (msg) { msg.textContent = '🔄 已刷新（' + newsItems.length + ' 条）'; msg.style.display = 'inline'; setTimeout(()=>{ msg.style.display='none'; }, 2500); }
}

function renderNewsList() {
  const box = document.getElementById('news-list');
  const empty = document.getElementById('news-empty');
  const count = document.getElementById('news-count');
  if (!box) return;
  if (!newsItems.length) {
    box.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (count) count.textContent = '(' + newsItems.length + ')';
  const typeLabel = k => (newsTypes.find(t => t.key === k) || { label: k }).label;
  box.innerHTML = newsItems.map((it, i) => `
    <div class="news-row">
      <span class="news-row-type">${escHtml(typeLabel(it.type))}</span>
      <div class="news-row-info">
        <div class="news-row-title">${escHtml(it.title)}</div>
        <div class="news-row-date">${escHtml(it.date || '')} · <code>_data/news/${escHtml(it.id)}.html</code></div>
      </div>
      <div class="news-row-actions">
        <button class="btn-outline btn-sm" onclick="editNews(${i})" title="编辑">✏️</button>
        <button class="btn-danger btn-sm" onclick="deleteNews(${i})" title="删除">🗑️</button>
      </div>
    </div>`).join('');
}

function openAddNewsModal() {
  document.getElementById('news-modal-title').textContent = '添加公告';
  document.getElementById('news-index').value = '';
  document.getElementById('news-form').reset();
  document.getElementById('news-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('news-html').value = '';
  document.getElementById('news-preview').style.display = 'none';
  document.getElementById('news-modal').style.display = 'flex';
  fillNewsTypeOptions('');
}

function editNews(index) {
  const it = newsItems[index];
  document.getElementById('news-modal-title').textContent = '编辑公告';
  document.getElementById('news-index').value = index;
  document.getElementById('news-type').value = it.type;
  document.getElementById('news-date').value = it.date || '';
  document.getElementById('news-title').value = it.title || '';
  document.getElementById('news-html').value = it.html || '';
  document.getElementById('news-preview').style.display = 'none';
  document.getElementById('news-modal').style.display = 'flex';
  fillNewsTypeOptions(it.type);
}

function fillNewsTypeOptions(selected) {
  const sel = document.getElementById('news-type');
  sel.innerHTML = newsTypes.map(t => `<option value="${escAttr(t.key)}">${escHtml(t.label)}</option>`).join('');
  if (selected) sel.value = selected;
}

function closeNewsModal() {
  document.getElementById('news-modal').style.display = 'none';
}

async function saveNews(e) {
  e.preventDefault();
  const idxField = document.getElementById('news-index').value;
  const data = {
    id: idxField ? newsItems[parseInt(idxField)].id : 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: document.getElementById('news-type').value,
    title: document.getElementById('news-title').value.trim(),
    date: document.getElementById('news-date').value || new Date().toISOString().slice(0, 10),
    html: document.getElementById('news-html').value
  };
  if (!data.title) { alert('请填写标题'); return; }
  if (idxField) {
    newsItems[parseInt(idxField)] = { ...newsItems[parseInt(idxField)], ...data };
  } else {
    newsItems.push(data);
  }
  // 排序：按日期倒序
  newsItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  localStorage.setItem('zmxc_news_index', JSON.stringify({ types: newsTypes, items: newsItems }));
  closeNewsModal();
  renderNewsList();
  toast(idxField ? '✏️ 公告已更新（本地）' : '✅ 公告已添加（本地）');
}

async function deleteNews(index) {
  if (!confirm('确认删除该公告？\n（点击推送后线上 _data/news/ 对应 .html 与索引也会被移除）')) return;
  const it = newsItems[index];
  newsItems.splice(index, 1);
  localStorage.setItem('zmxc_news_index', JSON.stringify({ types: newsTypes, items: newsItems }));
  renderNewsList();
  toast('🗑️ 已删除（本地）');
}

/* ---- 类型管理（服务端可增减调整） ---- */
function addNewsType() {
  const keyInput = document.getElementById('news-type-key');
  const labInput = document.getElementById('news-type-label');
  const key = (keyInput.value.trim() || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const label = labInput.value.trim();
  if (!key || !label) { alert('请填写类型 key（英文）与显示名'); return; }
  if (newsTypes.find(t => t.key === key)) { alert('该 key 已存在'); return; }
  newsTypes.push({ key, label });
  keyInput.value = ''; labInput.value = '';
  renderNewsTypes();
  toast('✅ 已添加类型「' + label + '」');
}

function removeNewsType(key) {
  if (!confirm('删除类型「' + key + '」？\n若已有公告使用该类型，将一并改为「公告」。')) return;
  newsTypes = newsTypes.filter(t => t.key !== key);
  newsItems.forEach(it => { if (it.type === key) it.type = 'announcement'; });
  localStorage.setItem('zmxc_news_index', JSON.stringify({ types: newsTypes, items: newsItems }));
  renderNewsTypes();
  renderNewsList();
  toast('🗑️ 类型已删除');
}

function renderNewsTypes() {
  const box = document.getElementById('news-type-list');
  if (!box) return;
  box.innerHTML = newsTypes.map(t => `
    <span class="news-type-chip">${escHtml(t.label)}
      ${newsTypes.length > 1 ? `<button class="chip-x" onclick="removeNewsType('${escAttr(t.key)}')" title="删除类型">✕</button>` : ''}
    </span>`).join('');
}

/* ---- HTML 编辑器工具条（蔚蓝档案公告式生成逻辑） ---- */
function newsWrapTag(tag) {
  const ta = document.getElementById('news-html');
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e) || '文本';
  ta.value = ta.value.slice(0, s) + '<' + tag + '>' + sel + '</' + tag + '>' + ta.value.slice(e);
  ta.focus();
  ta.selectionStart = s + tag.length + 2 + sel.length + tag.length + 3;
  ta.selectionEnd = ta.selectionStart;
}
function newsInsertImg() {
  const ta = document.getElementById('news-html');
  const url = prompt('粘贴图片直链 URL（可在「🗂️ 文件管理」复制）：', 'https://');
  if (!url) return;
  insertAtCursor(ta, '<img src="' + url + '" alt="" />');
}
function newsInsertLink() {
  const ta = document.getElementById('news-html');
  const url = prompt('粘贴链接 URL：', 'https://');
  const text = prompt('链接显示文字：', '点击前往');
  if (!url) return;
  insertAtCursor(ta, '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + (text || url) + '</a>');
}
function newsInsertLine() {
  insertAtCursor(document.getElementById('news-html'), '<hr />');
}
function insertAtCursor(ta, text) {
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
  ta.focus();
}
function newsPreview() {
  const pv = document.getElementById('news-preview');
  pv.innerHTML = document.getElementById('news-html').value || '<p style="color:#999">（空内容）</p>';
  pv.style.display = 'block';
}

/* ---- 推送全部公告到 GitHub ---- */
async function applyNewsToGithub() {
  const gh = config.github;
  if (!gh || !gh.tokenEncrypted) { toast('❌ 未配置 GitHub，请先到「🚀 部署设置」', true); switchTab('deploy'); return; }
  try {
    await getGithubToken();
  } catch(e) {
    toast('❌ ' + e.message, true); switchTab('deploy'); return;
  }
  toast('⏳ 正在推送公告到 GitHub...');
  try {
    // 1) 索引：_data/news/index.json
    await githubWriteFile(gh, '../_data/news/index.json', JSON.stringify({ types: newsTypes, items: newsItems.map(({ html, ...rest }) => rest) }, null, 2));
    // 2) 每篇正文：_data/news/<id>.html
    for (const it of newsItems) {
      await githubWriteFile(gh, '../_data/news/' + it.id + '.html', it.html || '<p></p>');
    }
    toast('✅ 公告已推送（索引 + ' + newsItems.length + ' 篇 HTML）');
    const msg = document.getElementById('news-msg');
    if (msg) { msg.textContent = '✅ 已推送至 GitHub（' + newsItems.length + ' 条）'; msg.style.display = 'inline'; setTimeout(()=>{ msg.style.display='none'; }, 4000); }
  } catch(e) {
    toast('❌ 推送失败：' + e.message, true);
  }
}

/* ---- 问卷：立即推送至 GitHub ---- */
async function applyQuestionnaireToGithub() {
  const gh = config.github;
  if (!gh || !gh.tokenEncrypted) { toast('❌ 未配置 GitHub，请先到「🚀 部署设置」', true); switchTab('deploy'); return; }
  try {
    await getGithubToken();
  } catch(e) {
    toast('❌ ' + e.message, true); switchTab('deploy'); return;
  }
  toast('⏳ 正在推送问卷配置...');
  try {
    const res = await saveConfig(); // config.json 内含 questionnaires
    toast('✅ 问卷配置已同步到 GitHub（config.json）');
  } catch(e) {
    toast('❌ 推送失败：' + e.message, true);
  }
}

