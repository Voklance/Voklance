# API conventions and endpoints

The API base path is `/api/v1`. Successes use `{ "success": true, "data": ..., "message": "..." }`; failures use `{ "success": false, "error": { "code": "...", "message": "..." } }`. Professional-data and onboarding routes require the existing `voklance_session` cookie, an available database, and Zod-validated input. They read and change only the signed-in user's data. The server never accepts `userId` from a self-service request. Email verification is public; resend requires a session.

## Existing routes

| Method | Path                  | Purpose                         |
| ------ | --------------------- | ------------------------------- |
| `GET`  | `/api/v1/health`      | Service and database status     |
| `POST` | `/api/v1/auth/signup` | Create account and session      |
| `POST` | `/api/v1/auth/login`  | Authenticate and create session |
| `GET`  | `/api/v1/auth/me`     | Current account                 |
| `POST` | `/api/v1/auth/logout` | Revoke session                  |

The temporary `/api/health` and `/api/auth/*` aliases remain. Sign-up and login still create the same MongoDB-backed sessions and HttpOnly cookie. Their `data.user` response, and `GET /api/v1/auth/me`, now include `accountStatus` and `onboardingStatus` alongside `id`, `name`, and `email`. The server uses `ACTIVE` and `NOT_STARTED` when older records lack those fields; it does not write a migration. Password and session hashes are never returned.

`GET /auth/me` returns `401 UNAUTHENTICATED` or `401 SESSION_EXPIRED` when the cookie is absent or invalid. Suspended and deactivated accounts receive `403 ACCOUNT_SUSPENDED` or `403 ACCOUNT_DEACTIVATED` on current-user lookup and protected APIs. An unexpected non-active status returns `403 ACCOUNT_UNAVAILABLE`. A correct password for such an account does not create a new session. `POST /auth/logout` remains available to clear an existing cookie. When `EMAIL_VERIFICATION_ENABLED=true`, new accounts must verify their email before accessing onboarding and professional-data APIs.

## Profile

