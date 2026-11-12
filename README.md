# KrunchyKremmy

A premium dessert-shop storefront and commerce API, built incrementally around a cream-and-cocoa design system.

## Brand and product direction

**KrunchyKremmy** pairs editorial dessert photography and high-contrast serif headlines with a quiet cream, cocoa, and strawberry palette. The interface should feel like a modern neighborhood patisserie: generous, tactile, and playful in its details rather than loud or childish. Product imagery uses Unsplash-hosted photos as development assets; replace or self-host selected, rights-cleared images before launch.

The expanded sample catalog includes cupcakes, hot dogs and buffet, chicken and chips, spaghetti and chicken, and Refreshing KrunchyKremmy Drinks alongside the original treats. The catalog and event-package entries in the seed are examples, not verified live offerings, prices, portions, inventory, or allergen declarations.

## Project layout

- `Krunchy/` — React + Vite customer storefront and customization experiences.
- `Kremmy/` — Express API, validation, commerce services, and Prisma access.
- `Kremmy/prisma/` — PostgreSQL schema and sample development catalog.

## Staged delivery and status

1. **Foundation — implemented** — project structure, Prisma/PostgreSQL model and initial migration, environment contract, and design tokens.
2. **Storefront — implemented as a first pass** — responsive homepage, category browsing, product catalog/search, guest bag, newsletter consent, and mobile navigation.
3. **Treat builders — implemented as a first pass** — four builders use configured option groups and trusted server prices when the API is configured. Without a database they explicitly show sample options/prices.
4. **Commerce services — partial** — paginated catalog, server-side builder quotes, inventory reservation, checkout idempotency, Paystack transaction initialization, signed webhook verification, server-side transaction verification, and fulfilment configuration/scheduling are implemented. Customer registration, email verification, password reset, order/booking history, protected staff APIs, and a staff dashboard have initial implementations; database-backed integration and live-provider flows remain unverified. Business delivery zones, fees, pickup address, operating hours, capacity, and reservation expiry must be configured by staff before checkout can be enabled.
5. **Integration and release — in progress** — focused tests/build and Prisma schema validation run locally. A real PostgreSQL migration, live payment transaction, and production deployment require configured services and further testing.

6. **Events & catering — request workflow implemented; staff management partial** — premium event landing page, quote-only service/package selection, five-step guest inquiry, server validation, availability-review signal, idempotent request references, rate limit, and token-protected individual request lookup. The staff dashboard supports review, quotations, availability rules, and blackout dates. Confirmation remains intentionally blocked until availability enforcement, customer acceptance, and deposit/payment requirements can be verified. No event price, date availability, quotation, or confirmation is fabricated.

7. **Food, drinks & catering expansion — storefront and request flow implemented as a first pass** — five added product categories, configurable seeded product choices, option-aware product details/cart, server-side option validation and price calculation, persisted order customizations, new quote-only event services/packages, and optional booking budget range. Product and category changes can be managed through protected staff tools; event service/package editing remains unavailable.
8. **Delivery, pickup & scheduling — configuration and checkout flow implemented; launch setup incomplete** — staff can configure delivery zones and fees, one fixed pickup location, separate schedules, capacities and blackout dates. Customer checkout displays available slots, obtains a server-priced quote, atomically reserves stock and slot capacity, and initializes Paystack in NGN. No live zones, pickup address, hours, fees or capacity are seeded. A late successful payment after reservation expiry is recorded for staff reconciliation.

The development catalog is seeded separately; the storefront labels its offline fallback as a sample menu. No payment success is fabricated. Paystack checkout returns unavailable until explicitly enabled with server secrets.

## Run locally

Requirements: Node.js 20.19+, npm, and PostgreSQL.

1. Copy `.env.example` to `.env`; set a local PostgreSQL connection string.
2. Install dependencies with `npm install`.
3. Generate the Prisma client: `npm run db:generate`.
4. Apply checked-in database migrations locally: `npm run db:migrate` (production: `npm run db:deploy`). Migrations add product customization, optional booking budget and request fingerprints, NGN defaults, Paystack reference fields, and additive fulfilment/scheduling tables without relabeling historical currency values or deleting rows.
5. Load the clearly identified sample catalog: `npm run db:seed`.
6. Start the frontend and API: `npm run dev`.

