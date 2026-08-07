# O2 Arena Ticket Booking System — Project Report

**Event:** Dua Lipa Live at The O2  
**Venue:** The O2 Arena  
**Event date:** 30 November 2026  
**Ticket sales start:** 1 July 2026  
**Stack:** Node.js + Express · MongoDB Atlas + Mongoose · HTML/CSS (Tailwind CDN) + Vanilla JavaScript  

---

## 1. Introduction

This project is a full-stack web application that manages ticket sales for a Dua Lipa concert at The O2 Arena. It supports customer registration, guest checkout, simulated card payment, QR-coded tickets, email verification, refunds/amendments under business rules, and an admin dashboard with sales statistics and ticket lookup.

The application was built to meet a university assignment brief requiring:

- Clean MVC folder structure
- Mobile-first responsive UI
- Custom JWT authentication (no third-party auth)
- Server-side enforcement of inventory and business rules
- Automated Jest tests for core logic
- Documented MongoDB schema design (embedding vs referencing)

---

## 2. Objectives

| Objective | Status |
|---|---|
| Sell 4 ticket types with correct prices and rules | Done |
| Register / login / guest checkout | Done |
| Early-bird discounts for registered users | Done |
| Simulated card payment only (no real card data stored) | Done |
| Prevent overbooking with atomic stock updates | Done |
| Cancellation (72h window, 20% fee) and upgrade-only amend | Done |
| QR ticket generation + admin lookup | Done |
| Admin stats (sales, revenue, demographics, inventory) | Done |
| Email verification + ticket confirmation via SMTP | Done |
| Automated tests for core business rules | Done |

---

## 3. Technologies Used

### Backend
- **Node.js / Express 5** — REST API and static file hosting
- **MongoDB Atlas + Mongoose** — cloud database and ODM
- **JWT (`jsonwebtoken`)** — sessionless authentication
- **bcryptjs** — password hashing
- **Nodemailer** — real SMTP emails (verification + ticket confirmation)
- **qrcode** — QR data URL generation for each ticket
- **express-validator / custom validators** — input and business-rule checks
- **Jest + Supertest** — unit / integration tests

### Frontend
- **HTML5 pages** under `frontend/pages/`
- **Tailwind CSS (CDN)** — mobile-first responsive styling
- **Vanilla JavaScript modules** — API client, auth, cart, nav, content
- **Chart.js** — admin dashboard charts

### Tooling
- `dotenv` for environment configuration
- `nodemon` for local development
- Git + GitHub for version control

---

## 4. System Architecture

The project follows an **MVC-style** layout:

```
backend/
  config/        # DB connection, constants, editable content
  controllers/   # Request handling / business orchestration
  models/        # Mongoose schemas
  middleware/    # Auth (JWT) + error handler
  routes/        # Express route definitions
  seed/          # Ticket types, discounts, admin user
  utils/         # Pricing, QR, email, verification helpers
frontend/
  css/           # Custom styles
  js/            # Client logic (api, auth, cart, nav, content)
  pages/         # HTML views
  index.html     # Homepage / event info
tests/           # Jest suites
```

**Request flow**

1. Browser loads static HTML/JS from Express.
2. Frontend calls `/api/...` endpoints with JSON.
3. Middleware authenticates JWT where required.
4. Controllers apply business rules (pricing, stock, refunds).
5. Models persist data in MongoDB Atlas.
6. Utils generate QR codes and send emails.

Both frontend and backend run from **one server** on port `3000` (`npm run dev`).

---

## 5. Features Implemented

### 5.1 Public / Customer features

| Page | Purpose |
|---|---|
| Homepage (`index.html`) | Event info, CTA to buy tickets |
| Tickets (`pages/tickets.html`) | Ticket type cards with prices & stock |
| Cart (`pages/cart.html`) | Review selected tickets |
| Checkout (`pages/checkout.html`) | Attendee details (group members supported) |
| Payment (`pages/payment.html`) | Simulated card payment UI |
| Confirmation (`pages/confirmation.html`) | Order success + QR display |
| Auth (`pages/auth.html`) | Register / Login / Guest |
| Verify (`pages/verify.html`) | Email OTP / link verification |
| Forgot / Reset password | Password recovery via email |
| Dashboard (`pages/dashboard.html`) | View, cancel, amend own tickets |

### 5.2 Admin features (`pages/admin.html`)

- Login-protected admin area (role = `admin`)
- QR / ticket-number lookup
- Manage ticket types (price, stock, rules)
- Manage discounts
- Manage users (edit / delete with cascade)
- List orders & tickets; cancel / amend any ticket
- Chart.js stats: tickets sold by type, revenue, age groups, registered vs guest
- Database browser (`/api/admin/data`) for inspection

