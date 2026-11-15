# Voklance

Voklance is a professional networking and community platform centered on purposeful interactions within communities. Its planned modules include professional profiles, a feed, community discovery, resource sharing, career opportunities, events, and distinct community actions such as `/referral`, `/needreferral`, `/event`, and `/meetup`.

The current implementation is a TypeScript MERN application with email and password accounts: React + Vite frontend, Express API, MongoDB through Mongoose, and a shared TypeScript package. MongoDB is required to sign up or sign in. Phase 01 includes backend APIs, a six-step React onboarding wizard, and route guards driven by the server's current-user response. When email verification is enabled, new unverified accounts enter `/verify-email-required`; verified incomplete accounts enter `/onboarding`; completed accounts enter `/app`. The signed-in dashboard has a chronological text feed, saved posts, community discovery and membership, and structured community actions. Global search and notifications are not implemented. See the [full project overview](docs/project-overview.md), [architecture](docs/architecture.md), and [API conventions](docs/api.md).

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- MongoDB Community Server locally, or a MongoDB connection string

## Setup

1. Install the project dependencies from the repository root with `npm install`.
2. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI`. Copy `frontend/.env.example` to `frontend/.env` if you want to override its API base URL.
3. Run both the API and frontend with `npm run dev`.
4. Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The API is available at `http://localhost:5001/api/v1`; its health check is `/api/v1/health`.

If MongoDB is not configured or available, the API still starts, but account and onboarding routes return a service-unavailable message. The frontend displays login and sign-up forms and reports the error when a form is submitted.

## Accounts

The start page is now the login page. Use **Create an account** to sign up, then sign out and back in with the same email and password. Passwords are stored as salted scrypt hashes. Sessions use random tokens stored as hashes in MongoDB and an HttpOnly, SameSite cookie that expires after seven days. In production, serve the site over HTTPS so the cookie can use its Secure flag.

The auth endpoints also include `POST /api/v1/auth/verify-email` and `POST /api/v1/auth/resend-verification`.

The authenticated onboarding endpoints are `GET /api/v1/onboarding`, `PATCH /api/v1/onboarding`, and `POST /api/v1/onboarding/complete`. Profile, catalog, selection, experience, and education endpoints are documented in [docs/api.md](docs/api.md). Seed skills and interests explicitly before trying to complete onboarding. The current local standalone MongoDB supports retryable selection updates; use a replica set when atomic replacements are required.

After sign-up or sign-in, the app checks `/auth/me` and opens `/verify-email-required` for a new unverified account, `/onboarding` for an eligible incomplete account, or `/app` for a completed account. The wizard loads saved progress, saves each required section before continuing, and resumes at the last saved step after a refresh. Experience and education entries have their own Add/Save controls; save those entries before continuing. The review screen confirms completion through the backend and then opens `/app`. Photo upload is labeled unavailable until an approved upload API exists. Missing onboarding fields on legacy accounts are read as `NOT_STARTED`; no existing records were changed or backfilled.

## Useful scripts

- `npm run dev` — start the API and Vite development server together.
- `npm run build` — build the shared package, backend, and frontend.
- `npm start` — start the API in production mode.
- `npm run lint` — run ESLint.
- `npm run typecheck` — check all TypeScript workspaces.
- `npm test` — run shared, API, and frontend smoke tests.
- `npm run seed:catalogs -w backend` — explicitly insert missing skill and interest catalog entries; repeated runs do not duplicate them. This does not run during startup.
- `npm run format` / `npm run format:check` — write or check Prettier formatting.

## Project layout

- `frontend/` — feature-based React application, React Router, TanStack Query, and Vite configuration.
- `backend/` — modular Express API, account and onboarding routes, models, and MongoDB connection management.
- `shared/` — browser-safe API response, profile, catalog, history, and onboarding contracts.
- `backend/.env.example` — local environment variable template.

Add API routes inside the relevant `backend/src/modules` feature and build UI features under `frontend/src/features`. Never commit `backend/.env` or other secrets.

