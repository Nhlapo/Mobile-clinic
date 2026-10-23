# MORJUD frontend redesign

## Design and structure

The existing Angular application now uses the original, unmodified `public/logo_bg.png`, deep blue and medical green, DM Sans typography, generous spacing, locally served photography and a dark navy footer. The homepage includes a split hero, six API-driven service cards, service detail dialogs, the MORJUD story, care principles, booking steps, home care, vision/mission/values, a clearly labelled patient-story placeholder, booking CTA and Cullinan area overview.

The layout takes inspiration from Meridian Home Health's calm healthcare presentation without copying its branding, copy or assets.

### Files and components

- `src/ui/header.component.ts` and `.html`: utility bar, original logo, sticky navigation, mobile menu, login/account and booking actions.
- `src/ui/home.component.ts` and `.html`: public homepage composition and native service detail dialog.
- `src/ui/service-card.component.ts`: reusable card connected to real API service data.
- `src/ui/section-heading.component.ts`: reusable section heading.
- `src/ui/footer.component.ts` and `.html`: original logo, real service links, configured contacts and policy links.
- `src/ui/models.ts`: public view models and service-to-photo mapping.
- `src/ui/reveal.directive.ts`: subtle section movement, disabled for reduced motion.
- `src/theme.css`: shared responsive visual system, including booking, login, patient and admin screens. Selected by `angular.json`; the earlier `src/styles.css` is inactive.
- `src/app.html`: reusable components surround the retained functional screens.
- `src/main.ts`: component integration and restoration of hash views on reload/Back; navigation from portals uses root URLs.
- `public/images/`: five new locally served stock photos. See `public/PHOTO-CREDITS.md` for sources and `public/LOGO-SETUP.md` for logo usage.
- `scripts/ui-smoke.mjs`, `scripts/booking-smoke.mjs`, `scripts/smoke.mjs`: browser verification using isolated in-memory databases. `scripts/inspect-ui.mjs` captures viewport previews.

## Existing functionality

The Node API, SQLite schema, authentication, server configuration and ORS integration are unchanged by the redesign. Services and prices still come from the API. Selecting care from a service dialog or footer feeds the existing booking form.

The five-step guest booking, address-versus-GPS selection, road-distance quote, slot availability, patient details, PDF upload, consent and confirmation remain in place. Patient profiles, appointment management, documents and notifications remain available. Admin appointments, calendar, patients, services, pricing, reports and provider settings retain their existing controls.

The public map is an area overview, not a coverage guarantee. The existing backend determines eligibility by driving distance and time. API keys and the precise dispatch coordinates remain server-side.

## Verification

Run from the project directory using Node 22.13 or newer:

```powershell
npm run build
npm test
node scripts/ui-smoke.mjs
node scripts/booking-smoke.mjs
```

Browser scripts use installed Microsoft Edge in headless mode. They never use the real database or routing key. Booking tests mock only the external road-routing responses and exercise the real local API.

Checks cover widths 320, 375, 430, 768, 1024, 1280 and 1440; horizontal overflow; local images; mobile navigation and Escape; service dialogs and selection; registration/profile persistence/logout; hash-route reloads and Back; every booking step; and each admin tab. Screenshots are written to `test-results/`.

The production build performs strict Angular/TypeScript checks. No separate lint task is configured in this project. Browser checks are functional and responsive checks, not a formal accessibility or Core Web Vitals audit.

## Content to supply and follow-up

- Real phone, email and optional WhatsApp details through the existing server configuration. Missing details are labelled as pending; no contact numbers or social accounts have been invented.
- Approved patient testimonials with permission. The visible placeholder contains no fabricated reviews or ratings.
- Approved staff biographies and business photographs if desired. Current photographs are illustrative stock, not claimed as MORJUD staff or patients.
- Review the existing draft privacy/terms and operational details before public launch. Existing limitations such as no automated email/SMS confirmation remain documented in `README.md`.

After building, refresh `http://localhost:3000` to load the redesign. If the server is stopped, start it with `npm start`.