| Method and path                                    | Request example and validation                                                                                                        | Success `data` example                                                                                                                          | Endpoint errors                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /api/v1/profiles/me`                          | No body                                                                                                                               | `{ "profile": null }` or `{ "profile": { "id": "...", "username": "ada", "fullName": "Ada Dev", "headline": "Engineer", "country": "India" } }` | `401 UNAUTHENTICATED`                                                                          |
| `PATCH /api/v1/profiles/me`                        | `{ "username": "ada", "fullName": "Ada Dev", "headline": "Engineer", "country": "India" }`; later updates may use any nonempty subset | `{ "profile": { "id": "...", "username": "ada", "fullName": "Ada Dev", "headline": "Engineer", "country": "India" } }`                          | `400 VALIDATION_ERROR`, `400 PROFILE_INCOMPLETE`, `409 USERNAME_TAKEN`, `409 PROFILE_CONFLICT` |
| `GET /api/v1/profiles/check-username?username=ada` | Username starts with a letter and uses 3–30 lowercase-normalized letters, digits, `.`, `_`, or `-`                                    | `{ "username": "ada", "available": true }`                                                                                                      | `400 VALIDATION_ERROR`                                                                         |

The first profile save needs `username`, `fullName`, `headline`, and `country` because the existing model requires them. Other editable fields are `bio`, `city`, `visibility` (`PRIVATE` or `PUBLIC`), HTTPS `githubUrl`, `portfolioUrl`, `websiteUrl`, and `professionalStatus` (`STUDENT`, `WORKING_PROFESSIONAL`, `FREELANCER`, `FOUNDER`, `RECRUITER`, `EDUCATOR`, or `OTHER`). `avatarUrl` cannot be written through this API until an approved upload integration exists. Availability checks are informational; the unique username index decides whether a save succeeds. A user's own username is reported as available. DTOs omit account and ownership fields.

## Skills and interests

Catalog queries accept optional `search`, `category`, `page` (1–1000), and `limit` (1–50, default 20). Search is escaped before a case-insensitive name match. Results are sorted by name and ID. Selection bodies accept at most 30 distinct valid ObjectIds, all of which must exist.

| Method and path                  | Request example and validation                    | Success `data` example                                                                                                               | Endpoint errors                                                                |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `GET /api/v1/skills`             | `?search=react&limit=20`                          | `{ "items": [{ "id": "...", "name": "React.js", "slug": "react-js", "category": "Frontend" }], "page": 1, "limit": 20, "total": 1 }` | `400 VALIDATION_ERROR`                                                         |
| `GET /api/v1/users/me/skills`    | No body                                           | `{ "skills": [{ "id": "...", "name": "React.js", "slug": "react-js", "category": "Frontend" }] }`                                    | `401 UNAUTHENTICATED`                                                          |
| `PUT /api/v1/users/me/skills`    | `{ "skillIds": ["507f1f77bcf86cd799439011"] }`    | `{ "skills": [{ "id": "...", "name": "React.js", "slug": "react-js", "category": "Frontend" }] }`                                    | `400 VALIDATION_ERROR`, `400 UNKNOWN_SKILL`, `409 ONBOARDING_REQUIRED_DATA`    |
| `GET /api/v1/interests`          | `?category=Technology&page=1`                     | `{ "items": [], "page": 1, "limit": 20, "total": 0 }`                                                                                | `400 VALIDATION_ERROR`                                                         |
| `GET /api/v1/users/me/interests` | No body                                           | `{ "interests": [] }`                                                                                                                | `401 UNAUTHENTICATED`                                                          |
| `PUT /api/v1/users/me/interests` | `{ "interestIds": ["507f1f77bcf86cd799439011"] }` | `{ "interests": [{ "id": "...", "name": "Cloud Computing", "slug": "cloud-computing", "category": "Technology" }] }`                 | `400 VALIDATION_ERROR`, `400 UNKNOWN_INTEREST`, `409 ONBOARDING_REQUIRED_DATA` |

Repeated identical `PUT` requests are idempotent. An empty set is allowed before completion; a completed user cannot remove their last skill or interest. On a replica set, replacement runs in a transaction. On standalone MongoDB, desired links are inserted before obsolete links are removed. If a write fails, the old set is preserved but extra links may remain until the same request is retried. Deploy a replica set when atomic replacement is required.

## Professional experience and education

All updates and deletes filter by both record ID and authenticated user ID. A record owned by someone else returns the same `404` as a missing record. Route IDs must be 24-character hexadecimal ObjectIds. Dates use `YYYY-MM-DD`; an end date cannot precede a start date, and current employment cannot have an end date. Each user may create up to 50 records of each kind. Milestone 2 defined `employmentType` as a bounded string, not an enum.

| Method and path                           | Request example and validation                                                                                           | Success `data` example                                                                                                                                                         | Endpoint errors                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `GET /api/v1/users/me/experiences`        | No body                                                                                                                  | `{ "experiences": [] }`                                                                                                                                                        | `401 UNAUTHENTICATED`                              |
| `POST /api/v1/users/me/experiences`       | `{ "jobTitle": "Engineer", "companyName": "Example Co", "startDate": "2024-04-01", "endDate": null, "isCurrent": true }` | `{ "experience": { "id": "...", "jobTitle": "Engineer", "companyName": "Example Co", "startDate": "2024-04-01", "isCurrent": true } }`; HTTP 201                               | `400 VALIDATION_ERROR`, `409 HISTORY_LIMIT`        |
| `PATCH /api/v1/users/me/experiences/:id`  | `{ "description": "Building applications" }`; nonempty partial object                                                    | `{ "experience": { "id": "...", "jobTitle": "Engineer", "companyName": "Example Co", "startDate": "2024-04-01", "isCurrent": true, "description": "Building applications" } }` | `400 VALIDATION_ERROR`, `404 EXPERIENCE_NOT_FOUND` |
| `DELETE /api/v1/users/me/experiences/:id` | No body                                                                                                                  | `{}`                                                                                                                                                                           | `400 VALIDATION_ERROR`, `404 EXPERIENCE_NOT_FOUND` |
| `GET /api/v1/users/me/educations`         | No body                                                                                                                  | `{ "educations": [] }`                                                                                                                                                         | `401 UNAUTHENTICATED`                              |
| `POST /api/v1/users/me/educations`        | `{ "institution": "Example University", "startDate": "2020-08-01", "endDate": "2024-05-01" }`                            | `{ "education": { "id": "...", "institution": "Example University", "startDate": "2020-08-01", "endDate": "2024-05-01" } }`; HTTP 201                                          | `400 VALIDATION_ERROR`, `409 HISTORY_LIMIT`        |
| `PATCH /api/v1/users/me/educations/:id`   | `{ "degree": "B.Tech" }`; nonempty partial object                                                                        | `{ "education": { "id": "...", "institution": "Example University", "degree": "B.Tech", "startDate": "2020-08-01" } }`                                                         | `400 VALIDATION_ERROR`, `404 EDUCATION_NOT_FOUND`  |
| `DELETE /api/v1/users/me/educations/:id`  | No body                                                                                                                  | `{}`                                                                                                                                                                           | `400 VALIDATION_ERROR`, `404 EDUCATION_NOT_FOUND`  |

Optional experience fields are `employmentType` and `description`; optional education fields are `degree` and `fieldOfStudy`. Sending `endDate: null` clears an end date. Neither history type is required for onboarding completion.

## Onboarding

The shared `OnboardingSnapshot` uses numeric steps `1`–`6` and an `education` array, matching the Milestone 2 contract. `completedSteps` is derived on the server and cannot be supplied by the client.

| Method and path                    | Request example and validation                                       | Success `data` example                                                                                                                                                                                                             | Endpoint errors                                                                          |
| ---------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/v1/onboarding`           | No body                                                              | `{ "onboarding": { "status": "NOT_STARTED", "currentStep": 1, "completedSteps": [], "profile": null, "skills": [], "interests": [], "experiences": [], "education": [] } }`                                                        | `401 UNAUTHENTICATED`                                                                    |
| `PATCH /api/v1/onboarding`         | `{ "currentStep": 1 }`; integer 1–6, no `completedSteps` or `userId` | `{ "onboarding": { "status": "IN_PROGRESS", "currentStep": 1, "completedSteps": [], "profile": null, "skills": [], "interests": [], "experiences": [], "education": [] } }`                                                        | `400 VALIDATION_ERROR`, `409 INVALID_ONBOARDING_STEP`                                    |
| `POST /api/v1/onboarding/complete` | No body or `{}`                                                      | `{ "onboarding": { "status": "COMPLETED", "currentStep": 6, "completedSteps": [1, 2, 3, 4, 5, 6], "completedAt": "2026-11-15T00:00:00.000Z", "profile": {}, "skills": [], "interests": [], "experiences": [], "education": [] } }` | `400 VALIDATION_ERROR`, `409 ONBOARDING_INCOMPLETE`, `409 ONBOARDING_INVALID_REFERENCES` |