The frontend is served at `http://localhost:5173`; the API health endpoint is `http://localhost:4000/api/health`.

## Responsive image assets

Original product and event photography remains unchanged in `Krunchy/public/`. After adding or replacing a local photo, regenerate responsive WebP variants and the manifest from the repository root with `npm run optimize:images -w Krunchy`, then include the generated files in the deployment. The storefront selects appropriately sized variants; source photos remain the fallback.

## Deploy on Vercel

This repository is a monorepo: `Krunchy/` is the Vite storefront and `Kremmy/` is the Express API. Import the repository as **one Vercel project using Services**, with the repository root as the project root. The root `vercel.json` builds each app separately and routes `/api/*` to Express and all other paths to Vite on the same origin. Do not import only one detected application; doing so leaves the other part of the app unavailable.

Add these project environment variables in Vercel for Production and Preview as appropriate:

- `DATABASE_URL` — the Supabase PostgreSQL connection URI. Use the Supabase session pooler URI for IPv4-compatible deployment and encode special characters in the password.
- `FRONTEND_ORIGIN` — the deployed storefront origin, such as `https://your-project.vercel.app`; update it if you attach a custom domain. This is used for payment-return URLs and allowed origins.
- `SECURITY_HASH_KEY` — a stable secret generated from at least 32 random bytes. Keep it unchanged across deployments.
- `CHECKOUT_ENABLED=false` — leave disabled until live business fulfilment settings and Paystack production credentials have been verified.
- `PAYSTACK_SECRET_KEY` — only when configuring Paystack; use the correct test or live secret for the environment.
- `PAYMENT_RESERVATION_MINUTES` — a positive integer from 1 to 1440 when enabling checkout.
- `RESEND_API_KEY` and `EMAIL_FROM` — configure only after transactional email is ready.

Supabase Auth API keys are not a substitute for `DATABASE_URL`; this application currently uses its own database-backed account and session implementation. Vercel does not read the ignored local `.env`. Apply schema updates with `npm run db:deploy -w Kremmy` against the intended database before deploying code that depends on them.

Vercel runs the Express app as a function, not as the persistent `server.js` process. The in-process cleanup intervals in `server.js` therefore do not run in production; reservation expiry is also triggered by checkout and slot activity, but scheduled security-data cleanup requires a separately configured Vercel Cron or another persistent worker before relying on it operationally.

To provision the first staff account, apply database migrations, then set `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_NAME`, and `ADMIN_BOOTSTRAP_PASSWORD` through a secure one-time environment and run `npm run admin:create -w Kremmy`. The password must be at least 12 characters. This command creates a new, verified administrator and intentionally refuses to change the role of an existing account. Remove the bootstrap variables immediately afterward; never commit them or leave them configured in a long-lived host environment.

## Event booking request API

- `GET /api/events` — active event types, services, configured option lists, and packages.
- `GET /api/events/availability?startsAt=...&endsAt=...&timeZone=...` — reports that a date is requestable, but always marks availability for staff review.
- `POST /api/bookings` — accepts a validated guest request, checks active event/services/options, records consent, optional budget range, and an availability-review note, and returns a reference plus a private access token. Replays with the same idempotency key and payload return the original reference; reusing a key for a different payload is rejected.
- `GET /api/bookings/:reference` — requires the one-time code in `x-booking-access-token`; do not share the code.

Event service/category/package records in the seed are examples. A request submission only records an inquiry; it never creates a confirmed reservation, calculates a quote, reserves capacity, or takes a deposit. Staff can review inquiries and create quotations through the protected dashboard, but Resend email delivery is unverified and bookings cannot be confirmed. Until email is configured and tested, staff must check delivery status and contact customers manually. Do not expose a public admin API as a substitute.

## Expanded product catalog

- `GET /api/products` returns the configured `customizationOptions` for each product.
- `POST /api/checkout/session` accepts the selected `customization` with a product item. The server validates choices against the current product configuration, calculates option prices, stores the selection on the order item, and initializes a Paystack payment in NGN.
- `POST /api/payments/webhook` validates Paystack's `x-paystack-signature` over the raw request body, then independently verifies `charge.success` or `charge.failed` transactions with Paystack before changing order/payment state.
- `GET /api/payments/verify/:reference` verifies the Paystack transaction server-side after the customer returns from checkout. The browser return URL is not treated as proof of payment.
- Run `npm run db:deploy` (or `npm run db:migrate` locally) and `npm run db:seed` to load the expanded sample catalog and event services/packages.

