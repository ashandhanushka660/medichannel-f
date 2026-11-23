# MediChannel — Frontend Lighthouse Remediation Report

**Date:** 23 November 2026  
**Branch:** `fix/frontend-lighthouse-remediation`  
**Baseline branch:** `main` at `b50d1bb`  
**Deployment action:** none — this report covers the local production build only; no deploy, merge or push was performed.

## 1. Objective and constraints

The supplied Lighthouse baseline reported Performance **68**, Accessibility **96**, Best Practices **92**, SEO **91** and CLS **0.902**. The baseline run also warned that results might be incomplete, so it is used as a defect signal rather than a controlled benchmark.

The remediation target was:

| Metric | Target | Final status |
| --- | ---: | --- |
| Performance | 90+ | Met: 95–100 across final runs |
| Accessibility | 98–100 | Met: 100 |
| Best Practices | 98+ | Met: 100 |
| SEO | 98+ | Met: 100 |
| CLS | ≤ 0.1 | Met: 0.010–0.011 |
| FCP | ≤ 1.8 s | Met on simulated mobile (0.9–1.0 s) and desktop (0.3 s); DevTools-throttled mobile measured 1.9 s |
| LCP | ≤ 2.5 s | Met: 0.6–2.3 s |
| TBT | ≤ 200 ms | Met: 0–200 ms |

The following were explicitly preserved:

- Next.js **16.4.5** App Router and React **19.3.0**.
- `public/mediclinic-system.html` as the static visual twin; no redesign.
- Brand colours: profile header `#E8734A`, title banner blue `#2B7A9E`.
- HTTPS hostname `https://app.medichannel.dpdns.org`, Vercel origin `https://medichannel-f.vercel.app`, exact-origin CORS, WSS `wss://app.medichannel.dpdns.org/ws`.
- CSP `connect-src 'self' https://app.medichannel.dpdns.org wss://app.medichannel.dpdns.org` and no `trycloudflare.com` or wildcard Vercel CORS.
- No feature removal, API/WebSocket disablement, credential exposure, RBAC weakening, patient-data exposure, backend/schema change, destructive database operation or automatic deployment.

## 2. Changes made

### 2.1 Cumulative layout shift

- The public HTML now paints the correct initial view synchronously before first paint and sets `data-app-ready="true"` in the same task.
- The boot view-selection script is hashed at build time and added to the CSP; the smoke suite verifies the header contains the current hash.
- Footer, public-notice, account/control and statistics regions reserve their space or remain hidden without changing layout after hydration.
- The duplicate public-notices load was removed.

### 2.2 Performance and startup cost

- The hero was extracted to a local, immutable `public/images/hero-doctor-1000.jpg` asset.
- API calls use a 25-second timeout, in-flight GET de-duplication, `fetchWithTimeout` and `loadOnce`.
- Duplicate appointment queue refreshes were removed.
- React effects use abort/cleanup guards.
- An anonymous session-hint cookie avoids an unnecessary `/api/auth/me` call for visitors who cannot have a session; the HttpOnly auth cookie is unchanged and is not readable by JavaScript.
- Motion-tree enhancement only runs for visible views.
- `Intl.DateTimeFormat` instances are shared.
- Expensive effects are reduced on mobile where they are not visible.
- App and chat messages are dismissible, and consultation status has explicit refresh/retry controls.

### 2.3 Accessibility

- Removed every low-contrast `text-white/70`, `text-white/80`, `text-white/85` and `opacity-90` usage; profile text now uses `text-ink`, and required white text uses full-opacity `text-white`.
- Corrected the walk-in first-name field to a real `<label for="walkin-fn">` and matching `id`, with `autocomplete`, `maxlength` and `required`.
- Regenerated `public/vendor/mediclinic-tailwind.css` from the updated tokens using pinned Tailwind CSS **3.4.17**; corrected token colours are `#B3431B` (`peach.d`), `#276749` (`ok`) and `#C53030` (`bad`).
- Added a skip link with a static `<main id="main-content" tabindex="-1">` target; the JS moves the target to the currently visible view after navigation.
- Added a polite route announcer and focus management for route changes.
- Notification bells now expose `aria-haspopup="true"` and maintain `aria-expanded`; closing one popover resets all bells.
- Native `<dialog>` elements are opened through a helper that focuses an initial control and restores focus to the triggering element on close.

### 2.4 SEO and discovery

- Added `src/app/robots.ts` and `src/app/sitemap.xml`/`src/app/sitemap.ts` output.
- Added canonical, Open Graph and robots metadata in `src/app/layout.tsx`.
- Private route aliases receive `X-Robots-Tag: noindex, nofollow`; private hash routes request the same via the existing meta robots tag.
- All five versioned static assets use the single cache-busting version `20261123d`.

### 2.5 Reproducible static CSS

The repository had Tailwind CSS 4 installed but the static generator targets a v3 config, so `npm run build:static-css` previously failed with `tailwindcss: not found`. The fix adds a pinned alias:

```json
"tailwindcss3": "npm:tailwindcss@3.4.17"
```

