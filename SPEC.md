# giuseppefurcolo.com rebuild: implementation spec

Oct 19, 2026 · @giuseppe

## Overview

Rebuild giuseppefurcolo.com as plain HTML, CSS and vanilla JS, hosted on GitHub Pages, with no build step and no dependencies. The site must still open and edit cleanly years from now with nothing but a text editor and git.

**How to use this doc in Claude Code:** export it as Markdown, save it as `SPEC.md` in an empty repo, then start the session with: `Read SPEC.md. Execute phases 1 to 6 in order. Stop after each phase and report what you did. Do not start phase 7 (DNS) without my approval.` Phase 1.1, 1.2 and 1.5 run in the Chrome console, so do those yourself first and give Claude Code the resulting \_raw/ folder, or ask it to automate them with Playwright.

**Goals**

- Visual parity with the current Framer site: sticky name header, 2011 to Now timeline with a highlighted range that tracks the active role, one section per role with a horizontal media strip and two text columns, footer links.
- Fix every issue found in the audit: hardcoded `width=1440` viewport, zero semantic headings, 39 images with no alt text, page invisible to text extractors, stale meta description, no `lang`, no structured data, copy errors.
- Readable and usable on a 375px phone.
- Total committed media under 60MB.

**Non-goals**

- No framework, bundler, npm, Node, TypeScript compilation, CSS preprocessor or package.json.
- No CMS, analytics, cookie banner or third-party scripts.
- No Vercel. No Cloudflare Pages. GitHub Pages only.
- No new case-study pages in this pass. Each role links out to the company site, as today.

**Hard constraints for Claude Code**

1. Every file in the repo is hand-editable source. Nothing generated is committed except optimized media.
2. Zero runtime dependencies. No CDN script or font tags. Fonts are self-hosted `woff2`.
3. Never use em dashes in any copy.
4. All text content lives in `index.html` as real HTML, never injected by JS. The page must read fully with JS disabled.
5. Do not hotlink `framerusercontent.com`. Every asset is downloaded and committed.
6. Ask before deleting anything outside the repo or changing DNS.

## Repo structure

The repo is named `giuseppefurcolo.github.io (see phase 7 for why)` and holds three source files, one folder of media, and a scratch folder that is gitignored.

```
giuseppefurcolo.github.io/
├── index.html            # all content, semantic markup, meta
├── styles.css            # all styles, tokens at the top
├── timeline.js           # timeline sync + strip controls, ~120 lines
├── CNAME                 # one line: giuseppefurcolo.com
├── 404.html              # minimal, links home
├── robots.txt
├── sitemap.xml
├── .nojekyll             # empty; stops Pages from running Jekyll
├── .gitignore            # _raw/, .DS_Store
├── SPEC.md               # this document
├── README.md             # 10-line update runbook (see last section)
├── assets/
│   ├── fonts/            # self-hosted woff2
│   ├── og/og.png         # 1200x630 social card
│   ├── favicon/          # favicon.svg, favicon.ico, apple-touch-icon.png
│   ├── logos/            # company marks, SVG preferred
│   └── work/
│       ├── surfside/     # 01.avif, 01.webp, 02.mp4, 02.webm, 02-poster.webp ...
│       ├── launchscience/
│       ├── beeswax/
│       ├── celtra/
│       ├── amplify/
│       └── qloo/
└── scripts/
    ├── extract-assets.js # run once in browser console (phase 1)
    └── optimize.sh       # run once locally (phase 2)
```

**Naming rules:** lowercase, kebab-case, two-digit order prefix matching position in the strip (`01`, `02`). A video and its poster share a stem. The scripts folder is committed so the process is reproducible, but nothing in it runs on the live site.

**`.gitignore`**

```
_raw/
.DS_Store
*.log
```

## Phase 1: extract assets and reference captures

Download every image, video, font and logo from the live Framer site into `_raw/` before the Framer plan is canceled, plus reference screenshots and measured design tokens. Framer serves media from `framerusercontent.com`, lazy-loads it, and requests images with resize query params, so a naive save misses files or saves thumbnails.

Live site facts from the audit (Oct 2026): 39 `<img>`, 11 `<video>`, page height about 6,670px at 1440 wide, 6 roles, footer links to email, LinkedIn, GitHub, Medium.

### 1.1 Force everything to load

Open https://giuseppefurcolo.com in desktop Chrome at 1440px wide. Paste this in the console first. It scrolls the page and every horizontal strip so lazy media loads.

```js
// scripts/extract-assets.js  (part 1: preload)
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
```

If `scrollers` is 0, Framer is animating the strip with transforms instead of overflow. In that case drag each strip manually to its end before part 2.

### 1.2 Build the manifest

This groups every asset under the role section it sits in, strips Framer resize params to get the original file, and copies a JSON manifest to the clipboard.

```js
// scripts/extract-assets.js  (part 2: manifest)
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
  document.querySelectorAll('img').forEach((img, i) => out.push({
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
```

Paste the clipboard into `_raw/manifest.json`. Expected count: at least 39 images plus 11 videos minus duplicates. If the count is far lower, re-run 1.1.

**Check the role mapping by eye.** `roleOf` uses the nearest ancestor whose text names exactly one company. Any asset tagged `global` that is clearly work media must be reassigned by hand in the manifest.

### 1.3 Download

```bash
mkdir -p _raw/files
# requires jq and curl (brew install jq)
jq -r '.[] | [.kind,.role,.url] | @tsv' _raw/manifest.json | nl -w2 -s$'\t' | \
while IFS=$'\t' read -r n kind role url; do
  ext="${url##*.}"; ext="${ext%%\?*}"
  dest="_raw/files/${role}/${kind}-$(printf '%02d' "$n").${ext}"
  mkdir -p "$(dirname "$dest")"
  curl -sSL --fail -o "$dest" "$url" && echo "ok  $dest" || echo "FAIL $url"
done
```

Re-run any `FAIL` lines. Some Framer videos may be served without a file extension. Use `file _raw/files/*/*` to detect real types and rename.

### 1.4 Reference captures

These are the visual source of truth for parity. Save to `_raw/reference/`.

- Full-page screenshot at 1440px wide (Chrome DevTools: Cmd+Shift+P, "Capture full size screenshot").
- Viewport screenshots of each role section at 1440px.
- A 20 second screen recording of scrolling top to bottom, to capture the timeline highlight behavior and any entrance animations.
  - The full visible copy: run `copy(document.body.innerText)` in the console and save it as `_raw/copy.txt`. This is the verbatim source for the Content section.

