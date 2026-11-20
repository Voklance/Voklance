# Voklance project overview

_Repository snapshot: 16 November 2026. This document describes implemented code and explicitly separates planned product ideas from working features._

## 1. What Voklance is

Voklance is being built as a professional networking platform with purposeful professional communities at its center. The product vision includes professional profiles, a feed, community discovery, resource sharing, career opportunities, events, and structured community actions. A community action is intended to have its own workflow and permission rules; it is not an unrestricted group chat message.

The current repository contains a working account flow, professional feed, community discovery and membership, and initial structured command activities. It does **not** yet contain working document uploads, publication, downloads, or attendance check-in. Referral fulfillment, event registration, and meetup RSVP are implemented.

> The earlier product brief mentioned Next.js. The application currently in this repository uses **React with Vite**. This document reflects the code that exists now.

## 2. Current implementation at a glance

| Area            | Current state                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------- |
| Accounts        | Email/password sign-up, sign-in, current user lookup, and sign-out backed by MongoDB sessions |
| Public pages    | Login and sign-up pages; the former starter page has been removed                             |
| Onboarding      | Six-step signed-in wizard at `/onboarding`, saved through the backend and resumable           |
| Signed-in pages | Home and Communities empty states, plus own and published professional profiles               |
| App shell       | Responsive top navigation, left navigation, main route content, and right profile sidebar     |
| API             | Express `/api/v1` account, profile, catalog, history, and onboarding endpoints                |
| Persistence     | Existing account models plus Phase 01 profile, catalog, selection, and history models         |
| Shared code     | API contracts plus onboarding and professional data types in `@voklance/shared`               |
| Tests           | Shared, frontend, model, and isolated MongoDB API integration tests                           |

## 3. Technology stack

Versions below are the version ranges declared in the workspace package files; `package-lock.json` records the installed versions.

| Layer                           | Technology                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------- |
| Language and workspaces         | TypeScript `^5.9.2`, npm workspaces                                              |
| Frontend                        | React `^19.1.1`, React DOM `^19.1.1`, Vite `^7.1.4`                              |
| Client routing and server state | React Router `^7.18.5`, TanStack React Query `^5.107.1`                          |
| HTTP client                     | Axios `^1.21.1`                                                                  |
| Backend                         | Node.js, Express `^5.1.0`, `tsx` for development                                 |
| Database                        | MongoDB through Mongoose `^8.18.0`                                               |
| Validation and HTTP security    | Zod `^4.6.7`, Helmet `^8.3.0`, CORS, cookie-parser, express-rate-limit           |
| Tests                           | Vitest `^4.1.12`, Supertest, React Testing Library, jsdom, MongoDB Memory Server |
| Code quality                    | ESLint `^9.39.5`, typescript-eslint `^8.72.2`, Prettier `^3.10.1`                |

The frontend and backend each use TypeScript strict mode. Frontend imports can use the `@/` alias for `frontend/src/`.

## 4. Repository structure

Generated `dist/` directories, `node_modules/`, local `.env` files, Git internals, and the installed Hallmark skill's reference files are omitted from this source tree. Directories marked **reserved** currently contain no implementation files and may not appear in a Git checkout until files are added.

