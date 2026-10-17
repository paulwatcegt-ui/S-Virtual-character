import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

function useTypewriter(text: string, speed = 38, startDelay = 600) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      interval = setInterval(() => setCount(c => {if(c >= text.length) {clearInterval(interval); return c;} return c+1;}), speed);
    }, startDelay);
    return () => {clearTimeout(timeout); clearInterval(interval);};
  }, [text, speed, startDelay]);
  return {displayed: text.slice(0,count), done: count >= text.length};
}

const sections = ['灵感实验室'];

function App() {
  const video=useRef<HTMLVideoElement>(null);
  const [open,setOpen] = useState(false);
  const [visible,setVisible] = useState(false);
  const [copied,setCopied] = useState(false);
  const [copyError,setCopyError] = useState(false);
  const {displayed,done} = useTypewriter('很高兴你来到这里。相同的品味，总会让我们相遇。那么，一起创造点什么？');
  useEffect(() => {const t = setTimeout(() => setVisible(true),400); return () => clearTimeout(t);},[]);
  useEffect(() => {
    const v=video.current!;
    let prevX:number|null=null, targetTime=0;
    const seek=()=>{if(Number.isFinite(v.duration)&&!v.seeking&&Math.abs(v.currentTime-targetTime)>.025) v.currentTime=targetTime;};
    const move=(e:MouseEvent)=>{
      if(prevX===null){prevX=e.clientX;return;}
      const delta=e.clientX-prevX;prevX=e.clientX;
      if(!Number.isFinite(v.duration))return;
      targetTime=Math.max(0,Math.min(v.duration,targetTime+delta/window.innerWidth*.8*v.duration));seek();
    };
    const reset=()=>{prevX=null;};
    const ready=()=>{targetTime=Math.min(.08,v.duration);seek();};
    v.addEventListener('seeked',seek);v.addEventListener('loadedmetadata',ready);
    window.addEventListener('mousemove',move);document.addEventListener('mouseleave',reset);
    return()=>{v.removeEventListener('seeked',seek);v.removeEventListener('loadedmetadata',ready);window.removeEventListener('mousemove',move);document.removeEventListener('mouseleave',reset);};
  },[]);
  useEffect(() => {const escape = (e: KeyboardEvent) => {if(e.key==='Escape'){setOpen(false);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
  async function copy() {try {await navigator.clipboard.writeText('songpeien@163.com');setCopied(true);setCopyError(false);setTimeout(()=>setCopied(false),2200);} catch {setCopyError(true);}}
  return <>
    <video ref={video} className="background" muted playsInline preload="auto" aria-hidden="true" src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_041744_63efcd78-bf7d-4039-99e2-2461e8a61903.mp4"/>
    <div className="face-depth" aria-hidden="true"/>
    <div className="shade"/>
    <header className="fixed top-0 w-full z-30 px-5 sm:px-8 py-4 sm:py-5 flex justify-between items-center text-white">
      <span className="flex items-center logo" role="img" aria-label="主页"><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7"/><path d="M5 9v12h5v-7h4v7h5V9"/></svg></span>
      <nav className="hidden md:flex text-[23px]" aria-label="主导航">{sections.map((name,i)=><React.Fragment key={name}>{i>0&&<span className="whitespace-pre">, </span>}<span className="">{name}</span></React.Fragment>)}</nav>
      <span className="hidden md:block text-[23px] underline underline-offset-2 ">前往主页</span>
      <button onClick={()=>setOpen(!open)} className={'hamburger md:hidden '+(open?'active':'')} aria-label={open?'关闭菜单':'打开菜单'} aria-expanded={open} aria-controls="mobile-menu"><span/><span/><span/></button>
    </header>
    <nav id="mobile-menu" aria-label="移动端导航" inert={!open} className={'mobile-menu md:hidden '+(open?'is-open':'')}>
      {sections.map(name=><span key={name}>{name}</span>)}<span className="underline underline-offset-4">前往主页</span>
    </nav>
    <main className="relative z-10 h-screen flex flex-col justify-end pb-12 md:justify-center md:pb-0 px-5 sm:px-8 md:px-10 overflow-hidden">
      <div className="max-w-xl relative z-10 hero-content">
        
        <p className="typewriter mb-5 sm:mb-6">{displayed}{!done&&<span className="cursor"/>}</p>
        <div className={'pills flex flex-wrap gap-y-1 '+(visible?'visible':'')}>
          <span className="pill">分享你的想法</span>
          <span className="pill">加入我们</span>
          <div className="email-row"><button className="pill outline" onClick={copy}><span>{copied?'已复制！':<>联系我：<span className="underline underline-offset-1">songpeien@163.com</span></>}</span><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 5.5V2.8a.8.8 0 0 0-.8-.8H2.8a.8.8 0 0 0-.8.8v6.9a.8.8 0 0 0 .8.8h2.7"/></svg></button></div>
        </div><span className="sr-only" role="status">{copied?'邮箱地址已复制。':''}</span>{copyError&&<p className="text-sm mt-2">暂时无法复制，请手动复制：<span className="select-text">songpeien@163.com</span></p>}
      </div>
    </main>
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);

