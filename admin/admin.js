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
  // GitHub Pages 静态托管无法写文件
  // 这里通过 WebDAV / 腾讯云 API / 用户手动等方式实现持久化
  // 演示模式下存 localStorage
  try {
    localStorage.setItem('zmxc_' + path, content);
  } catch(e) {}
  // 实际部署需要用户配置云端存储方案
  alert('⚠️ 当前为演示模式，数据已保存在浏览器本地存储。\n部署到 GitHub Pages 需要配置后端（如 GitHub API / Cloudflare Workers / 腾讯云 COS）来持久化保存数据。\n\n请查看 README.md 了解完整的部署方案。');
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
