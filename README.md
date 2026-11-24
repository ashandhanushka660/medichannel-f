# MediChannel – Hospital Channelling and Appointment Management

## Project Overview

MediChannel is a Hospital Channelling and Appointment Management System developed as a group project for IT404050 – Full Stack Development.

The repository contains a Next.js frontend and a Spring Boot backend. The backend provides REST APIs, authentication, business logic, database operations, and real-time communication.

## Technology Stack

- Java
- Spring Boot
- Spring Security
- Spring Data JPA
- Spring WebSocket
- PostgreSQL
- Maven

## Deployment Architecture

- Frontend hosting: Vercel (this repository), with Netlify as an alternative
- Backend hosting: Render (separate [`medichannel-backend`](https://github.com/wcm24b126-hue/medichannel-backend) repository)
- Database hosting: Neon PostgreSQL

This repository contains only the Next.js frontend. The root [`vercel.json`](./vercel.json) configures Vercel and [`netlify.toml`](./netlify.toml) configures the optional Netlify deployment. The Spring Boot backend, its `Dockerfile`, and its `render.yaml` live in the backend repository.

## User Roles

- CUSTOMER
- DOCTOR
- MANAGER
- ADMIN

## Main Modules

- Authentication and authorization
- User and role management
- Patient management
- Doctor and specialisation management
- Room and session management
- Appointment booking
- Queue management
- Online consultation chat
- Notifications
- Feedback and notices
- Audit logs

## Database

The system uses PostgreSQL hosted on Neon.

Database schema changes will be managed through Flyway migration files.

Never commit database passwords, connection strings, encryption keys, JWT secrets, or other credentials.

## Deployment

Deploy in this order: Supabase database, Heroku backend, then the Vercel frontend.

1. **Supabase:** Create a PostgreSQL project. Restore the production dump into it, then let Flyway apply the remaining migrations on first boot. Heroku cannot reach the direct `db.<ref>.supabase.co` host because it is IPv6-only, so use the **Session pooler** (`aws-0-<region>.pooler.supabase.com:5432`) with the username `postgres.<project-ref>` and `sslmode=require`.
2. **Heroku (backend repository):** Create the app and set config vars:
   - `DB_URL` to `jdbc:postgresql://aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require`
   - `DB_USERNAME` (`postgres.<project-ref>`) and `DB_PASSWORD` to the Supabase credentials
   - `JWT_SECRET`, `ENCRYPTION_KEY`, `HMAC_SECRET` to independent Base64-encoded 32+ byte keys. `ENCRYPTION_KEY` must stay stable once patient data exists.
   - `APP_FRONTEND_ORIGIN` to the exact frontend origin (for example `https://medichannel-f-p3z5.vercel.app`), with no wildcard
   - `APP_ADMIN_EMAIL` and `APP_ADMIN_PASSWORD` for the first administrator bootstrap (password: 8+ characters with a letter, a number and a symbol)
   - Leave `APP_DEMO_SEED` unset or `false` in production
   - `SPRING_PROFILES_ACTIVE=prod`
   Deploy with `git push heroku main`; Heroku reads `system.properties` for Java 21 and the `Procfile` for the web command. Wait for `/actuator/health` to report `UP`, then copy the `https://<app>-<hash>.herokuapp.com` origin.
3. **Vercel (this repository):** Import this repository at [vercel.com/new](https://vercel.com/new). Vercel detects Next.js, uses the root `vercel.json` (`npm ci` / `npm run build`), and deploys on every push to `main`. In **Project → Settings → Environment Variables**, add `API_URL` (Production and, if you use them, Preview) set to the Heroku app origin only, without a trailing slash, `/api`, or `/api/v1` (for example, `https://evening-plains-20028-0ce7ee55df0f.herokuapp.com`). Do not expose it through a `NEXT_PUBLIC_*` variable. Deploy, then set the Heroku `APP_FRONTEND_ORIGIN` to the exact Vercel production origin (for example `https://medichannel-f-p3z5.vercel.app`) and redeploy the backend.
4. **Netlify (alternative):** Import this repository. Netlify reads the root `netlify.toml`, runs `npm run lint && npm run build`, publishes `.next`, and applies `@netlify/plugin-nextjs` on Node 22. Set the same server-side `API_URL` variable, then set Render's `APP_FRONTEND_ORIGIN` to the Netlify URL.
5. **Verify:** Confirm the Render service reports healthy, open the Vercel (or Netlify) site, and check that login, the doctor catalogue, and the wake endpoint work. The CSP is generated at build time from `API_URL`, so set `API_URL` before the first deploy and rebuild after changing it.

#### Vercel notes

- Node 22 is used automatically on Vercel; `package.json` requires Node `>=20.9.0`.
- `vercel.json` pins the install (`npm ci`) and build (`npm run build`) commands.
- The `/api/backend/*` routes are server-side, so `API_URL` never reaches the browser.
- The WebSocket origin is derived from `API_URL` at build time. If you change the backend URL, redeploy the frontend so the CSP `connect-src` entries are regenerated.
- Preview deployments share the Production `API_URL` unless you add a Preview-scoped value. Render only accepts one `APP_FRONTEND_ORIGIN`, so use the stable production domain for two-user testing.

Keep all provider credentials in Render/Vercel environment settings; never commit them or place them in `NEXT_PUBLIC_*` variables. For local frontend development, copy `.env.example` to `.env.local` and point `API_URL` at your local or deployed backend. Do not commit local `.env` files.

### Render cold starts and frontend caching

The frontend probes the same-origin `/api/backend/wake` route when the app loads, when a hidden tab becomes visible again, after a back-forward-cache restore, and when connectivity returns. The route checks Render's health endpoint so a sleeping service can start; it does not keep Render awake, and a cold start may take time. Authenticated appointment history and queue data are fetched from the backend and are not cached. The app HTML and its browser script may be stored but must be revalidated before reuse.

A scheduled GitHub Actions workflow (`.github/workflows/keep-backend-awake.yml`) pings the Render health endpoint every 10 minutes so the free instance is less likely to reach its ~15-minute idle sleep. GitHub may delay scheduled runs, so treat this as a best-effort keep-alive rather than a guarantee.

### Frontend behavior and security

- The welcome screen is public. Signed-in patients also see a live queue card built from their real appointment for today (`You are number N`), a Dashboard button, and Log out; Log in/Register are hidden until logout.
- Every MediChannel logo and app-name link — dashboard headers, login, registration, and footer — returns to the welcome screen.
- Doctor, manager, and admin workspaces show only the selected sidebar panel. Panel links update the URL without scrolling the page or jumping to the bottom. Panel deep links (for example `#doctor-q`) are supported.
- A boot screen covers the app until session restore finishes, so the dashboard never flashes before hydration.
- Tailwind CSS 3.4.17 is self-hosted under `public/vendor/`, so the Content Security Policy can use `script-src 'self'` without trusting a third-party CDN.
- Auth cookies are HttpOnly, SameSite=Lax, Secure in production, and use the `__Host-` prefix in production. JavaScript cannot read the token.
- Appointment APIs and auth responses are `no-store`; HTML and the app script revalidate; the versioned vendor file is immutable.
- The static HTML is served with a strict CSP, `X-Frame-Options: DENY`, COOP/CORP, and `frame-ancestors 'none'`.

### Testing

```bash
npm run lint
npx tsc --noEmit
npm run build

# In one terminal (use the port printed by Next.js):
npm start
# In another terminal:
SMOKE_BASE_URL=http://localhost:8080 npm run test:smoke
```

The smoke suite checks routing, self-hosted assets, CSP/security headers, cache policy, anonymous
session rejection, CSRF rejection, and the wake endpoint. The browser test matrix and the
frontend UX score are in [`docs/FRONTEND_EVALUATION.md`](./docs/FRONTEND_EVALUATION.md).
The dedicated security assessment is in
[`docs/WEB_SECURITY_REVIEW.md`](./docs/WEB_SECURITY_REVIEW.md), and the review against the
official IT404050 Assignment 2 brief is in
[`docs/ASSIGNMENT_2_REVIEW.md`](./docs/ASSIGNMENT_2_REVIEW.md).

**Backend implementation status:** The Spring Boot backend currently provides versioned REST APIs for authentication, patients, doctors, sessions, appointments, and additional modules. Confirm that the backend deployment has applied the matching Flyway migrations before testing frontend flows. Features without a corresponding backend endpoint must not be simulated by the frontend.

## Environment Variables

The frontend server reads `API_URL`, which must be the Render backend origin without `/api` or `/api/v1`. On Vercel this is set in **Project → Settings → Environment Variables**; on Netlify `NODE_VERSION=22` is set in `netlify.toml`. The production backend (in the separate backend repository) reads `PORT`, `SPRING_PROFILES_ACTIVE`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`, `HMAC_SECRET`, `APP_FRONTEND_ORIGIN`, `APP_ADMIN_EMAIL`, `APP_ADMIN_PASSWORD`, and optionally `APP_DEMO_SEED` / `APP_DEMO_PASSWORD`. `PORT` is supplied by Render. The production profile requires a JDBC-formatted `DB_URL`; Neon connection details should use SSL (`sslmode=require`).

## Team Development

1. Clone the repository.
2. Create a feature branch for your assigned task.
3. Make your changes.
4. Commit and push your work if you have repository write access.
5. Submit a pull request for review.

## Project Repository

https://github.com/wcm24b126-hue/medichannel-backend
