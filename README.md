# 灵感实验室

基于 React、TypeScript、Vite 和 Tailwind CSS 的全屏交互页面。

当前版本使用原人物背景视频，鼠标横移控制视频进度，包含中文打字机文案、移动端菜单和邮箱复制按钮。面部局部明暗增强采用 CSS 效果，不改变原视频五官结构。

## 本地运行

需要 Node.js 及 npm。

```sh
npm ci
npm run dev
```

## 构建与预览

```sh
npm run build
npm run preview -- --port 4173
```

打开终端显示的本地地址。构建产物位于 `dist/`。

## 文件说明

- `src/main.tsx`：当前页面、鼠标控制视频进度、菜单及邮箱复制逻辑。
- `src/index.css`：布局、动画与局部光影效果。

邮箱为 `songpeien@163.com`。视频和字体通过外部地址加载，访问页面时需要网络；视频和字体的可用性受对应服务影响。邮箱复制应通过 localhost 或 HTTPS 使用。

该项目仅在本地预览，没有配置 GitHub Pages 或自动部署。

