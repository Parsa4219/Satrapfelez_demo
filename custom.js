/* =============================================================
   SATRAP FELEZ — custom.js  v3 — Performance Optimized
   بهینه‌سازی‌های کلیدی:
   ─ cursor RAF: dirty flag — فقط وقتی ماوس حرکت کرده اجرا میشه
   ─ scroll: یه RAF واحد، بدون parallax سنگین
   ─ section parallax و letter-bg transform حذف شد
   ─ event delegation به جای forEach listener روی هر کارت
   ─ magnetic و tilt: throttled با RAF
   ─ resize: debounced
   ─ section nav: IntersectionObserver به جای scroll
============================================================= */

'use strict';

const state = {
  mouse:       { x: -200, y: -200 },
  scrollY:     0,
  docH:        1,
  winH:        window.innerHeight,
  mouseDirty:  false,
  scrollDirty: false,
};

const qs       = (sel, ctx = document) => ctx.querySelector(sel);
const qsa      = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
// cached — جلوگیری از re-evaluate در هر بار صدا زدن
const IS_MOBILE = isMobile();


/* ═══════════════════════════════════════════════════════════
   LOADING SCREEN
═══════════════════════════════════════════════════════════ */
(function initLoader() {
  const loader = document.createElement('div');
  loader.id = 'sf-loader';
  loader.innerHTML = `
    <div class="sf-loader__inner">
      <img src="images/RTL_LOGO_transparent.png" alt="ساتراپ فلز"
           class="sf-loader__logo" onerror="this.style.display='none'">
      <div class="sf-loader__name">ساتراپ فلز</div>
      <div class="sf-loader__bar-wrap">
        <div class="sf-loader__bar" id="sfLoaderBar"></div>
      </div>
      <div class="sf-loader__pct" id="sfLoaderPct">۰٪</div>
    </div>`;

  const style = document.createElement('style');
  style.textContent = `
    #sf-loader{position:fixed;inset:0;z-index:99999;background:#04101A;
      display:flex;align-items:center;justify-content:center;
      transition:opacity .5s ease,visibility .5s ease;}
    #sf-loader.sf-loader--done{opacity:0;visibility:hidden;pointer-events:none;}
    .sf-loader__inner{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(320px,80vw);}
    .sf-loader__logo{height:56px;width:auto;filter:drop-shadow(0 0 16px rgba(245,200,0,.25));animation:sfLP 1.8s ease-in-out infinite;}
    @keyframes sfLP{0%,100%{opacity:.75}50%{opacity:1}}
    .sf-loader__name{font-family:'Vazirmatn',sans-serif;font-size:.75rem;font-weight:600;letter-spacing:.3em;color:rgba(255,255,255,.3);text-transform:uppercase;}
    .sf-loader__bar-wrap{width:100%;height:2px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden;}
    .sf-loader__bar{height:100%;width:0%;background:linear-gradient(to right,#F5C800,#4A8EC2);border-radius:2px;box-shadow:0 0 12px rgba(245,200,0,.5);transition:width .2s ease;}
    .sf-loader__pct{font-family:'Vazirmatn',sans-serif;font-size:.62rem;color:rgba(255,255,255,.2);letter-spacing:.2em;}`;
  document.head.appendChild(style);
  document.body.appendChild(loader);

  const bar  = qs('#sfLoaderBar');
  const pct  = qs('#sfLoaderPct');
  const toFa = n => n.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

  function setProgress(p) {
    if (bar) bar.style.width = p + '%';
    if (pct) pct.textContent = toFa(Math.round(p)) + '٪';
  }
  function dismiss() {
    setProgress(100);
    setTimeout(() => loader.classList.add('sf-loader--done'), 300);
  }

  let progress = 0;
  const fake = setInterval(() => {
    progress += Math.random() * 18;
    if (progress >= 85) { clearInterval(fake); progress = 85; }
    setProgress(progress);
  }, 120);

  window.addEventListener('load', () => {
    clearInterval(fake);
    // صبر کن تا فونت‌ها هم لود بشن (مهم برای ایران / شبکه کند)
    if ('fonts' in document) {
      document.fonts.ready.then(dismiss);
    } else {
      dismiss();
    }
  });
  setTimeout(dismiss, 6000);
})();