The completion row illustrates the response shape; a real successful response has a valid profile and nonempty skills and interests. Completion requires full name, unique username, headline, country, professional status, at least one existing skill, and at least one existing interest. Bio, city, avatar, experience, and education are optional. Step 4 can be skipped. Users may navigate backward but cannot jump past required steps. Completion is idempotent and changes only the signed-in `User` record.

## Common errors and security

Protected routes may also return `401 SESSION_EXPIRED`, `403 ACCOUNT_SUSPENDED`, `403 ACCOUNT_DEACTIVATED`, `403 ORIGIN_NOT_ALLOWED`, `503 DATABASE_UNAVAILABLE`, or generic `500 INTERNAL_ERROR`. Feed routes require completed onboarding and return `403 ONBOARDING_REQUIRED`; profile, catalog, history, and onboarding APIs remain accessible during setup. Resource ownership remains enforced in their services. Validation and database errors do not reveal stack traces or connection values. Rate limiting applies to sign-up, login, and feed writes. The routes use the current origin check and cookie-based authentication. A stricter CSRF policy for requests without an `Origin` header remains a security follow-up before public deployment.

## Email verification

| Method | Path                               | Behavior                                                                                       |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `POST` | `/api/v1/auth/verify-email`        | Body `{ "token": "..." }`; public, consumes a single-use token; returns `{ "verified": true }` |
| `POST` | `/api/v1/auth/resend-verification` | Session required; no email body; returns `{ "sent": true }` after provider acceptance          |

