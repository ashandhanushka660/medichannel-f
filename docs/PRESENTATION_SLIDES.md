# MediChannel — Presentation Slides

## Slide 1 — Title

MediChannel — Hospital Channelling and Appointment System  
IT404050 Full Stack Development — Group Assignment 2  
Group: MediChannel  
Live frontend: https://medichannel-f-p3z5.vercel.app/mediclinic-system.html#welcome  
Live API: https://evening-plains-20028-0ce7ee55df0f.herokuapp.com/

## Slide 2 — Problem and solution

- Current problem: phone bookings, paper register, duplicate numbers, invisible queue, personal messaging apps, mass calls for cancellations, spreadsheet patient data
- Solution: secure role-based web platform for booking, live queues, online consultation, payment, notices, feedback and reports
- Outcome: faster patient flow, privacy by design, auditable staff actions, live system on free hosting

## Slide 3 — Team and responsibilities

- P.A. Dhanushka — Team leader; database, authentication/roles, encryption, integration
- B. Vinojan — WebSockets, role pages, feedback and notices
- S. Kapilan — Database, authentication/roles, encryption
- M.H.M. Fahim — Database, authentication/roles, encryption
- H.M. Hasfak — Caching, deployment, live testing, report, slides and rehearsal

Every member will explain their own work during the presentation and Q&A.

## Slide 4 — Architecture

- Browser → Next.js App Router and BFF route handlers → Spring Boot REST API `/api/v1` → PostgreSQL
- Browser → WSS ticket → STOMP/WebSocket `/ws` → queue, chat and notification topics
- JWT remains in an HTTP-only Secure `__Host-` cookie; the browser never stores the bearer token
- Deployed with Vercel frontend, Heroku backend and Supabase PostgreSQL

## Slide 5 — Database design

- PostgreSQL with UUID keys, foreign keys, CHECK constraints, partial indexes and Flyway migrations
- Core tables: users, patients, specialisations, doctors, rooms, doctor_sessions, appointments, consultation_summaries, chat_messages, payments, reviews, notifications, notices, audit_logs
- Appointment number trigger locks the session row; no duplicate or reused numbers
- Live Flyway version: 29; fictional seed data only

## Slide 6 — Security and encryption evidence

- AES-256-GCM with random IV for personal and clinical fields
- HMAC-SHA256 lookup hashes for email and NIC; bcrypt cost 12 for passwords
- JWT with role and token-version claims; five failed logins lock for 15 minutes
- Exact-origin CORS and WSS origin checks; HTTPS and WSS in production
- Live evidence: `v1:` ciphertext at rest and decrypted name visible only to treating doctor
- Patient receives `403` for doctor and manager endpoints

## Slide 7 — Booking and real-time rules

- BR-01–BR-11: session fields, no overlap, unique queue numbers, one active booking, cutoffs, estimate formula, cancellation, status flow, consultation room, validation and history protection
- RT-01: live now-serving number
- RT-02: live availability after booking or cancellation
- RT-03: private encrypted chat with typing indicator and connection status
- RT-04: called, three-away, consultation-started, delayed and cancelled notifications

## Slide 8 — Live demo path

1. Open the production Vercel frontend and show live counters.
2. Register a fictional patient and complete the profile.
3. Book one physical and one online appointment; show queue numbers.
4. Sign in as doctor; accept, check in, start consultations and chat.
5. Complete consultations and publish summaries.
6. Show patient `403` denial for manager/doctor endpoints.
7. Cancel an empty future session and show the patient notification.
8. Show `v1:` ciphertext in the database and the decrypted doctor view.

## Slide 9 — Testing and evidence

- Backend: layered unit and PostgreSQL integration tests, 88 passing in the final cycle
- Frontend: 114 unit checks and 54 smoke checks in the final remediation cycle
- Live E2E: 40/40 passed after the final password reset
- Post-E2E: 12/12 passed, including encryption, persistence, health and CORS
- Required 30-case table is provided in `TEST_CASES_30.md`

## Slide 10 — Deployment, reflection and conclusion

- Supabase PostgreSQL → Heroku Spring Boot → Vercel Next.js
- Production frontend commit `00bfe0d`; backend commit `a555f11`, Heroku release `v58`
- Caffeine TTL cache, `no-store` personal data, compression and exact-origin CORS
- Backup 8–10 minute demo recording: https://drive.google.com/drive/u/1/folders/1D7_RV90haVzTvYngc10b0ECImY1iPta7?dmr=1&ec=wgc-drive-%5Bmodule%5D-goto
- AI disclosure: OpenCode assisted documentation, verification scripts and log analysis; all work was reviewed by the group
- Conclusion: secure, live, role-based full-stack system with evidence for every brief criterion
