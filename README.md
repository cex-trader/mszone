# 我的音乐空间

> 作者：cex-trader + Claude

自托管音乐搜索与播放站，单个 `index.html`，无需构建。

支持网易云、酷我、JOOX、QQ 四个音源。移动端优先的深色 UI，底部三标签导航；桌面宽度 ≥980px 自动切换三栏布局。

## 部署

把 `index.html` 放到任意静态托管即可（GitHub Pages、Cloudflare Pages、Nginx 等）。

音乐 API 需要自建代理服务，将 `index.html` 顶部 `<script>` 里的接口地址改成你自己的代理地址。

## 功能

- 多源搜索（网易云 / 酷我 / JOOX / QQ）
- 在线播放、歌词面板、封面展示
- 收藏与自建歌单（支持 JSON 导入导出）
- 键盘快捷键，支持中英文切换

## 自定义

所有样式和逻辑都在单个 `index.html` 里，常用改动点：

- `--brand` CSS 变量 — 主题强调色（默认 `#ffcb2e`）
- 第一个 `<script>` 块顶部的 API 地址
- `i18n` 对象里的界面文案

## 致谢

基于 [CharlesPikachu/musicsquare](https://github.com/CharlesPikachu/musicsquare) 二次开发，感谢原作者的开源贡献。
