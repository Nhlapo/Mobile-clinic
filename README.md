# Morjud Healthcare Providers

A responsive home-healthcare website, guest booking flow, patient account and private care-team portal. Built with **Angular 21**, **Node.js / Express 5**, and **SQLite** through Node's built-in SQLite driver. Uses modern Angular, rather than the retired AngularJS 1.x framework.

## Run locally

Install Node.js 22.13+ (22 LTS recommended), then:

```powershell
npm install
Copy-Item .env.example .env
npm run build
npm start
```

Open **http://localhost:3000**. For development, `npm run dev` serves Angular at **http://localhost:4200** and proxies API requests to port 3000.

On this Windows workspace you can also run `./Start-Morjud.ps1`. It finds the project-local Node runtime, builds the site and starts the server.

If using the project-local Node downloaded during setup:

```powershell
$env:Path = "$PWD\.tools\node-v22.23.2-win-x64;$env:Path"
npm.cmd run build
npm.cmd start
```

## Features

- Responsive public site: services, booking guidance, vision, mission, six values, contact and policy pages.
- Five-step guest booking with server-calculated road-distance quotes, geolocation and OpenStreetMap preview, available dates/times, patient details, optional PDF, separate service/travel fees, and printable confirmation.
- Patient registration/login, next visit, appointment history/cancellation, medical information, documents, notifications and profile updates.
- Role-protected admin: daily schedule, appointment management, date-filtered calendar, patients, service pricing, summary reports, activity and provider creation.
- Multi-provider schema with automatic assignment, atomic booking transactions and a unique active provider/time constraint.
- Password hashing with scrypt, HTTP-only sessions, access control on documents and appointments, request validation, rate limits, same-origin write checks and security headers.
- SQLite database created automatically under `data/`. Prices are stored as integer cents; confirmed visits preserve their quoted price.

## Set up real booking

The supplied brief contains example costs, but no approved price list, provider address, contact details or routing credentials. **Live booking defaults to disabled.** Do not enter real patient information in the unconfigured development application.

1. Create an administrator:

   ```powershell
   npm run admin -- admin@example.com "replace-with-a-unique-long-password" "Morjud Admin"
   ```

   No default administrator password is supplied. Avoid sharing terminal history containing this command.

