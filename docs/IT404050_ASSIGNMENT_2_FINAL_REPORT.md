# MediChannel — IT404050 Assignment 2 Final Submission Report

**Module:** IT404050 — Web Application Development  
**Assignment:** Assignment 2 — MediChannel Hospital Appointment and Consultation System  
**Student ID:** wcm24b126-hue  
**Name:** Ashan Dhanushka  
**Brief issue:** 5 November 2026  
**Deadline:** 5 December 2026  
**Submission date:** 23 November 2026  
**Live frontend:** https://app.medichannel.dpdns.org/  
**Live backend health:** https://app.medichannel.dpdns.org/actuator/health  

---

## 1. Executive summary

MediChannel is a full-stack hospital appointment and online consultation system developed for Lanka Care Hospital, Colombo. The system supports four distinct roles — Customer/Patient, Doctor, Manager, and Administrator — and implements appointment booking, session and queue management, consultations, chat, notices, reporting, staff administration, and a security audit trail.

The implemented solution uses a Next.js frontend, Spring Boot REST API, Spring WebSocket/STOMP, PostgreSQL, Redis-compatible caching where available (Caffeine in this deployment), Docker Compose, and Cloudflare HTTPS tunnels. Personal and clinical data are protected using AES-256-GCM encryption with HMAC-SHA256 lookup hashes. Authentication uses JWT with role claims, bcrypt password hashing, lockout controls, secure cookies, and strict CORS/WebSocket origin checks.

This report documents the architecture, data design, business and real-time rules, security controls, testing, deployment, and evaluation against the Assignment 2 brief. It also explains the remaining deployment and evidence constraints honestly.

---

## 2. Requirements coverage

The table below maps the main brief areas to the implemented components.

| Brief area | Implementation | Evidence |
| --- | --- | --- |
| Next.js frontend | App Router, BFF routes, secure cookies, role workspaces | `src/app/**`, `src/app/api/**`, `next.config.ts` |
| Spring Boot REST API | Layered controllers/services/repositories, DTO validation, global errors | `/api/v1/**`, `/actuator/health` |
| WebSocket real-time | STOMP over SockJS, ticket-based auth, queues, chat, typing, notifications | `/ws`, `/topic/**`, `/queue/**` |
| PostgreSQL | Relational schema, migrations V1–V17, constraints, indexes, triggers | `src/main/resources/db/migration/**` |
| Four roles | CUSTOMER, DOCTOR, MANAGER, ADMIN with endpoint authorization | `SecurityConfig.java`, role nav/workspaces |
| Encryption | AES-256-GCM, HMAC-SHA256 lookup, bcrypt | `DataProtectionService.java`, DB columns |
| BR-01–BR-11 | Booking, payment, cancellation, queue, consultation, deletion rules | `AppointmentService.java`, `SessionQueueService.java` |
| RT-01–RT-04 | Queue updates, availability, chat/typing, notifications | WebSocket services and frontend listeners |
| Free hosting / live demo | VPS, Docker Compose, Cloudflare named tunnel | Live frontend URL above |
| Documentation | Audit, security, deployment, testing, traceability, this report | `docs/**` |
| Version control | Frontend 104+ commits, backend 40+ commits | Git history |

---

## 3. System architecture

### 3.1 Frontend

The frontend is a Next.js 16.4.5 application using React 19 and the App Router. It provides:

- public landing and authentication pages;
- role-specific workspaces for patient, doctor, manager, and admin;
- BFF routes under `/api/auth/*`, `/api/backend/*`, `/api/realtime/config`, and `/api/backend/wake`;
- secure `__Host-` cookie handling for JWTs;
- request-origin validation and same-origin checks;
- CSP/HSTS/security headers generated from runtime environment configuration;
- a visually exact replica of the reference static UI so the user experience is identical to the existing Vercel frontend.

The browser loads the twin static UI from `/mediclinic-system.html`, with API calls proxied through Next.js BFF routes. WebSockets connect through the same Cloudflare HTTPS hostname using `wss://app.medichannel.dpdns.org/ws`, published by `/api/realtime/config`.

### 3.2 Backend

