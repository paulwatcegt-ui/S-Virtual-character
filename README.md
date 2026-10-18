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

## Cloudflare Pages 无损分块部署

无需 R2 或额外环境变量。保留生产分支 main、构建命令 npm run build、输出目录 dist。

构建时自动将实际使用的 character-rigged.glb 按字节拆为 6 个分块，每块不超过 20 MiB，同时生成清单和 SHA-256 校验值。不会发布两个完整 GLB。浏览器顺序下载、校验并还原原始字节，再使用原 GLTFLoader 解析；模型材质、纹理、骨骼、姿态与跟随逻辑不变。内容哈希文件名避免旧缓存混入新模型。

本地开发仍直接读取原 GLB。首次线上加载仍需下载约 106 MB，并占用模型缓冲区内存；分块不等于压缩。卸载组件时中止下载。Git LFS 必须正确拉取模型，否则构建会明确失败。

构建后运行 node --test tools/model-chunks.test.mjs，验证真实 HTTP 加载后与原模型 SHA-256 完全相同，并检查损坏分块和取消下载的处理。

鼠标灵敏度、死区、各部位时间常数、回正速度和最大角度集中在 `src/character-motion.mjs` 的 `FOLLOW_CONFIG`。响应测试记录见 `FOLLOW-TUNING.md`。页面默认不显示调试面板。
