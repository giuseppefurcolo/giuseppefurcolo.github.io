# giuseppefurcolo.com

Static site. No build step. Edit, commit, push; GitHub Pages deploys in about a minute.

## Preview locally
python3 -m http.server 8000   # then open http://localhost:8000

## Add a new role
1. Media: drop raw files in _raw/files/<slug>/, run scripts/optimize.sh, rename outputs to 01, 02...
2. index.html: copy the newest <article class="role">, paste it above, update id, data-start, data-end, --role-color, dates, links, title, copy, alt text.
3. Previous role: change its data-end from "now" to the real YYYY-MM, and its "Now" text to the month.
4. Timeline: if the new year is missing, add <li data-year="YYYY"> before "Now",
   change repeat(16, minmax(0, 1fr)) in styles.css to the new count, and update LAST_NUMBERED_YEAR in timeline.js.
5. Update jobTitle and worksFor in the JSON-LD, and lastmod in sitemap.xml.
6. Run the checks in SPEC.md phase 6.1, push.