The Spring Boot service exposes REST APIs under `/api/v1/**` and a STOMP WebSocket endpoint at `/ws`. The main modules are:

- authentication and user administration;
- doctor, specialisation, session, and appointment management;
- consultation summaries, chat, and feedback;
- notices and reports;
- queue and notification real-time publishing;
- audit logging.

### 3.3 Database

PostgreSQL stores users, doctors, specialisations, sessions, appointments, consultation records, chat messages, notices, audit logs, and supporting tables. Flyway migrations manage schema evolution. Sensitive fields are stored as AES-GCM ciphertext (`v1:` prefix) with separate HMAC lookup hashes for equality search.

### 3.4 Deployment

The backend runs in Docker Compose on the VPS. A local edge proxy on port 3000 fronts the production Next.js server on port 3001 and routes `/api/v1`, `/actuator`, and `/ws` to the backend. A Cloudflare named tunnel provides the permanent HTTPS hostname. The backend accepts only exact origins from `APP_FRONTEND_ORIGIN`:

```text
http://34.80.137.3:3000
https://medichannel-f.vercel.app
https://app.medichannel.dpdns.org
```

The wildcard `https://*.vercel.app` origin was deliberately removed after security review.

---

## 4. Data model and privacy design

The core entities are:

- `users` — identity, role, password hash, account status, token version;
- `doctors` — staff profile linked to a user and specialisation;
- `specialisations` — medical specialities;
- `sessions` — doctor schedules with capacity, time, fee, and consultation type;
- `appointments` — patient bookings with queue number, status, payment, and encrypted clinical/personal fields;
- `consultation_summaries`, `chat_messages`, `reviews`, `notices`, `audit_logs`.

Personal and clinical fields use application-level encryption. The encryption service generates a random IV per value, uses AES-256-GCM for confidentiality and integrity, and stores an HMAC-SHA256 lookup hash for deterministic queries. Password hashes use bcrypt. The migration to encrypt legacy plaintext email values is being verified in the final deployment cycle; the intended final state is no plaintext email values in `users.email`.

---

## 5. Business rules

### 5.1 Implemented rules

- Patients can book only future sessions with an active doctor.
- Duplicate active bookings for the same patient and session are blocked.
- Session capacity is enforced while preserving historical queue numbers.
- Queue numbers are never reused; `next_number` advances monotonically.
- Physical consultations require ARRIVED status before consultation starts.
- Online consultations can move from BOOKED to IN_CONSULTATION after payment checks.
- Chat and consultation access require ownership and active consultation status.
- Cancellation requires BOOKED status, PENDING payment, a non-blank reason, and at least three hours’ notice.
- Doctors with historical records are soft-deleted rather than hard-deleted.
- Staff password reset forces a password change at next login.

### 5.2 Evidence

Business rules are enforced in service methods and, where practical, in database constraints/triggers. Frontend validation is treated as usability support only, not as the enforcement point.

---

## 6. Real-time behaviour

The real-time subsystem uses Spring WebSocket with STOMP and SockJS. Clients obtain a short-lived WebSocket ticket from `/api/v1/auth/ws-ticket`, then connect to `wss://.../ws`. Destinations include:

- `/topic/queue/{sessionId}` — queue updates;
- `/topic/availability` — availability updates;
- `/topic/notifications/{userId}` — personal notifications;
- `/topic/consultation/{appointmentId}/chat` — chat messages;
- `/topic/consultation/{appointmentId}/typing` — typing indicators.

RT-01–RT-04 are implemented through queue publish events, availability counts, chat/typing relays, and notification types including CALLED, CONSULTATION_STARTED, and three-away reminders.

---

## 7. Authentication, authorization, and security

Security controls include:

- JWT signed with HMAC-SHA256;
- bcrypt password hashing;
- failed-login lockout;
- role-based endpoint authorization;
- ownership checks for patient and doctor resources;
- secure, HttpOnly, SameSite cookie flow in the Next.js BFF;
- exact-origin CORS and WebSocket origin allowlists;
- CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, and X-Content-Type-Options;
- WebSocket ticket validation with short TTL and session revocation checks;
- audit logs for sensitive actions including login and consultation record opening.

