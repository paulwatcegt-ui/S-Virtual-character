# S-Virtual-character · 虚拟人实验室

基于 React、TypeScript、Vite 和 Tailwind CSS 的全屏交互页面。

新访问默认进入人物首页，点击“设计过程”、底部箭头或向下滚轮可进入设计过程页面；该页面包含建模记录、测试优化及核心代码讲解。浏览器返回与页内刷新保留正常导航行为。

当前版本加载 `public/models/character-optimized.glb`（用户提供的 `10-18调试版_优化.glb`，8,070,640 字节）。Three.js 内置 MeshoptDecoder 解码后，运行时添加头颈和眼部蒙皮，保留新模型原始字节、材质、纹理、节点变换与静止外观。详情见 `MODEL-REPLACEMENT.md`。

原始模型不含骨骼或动画。结构诊断、处理方式和验证结果见 `MODEL-REPORT.md`。页面布局、背景、导航、打字机文案、移动端菜单和邮箱复制保持原有实现。

## 本地运行

需要 Node.js、npm。当前优化 GLB 直接存储在 Git 中；两个旧模型备份使用 Git LFS，运行旧模型回归测试前需拉取备份资源。

```sh
git lfs install
git clone https://github.com/paulwatcegt-ui/S-Virtual-character.git
cd S-Virtual-character
git lfs pull
npm ci
npm run dev
```

本机可双击 `启动调试.cmd`，使用 `.local-tools` 中的便携 Node.js。新模型运行时自动绑定，无需 Python。`tools/build-character-rig.py` 仅用于旧模型备份。验证截图、测量 JSON、终端日志和本机启动脚本仅保留在本地，未纳入版本控制。

## 构建与预览

```sh
npm run build
npm run preview -- --port 4173
```

打开终端显示的本地地址。构建产物位于 `dist/`。

## 文件说明

- `src/main.tsx`：当前页面、菜单及邮箱复制逻辑。
- `src/index.css`：布局、动画与局部光影效果。
- `src/Character.tsx`：GLB 加载、相机、灯光、指针跟随和资源释放。
- `src/character-rig.mjs`：本模型的颈部、头部和眼部骨骼控制与四元数插值。
- `src/character-motion.mjs`：角度限制和平滑插值，可调整响应速度。
- `public/models/character.glb`：保持不变的原始 GLB 副本。
- `public/models/character-rigged.glb`：旧绑定模型备份，页面不再加载。
- `public/models/character-optimized.glb`：当前加载的优化 GLB。
- `src/model-config.mjs`：模型路径、节点映射、绑定参考区域与相机构图参数。
- `src/prepare-character.mjs`：新模型眼部球面拟合与非破坏性运行时蒙皮。
- `tools/build-character-rig.py`：可重复生成蒙皮副本的处理脚本。

验证：构建后运行 `node --test tools/character-motion.test.mjs tools/character-rig.test.mjs tools/optimized-character.test.mjs tools/model-chunks.test.mjs`。
开发服务下访问 `/tools/model-inspection.html` 可分别查看当前模型的四个网格；加上 `?pose=left-up` 可检查绑定后的极限姿态。`?pose=front&eyes=right&close=eyes` 可单独检查眼部运动。

邮箱为 `songpeien@163.com`。模型从本地项目加载，约 8.07 MB。邮箱复制应通过 localhost 或 HTTPS 使用。

## Cloudflare Pages 无损分块部署

无需 R2 或额外环境变量。保留生产分支 main、构建命令 npm run build、输出目录 dist。

构建时将 `MODEL_CONFIG.file` 指定的当前模型按字节拆为每块不超过 20 MiB 的分块；当前模型仅需 1 块，同时生成清单和 SHA-256 校验值。旧模型不会发布。浏览器下载、校验并还原原始字节，再解码和添加运行时绑定。内容哈希文件名避免旧缓存混入新模型。

本地开发直接读取优化 GLB，线上下载约 8.07 MB。解码后几何和纹理仍占用内存；分块不等于压缩。开发和生产卸载组件时均中止下载。通过 Git 克隆时须正确拉取 LFS 资源。

构建后运行 node --test tools/model-chunks.test.mjs，验证真实 HTTP 加载后与原模型 SHA-256 完全相同，并检查损坏分块和取消下载的处理。

鼠标灵敏度、死区、各部位时间常数、回正速度和最大角度集中在 `src/character-motion.mjs` 的 `FOLLOW_CONFIG`。响应测试记录见 `FOLLOW-TUNING.md`。页面默认不显示调试面板。