2. Log in and review each service's price under Pricing (values are cents). Rename the initial provider directly in SQLite if appropriate; additional providers can be added under Settings.
3. The default dispatch address is **52 Ross Road, Cullinan, South Africa**, stored in `PROVIDER_ADDRESS` in `.env`. OpenRouteService locates the address when quoting; successful lookups are cached for 24 hours. Results without a matching house number are rejected. Leave `PROVIDER_LAT` and `PROVIDER_LNG` blank unless setting both to verified coordinates. Set the per-kilometre travel rate in `.env`. Coverage uses the bundled Gauteng province boundary for both typed addresses and GPS; the old MAX_DISTANCE_KM setting is no longer used. This release uses one shared dispatch base and the same services for all providers.
4. Add an [OpenRouteService API key](https://openrouteservice.org/dev/). The server geocodes addresses in South Africa and requests a `driving-car` route. There is no straight-line or invented-distance fallback. Check map pins carefully.
5. Add real phone, email and WhatsApp contact details. WhatsApp should use international digits only, without `+` or spaces. Review the displayed Monday–Saturday hours.
6. Set `BOOKING_ENABLED=true` and restart the server.

Quotes expire after 30 minutes. Appointment start times run hourly from 07:00 through 17:00, within the next 90 days, in SAST (UTC+02:00). Admin Services has a date-specific availability grid: mark a slot busy or available and see held/booked status. Sundays default to busy but individual slots can be opened. Each time supports one booking across all services/providers. Patient selection holds the slot for 10 minutes (or until the quote expires, if sooner); screens refresh every 10 seconds. Booking confirmation checks availability inside a database transaction. Cancellation reopens the slot unless it is busy. Mark adjacent times busy as needed for care and travel; hourly starts do not automatically reserve travel buffers. Visits throughout Gauteng are supported without the former 60 km or one-hour travel cutoff. Road-distance fees still apply from Cullinan. See server/BOUNDARY-CREDITS.md for boundary source and border limitations.

### Price calculation says “Online booking is being set up”

This means the running server has `BOOKING_ENABLED` disabled or no `ORS_API_KEY`. A map pin alone does not establish a driving route or travel price.

Sign in at [OpenRouteService](https://openrouteservice.org/log-in/) to obtain your key and put it in `.env` (never commit or share the key). Set `BOOKING_ENABLED=true`, confirm the dispatch location and fees, then restart the Node server. A frontend refresh alone does not reload `.env`. The default dispatch address is 52 Ross Road, Cullinan. Its user-confirmed dispatch pin is latitude `-25.6810980290163`, longitude `28.523261228919374`; these coordinates override address lookup because the geocoder only resolves Ross Road to street level.

The typed street address is used for pricing by default, even after finding your device location. To book at your device location, explicitly select the map-pin checkbox. Editing the address clears the old pin and quote. Confirm the resulting map pin before proceeding.

## Validation

```powershell
npm test
npm run build
```

API tests use an isolated in-memory database and synthetic patient information. They cover authentication, role escalation prevention, document ownership, price integrity, quote reuse, availability, exclusive time slots, cancellation, invalid uploads and cross-origin writes.

Browser checks (Microsoft Edge must be installed): `node scripts/smoke.mjs` checks the running app at port 3000; `node scripts/booking-smoke.mjs` starts an isolated in-memory server at port 3001, stubs the external routing service and tests the complete guest booking and admin completion flow. Screenshots are written to `test-results/`. The first script creates a synthetic patient account in the running application's database; use a development database.

Verified during implementation: production build, all 12 API tests, desktop/mobile smoke checks and the complete booking/admin browser flow. Live OpenRouteService calls were not tested because no business API key was supplied.

## Before production

- Replace draft privacy and terms text with approved business policies, retention rules and the responsible contact. Confirm service descriptions, operational hours and example fees.
- Deploy behind HTTPS, set `NODE_ENV=production`, and configure a trusted reverse proxy deliberately if using one. Secure cookies require HTTPS. The application expects frontend and API on the same origin.
- Protect the database and backups with OS access controls and encrypted storage. Database encryption and backup automation are infrastructure responsibilities, not implemented here.
- Email/SMS notifications, payment processing, password reset/email verification, advanced staff rosters, document malware scanning and external clinical-record integrations are **not implemented**. In-app notifications and printed confirmations work. Reports show visit value, not collected payments.
- Guests can complete a booking without registration; guest records are not linked by email alone to subsequently created accounts. This avoids exposing medical information through unverified email ownership. Guest cancellation is handled by the care team.
- Optional uploads accept PDFs up to 2 MB, stored in the database and served as authorised downloads. File signature checks are not malware scanning.
- Medical profile information is patient-managed; visit-specific details should be entered during booking. Administrators see appointment details and their attached documents.
- The admin patient list is derived from appointment name/email, not a full clinical patient registry. Providers share hours, rates and services; custom shifts, leave, travel optimisation, rescheduling and individual service qualifications need further operational design.
- Stock photographs are bundled locally (credits in `public/PHOTO-CREDITS.md`); maps load from OpenStreetMap. Review imagery with Morjud before launch. Typography uses Google Fonts with local system fallbacks.

## Frontend redesign

Booking location offers two independent choices: **Type an address** (no device location required) or **Use my current location** (no address required). GPS users can optionally add an address or directions. The confirmed GPS coordinates are retained with the booking for the care team. Changing the choice or location invalidates the old travel quote. Both methods require the road-routing service to be reachable.

See [REDESIGN.md](REDESIGN.md) for the updated components, responsive checks, preserved workflows, photo credits and pending business content. The active stylesheet is `src/theme.css`. The header and footer display your original `public/logo_bg.png` without modifying the artwork.

## Project folders

`src/` Angular UI · `server/` API, schema, admin CLI and tests · `public/` brand assets · `.env.example` configuration · `data/` runtime SQLite files (ignored).

Technical references: [Angular compatibility](https://angular.dev/reference/versions), [OpenRouteService API](https://openrouteservice.org/dev/).