/* ═══════════════════════════════════════════════════════════
   PAGE TRANSITION
═══════════════════════════════════════════════════════════ */
(function initPageTransition() {
  const overlay = document.createElement('div');
  overlay.id = 'sf-transition';
  const s = document.createElement('style');
  s.textContent = `
    #sf-transition{position:fixed;inset:0;z-index:9999;background:#04101A;
      opacity:0;pointer-events:none;transition:opacity .35s ease;}
    #sf-transition.sf-trans--in{opacity:1;pointer-events:all;}`;
  document.head.appendChild(s);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add('sf-trans--in');
    requestAnimationFrame(() => overlay.classList.remove('sf-trans--in'));
  });

  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') ||
        href.startsWith('mailto')) return;
    // لینک‌هایی مثل index.html#projects نباید transition داشته باشن
    const hrefWithoutHash = href.split('#')[0];
    if (!hrefWithoutHash.endsWith('.html')) return;
    // اگه همین صفحه هست فقط به anchor برو
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (hrefWithoutHash === currentPage || hrefWithoutHash === '') return;
    e.preventDefault();
    overlay.classList.add('sf-trans--in');
    setTimeout(() => { window.location.href = href; }, 350);
  });
})();


/* ═══════════════════════════════════════════════════════════
   LAZY LOAD
═══════════════════════════════════════════════════════════ */
(function initLazyLoad() {
  if (!('IntersectionObserver' in window)) return;

  const imgObs = new IntersectionObserver(entries => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      if (target.dataset.src) {
        target.src = target.dataset.src;
        if (target.dataset.srcset) target.srcset = target.dataset.srcset;
        target.removeAttribute('data-src');
      }
      imgObs.unobserve(target);
    });
  }, { rootMargin: '200px' });
  qsa('img[data-src]').forEach(el => imgObs.observe(el));

  const bgObs = new IntersectionObserver(entries => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      target.style.backgroundImage = `url('${target.dataset.bg}')`;
      target.removeAttribute('data-bg');
      bgObs.unobserve(target);
    });
  }, { rootMargin: '300px' });
  qsa('[data-bg]').forEach(el => bgObs.observe(el));
})();


/* ═══════════════════════════════════════════════════════════
   SECTION NAV DOTS — IntersectionObserver (بدون scroll)
═══════════════════════════════════════════════════════════ */
(function initSectionNav() {
  if (IS_MOBILE) return;
  const rawSections = qsa('section[id], footer[id]');
  if (rawSections.length < 2) return;

  const sections = rawSections.map(sec => ({
    el: sec,
    label:
      qs('.section-label', sec)?.textContent?.trim() ||
      qs('h2', sec)?.textContent?.trim().slice(0, 20) ||
      sec.id,
  }));

  const nav = document.createElement('nav');
  nav.id = 'sf-section-nav';
  const s = document.createElement('style');
  s.textContent = `
    #sf-section-nav{position:fixed;left:28px;top:50%;transform:translateY(-50%);z-index:900;
      display:flex;flex-direction:column;align-items:center;gap:10px;opacity:0;transition:opacity .5s ease;}
    #sf-section-nav.visible{opacity:1;}
    .sf-snav__dot{position:relative;width:6px;height:6px;border-radius:50%;
      background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.12);cursor:none;
      transition:background .3s,transform .3s,border-color .3s;}
    .sf-snav__dot.active{background:#F5C800;border-color:#F5C800;transform:scale(1.5);box-shadow:0 0 8px rgba(245,200,0,.6);}
    .sf-snav__dot:hover{background:rgba(255,255,255,.55);transform:scale(1.3);}
    .sf-snav__dot::after{content:attr(data-label);position:absolute;left:calc(100% + 12px);top:50%;
      transform:translateY(-50%);background:rgba(4,16,26,.9);color:rgba(255,255,255,.75);
      font-family:'Vazirmatn',sans-serif;font-size:.62rem;letter-spacing:.08em;white-space:nowrap;
      padding:5px 10px;border-radius:4px;border:1px solid rgba(255,255,255,.07);
      pointer-events:none;opacity:0;transition:opacity .25s;}
    .sf-snav__dot:hover::after{opacity:1;}
    .sf-snav__line{width:1px;height:10px;background:rgba(255,255,255,.08);}`;
  document.head.appendChild(s);

  sections.forEach((sec, i) => {
    if (i > 0) {
      const line = document.createElement('div');
      line.className = 'sf-snav__line';
      nav.appendChild(line);
    }
    const dot = document.createElement('div');
    dot.className = 'sf-snav__dot';
    dot.setAttribute('data-label', sec.label);
    dot.addEventListener('click', () =>
      sec.el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    nav.appendChild(dot);
  });
  document.body.appendChild(nav);

  const dots = qsa('.sf-snav__dot', nav);

  // active با IntersectionObserver — بدون scroll event
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const idx = sections.findIndex(s => s.el === entry.target);
      if (idx >= 0) dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    });
  }, { threshold: [0.1, 0.4], rootMargin: '0px 0px -20% 0px' });
  sections.forEach(sec => secObs.observe(sec.el));

  // نمایش nav بعد از hero
  const visObs = new IntersectionObserver(entries => {
    nav.classList.toggle('visible', !entries[0].isIntersecting);
  }, { threshold: 0.8 });
  visObs.observe(rawSections[0]);
})();


