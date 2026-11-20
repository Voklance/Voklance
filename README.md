# Voklance

Voklance is a professional networking and community platform centered on purposeful interactions within communities. Its planned modules include professional profiles, a feed, community discovery, resource sharing, career opportunities, events, and distinct community actions such as `/referral`, `/needreferral`, `/event`, `/meetup`, and `/resource`.

The current implementation is a TypeScript MERN application with email and password accounts: React + Vite frontend, Express API, MongoDB through Mongoose, and a shared TypeScript package. MongoDB is required to sign up or sign in. Phase 01 includes backend APIs, a six-step React onboarding wizard, and route guards driven by the server's current-user response. When email verification is enabled, new unverified accounts enter `/verify-email-required`; verified incomplete accounts enter `/onboarding`; completed accounts enter `/app`. The signed-in dashboard has a chronological text feed, saved posts, community discovery and membership, structured community actions, private direct messaging for accepted professional connections, a persistent in-app notification center, GitHub portfolio management, and unified search. See the [full project overview](docs/project-overview.md), [architecture](docs/architecture.md), and [API conventions](docs/api.md).

## Requirements

- Node.js 22.23.2 (pinned in `.nvmrc`) and npm 10.9.8; Node 22.12+ and npm 10.x are supported
- MongoDB Community Server 7.0.x (local reference version 7.0.14), or a MongoDB replica-set connection string
- MongoDB Shell (`mongosh`) to initialize a new local replica set; MongoDB Compass is optional

## Setup

For a fresh GitHub clone, follow the [colleague setup, MongoDB, and Compass guide](docs/colleague-setup.md). It covers exact versions, local database initialization, catalog data, the first account, and how colleagues can share a database safely.

Once set up, start the API and frontend together with `npm run dev`. Open `http://localhost:5173`; the API health check is `http://localhost:5001/api/v1/health`.

If MongoDB is not configured or available, the API still starts, but account and onboarding routes return a service-unavailable message. The frontend displays login and sign-up forms and reports the error when a form is submitted.

## Accounts

The start page is now the login page. Use **Create an account** to sign up, then sign out and back in with the same email and password. Passwords are stored as salted scrypt hashes. Sessions use random tokens stored as hashes in MongoDB and an HttpOnly, SameSite cookie that expires after seven days. In production, serve the site over HTTPS so the cookie can use its Secure flag.

The auth endpoints also include `POST /api/v1/auth/verify-email` and `POST /api/v1/auth/resend-verification`.

The authenticated onboarding endpoints are `GET /api/v1/onboarding`, `PATCH /api/v1/onboarding`, and `POST /api/v1/onboarding/complete`. Profile, catalog, selection, experience, and education endpoints are documented in [docs/api.md](docs/api.md). Seed skills and interests explicitly before trying to complete onboarding. Use the local replica set in the [setup guide](docs/colleague-setup.md) for transactional actions.

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

Member counts are computed from active membership records. Community images remain deferred. See [docs/api.md](docs/api.md) for endpoints and [docs/architecture.md](docs/architecture.md) for access rules.

## Structured community actions (Milestone 11)

On `/app/communities/:slug`, active members can type `/` to select `/referral`, `/needreferral`, `/event`, `/meetup`, or `/resource`. Selection opens a structured form. The first four commands publish activities; `/resource` publication is blocked pending approved storage and scanning. The board shows command-specific cards with filters and cursor-based loading. Authors and authorized community managers can delete activities without linked event or referral workflows; linked gatherings are cancelled through event controls. Public community activity is readable by signed-in, onboarded users; private activity requires active membership. The input does not submit ordinary chat messages. These slash commands are application actions, not shell commands.

The event and meetup forms now create managed gatherings and linked activities. Referral workflows, event registration, and meetup RSVPs use their own structured APIs. Notifications remain deferred. Use the same command registry and shared schema pattern to add future commands; do not add unrestricted community messaging.

## Professional events and meetups (Milestone 13)

Active community members can create an event or meetup from the `/event` or `/meetup` command on a community page. The form records an IANA time zone and checks for daylight-saving gaps and ambiguous local times. Creation links the event to a community activity. The Events navigation opens `/app/events` for upcoming, participated, organized, and past views; detail pages offer registration, RSVP, and organizer controls. Private community events require membership. Meeting links are visible only to confirmed participants and managers, and attendee directories are limited to organizers and active owner/admin roles. Event creation, editing, registration, and RSVP writes require a MongoDB replica set; configure `MONGODB_URI` to a replica-set URI before using these flows locally. A standalone server returns `503 TRANSACTIONS_REQUIRED` for these writes. Run `npm test` for the ephemeral replica-set integration tests. Paid ticketing, calendar sync, conferencing, notifications, and check-in remain deferred.