### 1.5 Measure design tokens

Run this on the live site and save the output to `_raw/tokens.json`. It reads computed styles from known elements by their text.

```js
(() => {
  const byText = t => [...document.querySelectorAll('body *')]
    .find(e => e.childElementCount === 0 && e.textContent.trim() === t);
  const pick = el => { if (!el) return null; const s = getComputedStyle(el);
    return { font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lh: s.lineHeight,
             ls: s.letterSpacing, color: s.color }; };
  copy(JSON.stringify({
    body: pick(document.body),
    nameLight: pick(byText('Giuseppe Furcolo\u2019s')),
    nameBold: pick(byText('Project Repo')),
    tagline: pick(byText('Grew Teams, Established Systems, Shipped Products.')),
    year: pick(byText('2016')),
    dates: pick(byText('Apr 2024')),
    company: pick(byText('Surfside')),
    role: pick(byText('Head of Design')),
    acquired: pick(byText('(Acquired by Octane 11)')),
    scrollLabel: pick(byText('Scroll')),
    footerLink: pick(byText('Linkedin')),
  }, null, 2));
})();
```

Also record by hand from DevTools: the strip panel border-radius, panel background, the timeline highlight colors (Surfside range is blue, LaunchScience orange, Qloo pink in the captures; confirm each role's color), the gap between role sections, and the max content width.

**Fonts:** identify the family from `tokens.json`. Unverified which typeface the site uses. If it is a Google Font, download `woff2` files for only the weights in use. If it is a commercial font served through Framer, confirm the license allows self-hosting before committing it, otherwise pick the closest open alternative and flag it.

### Exit criteria

- [ ] `_raw/manifest.json` with every asset assigned to a role or `global`
- [ ] All files downloaded, zero `FAIL`
- [ ] Reference screenshots and recording saved
- [ ] `_raw/tokens.json` saved, colors and radii noted
- [ ] Font identified and license confirmed

## Phase 2: optimize media

Convert every raw file into the final formats once, locally, with ImageMagick and ffmpeg, and commit only the outputs under `assets/`. Target total: under 60MB, no single file over 8MB.

**Decision: MP4 (H.264) only for video, no WebM.** H.264 plays in every browser and will for years; a WebM twin doubles the file count for a small size win. **Decision: AVIF plus WebP for images, no JPEG/PNG fallback.** Both formats have had universal browser support since 2024.

Tools: `brew install imagemagick ffmpeg jq`

### 2.1 Budgets

| Asset | Format | Max dimension | Quality | Target size |
| --- | --- | --- | --- | --- |
| Strip image, 2x | AVIF + WebP | 1600px longest edge | AVIF 55, WebP 78 | under 250KB AVIF |
| Strip image, 1x | AVIF + WebP | 800px longest edge | same | under 90KB AVIF |
| Strip video | MP4 H.264, no audio | 1280px wide | CRF 26 | under 4MB each |
| Video poster | WebP | 1280px wide | 75 | under 80KB |
| Logo | SVG, else WebP | 160px | 85 | under 15KB |
| OG card | PNG | 1200x630 | n/a | under 300KB |

### 2.2 Images

```bash
#!/usr/bin/env bash
# scripts/optimize.sh  (images)
set -euo pipefail
for src in _raw/files/*/image-* _raw/files/*/bg-*; do
  [ -f "$src" ] || continue
  role=$(basename "$(dirname "$src")")
  stem=$(basename "${src%.*}")
  out="assets/work/$role"; mkdir -p "$out"
  for w in 1600 800; do
    sfx=$([ $w = 1600 ] && echo "@2x" || echo "")
    magick "$src" -resize "${w}x${w}>" -strip -quality 55 "$out/${stem}${sfx}.avif"
    magick "$src" -resize "${w}x${w}>" -strip -quality 78 "$out/${stem}${sfx}.webp"
  done
done
```

After running, rename files from `image-07` style stems to strip order (`01`, `02`) matching the visual order in the reference screenshots. Claude Code should propose the rename map and wait for approval.

### 2.3 Videos

```bash
# scripts/optimize.sh  (videos)
for src in _raw/files/*/video-*; do
  [ -f "$src" ] || continue
  role=$(basename "$(dirname "$src")")
  stem=$(basename "${src%.*}")
  out="assets/work/$role"; mkdir -p "$out"
  ffmpeg -y -i "$src" -an \
    -vf "scale='min(1280,iw)':-2,fps=30" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow -crf 26 \
    -movflags +faststart "$out/${stem}.mp4"
  ffmpeg -y -ss 0.5 -i "$out/${stem}.mp4" -frames:v 1 -q:v 75 "$out/${stem}-poster.webp"
done
```

`-an` drops audio (strip videos autoplay muted). `+faststart` moves the index to the front so playback starts before the download finishes. If any output exceeds 4MB, re-run that file with `-crf 28`, then trim duration with `-t` if still over.

### 2.4 Verify

```bash
du -sh assets/
find assets -type f -size +4M -exec ls -lh {} \;
for f in assets/work/*/*.mp4; do
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "$f"
done
```

Every MP4 must report `h264`. Open five random AVIFs and two MP4s and compare against the reference screenshots for visible banding or blur on UI text. UI screenshots compress badly: if small text looks soft, raise AVIF quality to 65 for that file only.

### Exit criteria

- [ ] `assets/` under 60MB, no file over 8MB
- [ ] Every image has `.avif` and `.webp` at 1x and 2x
- [ ] Every video has `.mp4` and `-poster.webp`
- [ ] Files renamed to strip order, rename map approved
- [ ] Visual spot check passed

## Phase 3: HTML

`index.html` holds all content as static semantic HTML: one `h1`, one `article` with an `h2` per role, real `time` elements, alt text on every image, and a timeline built from a plain list. JS only enhances it; with JS off the page reads top to bottom with every word present.

### 3.1 Document outline

```
body
├── a.skip-link            → #work
├── header.site-header     (sticky)
│   ├── h1                 Giuseppe Furcolo’s Project Repo
│   ├── p.tagline
│   └── nav.timeline       ol of years + highlight bar
├── main#work
│   └── article.role × 6   (newest first)
│       ├── header: time range, h2 company (link), acquisition note, p role title, logo
│       ├── div.strip          horizontal media, ul > li > picture | video
│       └── div.role-copy      two paragraphs: company, my role
└── footer.site-footer     email, LinkedIn, GitHub, Medium
```

### 3.2 Head

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Giuseppe Furcolo, Product Design Leader</title>
  <meta name="description" content="Giuseppe Furcolo, product design leader in ad tech and SaaS. 15 years building design teams, design systems and complex B2B products at Surfside, LaunchScience, Beeswax, Celtra, Amplify and Qloo.">
  <link rel="canonical" href="https://giuseppefurcolo.com/">
  <meta name="theme-color" content="#ffffff">

  <meta property="og:type" content="profile">
  <meta property="og:url" content="https://giuseppefurcolo.com/">
  <meta property="og:title" content="Giuseppe Furcolo’s Project Repo">
  <meta property="og:description" content="Grew teams, established systems, shipped products. 2011 to now.">
  <meta property="og:image" content="https://giuseppefurcolo.com/assets/og/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">

  <link rel="icon" href="/assets/favicon/favicon.ico" sizes="32x32">
  <link rel="icon" href="/assets/favicon/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/favicon/apple-touch-icon.png">

  <!-- one preload per weight used above the fold; filenames depend on phase 1 font decision -->
  <link rel="preload" href="/assets/fonts/FONT-500.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
  <script src="/timeline.js" defer></script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Giuseppe Furcolo",
    "url": "https://giuseppefurcolo.com/",
    "email": "mailto:me@giuseppefurcolo.com",
    "jobTitle": "SURFSIDE_TITLE",
    "worksFor": { "@type": "Organization", "name": "Surfside", "url": "https://www.surfside.io/" },
    "sameAs": [
      "https://www.linkedin.com/in/giuseppe-furcolo/",
      "https://github.com/giuseppefurcolo",
      "https://medium.com/@giuseppefurcolo"
    ]
  }
  </script>