Checkout remains disabled unless explicitly configured. The new event packages are quotation requests and are never treated as instant orders. Staff product/category editing, order fulfillment status, booking review/quotations, and availability controls are available behind administrator authentication. Event-package/service editing, upload management, customer quote acceptance, and analytics remain unimplemented; do not treat seed data as a live menu or prices as launch-ready.

## Delivery, pickup, and scheduled checkout

- Staff configure these options in **Delivery & fulfilment**. There are no preloaded active zones, fees, pickup locations, hours, or capacities; checkout remains unavailable until complete real business settings are saved and activated.
- Delivery neighbourhood and fee are validated against the active zone on the backend. Pickup orders snapshot the single active pickup location. Each order snapshots its fee, customer fulfilment details, and scheduled time.
- `GET /api/fulfillment/config` returns public active fulfilment options. `GET /api/fulfillment/slots?method=DELIVERY|PICKUP&date=YYYY-MM-DD&zoneId=...` lists future capacity. `POST /api/checkout/quote` calculates current trusted item/fulfilment totals. `POST /api/checkout/session` revalidates and reserves inventory/capacity in a serializable database transaction before initializing Paystack; the storefront reuses the same idempotency key for retries of an unchanged checkout payload. Signed-in customers can retry a failed payment with `POST /api/account/orders/:orderNumber/retry-payment`, which revalidates and re-reserves the original order.
- Configure `PAYMENT_RESERVATION_MINUTES` as a positive integer (1–1440) and leave `CHECKOUT_ENABLED=false` until schedules, pickup/delivery configuration, and Paystack test-mode checkout have been verified. Expired reservations are released on subsequent slot/checkout activity; payment failures and late successful payments are retained for reconciliation.
- Apply the new migration using a non-production PostgreSQL database first. This workspace has not verified the migration against a configured database. Staff order tools support delivery/pickup progression and dispatch details. Payment/status email notifications, staff retry, and an automated reservation-expiry worker are implemented but still require database/provider integration testing before production use.

## Production authentication and server hardening