### 5.3 Auth & email

- Register with name, email, password, phone
- **Email verification** required before login (OTP + verify link, 15 min expiry)
- Resend verification
- Forgot / reset password
- Guest checkout (email required; no account verification)
- Delete own account (cascades related tickets/orders)
- Ticket confirmation email after payment (type, date, amount, attendees, embedded QR)

### 5.4 Extra improvements beyond the core brief

- Editable site copy via `backend/config/content.js` + `GET /api/content`
- Forgot-password flow linked from the login page
- Admin CRUD for catalogue / discounts / users
- Seed script resets inventory and ensures a pre-verified admin

---

## 6. Ticket Types & Inventory

| Code | Name | Price | Rules | Stock |
|---|---|---|---|---|
| `RESTRICTED` | Single Adult Restricted | £30 | Non-refundable, non-amendable | 700 |
| `STANDARD` | Single Adult Standard | £40 | Refundable & amendable | 800 |
| `VIP` | Single Adult VIP | £250 | Non-refundable, amendable | 100 |
| `GROUP_STANDARD` | Group Standard | £120 | Up to 5 people, flat price | 400 |
| **Total** | | | | **2,000** |

Stock is reserved with an atomic `findOneAndUpdate` that only succeeds when `remainingStock >= qty`, which prevents overbooking under concurrent requests.

---

## 7. Business Rules (as implemented)

1. **Register or guest checkout** — both supported.
2. **Discounts (registered / verified users only)**  
   - July 2026 → 10%  
   - August 2026 → 5%  
   - September 2026 → 10%  
   - After September → 0%
3. **Payment** — simulated card payment only; no real card numbers stored.
4. **Children** — under 16; cannot purchase alone; an adult must be on the same order.
5. **Inventory** — 2,000 tickets total; enforced server-side.
6. **Cancellation** — only if ticket type is refundable, not a guest purchase, and ≥ 72 hours before the event; **20% fee** retained.
7. **Amendment** — upgrades only (e.g. Standard → VIP); never downgrade; fee = price difference, capped at new ticket price.
8. **Guest tickets** — not eligible for refund.
9. **On payment success** — ticket documents created, unique ticket numbers generated, QR codes embedded, confirmation email sent.
10. **Admin** — can look up any ticket by QR/ticket number and cancel/amend/upgrade.

Core pricing / refund / upgrade helpers live in `backend/utils/pricing.js` (pure functions, unit-tested).

---

## 8. Database Design (MongoDB)

### 8.1 Collections

| Collection | Purpose |
|---|---|
| `users` | Customers, guests, admins (`role`) |
| `tickettypes` | Catalogue + remaining stock |
| `orders` | Checkout snapshot (items, totals, status) |
| `tickets` | Individual scannable tickets + QR |
| `payments` | Simulated payment audit records |
| `discounts` | Date-window discount configuration |

### 8.2 Relationships (reference vs embed)

| Relationship | Choice | Justification |
|---|---|---|
| User ↔ Order / Ticket | **Reference** | Shared user; orders/tickets queried independently |
| Order ↔ Ticket | **Reference** | Cancel / amend / QR lookup operate per ticket |
| Ticket ↔ TicketType | **Reference** | Shared mutable stock & prices |
| Order line items + attendees | **Embed** | Always loaded with the order; not reused alone |
| Ticket attendees / amendmentHistory | **Embed** | Owned exclusively by that ticket document |
| Payment | **Reference** from Order | Separate revenue audit entity |
| Discount | Own collection | Configurable date windows |

**Price snapshotting:** amounts paid are stored on orders/tickets at purchase time so later catalogue price edits do not rewrite history.

This design is the NoSQL equivalent of a normalised relational model: shared mutable entities are referenced; tightly owned sub-documents are embedded.

### 8.3 Entity relationship (text diagram)

```
User 1──* Order 1──* Ticket
  │                    │
  └────────* Ticket ───┘
                     │
                     *──> TicketType
Order *──1 Payment
Discount (standalone config)
```

---

## 9. API Overview