</head>
```

`SURFSIDE_TITLE` must match the title used in the Surfside section. See open decisions.

### 3.3 Header and timeline

The timeline is a list of years. The highlight bar is one absolutely positioned element that JS moves; without JS it is hidden. Each year gets `data-year` so JS can measure tick positions.

```html
<a class="skip-link" href="#work">Skip to work</a>
<header class="site-header">
  <h1 class="site-title"><span class="site-title__light">Giuseppe Furcolo’s</span> <span class="site-title__bold">Project Repo</span></h1>
  <p class="tagline">Grew Teams, Established Systems, Shipped Products.</p>
  <nav class="timeline" aria-label="Career timeline">
    <ol class="timeline__years">
      <li data-year="2011"><a href="#qloo">2011</a></li>
      <li data-year="2012"><a href="#qloo">2012</a></li>
      <li data-year="2013"><a href="#qloo">2013</a></li>
      <li data-year="2014"><a href="#qloo">2014</a></li>
      <li data-year="2015"><a href="#amplify">2015</a></li>
      <li data-year="2016"><a href="#celtra">2016</a></li>
      <li data-year="2017"><a href="#celtra">2017</a></li>
      <li data-year="2018"><a href="#celtra">2018</a></li>
      <li data-year="2019"><a href="#beeswax">2019</a></li>
      <li data-year="2020"><a href="#beeswax">2020</a></li>
      <li data-year="2021"><a href="#beeswax">2021</a></li>
      <li data-year="2022"><a href="#launchscience">2022</a></li>
      <li data-year="2023"><a href="#launchscience">2023</a></li>
      <li data-year="2024"><a href="#surfside">2024</a></li>
      <li data-year="2025"><a href="#surfside">2025</a></li>
      <li data-year="now"><a href="#surfside">Now</a></li>
    </ol>
    <div class="timeline__range" aria-hidden="true" hidden></div>
  </nav>
</header>
```

Each year links to the role that was active for most of that year. **Decision:** the current site's timeline appears non-interactive; making years anchor links adds navigation at zero cost and works without JS.

### 3.4 Role section template

Copy this block once per role. Attribute contract used by JS and CSS:

| Attribute | On | Format | Example |
| --- | --- | --- | --- |
| `id` | article | lowercase slug | `surfside` |
| `data-start` | article | `YYYY-MM` | `2024-04` |
| `data-end` | article | `YYYY-MM` or `now` | `now` |
| `style="--role-color"` | article | hex | `#3BA7F0` |
| `datetime` | time | `YYYY-MM` | `2024-04` |

```html
<article class="role" id="surfside" data-start="2024-04" data-end="now"
         style="--role-color: #3BA7F0" aria-labelledby="surfside-name">
  <header class="role__head">
    <p class="role__dates">
      <time datetime="2024-04">Apr 2024</time>
      <span class="role__arrow" aria-hidden="true">→</span>
      <span class="visually-hidden">to</span>
      <span>Now</span>
    </p>
    <h2 class="role__company" id="surfside-name">
      <a href="https://www.surfside.io/" rel="noopener">Surfside<span class="role__ext" aria-hidden="true">↗</span></a>
      <!-- optional: <span class="role__exit">(Acquired by X)</span> -->
    </h2>
    <p class="role__title">SURFSIDE_TITLE</p>
    <img class="role__logo" src="/assets/logos/surfside.svg" alt="" width="48" height="48">
  </header>

  <div class="strip-wrap">
  <p class="strip__hint" aria-hidden="true">Scroll →</p>
  <div class="strip" role="region" aria-label="Surfside work samples" tabindex="0">
    <ul class="strip__track">
      <li class="strip__item">
        <video class="strip__media" width="1280" height="720"
               poster="/assets/work/surfside/01-poster.webp"
               muted loop playsinline preload="none" controls
               aria-label="Animation: audience segments flowing into a single shopper profile">
          <source src="/assets/work/surfside/01.mp4" type="video/mp4">
        </video>
      </li>
      <li class="strip__item">
        <picture>
          <source type="image/avif" srcset="/assets/work/surfside/02.avif 800w, /assets/work/surfside/02@2x.avif 1600w" sizes="(max-width: 700px) 85vw, 60vw">
          <source type="image/webp" srcset="/assets/work/surfside/02.webp 800w, /assets/work/surfside/02@2x.webp 1600w" sizes="(max-width: 700px) 85vw, 60vw">
          <img class="strip__media" src="/assets/work/surfside/02.webp"
               width="1600" height="1000" loading="lazy" decoding="async"
               alt="Hourly averages heatmap showing impressions by day and hour for a retail location">
        </picture>
      </li>
    </ul>
  </div>
  </div>

  <div class="role-copy">
    <p>COMPANY_PARAGRAPH</p>
    <p>MY_ROLE_PARAGRAPH</p>
  </div>
</article>
```

