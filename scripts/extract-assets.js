// scripts/extract-assets.js
// Run once in the browser console on the live Framer site (see SPEC.md phase 1).
// Paste part 1, wait for "preload done", then paste part 2.

// part 1: preload
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let y = 0; y < document.body.scrollHeight; y += 400) {
    window.scrollTo(0, y); await sleep(250);
  }
  const scrollers = [...document.querySelectorAll('*')].filter(el => {
    const s = getComputedStyle(el);
    return /(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 10;
  });
  for (const el of scrollers) {
    el.scrollIntoView({ block: 'center' }); await sleep(300);
    for (let x = 0; x <= el.scrollWidth; x += 300) { el.scrollLeft = x; await sleep(200); }
  }
  window.scrollTo(0, 0);
  console.log('preload done, scrollers:', scrollers.length);
})();

// part 2: manifest
(() => {
  const ROLES = ['Surfside','LaunchScience','Beeswax','Celtra','Amplify','Qloo'];
  const clean = u => { try { const x = new URL(u, location.href); x.search = ''; return x.href; } catch { return null; } };
  const roleOf = el => {
    let n = el;
    while (n && n !== document.body) {
      const t = (n.innerText || '').slice(0, 300);
      const hits = ROLES.filter(r => t.includes(r));
      if (hits.length === 1) return hits[0].toLowerCase();
      n = n.parentElement;
    }
    return 'global';
  };
  const best = img => {
    const set = (img.srcset || '').split(',').map(s => s.trim().split(/\s+/));
    const widest = set.sort((a, b) => parseInt(b[1]) - parseInt(a[1]))[0];
    return clean(widest?.[0] || img.currentSrc || img.src);
  };
  const out = [];
  document.querySelectorAll('img').forEach(img => out.push({
    kind: 'image', role: roleOf(img), url: best(img),
    w: img.naturalWidth, h: img.naturalHeight, alt: img.alt || ''
  }));
  document.querySelectorAll('video').forEach(v => {
    const src = v.currentSrc || v.src || v.querySelector('source')?.src;
    out.push({ kind: 'video', role: roleOf(v), url: clean(src), poster: clean(v.poster || ''),
      w: v.videoWidth, h: v.videoHeight, duration: Math.round(v.duration) });
  });
  document.querySelectorAll('*').forEach(el => {
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
    if (m && m[1].includes('framerusercontent')) out.push({ kind: 'bg', role: roleOf(el), url: clean(m[1]) });
  });
  performance.getEntriesByType('resource')
    .filter(r => /\.(woff2?|ttf|otf)(\?|$)/.test(r.name))
    .forEach(r => out.push({ kind: 'font', role: 'global', url: r.name }));
  const og = document.querySelector('meta[property="og:image"]')?.content;
  if (og) out.push({ kind: 'og', role: 'global', url: clean(og) });
  const fav = document.querySelector('link[rel*=icon]')?.href;
  if (fav) out.push({ kind: 'favicon', role: 'global', url: clean(fav) });
  const seen = new Set();
  const dedup = out.filter(a => a.url && !seen.has(a.url) && seen.add(a.url));
  copy(JSON.stringify(dedup, null, 2));
  console.table(dedup.map(a => ({ kind: a.kind, role: a.role, w: a.w, h: a.h })));
  console.log(dedup.length, 'assets copied to clipboard');
})();
