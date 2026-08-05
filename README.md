# O2 Arena Ticket Booking (Dua Lipa — 30 Nov 2026)

Full-stack university assignment: **Node.js + Express**, **MongoDB Atlas + Mongoose**, **Tailwind (CDN) + vanilla JS**.  
Auth is built from scratch (JWT + email verification). Payments are **simulated**. Emails use **Nodemailer + SMTP**.

## Quick start

```bash
cp .env.example .env   # fill MONGODB_URI, JWT_SECRET, SMTP_* 
npm install
npm run seed           # ticket types, discounts, pre-verified admin
npm run dev            # http://localhost:3000
```

### Admin (pre-verified)
- Email: `admin@o2tickets.local`
- Password: `Admin123!`

### SMTP (required for real emails)
Set in `.env`:

```
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="O2 Tickets <noreply@example.com>"
APP_URL=http://localhost:3000
```

If SMTP is empty, the app still runs and **logs emails + OTPs to the server console** (useful for local demo).

## What’s implemented

- Register → **email OTP + verify link** → login blocked until verified (resend available)
- Guest checkout: **email required**, phone optional (no account verification)
- Logged-in checkout: name/email pre-filled from account; phone optional
- Ticket confirmation email after payment (type, date, amount, attendees, **QR embedded**)
- Atomic stock reservation (overbooking prevention)
- Discounts for verified registered users (Jul 10% / Aug 5% / Sep 10%)
- Cancel (72h + 20% fee), upgrade-only amend, guest non-refundable
- Admin: edit ticket types/discounts/users/tickets, QR lookup, Chart.js stats, DB browser
- Editable copy in `backend/config/content.js` (+ `frontend/js/content.js` / `/api/content`)
- Jest tests including **email-verification login gate**

## Assumptions

| Topic | Choice |
|---|---|
| Inventory 2,000 | VIP 100 · Restricted 700 · Standard 800 · Group 400 |
| Group £120 | Flat price for 1–5 people |
| Child | Under 16; adult required on same order |
| Amendment fee | Price difference; upgrades only |
| Verification | 6-digit OTP + link token; 15 min expiry |
| Venue “1,000” vs “2,000 tickets” | Sellable inventory = **2,000** per brief |

## Schema ↔ normalisation (report)

| Relationship | Choice | Why |
|---|---|---|
| User ↔ Order / Ticket | Reference | Shared user; independent updates |
| Order ↔ Ticket | Reference | Cancel/amend/QR lookup per ticket |
| Ticket ↔ TicketType | Reference | Shared mutable stock/prices |
| Order line items + attendees | Embed | Always loaded with order |
| Ticket attendees / amendmentHistory | Embed | Owned by ticket document |
| Payment | Reference | Revenue audit entity |
| Discount | Own collection | Date-window config |

Price paid is **snapshotted** on orders/tickets so catalogue changes don’t rewrite history.

## Editable content

Change homepage/auth/email wording in:

1. `backend/config/content.js` (source of truth for API + emails)  
2. Frontend loads it via `GET /api/content` and `data-content` attributes  

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | API + static frontend |
| `npm run seed` | Seed DB + admin |
| `npm test` | Jest (pricing, refunds, upgrades, overbooking, verification gate) |

## Project layout

```
backend/   config, controllers, middleware, models, routes, seed, utils
frontend/  css, js (api, auth, cart, content, nav), pages
tests/
.env.example
```