**Markup rules**

- `width` and `height` on every `img` and `video` must be the real intrinsic size of the 2x file. This prevents layout shift.
- The first role's first strip item uses `loading="eager"` and `fetchpriority="high"`. Every other image is `loading="lazy"`.
- Videos ship with `controls` and `preload="none"`. JS removes `controls` and handles play and pause. Without JS, visitors see the poster and can press play.
- Alt text describes what the screenshot shows in product terms, in under 20 words. Claude Code drafts alt text from the images and lists it for review. Purely decorative images (background patterns) get `alt=""`.
- Company logos use `alt=""` because the company name is already in the `h2`.
- External links use `rel="noopener"`. Do not add `target="_blank"`.

### 3.5 Footer

```html
<footer class="site-footer">
  <ul class="site-footer__links">
    <li><a href="mailto:me@giuseppefurcolo.com">me@giuseppefurcolo.com <span aria-hidden="true">↗</span></a></li>
    <li><a href="https://www.linkedin.com/in/giuseppe-furcolo/" rel="noopener">LinkedIn <span aria-hidden="true">↗</span></a></li>
    <li><a href="https://github.com/giuseppefurcolo" rel="noopener">GitHub <span aria-hidden="true">↗</span></a></li>
    <li><a href="https://medium.com/@giuseppefurcolo" rel="noopener">Medium <span aria-hidden="true">↗</span></a></li>
  </ul>
</footer>
```

Note the capitalization fixes: the live site says "Linkedin" and "Github".

### 3.6 Supporting files

**`404.html`:** same `head` minus JSON-LD, one line of text, one link home.

**`robots.txt`**

```
User-agent: *
Allow: /
Sitemap: https://giuseppefurcolo.com/sitemap.xml
```

**`sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://giuseppefurcolo.com/</loc><lastmod>2026-10-19</lastmod></url>
</urlset>
```

**`og.png`:** reuse the Framer OG image from the manifest if it is 1200x630 and still accurate. Otherwise render one: name, tagline, and the timeline bar on white.

## Content

Copy is carried over verbatim from the live site, with only the confirmed errors fixed. Do not rewrite, tighten or "improve" any paragraph beyond the fixes listed here. Anything marked OPEN needs Giuseppe's answer before launch; use the placeholder until then.

### Global copy

- **h1:** Giuseppe Furcolo’s Project Repo
- **Tagline:** Grew Teams, Established Systems, Shipped Products.
- **Footer links:** me@giuseppefurcolo.com, LinkedIn, GitHub, Medium

### Role data

Newest first, in page order. Colors marked "measure" come from phase 1.5.

| id | Company | Link | Start | End | Title | Exit note | Color |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `surfside` | Surfside | https://www.surfside.io/ | 2024-04 | now | OPEN: `SURFSIDE_TITLE` | none | blue, measure |
| `launchscience` | LaunchScience | https://www.launchscience.com/ | 2022-04 | 2024-04 | Co-founder and Chief Design Officer | (Acquired by Octane11) | orange, measure |
| `beeswax` | Beeswax | https://www.beeswax.com/ | 2019-12 | 2022-04 | Director of Product Design | (Acquired by FreeWheel Comcast) | measure |
| `celtra` | Celtra | https://celtra.com/ | 2016-07 | 2019-12 | Lead Product Designer | none | measure |
| `amplify` | Amplify | https://amplify.com/ | 2015-02 | 2016-01 | Lead Designer & Art Director | none | measure |
| `qloo` | Qloo | https://qloo.com/ | 2011-05 | 2015-01 | Design Director | none | pink, measure |

### Paragraphs

**Surfside**

- Company: OPEN. Live copy is "Surfside delivers end-to-end digital marketing and advertising for specific verticals. Deeply integrated, sophisticated, and growing fast. Building tools for highly demanding, ultra-productive power users." Keep it unless Giuseppe supplies new text.
- Role: "I built and lead the front-end team, driving a culture of speed, clarity, and craft. My focus is on turning complex capabilities into intuitive tools that scale, balancing depth, usability, and precision across the platform." OPEN: confirm "front-end team" versus "design and front-end team".

**LaunchScience**

- Company: "Revolutionizing Product Launches with SaaS: Cutting-edge Project Management, AI Integration, Streamlined Workflows for Today's Complex, Multi-Department Organizations." OPEN: this is the only Title Case paragraph on the site. Keep verbatim unless Giuseppe asks for sentence case.
- Role: "I played the key role in building the design and frontend dev team, implementing processes, tools, infrastructure and a state-of-the-art design system. Directed UX and branding. Recently, Octane11 has successfully acquired LaunchScience." OPEN: "Recently" is dated; suggest "Octane11 acquired LaunchScience in YEAR."

**Beeswax**

- Company: "The Bidder-as-a-Service. It provides automated media buying for omnichannel ads with a sophisticated interface that empowers advertisers and buyers in the programmatic ecosystem to customize and optimize their campaigns."
- Role: "I assembled the design team, established processes, developed the design system while working on building new complex features." Then a second paragraph: "My contributions played a significant role in Beeswax being acquired by FreeWheel (Comcast)."

**Celtra**

- Company and role: the audit captured this text only partially. Claude Code must copy both paragraphs verbatim from `_raw/` (save `document.body.innerText` from the live site during phase 1). Known fragments: the company paragraph begins "Celtra's Creative Automation solutions empower advertisers"; the role paragraph ends "...and FE engineers in developing a range of new products as well as constructing and supervising the expansion of the Celtra Design System to scale up operations, ensuring consistency in UI and UX throughout the process."

**Amplify**

- Company: "Amplify is leading the way of the next-generation K–12 curriculum and assessment."
- Role: "My role was to bring math curriculum scripts for 8th and 9th grade students to life, with illustrators, film makers, 3D designers and developers and working on the design and UX for students to do Algebra homework on tablets."

**Qloo**

- Company: "Qloo is cultural AI. With machine learning and theoretical research in neuroaesthetics, it predicts consumer taste across domains and provides personalization and insights to companies in the tech, entertainment, publishing, travel, and CPG industries via a robust API."
- Role: "As Design Director I was in charge of UI/UX of the consumer side for the mobile and desktop app. I created sophisticated data visualization screens and video ad campaigns and tutorials. I also developed many prototypes for concept apps using Qloo's engine as music players, dating apps and more." Verify against the full live text; the audit read part of this from a screenshot.