The package script continues to invoke the generator as `tailwindcss`; the alias supplies the v3 CLI binary. `npm run build:static-css` now succeeds and produces the corrected token colours.

## 3. Validation evidence

All checks were run on the final branch state.

| Check | Result |
| --- | --- |
| `npm test` | **114 / 114 passing** |
| `npm run lint` | clean |
| `npx tsc --noEmit --incremental false` | clean |
| `npm run build` | successful production build; 29 generated routes/pages |
| `SMOKE_BASE_URL=http://127.0.0.1:3100 npm run test:smoke` | **54 / 54 passing** |
| `npm run build:static-css` | successful, reproducible v3.4.17 output |
| Live CSP header check | passed, see below |

Live CSP verification command:

```bash
curl -sI https://app.medichannel.dpdns.org/mediclinic-system.html | grep -i content-security
```

The response included:

```text
connect-src 'self' https://app.medichannel.dpdns.org wss://app.medichannel.dpdns.org
```

and the build-computed inline script hash. The local smoke suite also verifies that the current compiled hash is present, the Tailwind CDN is not trusted, framing/plugins are blocked, COOP/CORP are same-origin, and API/auth responses are `no-store`.

## 4. Final Lighthouse measurements

Tooling: Lighthouse **12.8.2**, Chrome **158.0.8127.36**, local production server `http://127.0.0.1:3100/mediclinic-system.html`. Raw JSON results are in `/root/work/lighthouse-tooling/`.

| Run | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | Speed Index |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile, default simulated, run 1 | 96 | 100 | 100 | 100 | 1.0 s | 2.3 s | 170 ms | 0.011 | 1.1 s |
| Mobile, default simulated, run 2 | 96 | 100 | 100 | 100 | 0.9 s | 2.3 s | 180 ms | 0.011 | 1.1 s |
| Mobile, default simulated, run 3 | 95 | 100 | 100 | 100 | 0.9 s | 2.3 s | 200 ms | 0.011 | 1.1 s |
| Mobile, DevTools throttling | 96 | 100 | 100 | 100 | 1.9 s | 2.0 s | 160 ms | 0.011 | 2.1 s |
| Desktop, default simulated | 100 | 100 | 100 | 100 | 0.3 s | 0.6 s | 0 ms | 0.010 | 0.6 s |

Result files:

- `lh-final-mobile-sim-1.json`
- `lh-final-mobile-sim-2.json`
- `lh-final-mobile-sim-3.json`
- `lh-final-mobile-devtools.json`
- `lh-final-desktop.json`

All runs completed without a runtime error or run warning. The only borderline value is simulated-mobile TBT on run 3, which reached exactly the 200 ms target; no score or metric has been averaged, estimated or fabricated.

## 5. Assignment 2 re-evaluation

The previous evidence-based mark was **94 / 100**. The remediation materially strengthens criteria G and I, so the updated evidence-based mark is **95 / 100 (Excellent)**.

| Criterion | Max | Previous | Updated | Reason for change |
| --- | ---: | ---: | ---: | --- |
| A. Database design | 10 | 9.5 | 9.5 | Unchanged |
| B. Spring Boot API | 12 | 11.5 | 11.5 | Unchanged |
| C. Auth / roles / ownership | 10 | 9.5 | 9.5 | Unchanged; no RBAC or cookie weakening |
| D. Encryption / security evidence | 12 | 11.5 | 11.5 | Unchanged; CSP and deployment scope preserved |
| E. Booking rules BR-01–BR-11 | 10 | 9.5 | 9.5 | Unchanged |
| F. Real-time RT-01–RT-04 | 12 | 11.0 | 11.0 | Unchanged; no WebSocket change |
| G. Next.js frontend | 10 | 9.0 | **9.5** | Measured 100 accessibility/SEO/BP, stable CLS, improved focus, disclosure and route semantics |
| H. Feedback / notices / dashboards / reports | 5 | 4.8 | 4.8 | Unchanged |
| I. Caching / performance / deployment | 6 | 5.5 | **5.8** | Lighthouse targets met, deduped/cached loading, immutable versioned assets; free dynDNS retention note remains |
| J. Testing / documentation | 8 | 8.0 | 8.0 | Already full; 114 unit + 54 smoke assertions now recorded |
| K. Presentation / live demo / answers | 5 | 4.0 | 4.0 | Live Q&A/recording still not observed |

**Updated total:** 94.6 / 100, reported as **95 / 100**.

## 6. Residual limitations

- Simulated-mobile TBT remains close to the 200 ms threshold on this host; DevTools-throttled mobile is more stable at 160 ms.
- These fixes have **not** been deployed or merged. The live hostname still retains the previously deployed build until an explicit deployment is requested.
- Backend-affecting security items (JS-exposed Bearer token handling, logout revocation/multi-tab consistency, CSRF origin derivation, proxy path canonicalisation and CSP/Trusted Types scope) remain deferred pending explicit approval.
- The free deSEC dynDNS hostname should be touched at least once every ~180 days.
- Live presentation/Q&A cannot be scored until the session occurs; no demo recording was added in this cycle.