## Community resources (Milestone 14 foundation)

The `/resource` command and resource pages are available as a metadata foundation. The community resource page supports search, category and tag filters; My Resources and resource detail pages show safe metadata, status, and permitted actions for existing records. Reporting and moderator review are implemented. **Uploads and publication are blocked** because this repository has no approved private object storage or malware scanner. The form clearly says it does not save a file, and the API returns `503 RESOURCE_STORAGE_UNAVAILABLE` after membership checks. Preview and download are also unavailable. Resource metadata edits, deletion, and moderation decisions require a MongoDB replica set. Before enabling document sharing, approve a private storage provider and scanning/quarantine policy, then implement signature/container checks, secure delivery, and storage cleanup. Feed attachments remain separate and unavailable.

## Professional connections (Milestone 15)

After onboarding, open `/app/network/discover` to find published professionals by name, headline, skill, or location. Use Connect on a card or published profile. `/app/network` shows connections, received and sent requests, counts, search, and privacy settings. Recipients can accept or decline; senders can cancel; either side can remove an accepted connection. New profiles still default to private. Publishing a profile makes it discoverable and requestable unless the owner changes network settings. Connection lists default to private; sharing with connections exposes only published, active profile summaries. Request sends are limited to 10 per user per 15 minutes, and the same pair has a configurable cooldown after decline, cancellation, or removal (`CONNECTION_REREQUEST_COOLDOWN_HOURS`, default 168).

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run format:check` before deployment. The networking tests use an ephemeral MongoDB server. To verify manually, sign in as two completed users with published profiles, find one from the other account, send a request, accept it from the recipient's Received Requests tab, then remove it from either account. Toggle discovery, request, and connection-list settings and confirm the other account's results change. Community memberships remain separate.

## Private professional messaging (Milestone 16)

Accepted connections can open `/app/messages` from the navigation, a published profile, or My Network. The inbox supports live plain-text messages, history, search, unread counts, typing, online presence, optional read receipts, mute, archive, block, and message reporting. Messaging settings are under the inbox Settings control. Existing HttpOnly cookie sessions authenticate Socket.IO on the API server; no extra token or messaging server is needed. In local development, `npm run dev` starts the API and Vite proxy, including `/socket.io` WebSocket upgrades. In production, proxy `/socket.io` to the same backend as `/api/v1` and allow only configured frontend origins. Messaging uses ordinary MongoDB writes and works on a standalone instance; the event and resource transaction requirements above still apply to those features.

For a manual check, use two completed accounts with an accepted connection. Send a message with both inboxes open, confirm immediate delivery and unread badge changes, then reload to confirm persisted history. Check that a third account cannot open the conversation. Remove the connection or block the other user and confirm history, sending, typing, and presence become unavailable. Muting should suppress the short in-app notice while retaining unread counts. Read receipts are off by default and appear only after the reader enables them. Run the repository's lint, typecheck, test, build, and format checks before deployment. Multi-instance Socket.IO deployment needs the shared adapter and presence/rate-limit infrastructure described in [architecture](docs/architecture.md).

## Notification center (Milestone 17)

The top bar now has a live notification bell. Open `/app/notifications` for a private, filterable history and `/app/notifications/settings` to choose optional in-app categories. Read state and unread counts persist in MongoDB. Existing connection, referral, event, meetup, community, feed, and message actions generate controlled notifications; resource publication remains blocked by the Milestone 14 storage gate. The notification outbox retries transient creation failures, and Socket.IO delivers new items to signed-in tabs. Reconnect reloads the server state. For a manual check, use two accounts to send a connection request, open the recipient's bell, mark it read, and reload; then disable Network notifications and send another eligible request. See [API](docs/api.md) and [architecture](docs/architecture.md) for event contracts and the current post-commit enqueue limitation.

## GitHub portfolio (Milestone 18)

Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_OAUTH_CALLBACK_URL` in the backend environment to enable `/app/github`. Register the callback URL as the GitHub OAuth app callback; locally it is `http://localhost:5001/api/v1/github/callback`. The owner starts connection from My Profile or GitHub Portfolio. OAuth verifies the GitHub account with session-bound state and PKCE, then the app revokes the temporary GitHub grant. It stores only the verified GitHub numeric user ID and public profile metadata. Public repository sync uses GitHub's public API, requires no stored GitHub token, and is subject to public API rate limits. The owner can filter repositories, feature up to six, resync after the configured cooldown, and disconnect. Featured public repositories appear on a published Voklance profile. Sync imports at most 500 repositories per run; a partial sync preserves older records because it cannot prove which additional repositories disappeared. Repository counts and stars come from GitHub at the last successful sync. See [API](docs/api.md) and [architecture](docs/architecture.md) for details.