### Fixes applied

| Where | Live site | Fixed |
| --- | --- | --- |
| Beeswax role | establish processes | established processes |
| LaunchScience exit note | Octane 11 | Octane11 (matches body copy; confirm the company's own spelling) |
| LaunchScience role | tools,  infrastructure (double space) | tools, infrastructure |
| Amplify role | 8 and 9th grade | 8th and 9th grade |
| Footer | Linkedin, Github | LinkedIn, GitHub |
| Meta description | 12 Years of Work | see 3.2 |

Use typographic apostrophes (’) in all visible copy. Never introduce em dashes.

## Phase 4: CSS

`styles.css` is one file in five ordered layers: tokens, base, header and timeline, role sections, utilities. Replace every `MEASURE` value with numbers from `_raw/tokens.json` and the reference screenshots; the values below are approximations read from 1232px-wide captures.

**Decision: light theme only.** The live site has no dark mode and the dark media panels already carry contrast. **Decision: mobile-first media queries** with two breakpoints, 700px and 1100px.

### 4.1 Tokens

```css
@font-face {
  font-family: "Site";
  src: url("/assets/fonts/FONT-400.woff2") format("woff2");
  font-weight: 400; font-display: swap;
}
@font-face {
  font-family: "Site";
  src: url("/assets/fonts/FONT-500.woff2") format("woff2");
  font-weight: 500; font-display: swap;
}
@font-face {
  font-family: "Site";
  src: url("/assets/fonts/FONT-700.woff2") format("woff2");
  font-weight: 700; font-display: swap;
}

:root {
  /* color: MEASURE all */
  --c-bg: #ffffff;
  --c-ink: #1d1d2b;          /* company names, h1 bold */
  --c-ink-2: #4a4a5e;        /* body copy */
  --c-ink-3: #8a8aa3;        /* tagline, scroll hint */
  --c-muted-accent: #a9a9d6; /* "(Acquired by ...)" */
  --c-arrow: #22d3a0;        /* date arrow */
  --c-rule: #e6e6ee;
  --c-panel: #1c1c1e;
  --c-header-bg: rgb(255 255 255 / 0.85);

  /* type: MEASURE all */
  --ff: "Site", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --fs-title: clamp(1.25rem, 1rem + 1vw, 1.75rem);
  --fs-company: clamp(2rem, 1.4rem + 2.6vw, 3.25rem);
  --fs-role: clamp(1.05rem, 0.95rem + 0.5vw, 1.4rem);
  --fs-dates: clamp(1rem, 0.9rem + 0.4vw, 1.3rem);
  --fs-body: clamp(0.95rem, 0.9rem + 0.25vw, 1.1rem);
  --fs-small: 0.75rem;
  --fs-year: clamp(0.65rem, 0.55rem + 0.35vw, 0.95rem);

  /* layout */
  --max: 1160px;
  --gutter: clamp(16px, 3vw, 36px);
  --section-gap: clamp(64px, 8vw, 120px);
  --radius-panel: 12px;      /* MEASURE */
  --strip-h: clamp(220px, 42vw, 560px);
  --strip-gap: 16px;
  --header-h: 140px;         /* set by JS to the real header height */

  --ease: cubic-bezier(.2, .7, .2, 1);
}
```

### 4.2 Base

```css
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; scroll-padding-top: calc(var(--header-h) + 16px); }
body { margin: 0; background: var(--c-bg); color: var(--c-ink-2); font: 400 var(--fs-body)/1.45 var(--ff); }
img, video { display: block; max-width: 100%; height: auto; }
a { color: inherit; text-decoration: none; }
a:focus-visible, .strip:focus-visible { outline: 2px solid var(--c-ink); outline-offset: 3px; border-radius: 4px; }
h1, h2, p, ol, ul { margin: 0; }
ol, ul { padding: 0; list-style: none; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.skip-link { position: absolute; left: 8px; top: -40px; padding: 8px 12px; background: var(--c-ink); color: #fff; z-index: 100; }
.skip-link:focus { top: 8px; }
```

### 4.3 Header and timeline

```css
.site-header {
  position: sticky; top: 0; z-index: 50;
  background: var(--c-header-bg);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--c-rule);
  text-align: center;
  padding-top: 20px;
}
.site-title { font-size: var(--fs-title); font-weight: 400; color: var(--c-ink); letter-spacing: -0.01em; }
.site-title__bold { font-weight: 700; }
.tagline { font-size: var(--fs-small); color: var(--c-ink-3); margin-top: 2px; }

.timeline { position: relative; overflow: hidden; margin-top: 14px; border-top: 1px solid var(--c-rule); }
.timeline__years { display: grid; grid-template-columns: repeat(16, 1fr); }
.timeline__years li { display: flex; justify-content: center; }
.timeline__years a {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 10px 0 12px; font-size: var(--fs-year); font-weight: 500; color: var(--c-ink); width: 100%;
}
.timeline__years a::after { content: ""; width: 1px; height: 18px; background: var(--c-ink-2); }

.timeline__range {
  position: absolute; left: 0; bottom: 10px; height: 20px; border-radius: 10px;
  background: var(--range-color, #3BA7F0);
  transform: translateX(var(--range-x, 0)); width: var(--range-w, 0);
  transition: transform .5s var(--ease), width .5s var(--ease), background-color .5s var(--ease);
  pointer-events: none;
}
.timeline__range::before, .timeline__range::after {
  content: ""; position: absolute; top: 50%; width: 12px; height: 12px; margin-top: -6px;
  border-radius: 50%; background: var(--c-ink);
}
.timeline__range::before { left: 4px; }
.timeline__range::after { right: 4px; }
.timeline__range[data-open-end]::after { display: none; } /* "Now" roles run off the right edge */

@media (max-width: 699px) {
  .tagline { display: none; }
  .timeline__years li:nth-child(even):not(:last-child) a { color: transparent; } /* keep tick, hide label */
}
```

The range bar sits over the tick marks, matching the live site. Ticks remain visible through it because the bar is semi-opaque in the captures; MEASURE its opacity.

### 4.4 Role sections

```css
main { max-width: var(--max); margin: 0 auto; padding: 0 var(--gutter); }
.role { padding: var(--section-gap) 0; border-bottom: 1px solid var(--c-rule); }
.role:last-child { border-bottom: 0; }

.role__head { display: grid; grid-template-columns: 1fr auto; column-gap: 24px; align-items: start; }
.role__head > :not(.role__logo) { grid-column: 1; }
.role__logo { grid-column: 2; grid-row: 1 / span 3; width: clamp(36px, 4vw, 56px); height: auto; }
.role__dates { font-size: var(--fs-dates); font-weight: 700; color: var(--c-ink); display: flex; gap: .4em; align-items: baseline; }
.role__arrow { color: var(--c-arrow); }
.role__company { font-size: var(--fs-company); font-weight: 700; color: var(--c-ink); letter-spacing: -0.02em; line-height: 1.05; display: flex; flex-wrap: wrap; align-items: baseline; gap: .3em; }
.role__company a:hover { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; }
.role__ext { font-size: .7em; margin-left: .1em; }
.role__exit { font-size: var(--fs-body); font-weight: 400; color: var(--c-muted-accent); }
.role__title { font-size: var(--fs-role); font-weight: 700; color: var(--c-ink); margin-top: 4px; }

.strip {
  position: relative;
  background: var(--c-panel); border-radius: var(--radius-panel);
  overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory; scroll-padding-inline: 24px;
  overscroll-behavior-x: contain; scrollbar-width: none;
}
.strip::-webkit-scrollbar { display: none; }
.strip__track { display: flex; gap: var(--strip-gap); width: max-content; padding: 0; }
.strip__item { flex: none; height: var(--strip-h); scroll-snap-align: start; }
.strip__media, .strip__item picture, .strip__item img { height: 100%; width: auto; object-fit: cover; }
.strip__hint {
  position: absolute; top: -22px; left: 12px; font-size: var(--fs-small); color: var(--c-ink-3);
}
.strip-wrap { position: relative; margin-top: 28px; } /* hosts the hint and the JS prev/next buttons */
.strip-btn {
  position: absolute; top: 50%; translate: 0 -50%; z-index: 2;
  width: 44px; height: 44px; border-radius: 50%; border: 0;
  background: rgb(255 255 255 / .92); color: var(--c-ink); cursor: pointer;
  box-shadow: 0 2px 10px rgb(0 0 0 / .2); font-size: 18px;
  transition: opacity .2s;
}
.strip-btn[disabled] { opacity: 0; pointer-events: none; }
.strip-btn--prev { left: 12px; } .strip-btn--next { right: 12px; }
@media (hover: none) { .strip-btn { display: none; } } /* touch users swipe */

.role-copy { display: grid; gap: 16px 48px; margin-top: 20px; }
@media (min-width: 700px) { .role-copy { grid-template-columns: 1fr 1fr; } }
.role-copy p + p { margin-top: 0; }

.site-footer { max-width: var(--max); margin: 0 auto; padding: 32px var(--gutter) 48px; border-top: 1px solid var(--c-rule); }
.site-footer__links { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px 24px; font-size: var(--fs-small); color: var(--c-ink); }
.site-footer__links a:hover { text-decoration: underline; }
```

**Strip layout notes**

- Items have a fixed height and natural width, so mixed aspect ratios line up on one baseline like the live site. The `width`/`height` attributes from phase 3 let the browser reserve the right width before load.
- The live strips show items floating inside the dark panel with inset padding. If the captures confirm that, add `padding: 32px` to `.strip__track` and reduce `--strip-h` by 64px.
- The live site puts the "Scroll →" label above the panel at about 10px. **Decision:** keep its position but render it at `--fs-small` (12px) instead of the near-illegible live size. Prev and next buttons on hover-capable devices fix the discoverability gap the audit flagged.

### 4.5 Motion

```css
@media (prefers-reduced-motion: no-preference) {
  .role.is-pending .role__head, .role.is-pending .strip, .role.is-pending .role-copy {
    opacity: 0; transform: translateY(24px);
  }
  .role .role__head, .role .strip, .role .role-copy {
    transition: opacity .7s var(--ease), transform .7s var(--ease);
  }
  .role .strip { transition-delay: .08s; }
  .role .role-copy { transition-delay: .16s; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .timeline__range { transition: none; }
}
```

`is-pending` is added by JS before first paint of each role and removed when it enters the viewport. Without JS the class never exists, so nothing is hidden. Match timing to the reference recording; if the live site has no entrance animation, delete this block.

## Phase 5: JavaScript

`timeline.js` is about 120 lines of dependency-free vanilla JS loaded with `defer`. It does five things, each independent so one failing does not break the others: sync the timeline range to the active role, add prev and next buttons to strips, play videos only while visible, run entrance reveals, and keep `--header-h` accurate. Every feature is an enhancement; the page is complete without it.

### 5.1 Behavior spec

| Feature | Trigger | Result | Reduced motion |
| --- | --- | --- | --- |
| Active role | scroll, rAF-throttled | The last role whose top is above a line at header height + 30% of viewport becomes active | same |
| Range bar | active role changes, resize, fonts loaded | Bar spans the role's start to end month, in the role's color; "now" roles run off the right edge with no end dot | no transition |
| Strip buttons | hover-capable pointer | Prev and next scroll 80% of strip width; each disables at its edge | instant scroll |
| Video | at least 50% of a video visible, including horizontal clipping | Plays muted; pauses when it leaves | no autoplay, native controls kept |
| Entrance | role enters viewport | Fades and rises once | none |
| Header height | header resizes | Sets `--header-h` for `scroll-padding-top` | same |

**Date to x mapping.** Ticks are 2011 through 2025, then "Now". A date `YYYY-MM` maps to tick index `(YYYY - 2011) + (MM - 1) / 12`, interpolated between tick centers. Any year after 2025 and the value `now` map to the "Now" tick. Example: Surfside `2024-04` is index 13.25, a quarter of the way from the 2024 tick to the 2025 tick.

### 5.2 Markup contract the script relies on

1. Each `.strip` sits inside a static `.strip-wrap`, with `.strip__hint` as a sibling before it (phase 3.4). A hint inside `.strip` would be clipped by the strip's overflow.
2. `.timeline` has `overflow: hidden` and `.timeline__range` has `left: 0` (phase 4.3), so open-ended bars clip at the edge and `--range-x` is measured from the timeline's left.
3. Every `.role` has `data-start`, `data-end` and an inline `--role-color` (phase 3.4).

### 5.3 Reference implementation

```js
// timeline.js
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

  // header height -> --header-h
  if (header) {
    const setH = () => root.style.setProperty('--header-h', header.offsetHeight + 'px');
    new ResizeObserver(setH).observe(header);
  }

  // timeline range
  if (timeline && range && ticks.length && roles.length) {
    const centers = () => {
      const base = timeline.getBoundingClientRect().left;
      return ticks.map(li => { const r = li.getBoundingClientRect(); return r.left - base + r.width / 2; });
    };
    const indexOf = v => {
      if (v === 'now') return ticks.length - 1;
      const [y, m] = v.split('-').map(Number);
      if (y > LAST_NUMBERED_YEAR) return ticks.length - 1;
      return (y - FIRST_YEAR) + (m - 1) / 12;
    };
    const xAt = (idx, c) => {
      const i = Math.floor(idx);
      if (i >= c.length - 1) return c[c.length - 1];
      return c[i] + (c[i + 1] - c[i]) * (idx - i);
    };

    let active = null;
    const paint = () => {
      if (!active) return;
      const c = centers();
      const PAD = 10; // bar extends past the dot centers, MEASURE against reference
      const openEnd = active.dataset.end === 'now';
      const start = xAt(indexOf(active.dataset.start), c) - PAD;
      const end = openEnd ? timeline.clientWidth + PAD : xAt(indexOf(active.dataset.end), c) + PAD;
      range.style.setProperty('--range-x', start + 'px');
      range.style.setProperty('--range-w', Math.max(end - start, 24) + 'px');
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

  // strip prev / next
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

  // videos: play only while visible
  if (!reduce && 'IntersectionObserver' in window) {
    const vio = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      }
    }, { threshold: 0.5 });
    document.querySelectorAll('.strip video').forEach(v => {
      v.removeAttribute('controls');
      v.preload = 'metadata';
      vio.observe(v);
    });
  }

  // entrance reveal, only for roles below the fold (no flash on load)
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
})();
```

**Implementation notes**

- `IntersectionObserver` accounts for clipping by the strip's horizontal overflow, so a video scrolled out of the strip pauses even while the section is on screen.
- `play()` returns a promise that rejects if the browser blocks autoplay (Low Power Mode on iOS). The empty `catch` leaves the poster showing, which is acceptable.
- Keyboard: a focused `.strip` (it has `tabindex="0"`) scrolls with arrow keys natively. Do not add custom key handlers.
- No `localStorage`, no analytics, no network calls.

## Phase 6: QA

The site ships only when every check below passes locally. Serve it with `python3 -m http.server 8000` from the repo root and test at http://localhost:8000. Opening `index.html` as a file breaks the root-relative `/assets/` paths.

### 6.1 Automated checks

Run these from the repo root. Each must print nothing or the stated result.

```bash
# no em dashes anywhere in source
# (perl is used instead of grep -P because macOS grep lacks -P)
perl -CSD -ne 'print "FAIL em dash $ARGV:$.\n" if /\x{2014}/' index.html 404.html styles.css timeline.js

# no Framer hotlinks or leftover placeholders
grep -nE 'framerusercontent|SURFSIDE_TITLE|COMPANY_PARAGRAPH|MY_ROLE_PARAGRAPH|FONT-|MEASURE' index.html styles.css && echo "FAIL: leftovers"

# every img has alt, every img/video has width and height
perl -0 -ne 'print "FAIL img without alt\n" while /<img(?![^>]*\balt=)/g' index.html
perl -0 -ne 'print "FAIL missing width\n" while /<(img|video)(?![^>]*\bwidth=)/g' index.html

# heading outline: expect 1 h1, 6 h2
grep -o '<h1' index.html | wc -l
grep -o '<h2' index.html | wc -l

# every referenced asset exists
grep -oE '/assets/[^" ,)]+' index.html styles.css | sort -u | sed 's#^/##' | while read -r f; do [ -f "$f" ] || echo "MISSING $f"; done

# text is in the HTML, not injected: expect all six company names
for c in Surfside LaunchScience Beeswax Celtra Amplify Qloo; do grep -q "$c" index.html || echo "MISSING TEXT $c"; done

# size budget
du -sh assets/
```

Also run the HTML through https://validator.w3.org/nu/ (paste the file) and fix all errors.

### 6.2 Browser checks

Test in Chrome, Safari and Firefox on desktop, and Safari on a real iPhone.

- [ ] Side by side with `_raw/reference/` at 1440px: type sizes, weights, colors, spacing and panel radius match within a few pixels
- [ ] Timeline bar moves to the correct range for each of the 6 roles while scrolling, in the role's color, with no jump on first load
- [ ] Surfside bar runs off the right edge with no end dot; every other role shows two dots
- [ ] Clicking a year scrolls to the right role and the heading is not hidden under the sticky header
- [ ] Each strip scrolls by trackpad, by drag on touch, by arrow keys when focused, and by prev/next buttons on desktop
- [ ] Prev is disabled at the start of a strip, next at the end
- [ ] Videos play only when visible and pause when scrolled away vertically or horizontally
- [ ] At 375px: no horizontal page scroll, body text at least 15px, company names wrap cleanly, odd-year labels visible and even ones hidden, two text columns stack
- [ ] JS disabled (DevTools: Cmd+Shift+P, "Disable JavaScript"): all text visible, no hidden sections, videos show posters with native controls, timeline shows years with no bar
- [ ] macOS "Reduce motion" on: no entrance animation, no video autoplay, no smooth scroll
- [ ] Keyboard only: skip link appears on first Tab, focus ring visible on every link and strip, logical tab order
- [ ] VoiceOver: heading list (VO+U) shows 1 h1 and 6 h2 company names; images announce their alt text

### 6.3 Targets

| Metric | Tool | Target |
| --- | --- | --- |
| Lighthouse Performance, mobile | Chrome DevTools | 95+ |
| Lighthouse Accessibility | Chrome DevTools | 100 |
| Lighthouse Best Practices | Chrome DevTools | 100 |
| Lighthouse SEO | Chrome DevTools | 100 |
| Largest Contentful Paint, mobile | Lighthouse | under 2.0s |
| Cumulative Layout Shift | Lighthouse | under 0.02 |
| Initial transfer before scroll | DevTools Network | under 600KB |
| axe violations | axe DevTools extension | 0 |

Initial transfer stays low because all images below the first role are lazy and every video is `preload="none"` until it nears the viewport.

## Phase 7: deploy and DNS cutover

Publish from a repo named `giuseppefurcolo.github.io`, verify it on that URL, then move DNS from Framer to GitHub with the old records saved for rollback. Claude Code prepares commands and stops; Giuseppe performs every DNS and account change himself.

**Decision: name the repo `giuseppefurcolo.github.io`, not `giuseppefurcolo.com`.** A user-site repo serves from the domain root, so the root-relative `/assets/` paths work on the preview URL before DNS moves. A project repo would serve from `/giuseppefurcolo.com/` and break every asset path until cutover. This assumes the GitHub username is `giuseppefurcolo`, per the footer link.

**Note:** GitHub Pages on a free account requires a public repo. That is fine here; nothing in the repo is private. Keep `_raw/` gitignored.

### 7.1 Publish

```bash
git init -b main
git add -A
git commit -m "Rebuild site as static HTML"
gh repo create giuseppefurcolo.github.io --public --source=. --push
```

Then in GitHub: Settings → Pages → Build and deployment → Source: Deploy from a branch → `main`, `/ (root)` → Save. The `.nojekyll` file makes Pages serve files as-is.

Wait 1 to 2 minutes, then run phase 6.2 again against https://giuseppefurcolo.github.io. Do not continue until it passes. While `CNAME` is in the repo, GitHub may try to redirect the preview to the custom domain; if so, temporarily remove `CNAME`, test, then restore it in 7.4.

### 7.2 Before touching DNS

1. Record the current records so rollback is a copy-paste:

```bash
mkdir -p _raw/dns
for t in A AAAA CNAME TXT MX; do
  dig +noall +answer giuseppefurcolo.com $t
  dig +noall +answer www.giuseppefurcolo.com $t
done | tee _raw/dns/before.txt
```

2. Keep the `MX` and any email-related `TXT` records (SPF, DKIM, DMARC) exactly as they are. `me@giuseppefurcolo.com` depends on them. Only web records change.
3. In the registrar, lower the TTL on the apex and `www` records to 300 seconds. Wait for the old TTL to expire (often 1 hour, up to 24) before 7.3.
4. Verify the domain with GitHub to prevent takeover: github.com → Settings → Pages → Add a domain → add the `TXT` record GitHub shows → Verify.

### 7.3 Switch records

At the registrar, delete the apex and `www` records that point at Framer, then add:

| Host | Type | Value |
| --- | --- | --- |
| @ | A | 185.199.108.153 |
| @ | A | 185.199.109.153 |
| @ | A | 185.199.110.153 |
| @ | A | 185.199.111.153 |
| @ | AAAA | 2606:50c0:8000::153 |
| @ | AAAA | 2606:50c0:8001::153 |
| @ | AAAA | 2606:50c0:8002::153 |
| @ | AAAA | 2606:50c0:8003::153 |
| www | CNAME | giuseppefurcolo.github.io |

These are GitHub's published Pages addresses as of the doc date. Confirm them against [GitHub's custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) before entering them.