/* ═══════════════════════════════════════════════════════════
   CURSOR — dirty flag: RAF فقط وقتی ماوس حرکت کرده
═══════════════════════════════════════════════════════════ */
(function initCursor() {
  const pickbox   = qs('.autocad-cursor__pickbox');
  const crosshair = qs('.autocad-cursor__crosshair');
  if (!pickbox || !crosshair || IS_MOBILE) return;

  pickbox.style.willChange   = 'transform';
  crosshair.style.willChange = 'transform';

  let lerpX = -200, lerpY = -200;
  let isHovering = false;
  let rafRunning = false;

  const HOVER_SEL = [
    'a','button','.project-card','.ms-proj-card','.cs-proj-card',
    '.satrap-block','.client-card','.ms-type-card','.cs-type-card',
    '.ms-cap','.cs-cap','.sf-snav__dot',
  ].join(',');

  // event delegation — یه listener به جای صدها
  document.addEventListener('mouseover', e => {
    const hovering = !!e.target.closest(HOVER_SEL);
    if (hovering !== isHovering) {
      pickbox.classList.toggle('is-hovering', hovering);
      crosshair.classList.toggle('is-hovering', hovering);
      isHovering = hovering;
    }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    pickbox.style.opacity = crosshair.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    pickbox.style.opacity = crosshair.style.opacity = '1';
  });
  document.addEventListener('mousedown', () => pickbox.classList.add('is-clicking'));
  document.addEventListener('mouseup',   () => pickbox.classList.remove('is-clicking'));

  function cursorLoop() {
    rafRunning = false;
    const mx = state.mouse.x, my = state.mouse.y;

    // pickbox: مستقیم روی ماوس — بدون lerp
    pickbox.style.transform =
      `translate(calc(${mx}px - 50%), calc(${my}px - 50%))`;

    // crosshair: با lerp ملایم
    lerpX += (mx - lerpX) * 0.1;
    lerpY += (my - lerpY) * 0.1;
    crosshair.style.transform = `translate(${lerpX}px, ${lerpY}px)`;

    // اگه هنوز lerp در حال حرکته، frame بعدی رو بخواه
    if (Math.abs(mx - lerpX) > 0.3 || Math.abs(my - lerpY) > 0.3) {
      rafRunning = true;
      requestAnimationFrame(cursorLoop);
    } else {
      state.mouseDirty = false;
    }
  }

  document.addEventListener('mousemove', e => {
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
    if (!rafRunning) {
      rafRunning = true;
      requestAnimationFrame(cursorLoop);
    }
  }, { passive: true });
})();