Signup adds `data.verificationEmailSent` and keeps its existing session. With verification enabled, it creates an unverified account and attempts email delivery. With verification disabled, the value is `false`, no token or email is created, and new accounts can continue to onboarding. All auth user DTOs include `emailVerifiedAt` (ISO string or null) and `emailVerificationRequired`. A verification link carries the token in a URL fragment and expires after 24 hours. Verification does not create a session. Invalid, expired, and used links return `400 VERIFICATION_LINK_INVALID`; malformed bodies return `400 VALIDATION_ERROR`. Resend uses the session email and may return `409 EMAIL_ALREADY_VERIFIED`, `429 VERIFICATION_COOLDOWN`, `429 VERIFICATION_RATE_LIMITED`, or `503 EMAIL_DELIVERY_UNAVAILABLE`. Defaults are a 60-second cooldown, five account attempts per hour, and 20 IP attempts per hour; MongoDB stores these limits. A prior usable token stays valid if a replacement delivery fails.

When verification is enabled, profile, catalog, selection, history, and onboarding routes return `403 EMAIL_VERIFICATION_REQUIRED` for new unverified accounts. Legacy records without `emailVerificationRequired` retain previous access without being marked verified. Applying verification to those accounts requires a separate approved rollout.

## Public professional profile

`GET /api/v1/profiles/:username` is readable without a session. `GET /api/v1/profiles/public/:username` is the canonical form used by the frontend; it also supports the username `check-username`, which conflicts with the username-availability route. It normalizes and validates the username, then returns `404 PROFILE_NOT_FOUND` unless the profile has `visibility: PUBLIC` and its owner is active with completed onboarding. The response contains `{ "profile": { "username": "ada", "fullName": "Ada", "headline": "Engineer", "country": "India", "githubUrl": "https://github.com/ada" }, "skills": [], "experiences": [], "education": [] }`. Only allowlisted fields appear; email, account status, onboarding state, ownership IDs, avatar URLs from unconfigured storage, and security fields are excluded. Skills and history queries are bounded by their existing service limits.

`PATCH /api/v1/profiles/me` accepts optional `visibility`, `githubUrl`, `portfolioUrl`, and `websiteUrl` in addition to existing fields. Link values must use HTTPS without embedded credentials; GitHub links must point to a GitHub profile. Send `null` to remove a link. A new profile defaults to `PRIVATE`; older profile records without visibility also read as private and are never published automatically. The owner can review these fields through `GET /profiles/me`. All changes require the session, active account, and current verification policy.

## Professional feed and saved posts

All endpoints below require the existing session, active account, current email-verification policy, and completed onboarding. Writes use a 30-action/15-minute per-user limiter. Posts are text only, 1–3,000 trimmed characters. Comments are 1–1,000 trimmed characters. The only accepted post visibility value is `PROFESSIONALS`; omitted visibility has the same behavior. Attachment IDs and extra fields are rejected until approved storage exists.

| Method          | Path                                                 | Purpose                                                       |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `GET`           | `/api/v1/posts?limit=10&cursor=...`                  | Chronological feed, maximum limit 50                          |
| `POST`          | `/api/v1/posts`                                      | Publish `{ "content": "...", "visibility": "PROFESSIONALS" }` |
| `PATCH`         | `/api/v1/posts/:postId`                              | Edit own post with `{ "content": "..." }`                     |
| `DELETE`        | `/api/v1/posts/:postId`                              | Soft-delete own post                                          |
| `PUT`, `DELETE` | `/api/v1/posts/:postId/like`                         | Idempotent like and unlike                                    |
| `PUT`, `DELETE` | `/api/v1/posts/:postId/bookmark`                     | Idempotent private save and remove                            |
| `GET`           | `/api/v1/users/me/bookmarks?limit=10&cursor=...`     | Private saved posts                                           |
| `GET`           | `/api/v1/posts/:postId/comments?limit=10&cursor=...` | Flat comments                                                 |
| `POST`          | `/api/v1/posts/:postId/comments`                     | Add `{ "content": "..." }`                                    |
| `PATCH`         | `/api/v1/posts/:postId/comments/:commentId`          | Edit own comment                                              |
| `DELETE`        | `/api/v1/posts/:postId/comments/:commentId`          | Soft-delete own comment                                       |