### 7.4 Enable the custom domain

1. Make sure `CNAME` contains exactly `giuseppefurcolo.com` and is pushed.
2. Settings → Pages → Custom domain: `giuseppefurcolo.com` → Save. Wait for the DNS check to pass.
3. Wait for the TLS certificate (minutes to an hour), then tick Enforce HTTPS.

### 7.5 Verify

```bash
dig +short giuseppefurcolo.com A        # four 185.199.x.153 addresses
dig +short www.giuseppefurcolo.com      # giuseppefurcolo.github.io then the same IPs
curl -sI http://giuseppefurcolo.com | head -3      # 301 to https
curl -sI https://www.giuseppefurcolo.com | head -3 # 301 to apex
curl -s https://giuseppefurcolo.com | grep -c '<h2'  # 6
```

Then send a test email to `me@giuseppefurcolo.com` to confirm mail still flows, and paste the URL into LinkedIn's Post Inspector to refresh the OG preview.

### 7.6 Retire Framer

1. Remove the custom domain from the Framer project.
2. Wait 7 days with the new site live.
3. Confirm nothing references `framerusercontent.com` (phase 6.1 check).
4. Cancel the Framer plan. Keep the Framer project unpublished rather than deleted, as a fallback.

**Rollback:** re-enter the records from `_raw/dns/before.txt` and re-add the domain in Framer. With TTL at 300 seconds, recovery takes about 5 minutes.

