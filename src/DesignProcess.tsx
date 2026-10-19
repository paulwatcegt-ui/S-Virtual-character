import React from 'react';
import portrait from './assets/process/portrait-reference.jpg';
import clayModel from './assets/process/clay-model.png';
import normalStudy from './assets/process/normal-study.png';
import partsStudy from './assets/process/parts-study.png';

const stages = [
  {id: 'form', number: '01', label: '建模与交互', english: 'MODELING & INTERACTION', title: '从形体检查，到自然回应。', text: '从统一灰白材质的白模出发，观察头身比例、面部起伏、发束层次与针织细节；再通过法线颜色检查表面朝向和转折。随后将头颈、躯干与两侧眼部分为独立部件，为局部运动明确边界。这些步骤共同构成从静态塑形到交互绑定的一次完整制作过程。', details: ['白模与法线检查', '头颈及眼部拆分', '绑定与鼠标交互']},
  {id: 'refinement', number: '02', label: '测试与优化', english: 'TEST & REFINE', title: '既要有生命感，也要经得起验证。', text: '依据项目中的动作、骨骼和模型加载测试，检查鼠标方向、转角限制、不同帧率下的响应，以及快速反向与离开页面后的回正。新模型还需验证静止姿态不移位、九组极限姿态下颈根固定、面部保持刚性，以及眼部中心运动时眼睑边缘稳定。', details: ['姿态与交互回归', '下载完整性验证', '桌面及移动端检查']},
];

const codeNotes = [
  {title: '页面如何切换？', file: 'main.tsx', text: 'React 管理人物首页、设计过程页和过渡状态。首页将向下滚轮累计到阈值后，统一调用 navigate；按钮与箭头也走同一个入口。切换期间加锁，避免一次连续滚动触发多次跳转；地址锚点则让刷新和浏览器返回仍能找到正确页面。', code: "if (accumulated >= 55) {accumulated = 0; navigate('process');}"},
  {title: '模型如何显示并获得控制能力？', file: 'Character.tsx · prepare-character.mjs', text: 'Three.js 的 GLTFLoader 配合内置 MeshoptDecoder 解码优化模型，再由 prepareCharacter 添加运行时蒙皮，createHeadRig 找到头颈和眼部控制骨骼。绑定保留原几何、材质与节点变换，相机根据模型包围盒适配取景。React 负责页面，Three.js 负责人物画面。', code: 'const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);\nprepareCharacter(model);\nrig = createHeadRig(model);'},
  {title: '头眼跟随为什么能平滑响应？', file: 'character-motion.mjs · character-rig.mjs', text: '鼠标位置先映射成受限目标角度，再用四元数插值驱动骨骼。插值系数由每帧经过的秒数计算，而不是每帧移动固定角度；眼睛、头部和颈部使用不同响应速度。计算眼部目标时扣除头部已有旋转，减少视线叠加；失焦或离开时用更慢的参数回正。', code: 'export function dampingAlpha(delta, tau) {\n  return -Math.expm1(-Math.max(0, Math.min(delta, FOLLOW_CONFIG.maxFrameDelta)) / tau);\n}'},
  {title: '怎样避免损坏资源进入画面？', file: 'model-chunks.mjs · vite.config.ts', text: '构建时生成带哈希的模型数据块及清单，浏览器下载后逐块校验 SHA-256。大小不符、校验失败或连接长时间停滞都会报错并进入有限重试；离开组件时取消下载。这样既能检查资源完整性，也能避免旧缓存与新模型混用。', code: "const digest = await crypto.subtle.digest('SHA-256', result.subarray(offset, offset + part.size));\n// 将 digest 转为十六进制 hash 后，比较清单中的校验值\nif (hash !== part.sha256) throw new Error('Model chunk checksum mismatch');"},
  {title: '阅读过程页时，人物还在渲染吗？', file: 'Character.tsx · main.tsx', text: '进入设计过程页后，active 状态阻止动画循环继续执行骨骼更新和画面渲染。人物对象与已加载资源仍然保留，返回首页时直接恢复，避免重复下载和解码。初始化中创建的四元数、向量及姿态对象也会被反复复用，减少每帧分配。', code: 'if (!isActive.current) {previousTime = time; return;}'},
];

function ProcessFigure({src, alt, number, title, caption}: {src: string; alt: string; number: string; title: string; caption: string}) {
  return <figure className="process-photo">
    <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`查看原图：${title}`}><img src={src} alt={alt} loading="lazy" decoding="async"/></a>
    <figcaption><div><span>{number}</span><strong>{title}</strong><span className="photo-expand" aria-hidden="true">↗</span></div><p>{caption}</p></figcaption>
  </figure>;
}