```text
Voklance_V126/
├── .agents/skills/hallmark/           # Installed design skill
├── .github/copilot-instructions.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts                     # Express middleware and route composition
│       ├── server.ts                  # Startup and graceful shutdown
│       ├── common/
│       │   ├── AppError.ts
│       │   ├── apiResponse.ts
│       │   ├── catalogDto.ts
│       │   ├── selectionWrite.ts
│       │   ├── selectionWrite.test.ts
│       │   └── validationSchemas.ts
│       ├── config/env.ts              # Environment validation and CORS origins
│       ├── database/
│       │   ├── connection.ts
│       │   ├── catalogSeeds.ts
│       │   └── seedCatalogs.ts
│       ├── middleware/
│       │   ├── errorHandler.ts
│       │   ├── notFound.ts
│       │   ├── requestLogger.ts
│       │   ├── requireAllowedOrigin.ts
│       │   ├── requireAuth.ts
│       │   ├── requireCompletedOnboarding.ts
│       │   ├── requireDatabase.ts
│       │   ├── validateBody.ts
│       │   ├── validateParams.ts
│       │   └── validateQuery.ts
│       ├── types/express.d.ts
│       └── modules/
│           ├── auth/
│           │   ├── controller/authController.ts
│           │   ├── model/Session.ts
│           │   ├── sessionAuthorization.test.ts
│           │   ├── routes/authRoutes.ts
│           │   ├── service/
│           │   │   ├── authService.ts
│           │   │   └── passwordService.ts
│           │   └── validation/authSchemas.ts
│           ├── health/routes/
│           │   ├── healthRoutes.ts
│           │   └── healthRoutes.test.ts
│           ├── users/model/User.ts     # Also stores onboarding progress
│           ├── profiles/
│           │   ├── controller/
│           │   │   ├── profileController.ts
│           │   │   └── historyController.ts
│           │   ├── model/
│           │   │   ├── Profile.ts
│           │   │   ├── ProfessionalExperience.ts
│           │   │   └── Education.ts
│           │   ├── routes/
│           │   │   ├── profileRoutes.ts
│           │   │   └── historyRoutes.ts
│           │   ├── service/
│           │   │   ├── profileService.ts
│           │   │   └── historyService.ts
│           │   └── validation/
│           │       ├── profileSchemas.ts
│           │       └── historySchemas.ts
│           ├── skills/
│           │   ├── controller/skillController.ts
│           │   ├── model/Skill.ts
│           │   ├── model/UserSkill.ts
│           │   ├── routes/skillRoutes.ts
│           │   ├── service/skillService.ts
│           │   └── validation/skillSchemas.ts
│           ├── interests/
│           │   ├── controller/interestController.ts
│           │   ├── model/Interest.ts
│           │   ├── model/UserInterest.ts
│           │   ├── routes/interestRoutes.ts
│           │   ├── service/interestService.ts
│           │   └── validation/interestSchemas.ts
│           ├── onboarding/
│           │   ├── controller/onboardingController.ts
│           │   ├── routes/onboardingRoutes.ts
│           │   ├── service/onboardingService.ts
│           │   ├── onboardingApi.test.ts
│           │   ├── modelFoundation.test.ts
│           │   └── validation/onboardingSchemas.ts
│           └── commands/, communities/, events/, memberships/,
│               notifications/, posts/, referrals/, resources/
│                                        # Commands, communities, memberships, and posts implemented
├── docs/
│   ├── api.md
│   ├── architecture.md
│   └── project-overview.md
├── frontend/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── public/favicon.svg
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── app/
│       │   ├── layouts/
│       │   │   ├── ApplicationLayout.tsx
│       │   │   └── AuthLayout.tsx
│       │   ├── providers/AppProviders.tsx
│       │   └── router/
│       │       ├── AppRouter.tsx
│       │       └── AppRouter.test.tsx
│       ├── assets/Voklanceimage.png
│       ├── components/
│       │   ├── navigation/
│       │   │   ├── SideNavigation.tsx
│       │   │   └── TopNavigation.tsx
│       │   ├── shared/
│       │   │   ├── ErrorBoundary.tsx
│       │   │   ├── ErrorState.tsx
│       │   │   ├── LoadingState.tsx
│       │   │   └── ProfileSidebar.tsx
│       │   └── ui/                    # Reserved
│       ├── features/
│       │   ├── auth/
│       │   │   ├── api/authApi.ts
│       │   │   ├── cache/authCache.ts
│       │   │   ├── components/
│       │   │   │   ├── AuthForm.tsx
│       │   │   │   └── AuthForm.test.tsx
│       │   │   ├── hooks/useCurrentUser.ts
│       │   │   ├── hooks/useSignOut.ts
│       │   │   └── pages/
│       │   │       ├── LoginPage.tsx
│       │   │       └── SignupPage.tsx
│       │   ├── communities/
│       │   │   └── pages/CommunityDiscoveryPage.tsx
│       │   ├── community-commands/
│       │   │   ├── api/commandApi.ts
│       │   │   ├── components/             # Picker, form, board, cards, UI tests
│       │   │   └── hooks/useCommunityCommands.ts
│       │   ├── feed/pages/HomePage.tsx
│       │   ├── onboarding/
│       │   │   ├── api/onboardingApi.ts
│       │   │   ├── components/             # Wizard, progress, profile, catalog, history controls
│       │   │   ├── hooks/                  # Query and mutation hooks
│       │   │   ├── pages/OnboardingPage.tsx
│       │   │   ├── pages/OnboardingPage.test.tsx
│       │   │   └── validation/onboardingSchemas.ts
│       │   └── events/, notifications/, referrals/, resources/
│       │                                # Reserved features
│       ├── hooks/                     # Reserved
│       ├── lib/
│       │   ├── apiClient.ts
│       │   ├── apiClient.test.ts
│       │   └── queryClient.ts
│       ├── styles/index.css
│       └── types/vite-env.d.ts
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       └── index.test.ts
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── eslint.config.mjs
├── package.json
├── package-lock.json
└── README.md
```

