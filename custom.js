/* =============================================================
   SATRAP FELEZ — custom.js  v2
   Features:
   ─ Loading Screen با progress bar
   ─ Page Transition بین صفحات
   ─ Lazy Load تصاویر
   ─ Section Header Parallax
   ─ Sticky Progress Indicator (nav dots)
   ─ Refactored: یک RAF loop، یک scroll handler
   ─ Cross-page selectors (base / ms- / cs-)
============================================================= */

'use strict';

/* ─────────────────────────────────────────────
   SHARED STATE
───────────────────────────────────────────── */
const state = {
  mouse:   { x: -200, y: -200 },
  lerped:  { x: -200, y: -200 },
  scrollY: 0,
  docH:    1,
  winH:    window.innerHeight,
};

/* ─────────────────────────────────────────────
   UTILS
───────────────────────────────────────────── */
const lerp     = (a, b, t) => a + (b - a) * t;
const qs       = (sel, ctx = document) => ctx.querySelector(sel);
const qsa      = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const isMobile = () => window.matchMedia('(max-width: 768px)').matches;


/* ═══════════════════════════════════════════════════════════
   FEATURE 1 — LOADING SCREEN
   لوگو + progress bar که با window load پر میشه
   بعد از کامل شدن با fade از بین میره
═══════════════════════════════════════════════════════════ */
(function initLoader() {
  // لودر رو inject می‌کنیم — نیازی به تغییر HTML نیست
  const loader = document.createElement('div');
  loader.id = 'sf-loader';
  loader.innerHTML = `
    <div class="sf-loader__inner">
      <img src="images/RTL_LOGO_transparent.png"
           alt="ساتراپ فلز"
           class="sf-loader__logo"
           onerror="this.style.display='none'">
      <div class="sf-loader__name">ساتراپ فلز</div>
      <div class="sf-loader__bar-wrap">
        <div class="sf-loader__bar" id="sfLoaderBar"></div>
      </div>
      <div class="sf-loader__pct" id="sfLoaderPct">۰٪</div>
    </div>
  `;

  // استایل inline — مستقل از style.css
  const style = document.createElement('style');
  style.textContent = `
    #sf-loader {
      position: fixed; inset: 0; z-index: 99999;
      background: #04101A;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.6s ease, visibility 0.6s ease;
    }
    #sf-loader.sf-loader--done {
      opacity: 0; visibility: hidden; pointer-events: none;
    }
    .sf-loader__inner {
      display: flex; flex-direction: column;
      align-items: center; gap: 18px;
      width: min(320px, 80vw);
    }
    .sf-loader__logo {
      height: 56px; width: auto;
      filter: drop-shadow(0 0 16px rgba(245,200,0,0.25));
      animation: sfLoaderPulse 1.8s ease-in-out infinite;
    }
    @keyframes sfLoaderPulse {
      0%,100% { opacity: 0.75; }
      50%      { opacity: 1; }
    }
    .sf-loader__name {
      font-family: 'Vazirmatn', sans-serif;
      font-size: 0.75rem; font-weight: 600;
      letter-spacing: 0.3em; color: rgba(255,255,255,0.3);
      text-transform: uppercase;
    }
    .sf-loader__bar-wrap {
      width: 100%; height: 2px;
      background: rgba(255,255,255,0.07);
      border-radius: 2px; overflow: hidden;
    }
    .sf-loader__bar {
      height: 100%; width: 0%;
      background: linear-gradient(to right, #F5C800, #4A8EC2);
      border-radius: 2px;
      box-shadow: 0 0 12px rgba(245,200,0,0.5);
      transition: width 0.25s ease;
    }
    .sf-loader__pct {
      font-family: 'Vazirmatn', sans-serif;
      font-size: 0.62rem; color: rgba(255,255,255,0.2);
      letter-spacing: 0.2em;
      font-variant-numeric: tabular-nums;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(loader);

  const bar = qs('#sfLoaderBar');
  const pct = qs('#sfLoaderPct');

  // اعداد فارسی
  const toFa = n => n.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

  function setProgress(p) {
    if (bar) bar.style.width = p + '%';
    if (pct) pct.textContent = toFa(Math.round(p)) + '٪';
  }

  function dismiss() {
    setProgress(100);
    setTimeout(() => loader.classList.add('sf-loader--done'), 350);
  }

  // شبیه‌سازی پیشرفت — سریع تا ۸۵٪، بقیه منتظر load
  let progress = 0;
  const fake = setInterval(() => {
    progress += Math.random() * 18;
    if (progress >= 85) { clearInterval(fake); progress = 85; }
    setProgress(progress);
  }, 120);

  window.addEventListener('load', () => {
    clearInterval(fake);
    dismiss();
  });

  // حداکثر ۴ ثانیه صبر می‌کنیم
  setTimeout(dismiss, 4000);
})();


/* ═══════════════════════════════════════════════════════════
   FEATURE 2 — PAGE TRANSITION
   هر لینک داخلی (.html) → fade out → navigate → fade in
═══════════════════════════════════════════════════════════ */
(function initPageTransition() {
  // overlay که روی صفحه می‌کشه
  const overlay = document.createElement('div');
  overlay.id = 'sf-transition';
  const ovStyle = document.createElement('style');
  ovStyle.textContent = `
    #sf-transition {
      position: fixed; inset: 0; z-index: 9999;
      background: #04101A;
      opacity: 0; pointer-events: none;
      transition: opacity 0.38s ease;
    }
    #sf-transition.sf-trans--in  { opacity: 1; pointer-events: all; }
    #sf-transition.sf-trans--out { opacity: 0; pointer-events: none; }
  `;
  document.head.appendChild(ovStyle);
  document.body.appendChild(overlay);

  // fade in وقتی صفحه لود میشه
  requestAnimationFrame(() => {
    overlay.classList.add('sf-trans--in');
    requestAnimationFrame(() => overlay.classList.remove('sf-trans--in'));
  });

  // intercept کلیک‌ها روی لینک‌های داخلی
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    // فقط لینک‌های .html داخلی — نه anchor، نه external
    if (!href || href.startsWith('#') || href.startsWith('http') ||
        href.startsWith('mailto') || !href.endsWith('.html')) return;

    e.preventDefault();
    overlay.classList.add('sf-trans--in');
    setTimeout(() => { window.location.href = href; }, 380);
  });
})();


/* ═══════════════════════════════════════════════════════════
   FEATURE 3 — LAZY LOAD تصاویر
   المان‌هایی با data-bg یا <img data-src> رو lazy load می‌کنه
   برای hero bgها هم کار می‌کنه
═══════════════════════════════════════════════════════════ */
(function initLazyLoad() {
  if (!('IntersectionObserver' in window)) return;

  // img های معمولی با data-src
  const lazyImgs = qsa('img[data-src]');
  const imgObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      img.src = img.dataset.src;
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.removeAttribute('data-src');
      imgObs.unobserve(img);
    });
  }, { rootMargin: '200px' });
  lazyImgs.forEach(img => imgObs.observe(img));

  // div های با data-bg (background-image)
  const lazyBgs = qsa('[data-bg]');
  const bgObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.style.backgroundImage = `url('${el.dataset.bg}')`;
      el.removeAttribute('data-bg');
      bgObs.unobserve(el);
    });
  }, { rootMargin: '300px' });
  lazyBgs.forEach(el => bgObs.observe(el));
})();


/* ═══════════════════════════════════════════════════════════
   FEATURE 4 — STICKY SECTION PROGRESS INDICATOR
   نوار عمودی سمت چپ با dots — نشانگر position در صفحه
   فقط desktop، فقط اگه section های قابل تشخیص وجود داشته باشه
═══════════════════════════════════════════════════════════ */
(function initSectionNav() {
  if (isMobile()) return;

  // section هایی که id و یه عنوان قابل خوندن دارن
  const SECTION_SEL = 'section[id], footer[id]';
  const rawSections = qsa(SECTION_SEL);
  if (rawSections.length < 2) return;

  // label فارسی برای هر section (از section-label یا h2 اول)
  const sections = rawSections.map(sec => {
    const label =
      qs('.section-label', sec)?.textContent?.trim() ||
      qs('h2', sec)?.textContent?.trim().slice(0, 20) ||
      sec.id;
    return { el: sec, id: sec.id, label };
  });

  // ساخت nav
  const nav = document.createElement('nav');
  nav.id = 'sf-section-nav';

  const navStyle = document.createElement('style');
  navStyle.textContent = `
    #sf-section-nav {
      position: fixed;
      left: 28px; top: 50%;
      transform: translateY(-50%);
      z-index: 900;
      display: flex; flex-direction: column;
      align-items: center; gap: 10px;
      opacity: 0;
      transition: opacity 0.5s ease;
    }
    #sf-section-nav.visible { opacity: 1; }

    .sf-snav__dot {
      position: relative;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.12);
      cursor: none;
      transition: background 0.35s, transform 0.35s, border-color 0.35s;
    }
    .sf-snav__dot.active {
      background: #F5C800;
      border-color: #F5C800;
      transform: scale(1.5);
      box-shadow: 0 0 8px rgba(245,200,0,0.6);
    }
    .sf-snav__dot:hover {
      background: rgba(255,255,255,0.55);
      border-color: rgba(255,255,255,0.4);
      transform: scale(1.3);
    }

    /* tooltip */
    .sf-snav__dot::after {
      content: attr(data-label);
      position: absolute;
      left: calc(100% + 12px);
      top: 50%; transform: translateY(-50%);
      background: rgba(4,16,26,0.9);
      color: rgba(255,255,255,0.75);
      font-family: 'Vazirmatn', sans-serif;
      font-size: 0.62rem;
      letter-spacing: 0.08em;
      white-space: nowrap;
      padding: 5px 10px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.07);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.25s;
    }
    .sf-snav__dot:hover::after { opacity: 1; }

    /* خط اتصال بین dots */
    .sf-snav__line {
      width: 1px; height: 10px;
      background: rgba(255,255,255,0.08);
    }
  `;
  document.head.appendChild(navStyle);

  // ساخت dots
  sections.forEach((sec, i) => {
    if (i > 0) {
      const line = document.createElement('div');
      line.className = 'sf-snav__line';
      nav.appendChild(line);
    }
    const dot = document.createElement('div');
    dot.className = 'sf-snav__dot';
    dot.setAttribute('data-label', sec.label);
    dot.setAttribute('data-target', sec.id);
    dot.addEventListener('click', () => {
      sec.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nav.appendChild(dot);
  });

  document.body.appendChild(nav);

  // نمایش nav بعد از scroll اولیه
  function updateNav() {
    const scrollY = window.scrollY;

    // نمایش فقط بعد از ۱۰۰px scroll
    nav.classList.toggle('visible', scrollY > 100);

    // active dot
    let activeIdx = 0;
    sections.forEach((sec, i) => {
      if (scrollY >= sec.el.offsetTop - state.winH * 0.4) activeIdx = i;
    });

    qsa('.sf-snav__dot', nav).forEach((dot, i) => {
      dot.classList.toggle('active', i === activeIdx);
    });
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();
})();


/* ═══════════════════════════════════════════════════════════
   FEATURE 5 — SECTION HEADER PARALLAX
   عنوان‌های section با سرعت کمتر scroll می‌کنن
═══════════════════════════════════════════════════════════ */
(function initHeaderParallax() {
  if (isMobile()) return;

  // section-title هایی که داخل hero نیستن
  const titles = qsa('.section-title, .projects-hero__title').filter(el =>
    !el.closest('.hero, .ms-hero, .cs-hero, .projects-hero')
  );
  if (!titles.length) return;

  function updateParallax() {
    titles.forEach(el => {
      const rect   = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - state.winH / 2;
      // ±20px حرکت — subtle
      const offset = center * 0.06;
      el.style.transform = `translateY(${offset}px)`;
    });
  }

  window.addEventListener('scroll', updateParallax, { passive: true });
  updateParallax();
})();


/* ─────────────────────────────────────────────
   CURSOR
───────────────────────────────────────────── */
(function initCursor() {
  // اگه touch device باشه یا hover نداشته باشه، کرسر نمی‌خوایم
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  // المان‌های کرسر رو inject می‌کنیم
  const crosshair = document.createElement('div');
  crosshair.className = 'autocad-cursor__crosshair';
  const pickbox = document.createElement('div');
  pickbox.className = 'autocad-cursor__pickbox';
  document.body.appendChild(crosshair);
  document.body.appendChild(pickbox);

  let isClicking = false;

  const HOVER_SEL = [
    'a', 'button',
    '.project-card', '.ms-proj-card', '.cs-proj-card',
    '.satrap-block', '.client-card',
    '.ms-type-card', '.cs-type-card',
    '.ms-cap', '.cs-cap',
    '.sf-snav__dot',
  ].join(',');

  qsa(HOVER_SEL).forEach(el => {
    el.addEventListener('mouseenter', () => {
      pickbox.classList.add('is-hovering');
      crosshair.classList.add('is-hovering');
    }, { passive: true });
    el.addEventListener('mouseleave', () => {
      pickbox.classList.remove('is-hovering');
      crosshair.classList.remove('is-hovering');
    }, { passive: true });
  });

  document.addEventListener('mouseleave', () => {
    pickbox.style.opacity = crosshair.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    pickbox.style.opacity = crosshair.style.opacity = '1';
  });
  document.addEventListener('mousedown', () => {
    isClicking = true; pickbox.classList.add('is-clicking');
  });
  document.addEventListener('mouseup', () => {
    isClicking = false; pickbox.classList.remove('is-clicking');
  });

  function cursorTick() {
    state.lerped.x = lerp(state.lerped.x, state.mouse.x, 0.12);
    state.lerped.y = lerp(state.lerped.y, state.mouse.y, 0.12);
    const scale = isClicking ? ' scale(1.8)' : '';
    pickbox.style.transform =
      `translate(calc(${state.mouse.x}px - 50%), calc(${state.mouse.y}px - 50%))${scale}`;
    crosshair.style.transform =
      `translate(${state.lerped.x}px, ${state.lerped.y}px)`;
    requestAnimationFrame(cursorTick);
  }
  requestAnimationFrame(cursorTick);
})();


/* ─────────────────────────────────────────────
   MOUSE MOVE
───────────────────────────────────────────── */
document.addEventListener('mousemove', e => {
  state.mouse.x = e.clientX;
  state.mouse.y = e.clientY;
}, { passive: true });


/* ─────────────────────────────────────────────
   SCROLL — unified handler
───────────────────────────────────────────── */
(function initScroll() {
  const nav       = qs('#mainNav');
  const scrollBar = qs('#scrollBar');
  const heroBg    = qs('.hero__bg-photo, .ms-hero__bg, .cs-hero__bg');
  const sections  = qsa('section[id], footer[id]');
  const navLinks  = qsa('.nav__links a');
  const letterBgs = qsa('.satrap-block__letter-bg');

  let ticking = false;

  function onScrollRAF() {
    state.scrollY = window.scrollY;
    state.docH    = document.documentElement.scrollHeight - state.winH;

    if (nav) nav.classList.toggle('scrolled', state.scrollY > 40);

    if (scrollBar) {
      const pct = state.docH > 0
        ? Math.min(100, (state.scrollY / state.docH) * 100) : 0;
      scrollBar.style.width = pct + '%';
    }

    if (heroBg && state.scrollY < state.winH * 1.2)
      heroBg.style.transform =
        `scale(1.03) translateY(${state.scrollY * 0.07}px)`;

    letterBgs.forEach(el => {
      const block = el.closest('.satrap-block');
      if (!block) return;
      const rect = block.getBoundingClientRect();
      const rel  = (rect.top + rect.height / 2 - state.winH / 2) / state.winH;
      el.style.transform = `translateY(${rel * -18}px)`;
    });

    let current = '';
    sections.forEach(sec => {
      if (state.scrollY >= sec.offsetTop - 140) current = sec.id;
    });
    navLinks.forEach(link => {
      link.style.color =
        link.getAttribute('href') === '#' + current ? 'var(--yellow)' : '';
    });

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScrollRAF); ticking = true; }
  }, { passive: true });

  onScrollRAF();

  window.addEventListener('resize', () => {
    state.winH = window.innerHeight;
  }, { passive: true });
})();


/* ─────────────────────────────────────────────
   HERO LOAD
───────────────────────────────────────────── */
(function() {
  const hero = qs('.hero');
  if (hero) requestAnimationFrame(() => hero.classList.add('loaded'));
})();


/* ─────────────────────────────────────────────
   REVEAL ON SCROLL
───────────────────────────────────────────── */
(function initReveal() {
  const els = qsa('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('visible')); return;
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
    blocks.forEach(b => b.classList.add('in-view')); return;
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
   MAGNETIC BUTTONS
───────────────────────────────────────────── */
(function initMagnetic() {
  if (isMobile()) return;
  qsa('.btn-primary, .cs-btn-primary, .nav__cta').forEach(magnet => {
    magnet.addEventListener('mousemove', e => {
      const r  = magnet.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width  / 2) * 0.28;
      const dy = (e.clientY - r.top  - r.height / 2) * 0.28;
      magnet.style.transform = `translate(${dx}px, ${dy}px) scale(1.04)`;
    });
    magnet.addEventListener('mouseleave', () => {
      magnet.style.transform = '';
    });
  });
})();


/* ─────────────────────────────────────────────
   CARD 3D TILT
───────────────────────────────────────────── */
(function initTilt() {
  if (isMobile()) return;
  qsa('.project-card, .ms-proj-card, .cs-proj-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width  - 0.5) * 2;
      const y = ((e.clientY - r.top)  / r.height - 0.5) * 2;
      card.style.transform =
        `translateY(-6px) scale(1.005) rotateX(${y * -4}deg) rotateY(${x * 4}deg)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
})();