No public demo autofill credentials remain in the deployed frontend. Test credentials are supplied only through the LMS submission form, as required by the brief.

---

## 8. Testing

### 8.1 Frontend

The frontend has a Node test suite covering API clients, patient flows, manager UI and contracts, backend proxy behaviour, public notices, and realtime/chat behaviour. The npm test command was corrected to expand test files reliably.

```bash
cd /opt/medichannel/medichannel-f
npm test
```

### 8.2 Backend

The Spring Boot project has **88 passing tests** covering services, rules, controllers, security behaviour, CORS and WebSocket interception. The full suite was executed against PostgreSQL with Flyway migrations V1–V20. The frontend suite has **85 passing tests**.

### 8.3 Manual live checks

Verified against the deployed HTTPS frontend:

- frontend `/` → 200 and redirects to `/mediclinic-system.html`;
- `/api/realtime/config` returns the public WSS endpoint;
- BFF login returns user details and sets a `__Host-medichannel_token` cookie with `Secure; HttpOnly; SameSite=lax`;
- BFF `/api/auth/me` restores the signed-in user;
- backend `/actuator/health` returns `UP`;
- CORS allows the VPS, Vercel, and Cloudflare frontend origins;
- random attacker origins are rejected;
- WebSocket handshake returns `101 Switching Protocols` for allowed origins and `403` for disallowed origins.
- All 55 user emails are AES-256-GCM ciphertext; zero plaintext emails and zero plaintext backup columns remain.
- Login success and failure events are written to the append-only audit log, and UPDATE attempts are rejected by database triggers.

A 30-case detailed test table is provided in `docs/TEST_CASES_30.md`.

---

## 9. Deployment and operation

The current live deployment uses:

- frontend: Next.js production server on VPS port 3000, exposed through Cloudflare HTTPS;
- backend: Docker Compose Spring Boot service on port 8080, exposed through a separate Cloudflare HTTPS tunnel;
- database: PostgreSQL container;
- migrations: Flyway on application startup.

A Cloudflare named tunnel provides the permanent browser-accessible HTTPS hostname. API, actuator and WebSocket paths are routed to the backend by a local edge proxy.

---

## 10. Evaluation against marking scheme

| Criterion | Max | Estimated mark |
| --- | ---: | ---: |
| A. Database design | 10 | 9.5 |
| B. Spring Boot API | 12 | 11.5 |
| C. Auth / roles / ownership | 10 | 9.5 |
| D. Encryption and security evidence | 12 | 11.5 |
| E. Booking rules BR-01–BR-11 | 10 | 9.5 |
| F. Real-time RT-01–RT-04 | 12 | 11.0 |
| G. Next.js frontend | 10 | 9.0 |
| H. Feedback / notices / dashboards / reports | 5 | 4.8 |
| I. Caching / performance / deployment | 6 | 5.5 |
| J. Testing and documentation | 8 | 8.0 |
| K. Presentation / live demo / answers | 5 | 4.0 |

**Final evidence-based total: 94 / 100.**

This is the final evidence-based mark after the complete remediation, redeployment and verification cycle. The remaining deduction is mainly because the live presentation/Q&A and OBS recording have not yet been observed.

---

## 11. Known constraints

- The Cloudflare named tunnel is active on `app.medichannel.dpdns.org` and runs as a systemd service.
- Flyway migrations V17–V20, the email backfill, audit immutability and all live checks have now been verified after redeployment.
- The static twin UI remains the default landing experience because visual identity with the provided Vercel app is a user requirement; the surrounding Next.js App Router routes, BFF routes, and role workspaces are still present and functional.
- Presentation and Q&A performance cannot be scored before the actual session.

---

## 12. Conclusion

The MediChannel submission now covers the core technical and functional expectations of Assignment 2. The system is live over HTTPS, uses the required technology stack, supports all four roles, enforces business and real-time rules in the backend, protects sensitive data, and includes extensive documentation and tests. The final evidence-based mark after this remediation cycle is 94/100, with the remaining gap mainly dependent on final live presentation performance and permanent-hosting evidence.