There is no `frontend/src/Dashboard.tsx` now. Its former responsibilities are split between `ApplicationLayout.tsx`, reusable navigation/sidebar components, and route pages.

### Directory responsibilities

- `frontend/src/app`: app-wide providers, route definitions, and layouts.
- `frontend/src/features`: product features. An active feature can own its pages, components, hooks, API calls, types, schemas, and tests.
- `frontend/src/components`: reusable UI, navigation, and shared states.
- `frontend/src/lib`: shared frontend infrastructure such as the Axios and React Query clients.
- `backend/src/modules`: backend features. Routes connect middleware, controllers handle HTTP, services contain business logic, models handle persistence, and validation schemas check input.
- `backend/src/common`, `config`, `middleware`, `database`: cross-module backend concerns.
- `shared`: browser-safe contracts used by both applications. Backend-only packages are not imported here.

## 5. Frontend behavior and design

The root URL resolves access through `/auth/me`. Guests go to `/login`; new unverified accounts go to `/verify-email-required`; eligible users with unfinished onboarding go to `/onboarding`; completed users go to `/app`. Public auth pages redirect signed-in users by verification and onboarding status. `/account` remains a legacy redirect for completed users and sends incomplete users to onboarding.

| Route                             | Access               | Current content                                        |
| --------------------------------- | -------------------- | ------------------------------------------------------ |
| `/login`                          | Public               | Email/password sign-in form                            |
| `/signup`                         | Public               | Name/email/password sign-up form                       |
| `/onboarding`                     | Signed in            | Six-step professional profile wizard                   |
| `/app`                            | Completed onboarding | Chronological professional text feed and post composer |
| `/app/saved`                      | Completed onboarding | Private bookmarked posts                               |
| `/app/communities`                | Completed onboarding | Community discovery, search, and filters               |
| `/app/communities/create`         | Completed onboarding | Community creation                                     |
| `/app/communities/:slug`          | Completed onboarding | Community summary or member detail                     |
| `/app/communities/:slug/members`  | Active member        | Member directory and permitted role management         |
| `/app/communities/:slug/requests` | Authorized manager   | Pending membership request review                      |
| `/app/communities/:slug/settings` | Authorized manager   | Details, visibility, transfer, and archive controls    |
| `/app/profile`                    | Completed onboarding | Own professional profile                               |
| `/app/profile/edit`               | Completed onboarding | Profile, links, skills, and history editing            |
| `/app/professionals/:username`    | Completed onboarding | Published professional profile                         |
| `/account`                        | Redirect             | Completed users reach the appropriate `/app` page      |

The signed-in shell uses a top bar, left navigation, main content area, and right sidebar. Home, Communities, and Profile are working navigation destinations. Opportunities, global search, and notifications remain unavailable placeholders. Events is a working route. Saved posts is a working route. The right sidebar shows saved profile information and joined communities from the API. The layout adapts from three columns on desktop to a compact layout on narrower screens.

The visual system has a Voklance wordmark, an account page design, CSS color and spacing tokens, and a responsive dashboard. A dark token set exists under `[data-theme="dark"]`; no theme toggle is implemented. The starter page was removed in favor of the login page. Loading, retryable error, and global error boundary components are available.

