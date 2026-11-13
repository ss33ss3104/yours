const button = document.querySelector('.menu-button');
const menu = document.querySelector('#mobile-nav');
button.addEventListener('click', () => {
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  menu.hidden = expanded;
});
menu.addEventListener('click', event => {
  if (event.target.closest('a')) { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !menu.hidden) { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); button.focus(); }
});

// 見出しと取り組みの各行が、画面に入ったら下から出る（動きを減らす設定では最初から表示）
const reveals = document.querySelectorAll('.reveal');
document.documentElement.classList.add('js');
if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
  reveals.forEach(el => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -12% 0px' });
  reveals.forEach(el => io.observe(el));
}

// FVの写真が枠の中でマウスに少し引っ張られる。マウスのある端末だけ。動きを減らす設定では止める。
(() => {
  const box = document.querySelector('.hero-image');
  const img = box && box.querySelector('img');
  if (!img || !matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const MAX = 14; // 引っ張られる最大量（px）。枠からはみ出ないよう、写真は少し拡大しておく
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  img.style.scale = '1.06';
  const tick = () => {
    x += (tx - x) * .08; y += (ty - y) * .08;
    img.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    raf = Math.abs(tx - x) > .05 || Math.abs(ty - y) > .05 ? requestAnimationFrame(tick) : 0;
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(tick); };
  box.addEventListener('pointermove', e => {
    const r = box.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width * 2 - 1) * MAX;
    ty = ((e.clientY - r.top) / r.height * 2 - 1) * MAX;
    go();
  });
  box.addEventListener('pointerleave', () => { tx = 0; ty = 0; go(); });
})();
