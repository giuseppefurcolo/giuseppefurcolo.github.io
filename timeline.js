// timeline.js
// Progressive enhancement only: the page is complete without this file.
// 1 header height  2 timeline range  3 strip prev/next  4 videos  5 click-to-load embeds
// 6 entrance reveal  7 hash links on load
(() => {
  'use strict';
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const timeline = document.querySelector('.timeline');
  const ticks = [...document.querySelectorAll('.timeline__years li')];
  const range = document.querySelector('.timeline__range');
  const roles = [...document.querySelectorAll('.role')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FIRST_YEAR = 2011;
  const LAST_NUMBERED_YEAR = 2025;
  const DOT_INSET = 12; // bar end to dot center: 4px inset + 8px dot radius (styles.css)

  // 1. header height -> --header-h (used by scroll-padding-top)
  if (header) {
    const setH = () => root.style.setProperty('--header-h', header.offsetHeight + 'px');
    new ResizeObserver(setH).observe(header);
  }

  // 2. timeline range: bar spans the active role, start of its first month to end of its last
  if (header && timeline && range && ticks.length && roles.length) {
    const centers = () => {
      const base = timeline.getBoundingClientRect().left;
      return ticks.map(li => { const r = li.getBoundingClientRect(); return r.left - base + r.width / 2; });
    };
    // tick index for a YYYY-MM date; atEnd moves to the end of that month
    const indexOf = (v, atEnd) => {
      if (v === 'now') return ticks.length - 1;
      const [y, m] = v.split('-').map(Number);
      if (y > LAST_NUMBERED_YEAR) return ticks.length - 1;
      return (y - FIRST_YEAR) + (m - (atEnd ? 0 : 1)) / 12;
    };
    const xAt = (idx, c) => {
      const i = Math.min(Math.floor(idx), c.length - 2);
      return c[i] + (c[i + 1] - c[i]) * (idx - i);
    };

    let active = null;
    const paint = () => {
      if (!active) return;
      const c = centers();
      const openEnd = active.dataset.end === 'now';
      const start = xAt(indexOf(active.dataset.start, false), c) - DOT_INSET;
      const end = openEnd ? timeline.clientWidth + DOT_INSET : xAt(indexOf(active.dataset.end, true), c) + DOT_INSET;
      range.style.setProperty('--range-x', start + 'px');
      range.style.setProperty('--range-w', Math.max(end - start, 2 * DOT_INSET + 8) + 'px');
      range.style.setProperty('--range-color', getComputedStyle(active).getPropertyValue('--role-color').trim());
      range.toggleAttribute('data-open-end', openEnd);
    };
    const pick = () => {
      const line = header.offsetHeight + innerHeight * 0.3;
      let current = roles[0];
      for (const r of roles) if (r.getBoundingClientRect().top <= line) current = r;
      if (current !== active) { active = current; paint(); }
    };

    // first paint without animation
    range.hidden = false;
    range.style.transition = 'none';
    pick();
    requestAnimationFrame(() => requestAnimationFrame(() => { range.style.transition = ''; }));

    let ticking = false;
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; pick(); });
    }, { passive: true });
    addEventListener('resize', paint);
    document.fonts?.ready.then(paint);
  }

  // 3. strip prev / next (hidden by CSS on touch devices)
  document.querySelectorAll('.strip-wrap').forEach(wrap => {
    const strip = wrap.querySelector('.strip');
    if (!strip) return;
    const label = strip.getAttribute('aria-label') || 'work samples';
    const make = (dir, text, arrow) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `strip-btn strip-btn--${dir}`;
      b.setAttribute('aria-label', `${text}: ${label}`);
      b.textContent = arrow;
      wrap.append(b);
      return b;
    };
    const prev = make('prev', 'Previous', '←');
    const next = make('next', 'Next', '→');
    const step = d => strip.scrollBy({ left: d * strip.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    const update = () => {
      prev.disabled = strip.scrollLeft < 4;
      next.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4;
    };
    strip.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(strip);
    update();
  });

  // 4. videos: play muted only while at least half visible (vertical and horizontal).
  //    Observation starts after the load event so the first video's download does not
  //    compete with the poster, font and CSS on slow connections.
  if (!reduce && 'IntersectionObserver' in window) {
    const videos = document.querySelectorAll('.strip video');
    videos.forEach(v => v.removeAttribute('controls'));
    const start = () => {
      const vio = new IntersectionObserver(entries => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.play().catch(() => {});
          else e.target.pause();
        }
      }, { threshold: 0.5 });
      videos.forEach(v => vio.observe(v));
    };
    if (document.readyState === 'complete') start();
    else addEventListener('load', start, { once: true });
  }

  // 5. click-to-load embeds: nothing third-party loads until the visitor asks for it
  document.querySelectorAll('.embed[data-embed-src]').forEach(embed => {
    const link = embed.querySelector('.embed__open');
    if (!link) return;
    const title = embed.dataset.embedTitle || 'embedded content';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'embed__open';
    btn.innerHTML = '<span aria-hidden="true">▶</span> ';
    btn.append(`Load ${title}`);
    link.replaceWith(btn);
    btn.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = embed.dataset.embedSrc;
      f.title = title;
      f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      embed.append(f);
      embed.classList.add('is-loaded');
      f.focus();
    }, { once: true });
  });

  // 6. entrance reveal, only for roles below the fold (no flash on load)
  if (!reduce && 'IntersectionObserver' in window) {
    const eio = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.remove('is-pending');
        eio.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    roles.forEach(r => {
      if (r.getBoundingClientRect().top > innerHeight) {
        r.classList.add('is-pending');
        eio.observe(r);
      }
    });
  }

  // 7. a deep link like /#celtra: jump there once fonts settle, since smooth
  //    scrolling on html can swallow the browser's own initial jump
  if (location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) {
      const jump = () => target.scrollIntoView({ behavior: 'instant', block: 'start' });
      (document.fonts?.ready || Promise.resolve()).then(() => requestAnimationFrame(jump));
    }
  }
})();
