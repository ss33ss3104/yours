/* 画面の高さ：アドレスバーの出入りで変わらない「小さい画面の高さ」（100svh）を測っておき、スクロール連動の計算に使う。
   幅が変わったときだけ測り直す（iOSはスクロールのたびにアドレスバーで高さが変わり、resizeが飛ぶため）。 */
const stableVH = (() => {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
  document.documentElement.appendChild(probe);
  let vh = probe.offsetHeight || innerHeight, w = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== w) { w = innerWidth; vh = probe.offsetHeight || innerHeight; } }, { passive: true });
  return () => vh;
})();
// 幅が変わったときだけ呼ぶresize（高さだけの変化は無視する）
const onWidthResize = fn => { let w = innerWidth; addEventListener('resize', () => { if (innerWidth !== w) { w = innerWidth; fn(); } }, { passive: true }); };
const touchUI = matchMedia('(hover: none), (pointer: coarse)').matches;


const chosen=new URLSearchParams(location.search).get('service');
const select=document.querySelector('#service');
if(select&&['work','living','short','undecided'].includes(chosen))select.value=chosen;
document.querySelectorAll('form').forEach(f=>f.addEventListener('submit',event=>event.preventDefault()));
const menuButton=document.querySelector('.menu-toggle');
const menu=document.querySelector('#site-menu');
function closeMenu(){document.body.classList.remove('nav-open');menuButton?.setAttribute('aria-expanded','false');if(menuButton)menuButton.textContent='メニュー';}
menuButton?.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';document.body.classList.toggle('nav-open',open);menuButton.setAttribute('aria-expanded',String(open));menuButton.textContent=open?'閉じる':'メニュー';});
menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menuButton?.getAttribute('aria-expanded')==='true'){closeMenu();menuButton.focus();}});

/* 動きの設計：入口は「ふわっと弾む」、スクロールでは「人が街を歩く」。
   JavaScriptが無い場合と動きを止めた場合は、すべての内容が最初から見える。 */