export default function DesignProcess({onBack}: {onBack: () => void}) {
  return <div className="process-page">
    <header className="process-header">
      <a href="#" onClick={event => {event.preventDefault(); onBack();}} className="process-back"><span aria-hidden="true">↖</span> 返回虚拟人实验室</a>
      <span className="process-header-label">设计过程 / THE MAKING</span>
      <a href="mailto:songpeien@163.com" className="process-contact">聊聊你的想法 <span aria-hidden="true">↗</span></a>
    </header>
    <main className="process-main" id="design-process" tabIndex={-1}>
      <section className="process-intro" aria-labelledby="process-title">
        <div className="process-intro-copy">
          <p className="process-eyebrow">BEHIND THE CHARACTER <span>创作手记 · 01</span></p>
          <h1 id="process-title">从一个想法，<br/>到一种<span>存在。</span></h1>
          <p className="process-lead">从一张原型肖像出发，经过塑形、表面检查与部件拆分，<br/>让静止的形象，成为浏览器里会回应的角色。</p>
          <a href="#form" className="process-explore">探索创作过程 <span aria-hidden="true">↓</span></a>
        </div>
        <div className="process-art process-reference"><div className="reference-frame"><img src={portrait} width="1108" height="1419" alt="模型原型参考：蓝色背景中的黑发青年，身着黑色西装与领带" decoding="async"/><span>REFERENCE / 00</span></div><div className="process-art-caption"><span>原型肖像 / 形象的起点</span><span>从真实，到数字。</span></div></div>
      </section>
      <nav className="process-index" aria-label="设计阶段">
        {stages.map(stage => <a href={`#${stage.id}`} key={stage.id}><span>{stage.number}</span>{stage.label}<span aria-hidden="true">↘</span></a>)}
      </nav>
      <div className="process-stages">
        {stages.map(stage => <section className={`process-stage ${stage.id === 'form' ? 'stage-with-photos' : ''}`} id={stage.id} key={stage.id} aria-labelledby={`${stage.id}-title`}>
          <div className="process-stage-label"><span>{stage.number}</span><p>{stage.label}<small>{stage.english}</small></p></div>
          <div className="process-stage-body"><h2 id={`${stage.id}-title`}>{stage.title}</h2><p>{stage.text}</p>
            {stage.id === 'form' && <p>网页加载的模型保留四个网格，在解码后添加头颈与左右眼绑定：躯干和颈根保持稳定，眼睛先响应，头颈随后跟随。头部左右限制在 ±15°、上下 ±8°，眼部限制在 ±6° / ±4°。鼠标离开、窗口失焦或打开菜单时，角色缓慢回到默认方向。</p>}
            {stage.id === 'refinement' && <p>沿用优化 GLB 的 Meshopt 压缩、量化顶点与 WebP 纹理，将模型下载量从旧绑定版的 106.33 MB 降至 8.07 MB。加载后的原始几何属性和材质保持不变，绑定只在初始化时计算；动画更新复用计算对象，进入设计过程页时暂停人物渲染，返回时复用已加载的模型。</p>}
            <ul>{stage.details.map(detail => <li key={detail}>{detail}</li>)}</ul>
          </div>
          {stage.id === 'form' && <div className="process-photo-gallery">
            <ProcessFigure src={clayModel} alt="建模过程一：灰白材质的半身人物模型，展示发束、五官和针织上衣细节" number="01" title="白模 · 观察形体" caption="用统一的灰白材质观察面部体积、发型轮廓、领口与针织纹理，让注意力回到形体本身。"/>
            <ProcessFigure src={normalStudy} alt="建模过程二：使用蓝紫绿等颜色显示表面朝向的人物法线可视化" number="02" title="法线 · 观察表面" caption="颜色呈现表面朝向的变化，辅助检查头发、脸部和服装细节处的转折；这不是最终的角色配色。"/>
            <ProcessFigure src={partsStudy} alt="建模过程三：橙色头颈、绿色躯干以及蓝色和紫色眼部的分离视图" number="03" title="拆分 · 明确控制边界" caption="用不同颜色区分头颈、服装躯干和两侧眼部。图中的分离位置用于展示部件关系，网页中的角色按原始位置组装并进行局部蒙皮控制。"/>
          </div>}
          {stage.id === 'refinement' && <aside className="process-metrics" aria-label="本地验证与优化数据"><div><strong>8.07<small> MB</small></strong><span>当前模型下载大小</span></div><div><strong>92.4<small>%</small></strong><span>相比旧绑定模型减少</span></div><div><strong>14<small> 项</small></strong><span>模型与交互自动测试通过</span></div></aside>}
          {stage.id === 'refinement' && <div className="process-verification">
            <h3>从文件到画面，逐层验证。</h3>
            <div className="verification-grid"><article><span>01 / 资源</span><h4>下载完整，才进入解析。</h4><p>生产加载按分块执行 SHA-256 校验，并测试损坏检测、连接停滞重试和取消下载。当前模型小于 20 MiB，只需一个数据块。</p></article><article><span>02 / 动作</span><h4>细微回应，也有清晰边界。</h4><p>通过静止姿态、九组极限姿态与快速反向测试，检查躯干、颈根和眼睑的稳定性，同时验证不同刷新率下的头颈响应。</p></article><article><span>03 / 页面</span><h4>回到实际使用中检查。</h4><p>浏览器检查覆盖桌面与移动布局、刷新加载、头眼跟随、邮箱复制、菜单、滚轮跳转和返回路径；生产构建也已通过。</p></article></div>
            <section className="process-code-notes" aria-labelledby="code-notes-title"><p className="process-eyebrow">HOW IT WORKS / 网页如何运转</p><h3 id="code-notes-title">支撑体验的五个关键功能。</h3><p className="code-notes-intro">从本地实现中挑出最重要的逻辑，结合核心代码节选，说明画面、交互与加载如何配合。</p>{codeNotes.map((note, i) => <article className="code-note" key={note.title}><div className="code-note-heading"><span>0{i + 1}</span><h4>{note.title}</h4></div><p>{note.text}</p><div className="code-sample"><span>{note.file} / 核心节选</span><pre><code>{note.code}</code></pre></div></article>)}</section>
            <p className="verification-note">当前边界：模型与原站均没有眨眼、表情或待机动画；这些功能尚未实现。构建仍有脚本包体积提示，尚未进行跨显卡长期性能测试。</p>
          </div>}
        </section>)}
      </div>
      <footer className="process-footer"><p>形象的诞生，<br/>也是对话的开始。</p><button onClick={onBack}>回到角色，感受他的回应 <span aria-hidden="true">↗</span></button><div><span>虚拟人实验室</span><span>持续探索，持续生长。</span></div></footer>
    </main>
  </div>;
}