React Query holds the current-user, onboarding, profile, catalog, selection, and history caches. `authApi.ts` contains account API calls; `onboardingApi.ts` calls the existing professional-data and progress endpoints. `apiClient.ts` centralizes the Axios base URL, credentialed requests, timeout, and protected-request 401 handling. Login and signup confirm the session with `/auth/me`, then route by onboarding status. Logout and session expiry clear private caches. The six-step wizard saves required sections before advancing, supports separate experience and education CRUD, restores the backend's saved step, and completes only after the completion response and a fresh `/auth/me` agree. The browser keeps the session in an HttpOnly cookie; application code does not store authentication secrets or profile drafts in localStorage.

## 6. Backend and API

The Express app installs Helmet, CORS, a 32 KB JSON body limit, cookie parsing, and request logging before versioned routes. It has global error handling and an unknown-route response. The server connects to MongoDB when configured and handles `SIGINT` and `SIGTERM` shutdown.

The API base path is `/api/v1`. Existing `/api/health` and `/api/auth/*` routes remain temporary compatibility aliases. Milestone 3 adds protected self-service profile, skill, interest, experience, education, and onboarding endpoints. See [api.md](api.md) for every method, request, response, and error code.

| Method | Path                  | Purpose                                                  | Typical success |
| ------ | --------------------- | -------------------------------------------------------- | --------------- |
| `GET`  | `/api/v1/health`      | Report service, database connection state, and timestamp | `200`           |
| `POST` | `/api/v1/auth/signup` | Create a user and session                                | `201`           |
| `POST` | `/api/v1/auth/login`  | Verify credentials and create a session                  | `200`           |
| `GET`  | `/api/v1/auth/me`     | Read the signed-in user                                  | `200`           |
| `POST` | `/api/v1/auth/logout` | Revoke the session and clear its cookie                  | `200`           |

Success and failure bodies use the contracts in `shared/src/index.ts`:

```json
{ "success": true, "data": {}, "message": "Operation successful" }
```

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid request" } }
```

Zod validates sign-up, login, and the new onboarding inputs. Protected routes reuse the existing session service, derive ownership from the cookie, and require an available database. Sign-up and login have a rate limit of 20 attempts per 15 minutes per limiter key. Known errors return stable codes and appropriate HTTP statuses; unexpected errors return a generic message.

## 7. Accounts and persistence

The existing authentication models remain in place:

- `User`: name, unique normalized email, salted scrypt password hash, and timestamps. The password hash is excluded from normal queries. Phase 01 adds optional email verification and account/onboarding state fields. Suspended and deactivated accounts now receive a safe 403 on protected routes.
- `Session`: user reference, unique SHA-256 token hash, and expiry date. A TTL index removes expired session records.

Sign-up creates a user and a session. Login verifies a password and creates a new session. The browser receives a seven-day `voklance_session` cookie with `HttpOnly` and `SameSite=Lax`; `Secure` is enabled in production mode. Logout deletes the stored token hash and clears the cookie. The server checks the stored session and user on `/auth/me`.

Phase 01 Milestone 2 defined additional Mongoose models. Milestone 3 exposes them through authenticated backend APIs, and Milestone 4 uses those APIs in the React onboarding wizard:

| Model                                 | Purpose and main indexes                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Profile`                             | Professional name, normalized username, headline, location, bio, optional avatar URL and status; unique `userId` and username |
| `Skill`, `Interest`                   | Curated catalogs with unique slugs                                                                                            |
| `UserSkill`, `UserInterest`           | Per-user selections with unique user/catalog pairs                                                                            |
| `ProfessionalExperience`, `Education` | Multiple dated records per user, indexed by user and start date                                                               |

`User` stores `onboardingStatus`, `onboardingStep`, and `onboardingCompletedAt`; there is no second progress document to keep synchronized. New users receive `ACTIVE`, `NOT_STARTED`, and step `1` defaults. Legacy users may lack these fields and still sign in; missing account and onboarding statuses are read as `ACTIVE` and `NOT_STARTED` without changing stored records. No existing user is marked email-verified, and no development-database user backfill has been run. The application-wide route gate uses the current-user response, while backend ownership checks and active-account checks enforce API access. `requireCompletedOnboarding` exists for future approved application endpoints but is not mounted on onboarding-related APIs.

