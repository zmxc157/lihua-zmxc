# 星辰桑切片站 · 任务记录

## 时间
2026-08-29

## 任务
制作星辰桑栗花小小切片指引系统网页，托管部署于 GitHub Pages

## 完成内容

### 文件结构
```
star-slices/
├── index.html              (4.1 KB)  前台首页
├── README.md              (4.2 KB)  部署说明
├── .nojekyll             GitHub Pages 构建用
├── .gitignore
├── assets/icons/default.svg  默认图标
├── css/style.css          (16.2 KB) 前台样式（樱花粉主题）
├── js/app.js              (9.8 KB)  前台逻辑
├── _data/
│   ├── config.json       (304 B)   站点配置
│   └── slices.json       (1.7 KB)  切片数据
└── admin/
    ├── index.html         (12.5 KB) 管理后台
    ├── admin.css          (11.5 KB) 后台样式
    └── admin.js           (16.2 KB) 后台逻辑
```

### 功能实现
- **前台**：樱花粉主题 + 飘落樱花动画，分类筛选（默认：歌切/整活/未分类），模糊搜索，切片卡片展示（标题/日期/发布者/音频/跳转）
- **外部链接提示**：点击视频链接弹出确认弹窗
- **问卷功能**：支持4种位置（弹窗/右下角浮岛/列表顶部/列表底部），可配置多个
- **后台**：账号 admin / 密码 123456，默认密码强制要求修改；切片增删改查；站点标题/说明/图标配置；问卷管理
- **底部**：侵权投诉 1578929129@qq.com，版权 ©️ ZMXC

### 注意事项
- 自定义字体 zt.tts 需用户自行放入根目录，并在 CSS 中配置 @font-face
- GitHub Pages 纯静态部署时，后台数据写操作需配置后端（腾讯云 COS / Cloudflare Workers / GitHub API）
- 详见 README.md 部署指南