(() => {
  const root=document.documentElement;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  const store={get(){try{return localStorage.getItem('yours-motion')}catch{return null}},set(v){try{localStorage.setItem('yours-motion',v)}catch{}}};
  let stopped=store.get()==='off';
  const moving=()=>!reduce.matches&&!stopped;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

  // 見出しを1文字ずつ動かす。読み上げは元の文のまま。
  document.querySelectorAll('[data-split]').forEach(el=>{
    el.setAttribute('aria-label',el.textContent.replace(/\s+/g,''));
    let i=0;
    const walk=node=>{
      [...node.childNodes].forEach(child=>{
        if(child.nodeType===3){
          const frag=document.createDocumentFragment();
          [...child.textContent.trim()].forEach(ch=>{
            const s=document.createElement('span');
            s.className='ch';s.textContent=ch;s.setAttribute('aria-hidden','true');
            s.style.setProperty('--i',i++);frag.append(s);
          });
          child.replaceWith(frag);
        }else if(child.nodeType===1&&child.tagName!=='BR')walk(child);
      });
    };
    walk(el);
  });

  // 画面に入ったものへ印を付ける。
  const revealables=[...document.querySelectorAll('[data-split],[data-reveal],main:not(.editorial-home) .section>h2,.page-head h1,.principles article,.steps li,.home-item,.line-list li,.cost-examples article,.day-list li,.activity-list article,.meeting-records article,.service-divider,.footer-landscape')];
  revealables.forEach(el=>{if(!el.matches('[data-split]'))el.classList.add('rv');});
  const seen=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    entry.target.classList.add('is-in');seen.unobserve(entry.target);
  }),{threshold:.14,rootMargin:'0px 0px -6% 0px'});
  const early=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    entry.target.classList.add('is-in');early.unobserve(entry.target);
  }),{threshold:0,rootMargin:'0px 0px 15% 0px'});
  revealables.forEach(el=>(el.matches('.service-divider,.footer-landscape')?early:seen).observe(el));

  // スクロール連動。計測は読み込み時とサイズ変更時だけにし、毎フレームは書き込みだけ行う。
  const items=[...document.querySelectorAll('[data-walk],[data-drift],[data-parallax]')].map(el=>{
    const anchor=el.closest('.chapter,.town-story,.contact-finale')||el.parentElement;
    const walk=el.dataset.walk?el.dataset.walk.split(',').map(Number):null;
    return{el,anchor,walk,steps:Number(el.dataset.steps||0),drift:Number(el.dataset.drift||0),parallax:Number(el.dataset.parallax||0),top:0,height:0,width:0,visible:false};
  });
  const track=document.querySelector('[data-band]');
  const days=[...document.querySelectorAll('.day-list')].map(el=>({el,top:0,height:0}));
  let vh=stableVH();
  const measure=()=>{
    vh=stableVH();
    const y=scrollY;
    items.forEach(it=>{const r=it.anchor.getBoundingClientRect();it.top=r.top+y;it.height=r.height;it.width=it.anchor.clientWidth;});
    days.forEach(d=>{const r=d.el.getBoundingClientRect();d.top=r.top+y;d.height=r.height;});
  };
  const paint=()=>{
    const y=scrollY;
    if(track)track.style.transform=`translate3d(${-(y*.32)%(track.scrollWidth/2)}px,0,0)`;
    items.forEach(it=>{
      if(y+vh<it.top-200||y>it.top+it.height+200)return;
      const p=clamp((y+vh-it.top)/(vh+it.height),0,1);
      if(it.walk){
        const x=(it.walk[0]+(it.walk[1]-it.walk[0])*p)/100*it.width;
        const bob=it.steps?Math.abs(Math.sin(p*it.steps*Math.PI))*-9:0;
        const tilt=it.steps?Math.sin(p*it.steps*Math.PI)*2.2:0;
        it.el.style.transform=`translate3d(${x.toFixed(1)}px,${bob.toFixed(1)}px,0) rotate(${tilt.toFixed(2)}deg)`;
      }else if(it.drift){
        it.el.style.transform=`translate3d(${(it.drift*(p-.5)*2).toFixed(2)}%,0,0)`;
      }else{
        it.el.style.transform=`translate3d(0,${(it.parallax*(y+vh/2-it.top-it.height/2)).toFixed(1)}px,0)`;
      }
    });
    days.forEach(d=>d.el.style.setProperty('--p',clamp((y+vh*.62-d.top)/d.height,0,1).toFixed(3)));
  };
  let queued=false;
  const onScroll=()=>{if(queued||!moving())return;queued=true;requestAnimationFrame(()=>{queued=false;paint();});};
  const clearInline=()=>{items.forEach(it=>it.el.style.removeProperty('transform'));track?.style.removeProperty('transform');days.forEach(d=>d.el.style.setProperty('--p','1'));};

  // ポインタに少しだけ反応する。タッチや動きを抑える設定では使わない。
  const pointerItems=[...document.querySelectorAll('[data-pointer]')];
  if(matchMedia('(hover:hover) and (pointer:fine)').matches&&pointerItems.length){
    let px=0,py=0,pending=false;
    addEventListener('pointermove',e=>{
      if(!moving())return;
      px=e.clientX/innerWidth-.5;py=e.clientY/innerHeight-.5;
      if(pending)return;pending=true;
      requestAnimationFrame(()=>{pending=false;pointerItems.forEach(el=>{const k=Number(el.dataset.pointer);el.style.translate=`${(px*k).toFixed(1)}px ${(py*k).toFixed(1)}px`;});});
    },{passive:true});
  }

  // 追従するヘッダー。下へ読むときは隠し、上へ戻ると現れる。
  const header=document.querySelector('.header');
  let lastY=scrollY;
  const onHeader=()=>{
    const y=scrollY;
    header?.classList.toggle('is-stuck',y>140);
    if(document.body.classList.contains('nav-open'))header?.classList.remove('is-hidden');
    else if(Math.abs(y-lastY)>6){header?.classList.toggle('is-hidden',y>lastY&&y>420);}
    if(Math.abs(y-lastY)>6)lastY=y;
  };

  // 揺れるWebPと静止画を切り替える。
  const boilSources=[...document.querySelectorAll('source[data-boil]')];
  boilSources.forEach(s=>{s.dataset.src=s.getAttribute('srcset');});
  const syncBoil=()=>boilSources.forEach(s=>{
    if(moving())s.setAttribute('srcset',s.dataset.src);else s.removeAttribute('srcset');
  });

  const toggle=document.querySelector('.motion-toggle');
  const apply=()=>{
    const on=moving();
    root.classList.toggle('motion-on',on);
    root.classList.toggle('motion-off',!on);
    if(toggle){toggle.hidden=reduce.matches;toggle.setAttribute('aria-pressed',String(stopped));toggle.textContent=stopped?'動かす':'動きを止める';}
    syncBoil();
    if(on){measure();paint();}else{clearInline();pointerItems.forEach(el=>el.style.removeProperty('translate'));}
  };
  toggle?.addEventListener('click',()=>{stopped=!stopped;store.set(stopped?'off':'on');apply();});
  reduce.addEventListener?.('change',apply);

  addEventListener('scroll',()=>{onScroll();onHeader();},{passive:true});
  onWidthResize(()=>{measure();onScroll();});
  addEventListener('load',()=>{measure();onScroll();});
  document.fonts?.ready.then(()=>{measure();onScroll();});
  apply();onHeader();
  // 開閉や画像読み込みで高さが変わったときも測り直す。
  if('ResizeObserver' in window){const ro=new ResizeObserver(()=>{measure();onScroll();});ro.observe(document.body);}
})();

