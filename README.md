# 🌸 星辰桑切片站

收录星辰桑所有可爱切片的指引系统。

---

## 📦 目录结构

```
star-slices/
├── index.html          # 前台首页
├── README.md           # 本说明
├── assets/
│   ├── audio/          # MP3 试听音频（放入 mp3 文件）
│   ├── imgs/           # 图片资源
│   └── icons/          # 图标（默认有 default.svg）
├── css/
│   └── style.css       # 前台样式
├── js/
│   └── app.js          # 前台逻辑
├── _data/
│   ├── config.json     # 站点配置（管理员在后台修改）
│   └── slices.json     # 切片数据（管理员在后台管理）
└── admin/
    ├── index.html      # 管理后台
    ├── admin.css       # 后台样式
    └── admin.js        # 后台逻辑
```

---

## 🚀 快速部署到 GitHub Pages

### 步骤 1：创建 GitHub 仓库

1. 登录 GitHub，点击右上角 **New repository**
2. 仓库名填写 `star-slices`（或其他名字）
3. 选择 **Public**（公开仓库才能用 GitHub Pages）
4. 点击 **Create repository**

### 步骤 2：上传代码

在仓库页面点击 **uploading an existing file**，把所有文件拖进去上传。

或者在本地执行（需要安装 Git）：

```bash
cd C:\Users\Administrator\star-slices
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/star-slices.git
git push -u origin main
```

### 步骤 3：开启 GitHub Pages

1. 进入仓库 **Settings** → **Pages**
2. Source 选择 **Deploy from a branch** → **main** 分支 → **/ (root)**
3. 点击 **Save**
4. 等待 1-2 分钟，访问 `https://你的用户名.github.io/star-slices/`

---

## 🎨 自定义字体

用户要求网页使用自定义字体 `zt.tts`。

**操作方法：**
1. 将字体文件（`.ttf` 或 `.otf`）命名为 `zt.tts` 放入项目根目录
2. 在 `css/style.css` 和 `admin/admin.css` 顶部 `@import` 部分添加：

```css
@font-face {
  font-family: 'ZTCustom';
  src: url('../zt.tts') format('truetype');
  font-weight: normal;
  font-style: normal;
}
```

3. 将 `:root` 里的 `--font-main` 改为 `'ZTCustom', sans-serif`

> 💡 建议字体文件控制在 2MB 以内，TTF 格式兼容性最好。

---

## 📁 音频文件放置

1. 将 MP3 文件放入 `assets/audio/` 目录
2. 文件命名建议与切片 ID 对应，如 `slice-001.mp3`
3. 在后台添加切片时，填写相对路径：`assets/audio/slice-001.mp3`

---

## ⚙️ 后台访问

1. 打开前台页面，点击底部的 **管理后台** 或直接访问 `/admin/`
2. 默认账号：`admin`，密码：`123456`
3. ⚠️ 首次登录必须修改默认密码！

---

## ⚠️ 关于数据持久化

当前代码为**纯静态页面**，数据保存在浏览器本地存储中。

**如需完整后台功能（增删改查切片），推荐以下方案之一：**

### 方案 A：腾讯云 COS + Workers（推荐）

1. 注册腾讯云，开通 COS 对象存储
2. 创建一个**公有读私有写**的 Bucket
3. 使用腾讯云 Workers 写一个简单的 CRUD API
4. 修改 `admin.js` 中的 `saveFile()` 函数，改为调用 Workers API

### 方案 B：GitHub API（免费）

1. 在 GitHub 创建一个 Personal Access Token
2. 修改 `admin.js` 中的 `saveFile()` 使用 GitHub REST API 提交文件
3. 优点：免费；缺点：需要每次手动配置

### 方案 C：Cloudflare Workers + KV

免费额度完全够个人使用，部署简单。

---

## 🎀 樱花图标自定义

在后台 **站点设置** → **网站图标 URL** 中填入 SVG/PNG 链接。

默认图标在 `assets/icons/default.svg`，可用以下代码替换为粉色樱花：

```html
<!-- assets/icons/default.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <text y=".9em" font-size="90">🌸</text>
</svg>
```

---

## 底部版权

页面底部已自动显示：
- 侵权投诉：`1578929129@qq.com`
- 版权信息：`©️ ZMXC`

如需修改，可直接在 `index.html` 底部 footer 区域编辑。

---

**祝部署顺利！🌸**
