import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import Character from './Character';
import DesignProcess from './DesignProcess';

const processHashes = new Set(['#design-process', '#form', '#refinement']);
const currentPage = () => processHashes.has(window.location.hash) ? 'process' : 'home';
function initialPage() {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  // A new visit starts with the character, even when opening a saved process URL.
  // Reloading an already-open process page keeps the reader's current location.
  if (navigation?.type !== 'reload') {
    if (processHashes.has(window.location.hash)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return 'home';
  }
  return currentPage();
}

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

const sections = ['虚拟人实验室'];
const homeUrl = 'https://songpeien.pages.dev/';
const heroTitle = '让想象拥有形态，让角色拥有生命。';
const heroSubtitle = '在虚拟与现实之间，探索数字形象的无限可能。';

function App() {
  const [page, setPage] = useState(initialPage);
  const [transitioning, setTransitioning] = useState(false);
  const [destination, setDestination] = useState('process');
  const transitionLock = useRef(false);
  const transitionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [open,setOpen] = useState(false);
  const [visible,setVisible] = useState(false);
  const [copied,setCopied] = useState(false);
  const [copyError,setCopyError] = useState(false);
  const {displayed,done} = useTypewriter(heroTitle + heroSubtitle);
  const navigate = useCallback((next: 'home' | 'process') => {
    if (transitionLock.current) return;
    transitionLock.current = true;
    setDestination(next);
    setTransitioning(true);
    setOpen(false);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    transitionTimers.current = [setTimeout(() => {
      window.history.pushState(null, '', window.location.pathname + window.location.search + (next === 'process' ? '#design-process' : ''));
      setPage(next);
      window.scrollTo(0, 0);
    }, reduced ? 0 : 650), setTimeout(() => {
      setTransitioning(false);
      transitionLock.current = false;
      requestAnimationFrame(() => document.getElementById(next === 'process' ? 'design-process' : 'character-home')?.focus({preventScroll: true}));
    }, reduced ? 30 : 1350)];
  }, []);
  useEffect(() => {
    const sync = () => {
      transitionTimers.current.forEach(clearTimeout);
      transitionLock.current = false;
      setTransitioning(false);
      setOpen(false);
      setPage(currentPage());
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); transitionTimers.current.forEach(clearTimeout);};
  }, []);
  useEffect(() => {
    document.body.style.overflow = page === 'home' || transitioning ? 'hidden' : '';
    document.title = page === 'process' ? '设计过程 · 虚拟人实验室' : 'S-Virtual-character';
    return () => {document.body.style.overflow = '';};
  }, [page, transitioning]);
  useEffect(() => {
    let accumulated = 0, lastWheel = 0;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (transitionLock.current) {event.preventDefault(); return;}
      if (page !== 'home' || open) return;
      event.preventDefault();
      if (event.deltaY <= 0) {accumulated = 0; return;}
      const now = performance.now();
      if (now - lastWheel > 180) accumulated = 0;
      lastWheel = now;
      accumulated += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (accumulated >= 55) {accumulated = 0; navigate('process');}
    };
    window.addEventListener('wheel', wheel, {passive: false});
    return () => window.removeEventListener('wheel', wheel);
  }, [page, open, navigate]);
  useEffect(() => {const t = setTimeout(() => setVisible(true),400); return () => clearTimeout(t);},[]);
  useEffect(() => {const escape = (e: KeyboardEvent) => {if(e.key==='Escape'){setOpen(false);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
  async function copy() {try {await navigator.clipboard.writeText('songpeien@163.com');setCopied(true);setCopyError(false);setTimeout(()=>setCopied(false),2200);} catch {setCopyError(true);}}
  return <>
    <div hidden={page !== 'home'} inert={transitioning}>
    <Character menuOpen={open} active={page === 'home' && !transitioning}/>
    <div className="face-depth" aria-hidden="true"/>
    <div className="shade"/>
    <header className="fixed top-0 w-full z-30 px-5 sm:px-8 py-4 sm:py-5 flex justify-between items-center text-white">
      <a href={homeUrl} className="flex items-center logo" aria-label="主页"><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7"/><path d="M5 9v12h5v-7h4v7h5V9"/></svg></a>
      <nav className="hidden md:flex text-[23px]" aria-label="主导航">{sections.map((name,i)=><React.Fragment key={name}>{i>0&&<span className="whitespace-pre">, </span>}<span className="">{name}</span></React.Fragment>)}</nav>
      <a href={homeUrl} className="hidden md:block text-[23px] underline underline-offset-2 ">前往主页</a>
      <button onClick={()=>setOpen(!open)} className={'hamburger md:hidden '+(open?'active':'')} aria-label={open?'关闭菜单':'打开菜单'} aria-expanded={open} aria-controls="mobile-menu"><span/><span/><span/></button>
    </header>
    <nav id="mobile-menu" aria-label="移动端导航" inert={!open} className={'mobile-menu md:hidden '+(open?'is-open':'')}>
      {sections.map(name=><span key={name}>{name}</span>)}<a href={homeUrl} className="underline underline-offset-4">前往主页</a>
    </nav>
    <main id="character-home" tabIndex={-1} className="home-main relative z-10 h-screen flex flex-col justify-end pb-12 md:justify-center md:pb-0 px-5 sm:px-8 md:px-10 overflow-hidden">
      <div className="max-w-xl relative z-10 hero-content">
        
        <div className="typewriter hero-copy mb-5 sm:mb-6">
          <p className="hero-copy-title">{displayed.slice(0, heroTitle.length)}{displayed.length < heroTitle.length&&<span className="cursor"/>}</p>
          <p className="hero-copy-subtitle">{displayed.slice(heroTitle.length)}{displayed.length >= heroTitle.length&&!done&&<span className="cursor"/>}</p>
        </div>
        <div className={'pills flex flex-wrap gap-y-1 '+(visible?'visible':'')}>
          <a className="pill" href="#design-process" onClick={event => {event.preventDefault(); navigate('process');}}>设计过程</a>
          <div className="email-row"><button className="pill outline" onClick={copy}><span>{copied?'已复制！':<>联系我：<span className="underline underline-offset-1">songpeien@163.com</span></>}</span><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 5.5V2.8a.8.8 0 0 0-.8-.8H2.8a.8.8 0 0 0-.8.8v6.9a.8.8 0 0 0 .8.8h2.7"/></svg></button></div>
        </div><span className="sr-only" role="status">{copied?'邮箱地址已复制。':''}</span>{copyError&&<p className="text-sm mt-2">暂时无法复制，请手动复制：<span className="select-text">songpeien@163.com</span></p>}
      </div>
      <a className="scroll-cue" href="#design-process" aria-label="向下探索设计过程" onClick={event => {event.preventDefault(); navigate('process');}}><span>探索设计过程</span><svg width="24" height="32" viewBox="0 0 24 32" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M12 2v26M4 20l8 8 8-8"/></svg></a>
    </main>
    </div>
    {page === 'process' && <div inert={transitioning}><DesignProcess onBack={() => navigate('home')}/></div>}
    {transitioning && <div className="page-transition" role="status" aria-live="polite"><div className="transition-grid" aria-hidden="true"/><div className="transition-copy"><p>虚拟人实验室 / THE MAKING</p><h2>{destination === 'process' ? <>从想象，<br/>到发生。</> : <>让角色，<br/>再次回应。</>}</h2><div className="transition-line"/><span>{destination === 'process' ? '正在走进设计过程' : '正在返回虚拟人实验室'}</span></div><span className="transition-corner" aria-hidden="true">{destination === 'process' ? '01 — 02' : '02 — 01'} ↘</span></div>}
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);