## Future updates and open decisions

Adding a role years from now takes about 30 minutes and needs only a text editor, ImageMagick, ffmpeg and git. The steps below go into `README.md` verbatim.

### README.md

```markdown
# giuseppefurcolo.com

Static site. No build step. Edit, commit, push; GitHub Pages deploys in about a minute.

## Preview locally
python3 -m http.server 8000   # then open http://localhost:8000

## Add a new role
1. Media: drop raw files in _raw/files/<slug>/, run scripts/optimize.sh, rename outputs to 01, 02...
2. index.html: copy the newest <article class="role">, paste it above, update id, data-start, data-end, --role-color, dates, links, title, copy, alt text.
3. Previous role: change its data-end from "now" to the real YYYY-MM, and its "Now" text to the month.
4. Timeline: if the new year is missing, add <li data-year="YYYY"> before "Now",
   change repeat(16, 1fr) in styles.css to the new count, and update LAST_NUMBERED_YEAR in timeline.js.
5. Update jobTitle and worksFor in the JSON-LD, and lastmod in sitemap.xml.
6. Run the checks in SPEC.md phase 6.1, push.
```

**Timeline growth.** Each year adds a column. At 20 columns the labels get tight on a 375px phone; the mobile rule already hides every other label. Past about 24 columns, switch to showing every third label on mobile.

### Open decisions

Resolve these before launch. Until then, placeholders stay in the files and the phase 6.1 leftovers check fails, which blocks shipping by design.

- [ ] **Surfside title** (`SURFSIDE_TITLE`, used in the role section and JSON-LD). Live site: "Head of Design". Should it be Chief Design Officer and co-founder?
- [ ] **Surfside role paragraph**: "front-end team" or "design and front-end team"?
- [ ] **Surfside company paragraph**: keep the live copy or replace it with a current description.
- [ ] **LaunchScience**: acquisition year to replace "Recently", and confirm the spelling Octane11.
- [ ] **LaunchScience company paragraph**: keep Title Case or switch to sentence case like the rest of the site.
- [ ] **Font**: identified family and license confirmed for self-hosting (phase 1.5).
- [ ] **Role colors**: all six measured from the reference captures.
- [ ] **OG image**: reuse Framer's or render a new one.

Out of scope for this pass but raised in the audit: quantified outcomes per role (team size, design system adoption, exit context) and one deeper case study. Both drop into the existing role template without structural changes.