/* ═══════════════════════════════════════════════════════════
   SCROLL — یه RAF loop، بدون parallax سنگین
═══════════════════════════════════════════════════════════ */
(function initScroll() {
  const nav      = qs('#mainNav');
  const scrollBar = qs('#scrollBar');
  // فقط hero__bg-photo برای index — parallax ساده
  const heroBg   = qs('.hero__bg-photo');
  const navLinks = qsa('.nav__links a');
  const sections = qsa('section[id], footer[id]');

  if (heroBg) heroBg.style.willChange = 'transform';

  let rafId = null;

  function onScrollFrame() {
    rafId = null;
    const sy = window.scrollY;
    const dh = document.documentElement.scrollHeight - state.winH;

    if (nav) nav.classList.toggle('scrolled', sy > 40);

    if (scrollBar) {
      scrollBar.style.width = dh > 0 ? Math.min(100, sy / dh * 100) + '%' : '0%';
    }

    // hero parallax — فقط وقتی hero در viewport هست
    if (heroBg && sy < state.winH * 1.5) {
      heroBg.style.transform = `translateY(${sy * 0.22}px)`;
    }

    // active nav link — loop از آخر برای سرعت بیشتر
    let current = '';
    for (let i = sections.length - 1; i >= 0; i--) {
      if (sy >= sections[i].offsetTop - 160) { current = sections[i].id; break; }
    }
    navLinks.forEach(link => {
      link.style.color =
        link.getAttribute('href') === '#' + current ? 'var(--yellow)' : '';
    });
  }

  window.addEventListener('scroll', () => {
    state.scrollY = window.scrollY;
    if (!rafId) rafId = requestAnimationFrame(onScrollFrame);
  }, { passive: true });

  // اجرای اولیه
  state.scrollY = window.scrollY;
  onScrollFrame();

  // resize با debounce
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      state.winH = window.innerHeight;
    }, 150);
  }, { passive: true });
})();


/* ─────────────────────────────────────────────
   HERO LOADED CLASS
───────────────────────────────────────────── */
(function() {
  const hero = qs('.hero');
  if (hero) requestAnimationFrame(() => hero.classList.add('loaded'));
})();


/* ─────────────────────────────────────────────
   REVEAL — IntersectionObserver
───────────────────────────────────────────── */
(function initReveal() {
  const els = qsa('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => obs.observe(el));
})();


/* ─────────────────────────────────────────────
   SATRAP BLOCK PROGRESS BARS
───────────────────────────────────────────── */
(function initProgressBars() {
  const blocks = qsa('.satrap-block');
  if (!blocks.length) return;
  if (!('IntersectionObserver' in window)) {
    blocks.forEach(b => b.classList.add('in-view'));
    return;
  }
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  blocks.forEach(b => obs.observe(b));
})();


/* ─────────────────────────────────────────────
   MAGNETIC BUTTONS — throttled RAF
───────────────────────────────────────────── */
(function initMagnetic() {
  if (IS_MOBILE) return;
  qsa('.btn-primary, .cs-btn-primary, .nav__cta').forEach(magnet => {
    let rafId = null;
    let lastE = null;
    magnet.addEventListener('mousemove', e => {
      lastE = e;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        if (!lastE) return;
        const r  = magnet.getBoundingClientRect();
        const dx = (lastE.clientX - r.left - r.width  / 2) * 0.25;
        const dy = (lastE.clientY - r.top  - r.height / 2) * 0.25;
        magnet.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
        rafId = null;
      });
    }, { passive: true });
    magnet.addEventListener('mouseleave', () => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      lastE = null;
      magnet.style.transform = '';
    });
  });
})();


/* ─────────────────────────────────────────────
   CARD TILT — throttled RAF
───────────────────────────────────────────── */
(function initTilt() {
  if (IS_MOBILE) return;
  qsa('.project-card, .ms-proj-card, .cs-proj-card').forEach(card => {
    let rafId = null;
    let lastE = null;
    card.addEventListener('mousemove', e => {
      lastE = e;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        if (!lastE) return;
        const r = card.getBoundingClientRect();
        const x = ((lastE.clientX - r.left) / r.width  - 0.5) * 2;
        const y = ((lastE.clientY - r.top)  / r.height - 0.5) * 2;
        card.style.transform =
          `translateY(-6px) scale(1.005) rotateX(${y * -3}deg) rotateY(${x * 3}deg)`;
        rafId = null;
      });
    }, { passive: true });
    card.addEventListener('mouseleave', () => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      lastE = null;
      card.style.transform = '';
    });
  });
})();


/* ─────────────────────────────────────────────
   STAGGER DELAYS
───────────────────────────────────────────── */
(function initStagger() {
  qsa('.footer__links').forEach(list => {
    qsa('a', list).forEach((link, i) => {
      link.style.transitionDelay = (i * 0.04) + 's';
    });
  });
})();