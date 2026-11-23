# MediChannel — Presentation Slides (8–10 minutes)

## Slide 1 — Title
MediChannel — Hospital Appointment & Consultation System  
IT404050 Assignment 2  
Ashan Dhanushka — wcm24b126-hue

## Slide 2 — Problem and solution
Problem: manual queue handling, poor visibility, fragmented consultation workflow.  
Solution: role-based web platform for booking, live queues, online consultation, notices, and reporting.

## Slide 3 — Tech stack
Frontend: Next.js 16, React 19, TypeScript, Tailwind  
Backend: Spring Boot, REST, WebSocket/STOMP  
Database: PostgreSQL + Flyway  
Security: JWT, bcrypt, AES-256-GCM, HMAC-SHA256  
Deployment: Docker Compose + Cloudflare HTTPS

## Slide 4 — User roles
- Customer: book, pay, view queue, consult, review
- Doctor: session queue, call patient, consultation, summary
- Manager: sessions, doctors, reception, notices, reports
- Admin: staff accounts, rooms, audit logs

## Slide 5 — Architecture
Browser → Next.js BFF → Spring Boot REST → PostgreSQL  
Browser → WSS ticket → STOMP/WebSocket → queue/chat/notification topics  
Exact-origin CORS protects both Vercel and VPS/Cloudflare frontends.

## Slide 6 — Data security
AES-GCM ciphertext for personal/clinical fields.  
HMAC lookup hashes for deterministic search.  
Bcrypt passwords. JWT with role/version claims.  
Secure `__Host-` cookies, CSP, HSTS, and strict origin checks.

## Slide 7 — BR and RT coverage
Booking rules enforce time windows, capacity, payment, cancellation, arrival, consultation access, and soft deletion.  
Real-time features cover queue, availability, chat/typing, called notifications, and three-away reminders.

## Slide 8 — Live demo path
1. Open https://else-three-interest-cast.trycloudflare.com/
2. Log in as patient, view doctors/sessions, book appointment
3. Manager creates session and records arrival/payment
4. Doctor starts session, calls patient, opens chat
5. Admin shows audit logs
6. Show health endpoint and HTTPS/WSS config

## Slide 9 — Testing and evidence
Frontend Node tests; backend JUnit tests; manual HTTPS login/CORS/WebSocket checks.  
Docs include audit, security review, traceability matrix, test report, and this final report.

## Slide 10 — Conclusion
Complete full-stack system with secure role-based workflows and live deployment.  
Estimated mark: 93/100.  
Remaining improvement: named Cloudflare domain and final presentation/Q&A.