| Area | Key endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/guest`, `/verify`, `/forgot-password`, `/reset-password`, `DELETE /api/auth/me` |
| Ticket types | `GET /api/ticket-types` |
| Orders | Create order, pay (simulated) |
| Tickets | Customer cancel / amend own tickets |
| Admin | Stats, lookup, CRUD ticket types/discounts/users, browse data |
| Content | `GET /api/content` |
| Health | `GET /api/health` |

Protected routes use JWT middleware (`protect`). Admin routes also require `requireAdmin`.

---

## 10. Security Measures

- Passwords hashed with **bcrypt** (cost factor 12)
- JWT secret stored in `.env` (never committed)
- Role-based access control for admin APIs
- Customers can only access their own orders/tickets
- Real card data is **never** collected or stored (payment is simulated)
- `.env` listed in `.gitignore`; `.env.example` provided for setup
- Email verification gate before registered login
- Mongoose schema validation (`required`, `enum`, `min`/`max`) for data integrity

---

## 11. Testing

Automated Jest tests cover the assignment’s core business logic:

| Suite | What it verifies |
|---|---|
| `tests/pricing.test.js` | Discounts, refunds (20% fee), 72h window, guest non-refund, upgrade-only, child accompaniment |
| `tests/overbooking.test.js` | Atomic stock reservation refuses when inventory is insufficient |
| `tests/verification.test.js` | Unverified users cannot log in; verified users can |

**Latest local run:** **31 / 31 tests passed**.

```bash
npm test
```

---

## 12. How to Run (smooth startup)

### Prerequisites
- Node.js (LTS recommended)
- MongoDB Atlas connection string in `.env`
- Optional but recommended: Gmail SMTP App Password for real emails

### Steps

```bash
cd "/Users/sonirajbanshi/Downloads/bijan/AVI vai project "
cp .env.example .env          # if needed — then fill real values
npm install
npm run seed                  # ticket types, discounts, admin
npm run dev                   # http://localhost:3000
```

### Demo admin account (pre-verified)

- **Email:** `admin@o2tickets.local`
- **Password:** `Admin123!`

### Suggested demo path for markers

1. Open `http://localhost:3000`
2. Browse tickets → add to cart → checkout as guest **or** register
3. If registering: verify email (OTP/link) → login
4. Complete simulated payment → view confirmation + QR
5. Check dashboard for cancel/amend options
6. Login as admin → open Admin → view stats + QR lookup
7. Run `npm test` to show automated verification

### SMTP note
If SMTP is misconfigured, the app still runs and logs verification OTPs / email content to the **server console**, so demos are not blocked.

---

## 13. Assumptions Made

| Topic | Decision |
|---|---|
| Inventory split of 2,000 | VIP 100 · Restricted 700 · Standard 800 · Group 400 |
| Group £120 | Flat price for 1–5 attendees |
| Child definition | Under 16 years |
| Amendment fee | Price difference; upgrades only |
| Venue “1,000 capacity” vs “2,000 tickets” | Sellable inventory = **2,000** as per brief |
| Email verification | 6-digit OTP + link token; 15-minute expiry |
| Payment | Always succeeds in simulation (demo mode) |

---

## 14. Project Structure Summary

```
o2-ticket-booking/
├── backend/          API (MVC)
├── frontend/         Mobile-first UI
├── tests/            Jest suites
├── .env.example      Safe template
├── package.json      Scripts: start, dev, seed, test
├── README.md         Setup guide
└── PROJECT_REPORT.md This document
```

---

## 15. What Was Built (work summary)

1. **Scaffolded** Node/Express + MongoDB project with MVC folders and `.env` / `.env.example`.
2. **Designed** Mongoose schemas with clear embedding vs referencing choices.
3. **Implemented** auth (register, login, guest, JWT, email verification, forgot password, account delete).
4. **Built** ticket catalogue, cart, checkout, simulated payment, confirmation with QR.
5. **Enforced** discounts, child rules, atomic stock, cancel/amend rules server-side.
6. **Added** Nodemailer SMTP for verification + ticket confirmation emails.
7. **Built** admin dashboard (stats, QR lookup, CRUD, DB browser).
8. **Wrote** Jest tests for pricing, refunds, upgrades, overbooking, verification gate.
9. **Seeded** Atlas database and verified the app runs at `http://localhost:3000`.
10. **Documented** setup, assumptions, and schema rationale in README + this report.

---

## 16. Conclusion

The O2 Arena ticket booking system meets the assignment requirements: a responsive full-stack application with custom auth, MongoDB data design justified against normalisation principles, strict business-rule enforcement, QR tickets, admin analytics, SMTP emails, and automated tests. The application is runnable locally with `npm run seed` and `npm run dev`, and core logic is verified by a passing Jest suite.

---

## Appendix A — Useful commands

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run seed` | Reset catalogue / admin |
| `npm run dev` | Development server (port 3000) |
| `npm start` | Production-style start |
| `npm test` | Run Jest tests |

## Appendix B — Screenshots checklist (for submission)

Capture these for your report / demo pack:

1. Homepage (mobile + desktop)
2. Ticket selection page
3. Register / login / guest
4. Checkout with attendees
5. Payment page
6. Confirmation page with QR
7. Customer dashboard (cancel/amend)
8. Admin stats charts
9. Admin QR lookup result
10. Terminal showing `npm test` all green