The skill and interest seed data is explicit and idempotent. Run `npm run seed:catalogs -w backend` only when you want to insert missing catalog entries into the configured database; startup does not seed automatically. Avatar storage is not configured, so the optional `avatarUrl` model field does not imply that uploads work.

`Community` and `CommunityMembership` collections store professional communities, membership status, and roles. Unique slug, membership pair, and active-owner indexes protect their invariants. `CommunityActivity` stores validated, versioned command payloads with community/status/time, community/status/type/time, and author/time indexes. The command registry is code, not a MongoDB collection. Referral fulfillment and event registration are implemented. Resource metadata, read APIs, and moderation are implemented as a foundation; uploads and publication remain blocked. Notifications are unimplemented.

## 8. Configuration and local setup

Requirements: Node.js 20.19+ or 22.12+, npm, and MongoDB for account operations.

1. Run `npm install` from the repository root.
2. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` for your MongoDB instance.
3. Optionally copy `frontend/.env.example` to `frontend/.env` to override the API base URL.
4. Run `npm run dev` and open the Vite URL printed in the terminal, normally `http://localhost:5173`.

The example backend configuration uses port `5001`, `CLIENT_URLS=http://localhost:5173`, and a local MongoDB URL. The frontend defaults to `/api/v1`; Vite proxies `/api` requests to the local backend on port `5001`. In production, configure `MONGODB_URI`, the allowed frontend origin(s), HTTPS, and the deployment host's routing so frontend and API requests reach their respective services. Do not commit local `.env` files.

If MongoDB is absent or disconnected, the health endpoint still responds and account routes return a `503` error.

## 9. Root scripts and checks

| Command                            | What it does                                                            |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                      | Builds shared contracts, then runs backend and Vite development servers |
| `npm run build`                    | Builds shared, backend, and frontend workspaces                         |
| `npm start`                        | Starts the built backend with `NODE_ENV=production`                     |
| `npm run lint`                     | Runs ESLint across the workspaces                                       |
| `npm run typecheck`                | Runs strict TypeScript checks                                           |
| `npm test`                         | Runs shared, backend, and frontend Vitest suites                        |
| `npm run format`                   | Applies Prettier formatting                                             |
| `npm run format:check`             | Checks Prettier formatting without changing files                       |
| `npm run seed:catalogs -w backend` | Explicitly inserts missing skill and interest catalog entries           |

Current automated tests cover shared contracts, health and auth compatibility, frontend rendering, model validation, all new API modules, user isolation, step persistence, completion, and both standalone and replica-set selection writes. Backend integration tests use ephemeral MongoDB Memory Server instances and do not alter the development database.

## 10. Planned work and open product decisions

- Profile picture upload is unavailable until a secure upload endpoint is approved.
- Published professional profiles can be found through authenticated professional discovery with name, headline, skill, and location filters.
- Email verification is implemented for new accounts. Production SMTP delivery and a legacy-account enforcement rollout remain open; password recovery is not implemented.
- The chronological text feed is implemented; ranking, public discovery, attachments, and moderation are not implemented.
- Community creation, discovery, membership, roles, settings, and ownership transfer are implemented. Transfer requires a MongoDB replica set.
- `/referral`, `/needreferral`, `/event`, and `/meetup` publish structured community activities. Referral responses, event registration, and meetup RSVP are implemented; attendance check-in remains future work.
- Resource types, size policy, membership checks, and download permissions are defined. Approved private storage, scanning, and actual uploads/downloads remain blocked.
- Global search, notifications, and opportunities remain placeholders. Community search, saved posts, and events are working routes.
- A dark theme toggle is not implemented, although dark CSS tokens are prepared.

These gaps are intentional: the product context describes direction, not complete behavior specifications. Future community actions should use backend-enforced permissions and distinct workflows, while ordinary feed posts remain a separate concept.

## 11. Related documents

- [README.md](../README.md): quick start and commands.
- [architecture.md](architecture.md): architectural boundaries and conventions.
- [api.md](api.md): current endpoints and API response rules.

## 12. Milestone 6 email verification