## Email verification (Milestone 6)

With `EMAIL_VERIFICATION_ENABLED=true`, new signups receive an unverified account and the existing session cookie. The API attempts to send a 24-hour verification link and reports `verificationEmailSent` in the signup response. If SMTP is unavailable, the account stays unverified and can request another link later. The browser sends new accounts to `/verify-email-required`; `/verify-email` consumes the fragment token and continues to onboarding when the session is present. Verification from another browser succeeds without creating a session and offers sign-in.

For local testing, start an SMTP mail capture service on `127.0.0.1:1025`, copy `backend/.env.example`, and set `APP_PUBLIC_URL` to your frontend origin. The backend uses Nodemailer SMTP. Production email delivery requires a real SMTP host, sender address, and credentials where required; none are included in the repository. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `APP_PUBLIC_URL`, and resend limits are validated by `backend/src/config/env.ts`.

When enabled, new unverified accounts receive `403 EMAIL_VERIFICATION_REQUIRED` on onboarding and professional-data APIs. Existing accounts are neither marked verified nor newly blocked; their rollout policy still needs approval. See [docs/api.md](docs/api.md) and [docs/architecture.md](docs/architecture.md) for the token lifecycle and limits.

## Professional profiles (Milestone 8)

Completed users can view `/app/profile`, edit at `/app/profile/edit`, and open another member's published profile at `/app/professionals/:username`. Profile editing reuses the existing skills, experience, and education APIs. The owner can set a headline, bio, location, status, three HTTPS professional links, and profile visibility. Existing profiles remain private until their owner selects **Public**. The right sidebar and Profile navigation use saved profile data. Profile image upload remains unavailable until an approved secure storage service exists; initials appear as the fallback.

The public API is `GET /api/v1/profiles/:username`. It returns only published profiles for active users with completed onboarding. It excludes email, account status, onboarding internals, and session data. See [docs/api.md](docs/api.md) for the response shape and [docs/architecture.md](docs/architecture.md) for the privacy boundary.

## Professional feed (Milestone 9)

After onboarding, `/app` shows a chronological text feed. Members can publish, edit, and delete their own posts; like, comment on, and save available posts; and open `/app/saved` for private bookmarks. Posts and comments render as plain text. Load-more buttons use stable cursors. Authors link to published professional profiles when available. The feed and community actions use separate models and APIs.

Image, PDF, and presentation attachments remain unavailable because no approved object-storage integration exists. The composer does not expose a working upload control. Configure and approve storage, signature validation, malware and access controls before attachment support is added. Run `npm test` for isolated feed API and UI tests.

## Professional communities (Milestone 10)

Completed users can discover, search, filter, create, join, and manage professional communities at `/app/communities`. Public communities allow immediate joining; private communities require a membership request and approval. Active members can view the member directory. Owners and authorized managers can review requests, edit details, manage permitted roles, and remove members. Ownership transfer uses a MongoDB transaction and requires a replica set. Archived communities remain readable to members but reject joins and management writes. The right sidebar shows up to five joined communities from the API.

The local standalone MongoDB supports community creation through a hidden staging state and cleanup on write failure. Use a replica set to exercise ownership transfer locally. Member counts are computed from active membership records. Community images and notifications remain deferred. See [docs/api.md](docs/api.md) for endpoints and [docs/architecture.md](docs/architecture.md) for access rules.

## Structured community actions (Milestone 11)

On `/app/communities/:slug`, active members can type `/` to select `/referral`, `/needreferral`, `/event`, or `/meetup`. Selecting one opens a validated form and publishes a structured activity. The board shows command-specific cards with filters and cursor-based loading. Authors and authorized community managers can delete activities. Public community activity is readable by signed-in, onboarded users; private activity requires active membership. The input does not submit ordinary chat messages. These slash commands are application actions, not shell commands.

The initial forms create announcements only. Referral fulfillment, job applications, event registration, meetup attendance, and notifications are deferred. Use the same command registry and shared schema pattern to add future commands; do not add unrestricted community messaging.
