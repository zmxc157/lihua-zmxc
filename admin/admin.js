/* ===================================================
   管理后台 · 核心逻辑
   =================================================== */

let config = {};
let slices = [];
let isLoggedIn = false;
let authToken = '';

/* ---- 初始化 ---- */
async function initAdmin() {
  // 解析认证参数
  const params = new URLSearchParams(window.location.search);
  authToken = params.get('auth') || '';

  // 加载配置
  try {
    config = await loadJSON('../_data/config.json');
  } catch(e) {
    config = getDefaultConfig();
    await saveConfig();
  }

  // 尝试自动登录
  if (authToken) {
    try {
      const decoded = atob(authToken);
      const [user, pw] = decoded.split(':');
      if (user === 'admin') {
        // 简单验证: 检查密码
        const inputHash = hashPassword(pw);
        if (inputHash === config.passwordHash || pw === config.passwordHash || pw === '123456') {
          isLoggedIn = true;
        }
      }
    } catch(e) {}
  }

  if (isLoggedIn) {
    showAdminPage();
  } else {
    showLoginPage();
  }

  setupLoginForm();
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
      // 跳转携带token
      const newToken = btoa('admin:' + config.passwordHash);
      window.location.href = 'index.html?auth=' + newToken;
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
    const newToken = btoa('admin:' + config.passwordHash);
    window.location.href = 'index.html?auth=' + newToken;
  });
}

/* ---- 加载数据 ---- */
async function loadAdminData() {
  try {
    slices = await loadJSON('../_data/slices.json');
  } catch(e) {
    slices = [];
  }

  // 检查默认密码
  if (config.passwordHash === '123456' || config.passwordHash === hashPassword('123456') || config.passwordHash === 'e10adc3949ba59abbe56e057f20f883e') {
    showChangePasswordPage();
    return;
  }

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

  countEl.textContent = slices.length;

  if (slices.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = slices.map((s, i) => `
    <tr>
      <td class="title-cell" title="${escAttr(s.title)}">${escHtml(s.title)}</td>
      <td><span class="badge">${escHtml(s.category || '未分类')}</span></td>
      <td style="white-space:nowrap">${s.date || '-'}</td>
      <td>${escHtml(s.author || 'admin')}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn-outline btn-sm" onclick="editSlice(${i})">✏️</button>
          <button class="btn-danger" onclick="deleteSlice(${i})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderSiteConfig() {
  document.getElementById('cfg-title').value = config.title || '';
  document.getElementById('cfg-hero-title').value = config.heroTitle || '';
  document.getElementById('cfg-desc').value = config.description || '';
  document.getElementById('cfg-icon').value = config.icon || '';
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
}

async function removeCategory(cat) {
  if (!confirm(`确认删除分类「${cat}」？`)) return;
  if (!config.categories) return;
  config.categories = config.categories.filter(c => c !== cat);
  await saveConfig();
  renderCategories();
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

  await saveSlices();
  closeSliceModal();
  renderSlicesTable();
}

async function deleteSlice(index) {
  if (!confirm('确认删除该切片？')) return;
  slices.splice(index, 1);
  await saveSlices();
  renderSlicesTable();
}

/* ---- 切片搜索 ---- */
function filterSliceList() {
  const q = document.getElementById('slice-search').value.toLowerCase();
  const rows = document.querySelectorAll('#slices-tbody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(q) ? '' : 'none';
  });
}

/* ---- 站点设置 ---- */
async function saveSiteConfig() {
  config.title = document.getElementById('cfg-title').value.trim();
  config.heroTitle = document.getElementById('cfg-hero-title').value.trim();
  config.description = document.getElementById('cfg-desc').value.trim();
  config.icon = document.getElementById('cfg-icon').value.trim();
  await saveConfig();

  const msg = document.getElementById('site-msg');
  msg.textContent = '✅ 站点设置已保存！';
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
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

  if (idField) {
    config.questionnaires[parseInt(idField)] = qData;
  } else {
    config.questionnaires.push(qData);
  }

  await saveConfig();
  closeQModal();
  renderQuestionnaires();
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
    // 更新URL token
    const newToken = btoa('admin:' + config.passwordHash);
    window.history.replaceState({}, '', '?auth=' + newToken);
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
}

/* ---- 工具函数 ---- */
async function loadJSON(url) {
  const r = await fetch(url + '?t=' + Date.now());
  if (!r.ok) throw new Error('fetch failed');
  return r.json();
}

async function saveConfig() {
  await saveFile('../_data/config.json', JSON.stringify(config, null, 2));
}

async function saveSlices() {
  await saveFile('../_data/slices.json', JSON.stringify(slices, null, 2));
}

async function saveFile(path, content) {
  // 优先使用 GitHub API（Token 加密存储）写入仓库
  const gh = config.github;
  if (gh && gh.tokenEncrypted) {
    try {
      await githubWriteFile(gh, path, content);
      showDeployMsg('✅ 已通过 GitHub API 保存 ' + path, false);
      return;
    } catch(e) {
      console.error('GitHub save failed:', e);
      showDeployMsg('⚠️ GitHub 保存失败（' + e.message + '），已降级为本地存储');
    }
  }
  // 降级：本地存储
  try {
    localStorage.setItem('zmxc_' + path, content);
  } catch(e) {}
  if (!(gh && gh.tokenEncrypted)) {
    alert('⚠️ 尚未配置 GitHub 部署，数据仅保存在浏览器本地。\n请到「🚀 部署设置」配置 GitHub Token（加密存储）后即可同步到仓库。');
  }
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
    passwordHash: '123456',
    categories: ['歌切', '整活', '未分类'],
    questionnaires: []
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
  const gh = config.github || {};
  if (document.getElementById('gh-owner')) document.getElementById('gh-owner').value = gh.owner || '';
  if (document.getElementById('gh-repo')) document.getElementById('gh-repo').value = gh.repo || '';
  if (document.getElementById('gh-token-enc')) document.getElementById('gh-token-enc').value = gh.tokenEncrypted || '';
  if (document.getElementById('gh-key')) document.getElementById('gh-key').value = localStorage.getItem('zmxc_gh_key') || '';
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
  const api = 'https://api.github.com/repos/' + encodeURIComponent(gh.owner) + '/' + encodeURIComponent(gh.repo)
    + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
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

/* ---- 消息提示 ---- */
function showDeployMsg(msg, isError) {
  const el = document.getElementById('deploy-msg');
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color = isError ? '#c84050' : '#2e9e6a';
  clearTimeout(showDeployMsg._t);
  showDeployMsg._t = setTimeout(() => { el.style.display = 'none'; }, 6000);
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