When `EMAIL_VERIFICATION_ENABLED=true`, new registrations have `emailVerificationRequired: true` and an unverified email timestamp. The switch currently defaults to `false`; new registrations then skip token generation and email delivery and continue directly to onboarding. Signup preserves the MongoDB session and reports whether an SMTP provider accepted the verification email. The frontend routes these accounts to `/verify-email-required`; `/verify-email` processes a one-time 24-hour token, then sends an authenticated user to onboarding. A different browser can verify without gaining a session. `/auth/me` returns verification state. Onboarding and professional-data APIs enforce verification for new accounts only while the switch is enabled. Existing accounts lack the opt-in marker and keep their prior access without being marked verified. Production SMTP configuration and the legacy enforcement policy remain open. See [architecture.md](architecture.md) and [api.md](api.md).

## 13. Milestone 8 professional profiles

The signed-in shell now includes Profile navigation. `/app/profile` displays the member's saved professional identity, about section, skills, interests, experience, education, and approved links. `/app/profile/edit` edits basic fields, HTTPS GitHub/portfolio/website links, visibility, skills, and history through the existing owned APIs. `/app/professionals/:username` displays published profiles using the public API. Existing profiles are private until their owner opts in; incomplete or suspended accounts are excluded from public responses. No existing profile documents were changed. Profile image upload remains unavailable because secure storage has not been approved or configured.

## 14. Milestone 9 professional feed

The Home route now loads persisted professional text posts. Members with completed onboarding can create, edit, and soft-delete their own posts, like/unlike, write and manage flat comments, and bookmark posts privately at `/app/saved`. Feed and comment lists use cursor-based load-more paging. Posts show allowlisted author details and link to published public profiles when available. Community slash commands use separate models and APIs. File attachments await an approved object-storage provider and related validation/security controls.

## 15. Milestone 10 professional communities

The Communities route now loads real MongoDB-backed discovery results with search, category, visibility, and cursor pagination. Completed members can create public or private communities. Public joins become active immediately; private joins create pending requests. Active members can view a directory, and authorized owner, admin, or moderator roles can review requests. Owners and admins manage permitted details and roles; only the owner can change visibility, transfer ownership, or archive. The sidebar lists joined communities. Private summaries hide member-only details from nonmembers. No community chat, images, or notifications were added in Milestone 10.

## 16. Milestone 11 structured community activities

Milestone 11 introduced the command picker, four validated forms, filters, and paginated activity cards. At that milestone, the event and meetup commands created informational announcements only. Milestone 13 links them to managed gatherings with registration and RSVP. Private activity is visible only to active members. Public activity is readable to authenticated users who completed onboarding. The API derives author identity from the session and enforces the command allowlist and active membership. The slash picker has no arbitrary message submission path. These commands are application actions, not shell commands.

## 18. Milestone 13 professional events and meetups

Active community members create events and meetups through the existing `/event` and `/meetup` command forms. Each command creates a linked activity and managed event record. `/app/events` provides discovery and personal views; event details support registration or RSVP, and organizers can edit, cancel, and inspect a privacy restricted attendee directory. Community detail shows upcoming gatherings and links its event activity cards to details. Capacity is enforced through transactional counters. Online meeting links are limited to confirmed participants and managers. Event writes require a MongoDB replica set; standalone MongoDB returns a clear 503 rather than attempting an unsafe multi-document write. See [api.md](api.md) and [architecture.md](architecture.md) for the routes, indexes, time-zone handling, and access policy.

## 19. Milestone 14 community resource foundation

`/resource` appears in the structured community action picker. Its form collects metadata and validates a locally selected document's declared MIME, extension, and size, but does not upload or publish it. The repository has no approved private object storage or malware scanner, so the backend refuses upload and publication with `503 RESOURCE_STORAGE_UNAVAILABLE`. The new resource models, shared contracts, safe metadata discovery/detail APIs, report and moderation APIs, and `/app/resources`, `/app/resources/:resourceId`, and `/app/communities/:slug/resources` pages are implemented. Tests seed metadata in an ephemeral MongoDB replica set to verify access rules, filters, editing, reporting, moderation, and API denial without touching production storage. Document content, secure downloads, inline PDF preview, and Office conversion remain blocked until a storage provider and security policy are approved. See [api.md](api.md) and [architecture.md](architecture.md).

## 20. Milestone 15 professional networking