Lists return `{ "items": [], "nextCursor": null, "hasMore": false }` inside the standard success envelope. A post DTO contains ID, text, safe author name/username/headline, timestamps, like/comment counts, and current viewer's liked/bookmarked/owned flags. It excludes email, user IDs, session data, and profile internals. A private or missing author profile has a non-linked author name. Invalid IDs or cursors return `400 VALIDATION_ERROR`; unavailable or non-owned posts/comments return 404. Deleted posts disappear from feed and saved posts, and their interactions return 404. Bookmarks are never publicly listed.

## Professional communities

Discovery and detail reads allow guests. Mutations and `/users/me/communities` require an active session, the current email-verification policy, and completed onboarding. Writes have a 30-action/15-minute per-user limiter. All IDs are validated 24-character hexadecimal ObjectIds; slugs are lowercase letters, digits, and hyphens. Page limits default to 10 and cannot exceed 50. Pages use descending creation time plus ID cursors. Successful responses use the standard envelope.

| Method   | Path                                                                      | Purpose                                                   |
| -------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| `GET`    | `/api/v1/communities?search=&category=&visibility=&limit=10&cursor=`      | Discover active communities                               |
| `POST`   | `/api/v1/communities`                                                     | Create community and active owner membership              |
| `GET`    | `/api/v1/communities/:slug`                                               | Public summary or full permitted detail                   |
| `GET`    | `/api/v1/users/me/communities?limit=10&cursor=`                           | Signed-in user's active memberships                       |
| `POST`   | `/api/v1/communities/:communityId/join`                                   | Join public or request private membership                 |
| `DELETE` | `/api/v1/communities/:communityId/membership`                             | Leave or cancel a pending request; owner cannot leave     |
| `GET`    | `/api/v1/communities/:communityId/members?limit=10&cursor=`               | Active member directory                                   |
| `GET`    | `/api/v1/communities/:communityId/membership-requests?limit=10&cursor=`   | Pending requests for authorized managers                  |
| `POST`   | `/api/v1/communities/:communityId/membership-requests/:requestId/approve` | Activate pending request                                  |
| `POST`   | `/api/v1/communities/:communityId/membership-requests/:requestId/reject`  | Reject pending request                                    |
| `PATCH`  | `/api/v1/communities/:communityId`                                        | Edit permitted community fields                           |
| `PATCH`  | `/api/v1/communities/:communityId/members/:userId/role`                   | Assign admin, moderator, or member role                   |
| `DELETE` | `/api/v1/communities/:communityId/members/:userId`                        | Remove permitted active member                            |
| `POST`   | `/api/v1/communities/:communityId/transfer-ownership`                     | Atomically transfer owner to active member on replica set |
| `POST`   | `/api/v1/communities/:communityId/archive`                                | Owner-only archive                                        |

Create body: `{ "name": "React Professionals", "description": "A professional React community.", "category": "software-development", "tags": ["react"], "visibility": "PUBLIC", "rules": "Be respectful." }`. The ten category slugs and labels are shared by the API and frontend. Name is 3–80 characters; description 10–1,000; rules up to 3,000; at most eight unique normalized tags of at most 30 characters. Visibility is `PUBLIC` or `PRIVATE`. The server generates a unique stable slug; renaming does not change the route. Owner, status, count, and IDs cannot be supplied or edited through general settings. Owners can change visibility; admins can edit other approved fields.

Discovery searches names and public-community tags, with optional category and visibility filters. Private-community nonmembers, including pending or removed users, see only name, category, visibility, member count, and their own membership state; description, tags, rules, and owner details are null or empty. Active members see full details. Directory entries include only name, published profile username/headline when available, role, and join time; email and security fields are excluded. Count is derived from active membership records. Duplicate joins and pending requests return their existing state. Rejected or removed members may request again. Changing a private community to public does not auto-approve old requests; a pending user can submit join again to activate. Approval/rejection requires a pending request and cannot be repeated.

