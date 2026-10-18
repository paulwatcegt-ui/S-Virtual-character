# S-Virtual-character · 虚拟人实验室

基于 React、TypeScript、Vite 和 Tailwind CSS 的全屏交互页面。

当前调试版加载 `public/models/character-rigged.glb`：在原始模型副本中补充颈部、头部和左右眼骨骼及蒙皮权重，实现眼睛先响应、头部稍慢跟随、颈根保持稳定的鼠标交互。原模型、纹理和初始外观保留。

原始模型不含骨骼或动画。结构诊断、处理方式和验证结果见 `MODEL-REPORT.md`。页面布局、背景、导航、打字机文案、移动端菜单和邮箱复制保持原有实现。

## 本地运行

需要 Node.js、npm 和 Git LFS。两个 GLB 模型通过 Git LFS 保存，克隆后先拉取模型资源。

```sh
git lfs install
git clone https://github.com/paulwatcegt-ui/S-Virtual-character.git
cd S-Virtual-character
git lfs pull
npm ci
npm run dev
```

已包含可运行的绑定模型，无需重新生成。重新生成模型时，运行 `tools/build-character-rig.py`，需要 Python 和 numpy。验证截图、测量 JSON、终端日志和本机启动脚本仅保留在本地，未纳入版本控制。

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
- `public/models/character-rigged.glb`：页面实际加载的蒙皮副本。
- `tools/build-character-rig.py`：可重复生成蒙皮副本的处理脚本。

验证：`node --test tools/character-motion.test.mjs tools/character-rig.test.mjs`。
开发服务下访问 `/tools/model-inspection.html` 可分别查看原始四个网格；加上 `?pose=left-up` 可检查绑定后的极限姿态。`?pose=front&eyes=right&close=eyes` 可单独检查眼部运动。

邮箱为 `songpeien@163.com`。模型从本地项目加载，约 106 MB，首次打开需要等待加载。邮箱复制应通过 localhost 或 HTTPS 使用。

该项目仅在本地预览，没有配置 GitHub Pages 或自动部署。


鼠标灵敏度、死区、各部位时间常数、回正速度和最大角度集中在 `src/character-motion.mjs` 的 `FOLLOW_CONFIG`。响应测试记录见 `FOLLOW-TUNING.md`。页面默认不显示调试面板。