/* なめらかなスクロール（Lenis 1.1.20・MIT、assets/vendor/）。試用中：URLに ?lenis=0 を付けると無効にして比べられる。
   スマホの指のスクロールにも効かせる（syncTouch）。動きを止める設定・動きを減らす設定・メニューを開いている間は使わない。 */
(() => {
  if (!window.Lenis || new URLSearchParams(location.search).get('lenis') === '0' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  let lenis = null, raf = 0;
  const loop = t => { lenis?.raf(t); raf = requestAnimationFrame(loop); };
  const on = () => {
    if (lenis) return;
    lenis = new Lenis({ lerp: .1, smoothWheel: true, syncTouch: true, syncTouchLerp: .07, touchMultiplier: .9, touchInertiaMultiplier: 15, anchors: { offset: -24 } });
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const off = () => { if (!lenis) return; lenis.destroy(); lenis = null; cancelAnimationFrame(raf); raf = 0; };
  const sync = () => {
    if (root.classList.contains('motion-off')) return off();
    on();
    if (document.body.classList.contains('nav-open')) lenis.stop(); else lenis.start();
  };
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
  window.__lenis = () => lenis;
})();

/* FV：写真と縦書きのキャッチ・説明・2つの入口。ロード画面は最低1.5秒見せ、写真とフォントが揃ったら本編を始める。届かなくても3.5秒で進める。 */
(() => {
  const sec = document.querySelector('.rise'); if (!sec) return;
  const photo = sec.querySelector('.rise-photo img'), loader = document.querySelector('.site-loader'), header = document.querySelector('.header');
  const measure = () => sec.style.setProperty('--hh', (header.offsetTop + header.offsetHeight) + 'px');
  const ready = () => { sec.classList.add('is-ready'); loader?.classList.add('is-done'); };
  sec.querySelectorAll('.rise-copy h1 .ch').forEach(c => { if (c.textContent === '・') c.classList.add('rise-naka'); });
  const assets = Promise.all([
    photo.decode ? photo.decode().catch(() => {}) : 0,
    document.fonts?.load ? document.fonts.load('700 40px "fot-tsukuardgothic-std"', '地').catch(() => {}) : 0,
    document.fonts?.load ? document.fonts.load('400 40px "Zen Old Mincho Catch"', 'ま').catch(() => {}) : 0,
  ]);
  Promise.all([Promise.race([assets, new Promise(r => setTimeout(r, 3500))]), new Promise(r => setTimeout(r, 1500))]).then(ready, ready);
  onWidthResize(measure);
  addEventListener('load', measure);
  measure();
  // 下端の波：FVを画面に留めたまま、画面の45%ぶんのスクロールで生成りを画面の約3割までせり上げる（CSSの .motion-on .rise の高さと対）。動きを止めているときは動かさない
  let queued = false;
  const tide = () => {
    queued = false;
    const p = document.documentElement.classList.contains('motion-off') ? 0 : Math.min(1, Math.max(0, scrollY / (stableVH() * .45)));
    sec.style.setProperty('--p', p.toFixed(4));
    sec.style.setProperty('--lift', (p * (2 - p) * stableVH() * .32).toFixed(1) + 'px');
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(tide); } }, { passive: true });
  new MutationObserver(tide).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  tide();

  // 下端の3層の波を、コードで描いた波形で動かす。長さの違う2つの波を逆向きに進めて重ね、同じ形が横に流れるのではなく水面のようにうねらせる
  const tideEl = sec.querySelector('.rise-tide'), back = sec.querySelector('.tide-back'), mid = sec.querySelector('.tide-mid'), front = sec.querySelector('.tide-wave');
  const layers = [
    { el: back, paths: [...back.querySelectorAll('path')], hk: 1.2, base: .42, a1: .17, a2: .07, l1: .62, l2: .27, s1: .55, s2: -.8, ph: 0 },
    { el: mid, paths: [...mid.querySelectorAll('path')], hk: 1.1, base: .42, a1: .12, a2: .06, l1: .48, l2: .21, s1: -.7, s2: .95, ph: 2.1 },
    { el: front, hk: 1, base: .45, a1: .13, a2: .06, l1: .7, l2: .3, s1: .45, s2: -.72, ph: 4.2 },
  ];
  let W = 0, E = 0, waveRaf = 0, seen = true;
  let frontSvg = null, frontPath = null;
  if (touchUI) {
    const NS = 'http://www.w3.org/2000/svg';
    frontSvg = document.createElementNS(NS, 'svg'); frontSvg.setAttribute('class', 'tide-front'); frontSvg.setAttribute('preserveAspectRatio', 'none'); frontSvg.setAttribute('aria-hidden', 'true');
    frontPath = document.createElementNS(NS, 'path'); frontSvg.appendChild(frontPath);
    front.after(frontSvg); tideEl.classList.add('has-svg-front');
  }
  const sizeWaves = () => {
    W = tideEl.clientWidth; E = back.getBoundingClientRect().height / 1.2;
    layers.forEach(L => { if (L.el.tagName === 'svg') L.el.setAttribute('viewBox', `0 0 ${W} ${(E * L.hk).toFixed(1)}`); });
    if (frontSvg) frontSvg.setAttribute('viewBox', `0 0 ${W} ${(E + 6).toFixed(1)}`);
  };
  const stageEl = sec.querySelector('.rise-stage');
  const points = (L, t, grow) => {
    const h = E * L.hk, k1 = 2 * Math.PI / (W * L.l1), k2 = 2 * Math.PI / (W * L.l2), a1 = E * L.a1 * grow, a2 = E * L.a2 * grow, step = Math.max(12, W / 120), out = [];
    for (let x = 0; x <= W + step; x += step) {
      const X = Math.min(x, W);
      out.push([X, h * L.base + a1 * Math.sin(k1 * X + L.s1 * t + L.ph) + a2 * Math.sin(k2 * X + L.s2 * t)]);
    }
    return out;
  };
  const drawWaves = now => {
    const t = now / 1000, grow = 1 + (parseFloat(sec.style.getPropertyValue('--p')) || 0) * .6;
    layers.forEach(L => {
      const pts = points(L, t, grow);
      if (L.paths) {
        const h = (E * L.hk + 2).toFixed(1), d = pts.map(([x, y], n) => (n ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join('');
        L.paths.forEach(p => p.setAttribute('d', `${d}L${W} ${h}L0 ${h}Z`));
      } else {
        // 手前の波は紙を重ねず、FVそのものを波の形で切り抜く。下にはページの紙の地がそのまま見え、ABOUTと継ぎ目なくつながる
        if (touchUI) {
          // スマホ：FV全体（大きな写真）を毎フレーム切り抜くと描き直しが重いので、紙の色の波をSVGで描いて重ねる
          const hh = (E + 6).toFixed(1), d = pts.map(([x, y], n) => (n ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join('');
          frontPath.setAttribute('d', `${d}L${W} ${hh}L0 ${hh}Z`);
        } else {
          const off = tideEl.getBoundingClientRect().top - stageEl.getBoundingClientRect().top + E * .42;  // スマホ幅の「下から入る」ずらし（translate）も含めた位置
          const d = pts.reverse().map(([x, y]) => 'L' + x.toFixed(1) + ' ' + (y + off).toFixed(1)).join('');
          stageEl.style.clipPath = `path('M0 0L${W} 0${d}Z')`;
          stageEl.classList.add('is-clipped');
        }
      }
    });
  };
  const moves = () => document.documentElement.classList.contains('motion-on');
  let lastDraw = 0;
  const loop = now => { waveRaf = 0; if (!touchUI || now - lastDraw > 32) { lastDraw = now; drawWaves(now); } if (moves() && seen) waveRaf = requestAnimationFrame(loop); };
  const startWaves = () => { if (!waveRaf) waveRaf = requestAnimationFrame(loop); };
  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { seen = en.isIntersecting; if (seen) startWaves(); }).observe(tideEl);
  onWidthResize(() => { sizeWaves(); startWaves(); });
  new MutationObserver(startWaves).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  sizeWaves(); startWaves();

})();

/* ABOUT：見出しと説明文を固定した画面で、街のイラストが波の向こうからせり上がり、人が順に飛び出す。 */
(() => {
  const root = document.documentElement, town = document.querySelector('.town-story'); if (!town) return;
  const stage = town.querySelector('.town-stage'), island = town.querySelector('.rise-island'), copy = town.querySelector('.town-copy'),
    wave = town.querySelector('.rise-wave'), people = [...town.querySelectorAll('.rise-person')];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t * t * (3 - 2 * t), mix = (a, b, t) => a + (b - a) * t;
  const backOut = t => { const s = 1.5, u = t - 1; return 1 + u * u * ((s + 1) * u + s); };
  const on = () => root.classList.contains('motion-on');
  let H = 0, top = 0, travel = 1, iw = 0, y0 = 0, y1 = 0, copy0 = 0, cur = 0, raf = 0;
  function measure() {
    if (!on()) return;
    H = stage.clientHeight; top = town.getBoundingClientRect().top + scrollY; travel = Math.max(1, town.offsetHeight - H);
    iw = island.offsetWidth; const ih = iw * 2 / 3, waveTop = H - wave.offsetHeight * .62;
    y0 = H - ih * .24;           // 最初からタワーの先端だけ見せて、上がってくることを予告する
    copy.style.transform = 'none';
    const box = copy.getBoundingClientRect();
    const gap = innerWidth <= 760 ? -ih * .08 : 16;  // スマホは空の部分だけ文章の下端に少しかける
    y1 = Math.max(waveTop - ih * .965, box.bottom - stage.getBoundingClientRect().top + gap);  // 全身が波の上に出るか、見出し・説明文の下端で止める
    copy0 = (H - box.height) / 2 - (box.top - stage.getBoundingClientRect().top);  // 最初は見出しを画面の中央に置く
  }
  function paint(s) {
    const p = clamp(s / travel), q = seg(p, 0, .78);
    const x = innerWidth <= 760 ? -iw * .57 : -iw / 2;  // PCは画面の中央
    island.style.transform = `translate3d(${x.toFixed(1)}px,${(y0 + (y1 - y0) * q).toFixed(1)}px,0) scale(${(.86 + .14 * q).toFixed(4)})`;
    copy.style.transform = `translate3d(0,${mix(copy0, 0, ease(seg(p, 0, .5))).toFixed(1)}px,0)`;
    people.forEach((el, o) => {
      const t = seg(p, .3 + o * .08, .58 + o * .08);
      el.style.transform = `translate3d(0,${((1 - backOut(t)) * (el.offsetHeight + wave.offsetHeight * .56 + 24)).toFixed(1)}px,0)`;
    });
  }
  function tick() {
    raf = 0; if (!on()) return;
    const target = clamp(scrollY - top, 0, travel);
    cur += (target - cur) * (touchUI ? 1 : .16);
    if (Math.abs(target - cur) < .4) cur = target;
    paint(cur);
    if (cur !== target) raf = requestAnimationFrame(tick);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  function reset() { [island, copy, ...people].forEach(el => el.style.removeProperty('transform')); }
  function sync() { if (on()) { measure(); cur = clamp(scrollY - top, 0, travel); paint(cur); } else reset(); }
  addEventListener('scroll', kick, { passive: true });
  onWidthResize(sync);
  addEventListener('load', sync);
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class'] });
  document.fonts?.ready.then(sync);
  sync();
})();

// トップFVの写真が、画面の中でマウスに少し引っ張られる。マウスのある端末だけ。動きを止めている間・動きを減らす設定では動かさない。
(() => {
  const sec = document.querySelector('.rise');
  const img = sec && sec.querySelector('.rise-photo img');
  if (!img || !matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const MAX = 16; // 引っ張られる最大量（px）。端が見えないよう、写真は少し拡大しておく
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  img.style.scale = '1.09'; // 拡大の中心が下寄り（72%）なので、下端に余白を残すため大きめに
  const off = () => document.documentElement.classList.contains('motion-off');
  const tick = () => {
    x += (tx - x) * .06; y += (ty - y) * .06;
    img.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    raf = Math.abs(tx - x) > .05 || Math.abs(ty - y) > .05 ? requestAnimationFrame(tick) : 0;
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(tick); };
  sec.addEventListener('pointermove', e => {
    if (off()) { tx = ty = 0; go(); return; }
    const r = sec.getBoundingClientRect(), h = Math.min(r.height, innerHeight);
    tx = ((e.clientX - r.left) / r.width * 2 - 1) * MAX;
    ty = Math.max(-1, Math.min(1, (e.clientY - r.top) / h * 2 - 1)) * MAX;
    go();
  });
  sec.addEventListener('pointerleave', () => { tx = ty = 0; go(); });
})();