## Unified search (Milestone 19)

Use the top-bar search field or open `/app/search`. The All tab shows bounded previews for people, communities, posts, events, referrals, resources, and imported public GitHub projects. Each category has its own paginated result list and relevant filters. Search suggestions are debounced; recent searches stay in the current browser's local storage and can be cleared. Search enforces active account and publication rules, block relationships, private community membership, and published resource status. It uses MongoDB text indexes and examines at most 250 candidates per category, so very large result sets can be incomplete. Relevance is deterministic title/name exact, prefix, contains, then description; recent sort is also available. Search does not inspect private messages, applications, or file contents. A direct post detail route makes post results navigable. See [API](docs/api.md) and [architecture](docs/architecture.md).

## Personalized feed (Milestone 20)

The home feed has For You, Following, and Recent tabs, with the existing composer and post actions intact. For You ranks up to 250 recent public-author posts using explicit interests, skills, accepted connections, and a time-decay term; Following shows posts from accepted connections, and Recent is chronological. Each post states the reason used. Hide and Not Interested feedback persist for the current user and support undo. The sidebar and `/app/recommendations/:category` show permission-checked people, communities, events, published resources, and open referral opportunities. `/app/settings/feed` lets a member add or remove up to twelve topic preferences, alongside existing onboarding interests and skills. Resource suggestions will remain empty until approved storage enables publication. Candidate windows and offset pagination bound work; very large pools may omit older candidates, and live edits can shift ranked pages. See [API](docs/api.md) and [architecture](docs/architecture.md).

## Account and privacy settings (Milestone 22)

`/app/settings` links account information, security, privacy, notifications, blocked users, feed interests, and data export. Members can change their name; request a verified email change when SMTP is configured; change their password; inspect and revoke sessions; update profile, discovery, connection, and messaging privacy; review blocked members; export bounded personal data; or deactivate and later reactivate their account. Forgot/reset password pages use expiring single-use email links and the existing scrypt password service. Password changes, resets, confirmed email changes, and deactivation invalidate all session versions and sign out every device. Set `SMTP_HOST`, `EMAIL_FROM`, and `APP_PUBLIC_URL` explicitly to enable password recovery and email change outside tests. A failed or missing SMTP configuration never silently replaces the verified account email.

Permanent deletion currently returns `503 ACCOUNT_DELETION_UNAVAILABLE`. The application has shared communities, conversations, posts, and cross-module references but no approved, durable deletion worker and retention policy. The settings page explains this and offers deactivation and support contact instead. No deletion request is falsely accepted. See [API](docs/api.md) and [architecture](docs/architecture.md) for the data inventory and limits.

## Responsive navigation and accessibility (Milestone 23)

At compact widths, the main navigation opens from the top bar and closes on Escape, a route change, or a wider viewport. The skip link moves keyboard focus past navigation, focus indicators are visible, and reduced-motion preferences disable decorative animation. Forms and lists reflow for small screens. Check desktop and phone widths, keyboard navigation, and reduced-motion mode when reviewing visual changes.
The app currently uses its existing light theme; dark mode is a future enhancement.

## Saved items and activity (Milestone 25)

`/app/saved` combines posts, events, published resources, and open referral opportunities in one private list. Members can filter, search, sort, organize items into private collections, and remove a save without deleting its source. Existing post saves migrate to the unified bookmark record on first use. A removed or inaccessible source appears as a generic unavailable item. `/app/activity` derives a private timeline from existing posts, comments, likes, connection requests, community memberships, event registrations, resource publications, and referral activities; removed records are not recreated. See [API](docs/api.md) for routes and limits.

## Profile and portfolio (Milestone 26)

Profile owners can add certifications and portfolio projects, feature up to four projects, arrange profile sections, and see an explicit profile-completeness checklist. Published profiles have shareable `/u/:username` visitor pages. Certificates and project URLs must use HTTPS, and user-supplied credentials or repository links are not independently verified. Private profiles remain inaccessible through the public API. Profile completeness uses documented section weights as a content checklist, never a hiring score. GitHub showcase remains based on the connected account's public repository snapshot.
Published project and certification text can help a discoverable profile appear in people search; project topics can also inform the existing people recommendation reasons.
Earlier profile links continue to resolve after an owner changes their username; previous usernames stay reserved to that owner.