`/app/network` shows accepted connections, received and sent requests, counts, search, and network privacy settings. `/app/network/discover` finds published, discoverable professionals by name, headline, skill, or location. Published professional profiles include connection controls and show counts and lists only when the profile owner's setting permits them. Requests can be accepted, declined, cancelled, and accepted relationships removed. One canonical pair record prevents reciprocal duplicates. Professional connections remain independent of community memberships and grant no community access. Private messaging, notifications, recommendations, contact import, and general community chat remain outside this milestone.

## 21. Milestone 16 private professional messaging

Accepted professional connections can create one private conversation per pair and exchange persistent plain-text messages at `/app/messages`. The app now has an authenticated Socket.IO connection on the existing API server for delivery, acknowledgements, typing, presence, read updates, unread counts, and short in-app message notices. REST supplies conversation creation and search, history, settings, block controls, and reporting. MongoDB indexes enforce pair uniqueness, sender UUID idempotency, message history order, and per-person state. The current session cookie authenticates sockets, and each operation rechecks connection and block permissions. Blocking or removing a connection revokes access. Read receipts are opt-in; presence is visible only to eligible connections and can be hidden. Muting suppresses message notices while preserving delivery and unread counts. Published profiles and My Network provide a Message action for connected people. The community slash-command board remains a separate structured workflow. See [api.md](api.md) and [architecture.md](architecture.md) for the event contract, access checks, and deployment limits.

## 22. Milestone 17 notification center

The top bar bell, `/app/notifications`, and `/app/notifications/settings` use persisted per-user notifications with cursor pages, category and unread filters, read controls, and preferences. Authenticated Socket.IO user rooms publish new notifications and unread counts; reconnect reconciles through REST. Controlled templates and structured internal targets avoid arbitrary HTML and redirects. Existing connection, referral, event/meetup, private community, post, and message services now enqueue notification events; the outbox retries transient processing failures. Resource publication is still storage-gated, so no resource publication notification fires. See [api.md](api.md) and [architecture.md](architecture.md) for endpoint and atomicity details.

## 23. Milestone 18 GitHub portfolio

`/app/github` lets the owner connect a GitHub identity through session-bound OAuth, sync public repositories, select featured projects, and disconnect. The callback revokes its temporary authorization; the app stores no GitHub token. GitHub's public API supplies repository metadata. Published profiles show only available featured repositories. Configure the backend OAuth environment values to enable connection. Public API rate limits and the 500-repository per-run cap bound sync. See [api.md](api.md) and [architecture.md](architecture.md).

## 24. Milestone 19 unified search

The top navigation now offers debounced, permission-aware suggestions. `/app/search` has an All preview and category pages for people, communities, posts, events, referrals, published resources, and imported public GitHub projects. Category filters, recent sorting, paginated results, local recent search history, and direct post navigation are available. MongoDB text indexes and a 250-candidate window bound each category query; matches beyond that window may be absent. Private community content requires active membership and blocked or inactive people are excluded. See [api.md](api.md) and [architecture.md](architecture.md).

## 25. Milestone 20 personalized discovery

Home now offers For You, Following, and Recent post feeds while preserving the composer and post interactions. Rule-based ranking uses explicit professional interests, skills, accepted connections, and post age, then applies privacy, block, feedback, and author-diversity checks. Members can hide posts, mark them uninteresting, dismiss suggestions, and edit topic preferences at `/app/settings/feed`. A sidebar and category pages recommend public professionals, communities, events, published resources, and open referral opportunities with reasons. Candidate windows are bounded and ranking is deterministic; no machine learning or sensitive profile inference is used. See [api.md](api.md) and [architecture.md](architecture.md).

## 26. Milestone 22 settings, security, and privacy

`/app/settings` now groups account, password and sessions, privacy, blocked users, notification preferences, feed interests, and personal data export. Forgot/reset password, signed-in email change, and password-based reactivation use the existing account and session system. Session version increments immediately invalidate old cookies after sensitive changes. A bounded, password-protected JSON export contains the member's own data without password or token material. Permanent deletion is gated with a clear 503 and UI explanation until a durable cross-module cleanup and retention policy exists; deactivation is available. See [api.md](api.md) and [architecture.md](architecture.md).
