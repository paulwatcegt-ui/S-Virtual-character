# 优化模型替换交付记录

日期：2026-10-19。项目：`D:\CodexWork\虚拟形象设计`。

## 检查与选择

项目使用 React 19、Three.js 0.186.1、GLTFLoader 和 Vite，没有 React Three Fiber。页面入口为 src/main.tsx，人物渲染在 src/Character.tsx，动作参数在 src/character-motion.mjs，骨骼控制在 src/character-rig.mjs。

用户文件 `E:\素材库\3D模型\10-18调试版_优化.glb` 已原样复制为 public/models/character-optimized.glb，大小 8,070,640 字节，SHA-256 为 `3f00472ff065feb1f3ee7533d13fb0f9e932ccd15357fdd19b001c29ef958724`。没有重新压缩或重做纹理。

新 GLB 包含四个独立网格，没有 skin、骨骼、动画或 Morph Targets。part_0 为头发、面部及连通颈部；part_1 为服装躯干；part_2、part_3 为包含周边眼睑的眼部表面，并非完整独立眼球。新网格的局部平移、量化缩放与旧模型不同，但解码后的世界尺寸和方向仍与旧构图相符。

新模型使用 EXT_meshopt_compression、KHR_mesh_quantization、EXT_texture_webp、KHR_materials_specular。材质保留原 baseColor、normal、metallicRoughness 和 specular 配置。使用 Three.js 自带 MeshoptDecoder，无新增项目依赖。

## 非破坏性适配

保留新文件的全部字节。加载解码后保留原 POSITION、NORMAL、UV、索引、材质对象和节点变换，添加 skinIndex、skinWeight。绑定矩阵包含各网格的实际缩放、平移与旋转，静止姿态不改变表面。

运行时创建 CharacterRigRoot → Neck → Head → Eye_L / Eye_R。part_1 不蒙皮、不移动。头颈权重在原始世界坐标中过渡，颈根固定，并保护低处下巴以保持面部刚性。保留头颈 30% / 70% 分配。

眼部控制在新解码网格上重新拟合球面中心和眼睑长轴；配置中的中心只限定拟合搜索区域。拟合样本不足、半径超出预期或相对残差超过 1% 时明确报错，避免用不匹配的眼轴静默驱动。眼部中心蒙皮到眼骨骼，外围渐变回 Head。由于原模型不是完整眼球，此替代只针对现有小角度注视，不应扩展为大角度眼球旋转。

最大头部左右 ±15°、上下 ±8°；眼部 ±6° / ±4°。眼睛先响应，扣除当前头部转角避免重复叠加视线。保留时间相关阻尼、快速反向限制、失焦/离开/菜单打开后的平滑回正。

相机按实际模型包围盒高度和底部位置计算取景，沿用原桌面/移动水平构图比例。原灯光、透明画布、色彩空间、像素比、页面 CSS 和背景效果均未改变；原实现没有启用实时阴影贴图，此次没有额外开启。

## 功能与限制

- 成功继承头部跟随、独立眼动、固定颈根、平滑停止和回正。
- 保留加载提示、失败提示、下载取消、生产哈希校验、停滞重试和内容哈希缓存。
- 保留导航、打字机文案、响应式布局、移动菜单、Escape 关闭及邮箱复制。
- 旧站没有眨眼、表情或待机动画实现，新旧模型也均无动画片段或 Morph Targets。因此没有可继承的眨眼/表情/待机功能，未伪造已经恢复；AnimationMixer 的动画支持路径保留。
- 相同节点命名不是通用人形绑定保证。本适配针对实际检查过的文件，并校验模型结构、世界尺寸及眼部拟合；更换其他资产需要重新检查。

## 备份与修改文件

旧模型 public/models/character.glb、character-rigged.glb 原样保留。替换前 src、tools、vite.config.ts、README.md 已备份至 verification/backup-before-model-replacement/，不进入生产构建。

- public/models/character-optimized.glb：新资产。
- src/model-config.mjs：模型路径、节点映射、参考绑定区域、取景参数。
- src/prepare-character.mjs：结构检查、球面拟合、运行时蒙皮。
- src/Character.tsx：Meshopt 解码、加载新模型、可取消开发下载、包围盒取景、调用适配。
- src/character-rig.mjs：集中节点映射，复用每帧姿态对象以减少分配。
- vite.config.ts：生产分块来源跟随当前模型配置。
- tools/optimized-character.test.mjs：新压缩模型真实解码与绑定回归。
- tools/character-rig.test.mjs：刷新率测试保留姿态快照，避免复用结果对象影响断言。
- tools/model-chunks.test.mjs：分块数量与源模型随实际文件大小确定，不再固定六块。
- tools/model-inspection.html：检查入口改为当前模型，支持 Meshopt 与运行时绑定。
- README.md、MODEL-REPLACEMENT.md：当前使用和交付说明。MODEL-REPORT.md、FOLLOW-TUNING.md 保留为历史记录。
- .local-tools/browser-check/model-replacement.cjs：本地浏览器验证脚本，不是项目依赖。

模型替换阶段没有修改 src/main.tsx、src/index.css、package.json 或 package-lock.json；随后新增设计过程页面时调整了页面入口与样式。同步内容包含模型适配和设计过程页面，依赖配置保持不变。本地工具、启动脚本、接手记录和验证备份不纳入同步。

## 验证

构建：npm run build 通过。自动测试：

```sh
node --test tools/character-motion.test.mjs tools/character-rig.test.mjs tools/optimized-character.test.mjs tools/model-chunks.test.mjs
```

14 项通过。覆盖输入映射、帧率一致性、原模型回归、新模型哈希/几何/材质不变、绑定姿态、九组极限姿态、眼部中心运动与眼睑固定、快速反向和回正，以及生产真实 HTTP 分块还原、损坏检测、停滞重试和取消。Node 几何测试跳过图片解码，真实 WebP 解码另在 Chrome 中验证。

Chrome 验证开发和生产：模型状态 ready、骨骼初始化、四角鼠标极限姿态、静止、桌面 1440×900、移动 390×844、移动菜单及 Escape、菜单回正、刷新后重新加载。邮箱复制检查结果为 songpeien@163.com。每次导航开发仅请求一个 GLB，生产仅请求一个 manifest 和一个数据块；没有重复加载旧模型。

截图及浏览器记录位于 verification/model-replacement/。已目视检查正面、转头、抬头/低头和移动页面截图，未见明显颈部裂口或材质缺失。未增加页面 JS 异常；原有 favicon.ico 404 仍存在。

## 性能

下载量从旧绑定模型 106,334,980 字节降至 8,070,640 字节，减少约 92.4%。解码顶点数从旧 893,329 降至新 327,763。使用文件已有优化，不对新模型进一步降质。运行时绑定和拟合只在加载时执行，动画循环复用四元数、欧拉角和姿态对象。原有开发诊断字符串仍仅在 DEV 下输出。

生产仍有 Vite 大于 500 kB 的 JS 提示（约 900 kB 未 gzip，约 245 kB gzip），不是构建错误。纹理和解码几何仍占用 GPU/内存。无界面 Chrome 的软件 WebGL 检查没有发现运行失败，但其 rAF 时间不能当作实体桌面 GPU 的 FPS 保证；未做跨显卡长时间基准。