/* ─────────────────────────────────────────────
   STAGGER DELAYS
───────────────────────────────────────────── */
(function initStagger() {
  const header = qs('.storytelling__header');
  if (header) {
    qsa('*', header).forEach((child, i) => {
      child.style.transitionDelay = (i * 0.07) + 's';
    });
  }
  qsa('.footer__links').forEach(list => {
    qsa('a', list).forEach((link, i) => {
      link.style.transitionDelay = (i * 0.04) + 's';
    });
  });
})();

/* ─────────────────────────────────────────────
   PREMIUM MOBILE MENU
───────────────────────────────────────────── */
(function initHamburger() {
  const nav = qs('#mainNav');
  if (!nav) return;

  // inject دکمه
  const btn = document.createElement('button');
  btn.className = 'nav__hamburger';
  btn.setAttribute('aria-label', 'باز کردن منو');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span></span><span></span><span></span>';
  nav.appendChild(btn);

  const links = qs('.nav__links', nav);
  if (!links) return;

  function openMenu() {
    links.classList.add('mobile-open');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'بستن منو');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    links.classList.remove('mobile-open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'باز کردن منو');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    links.classList.contains('mobile-open') ? closeMenu() : openMenu();
  });

  // بستن با کلیک روی لینک
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeMenu);
  });

  // بستن با کلیک خارج
  document.addEventListener('click', e => {
    if (links.classList.contains('mobile-open') && !nav.contains(e.target)) {
      closeMenu();
    }
  });

  // بستن با Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });

  // resize: بستن اگه صفحه بزرگ شد
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeMenu();
  }, { passive: true });
})();