Role permissions are enforced on the server: owners manage settings, admins, moderators, requests, removal, transfer, and archive; admins edit details, review requests, manage moderators/members, and remove ordinary members; moderators review requests and view the directory; members view the directory and may leave. The owner role cannot be assigned through role update. Owners must transfer ownership before leaving. Archived communities remain readable under their existing visibility rules, while joins and management writes return an error. Transfer makes the old owner an admin and requires an active target and a MongoDB replica set; standalone MongoDB returns `503 REPLICA_SET_REQUIRED`. Common errors include `400 VALIDATION_ERROR`, `403 COMMUNITY_FORBIDDEN`, `404 COMMUNITY_NOT_FOUND`, `409 MEMBERSHIP_CONFLICT`, `409 REQUEST_NOT_PENDING`, `409 OWNER_TRANSFER_REQUIRED`, `409 COMMUNITY_ARCHIVED`, and `429 RATE_LIMITED`.

Community image uploads, unrestricted messaging, and notifications are not available through these endpoints. Structured command activity uses the separate endpoints below.

## Structured community commands and activity

All endpoints require an active session, current email-verification policy, completed onboarding, and the existing origin check. IDs are 24-character hexadecimal MongoDB IDs. Writes have a 20-action/15-minute per-user process-memory rate limit. Responses use the standard success envelope. Slash commands are structured application actions, not shell commands or ordinary chat messages.

| Method   | Path                                                                    | Purpose                                                               |
| -------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `GET`    | `/api/v1/communities/:communityId/commands`                             | Available command metadata for an active member                       |
| `POST`   | `/api/v1/communities/:communityId/commands`                             | Validate and publish one command activity                             |
| `GET`    | `/api/v1/communities/:communityId/activities?command=&limit=10&cursor=` | Chronological activity; optional command filter; maximum page size 50 |
| `DELETE` | `/api/v1/communities/:communityId/activities/:activityId`               | Soft-delete as author or authorized manager                           |

The discovery response contains `data.commands`, each with `id`, slash `command`, `label`, `description`, `iconId`, `category`, `enabled`, `payloadVersion`, and `displayType`. Only active members of an active community receive permitted commands. The initial command IDs are `referral`, `needreferral`, `event`, and `meetup`, all at payload version `1`.

Submit `{ "command": "needreferral", "payloadVersion": 1, "payload": { "jobTitle": "Frontend Engineer", "company": "Example Co", "experienceLevel": "mid", "message": "I would appreciate a referral for this role." } }`. Required fields by command:

| Command        | Required payload fields                                                                                     | Optional payload fields |
| -------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------- |
| `referral`     | `jobTitle`, `company`, `location`, `workMode` (`remote`, `hybrid`, `onsite`), HTTPS `jobUrl`, `description` | `expiresAt`             |
| `needreferral` | `jobTitle`, `company`, `experienceLevel` (`entry`, `mid`, `senior`), `message`                              | HTTPS `jobUrl`          |
| `event`        | `title`, `description`, `startAt`, `locationType`, `locationOrUrl`                                          | `endAt`                 |
| `meetup`       | `title`, `description`, `scheduledAt`, `locationType`, `locationOrUrl`                                      | `capacity` (1–10000)    |

Dates are ISO datetimes with timezone offsets. Event end time must follow start time. `locationType` is `online`, `in_person`, or `hybrid`; online locations must be HTTPS URLs without credentials. Text is trimmed, length bounded, and cannot contain HTML markup. Payload and top-level objects reject extra fields. The server chooses the author from the session and revalidates the selected registry schema. Success returns `201` with `data.activity`.

Activity pages return `{ "items": [], "nextCursor": null, "hasMore": false }` inside `data`. Each item includes ID, community ID, command, label, version, validated display payload, safe author name/optional published username and headline, creation time, `ownedByMe`, and `canDelete`. Public-community activity is available to signed-in, onboarded users; private-community activity requires active membership. Deleted records and unavailable authors are excluded. The cursor is opaque and stable for descending creation time and ID. Deletion returns `data: {}` and clears the stored payload.

The API can return `400 COMMAND_UNKNOWN`, `400 COMMAND_VERSION_UNSUPPORTED`, `400 COMMAND_PAYLOAD_INVALID`, `403 COMMAND_DISABLED`, `403 COMMAND_FORBIDDEN`, `404 ACTIVITY_NOT_FOUND`, `409 COMMUNITY_ARCHIVED`, `429 RATE_LIMITED`, and the existing auth, validation, and database errors. There is no generic community message endpoint. Referral fulfillment, applications, event registration, meetup attendance, and notifications are not part of these APIs.