- Apply the additive `20261103090000_auth_security_hardening` migration before deploying the updated API. It adds per-account failed-login state, shared PostgreSQL IP-rate-limit buckets, and security-event records.
- Customer and administrator accounts use the same protected login endpoint and existing session cookies. Login returns a generic error for unknown, unverified, incorrect-password, and temporarily locked accounts. Five failed attempts within 15 minutes lock that account for 15 minutes; a successful login clears the counter. Password recovery clears the lockout and revokes existing sessions.
- Login is limited to 10 attempts per IP per 15 minutes. Registration, email verification, password-reset requests, and password-reset submissions each have separate limits. The limits use PostgreSQL atomic upserts, so they are shared across API instances. PostgreSQL availability is therefore required for these auth endpoints.
- Configure a long, random `SECURITY_HASH_KEY` in the backend environment (at least 32 random bytes, kept stable across instances; generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`). It HMAC-hashes IP identifiers used for rate-limit keys and security events; raw IP addresses, email addresses, passwords, and tokens are not stored in the security-event log. Admins can view recent events at `/api/admin/security/events`; event records are pruned after 90 days.
- `TRUSTED_PROXY_CIDRS` defaults to empty, so forwarded headers are not trusted unless explicitly configured. Set it to the exact proxy IPs/CIDRs that connect to the API—not `*` or an unrestricted hop count. Configure each proxy to discard client-supplied forwarding headers and set/overwrite `X-Forwarded-For` with the actual client address. Never expose the API directly if trusting a proxy.
- Express disables `X-Powered-By`; application middleware removes common technology headers and production 5xx responses are generic. Standard Node HTTP does not add a `Server` header. Configure the actual edge server as well: for Nginx use `server_tokens off;` (hides the version) and, where the `headers-more` module is available, `more_clear_headers Server;`; for Apache use `ServerTokens Prod`, `ServerSignature Off`, and `Header unset X-Powered-By`. Hosting providers may require their own header controls. Verify headers from the public edge, not only from Express.
- Before enabling production authentication, deploy the migration, set `SECURITY_HASH_KEY`, configure trusted proxy CIDRs if applicable, and test lockout, recovery, rate limits, and headers in a staging environment. This workspace does not contain a production Nginx/Apache configuration or an available PostgreSQL integration environment, so edge-header suppression and concurrent database behavior still need deployment verification.

## Payment and launch configuration

Paystack is the sole configured payment gateway. Set `PAYSTACK_SECRET_KEY` and `PAYSTACK_CURRENCY=ngn` only in the backend environment; never expose the secret to Vite. Configure the Paystack dashboard webhook to call `/api/payments/webhook`. The configured business and checkout currency is Nigerian naira (`NGN`). Monetary integer fields represent minor units (kobo) and are divided by 100 for display. Existing records keep their recorded currency and amount when migrations run, so historical transactions are not relabeled. A provider-neutral migration renames legacy payment identifier columns without deleting their values. Pending records with an old provider session/transaction are blocked from starting another payment and require manual reconciliation to prevent duplicate charges. Checkout is disabled unless `CHECKOUT_ENABLED=true` and the Paystack secret is present. Webhook signature verification, idempotent order handling, amount/currency/order matching, and transactional stock reservation are implemented, but must be verified with Paystack test keys and webhook delivery. Customer authentication and a protected staff experience have initial implementations but require PostgreSQL integration and end-to-end testing. Delivery, tax, refund, and fulfillment policies must be decided and implemented before enabling checkout for real customers.

Sample products and prices loaded by `db:seed` are development menu data, not a live business catalog. Review/reprice every sample product, builder option, and catering quotation in NGN/kobo before launch; changing the currency does not perform an exchange-rate conversion. Configure real menu, prices, stock, policies, photography rights, email delivery, and hosting before deployment.

## Deployment checklist

- Set `DATABASE_URL`, `FRONTEND_ORIGIN`, and `NODE_ENV` on the API host.
- Configure `RESEND_API_KEY` and a verified `EMAIL_FROM` sender for transactional email. Email delivery and retry behavior have not been verified; check provider delivery and logs before relying on verification, reset, or quotation messages.
- Configure Paystack test keys in `PAYSTACK_SECRET_KEY`, set `PAYSTACK_CURRENCY=ngn`, and configure the dashboard webhook endpoint as `/api/payments/webhook`. Set a reviewed `PAYMENT_RESERVATION_MINUTES` value. Keep `CHECKOUT_ENABLED=false` until real NGN prices, delivery zones/fees, pickup location, schedules/capacities, and payment flows are configured and tested.
- Run `npm run db:deploy`, then use the health endpoint to confirm API/database connectivity.
- Create the initial staff account using the one-time bootstrap procedure above; do not expose admin credentials in source control or frontend environment variables.
- Build the storefront with `npm run build`; configure the frontend host to proxy `/api` to the backend or set up an equivalent same-origin API route.
- Serve both applications over HTTPS. Keep API credentials in backend-only environment variables.
- Before accepting real orders, complete and test customer authentication, password reset, protected administration, checkout, order fulfillment, delivery/tax/refund/currency policy, email delivery, backups, monitoring, and real product/photo configuration.
- Event booking requests require the event migration and development seed to be applied. All sample event types/services/packages are development menu content; configure actual services, customization choices, service area, business time zone, availability, cancellation terms, privacy notice, response-time policy, and staff review process before publishing.
- Event requests are always quote-only and unconfirmed. Public availability checks explicitly require staff review; no capacity is held. Staff cannot confirm a booking until availability enforcement, customer acceptance, and deposit/payment requirements are implemented and tested. Configure real event policies and verify Resend delivery before using quotation tools.

## Production readiness

This project is **not production-ready**. The delivery/pickup data model and customer/admin configuration flows are implemented, but no real zones, fees, pickup address, schedules, capacities, or reservation expiry have been configured. The new migration has not been applied to a configured PostgreSQL database; Paystack test/live transactions, webhook delivery, automated reservation cleanup, and email order notifications are unverified or incomplete. Sample catalog values have not been repriced as actual Naira prices. Keep checkout disabled and booking confirmation unavailable until real business settings are documented and full integration flows are tested in a non-production environment.
