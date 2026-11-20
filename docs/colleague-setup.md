# Colleague setup: GitHub, MongoDB, and Compass

This guide starts with a fresh clone. Run commands from the repository root unless a step says otherwise. Each developer can use a separate local MongoDB database, or the team can connect to one approved shared MongoDB deployment. GitHub stores the code; it does not copy MongoDB data between computers.

## Versions and downloads

| Tool                      | Version for this project                                  | Purpose                                     |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| Node.js                   | **22.23.2** (the `.nvmrc` version; Node 22.12+ supported) | API, frontend, and build tools              |
| npm                       | **10.9.8** (npm 10.x supported)                           | Installs the committed lockfile             |
| MongoDB Community Server  | **7.0.14** local reference; use a 7.0.x server            | Local database                              |
| MongoDB Shell (`mongosh`) | Current compatible 2.x release                            | One-time local replica-set setup and checks |
| MongoDB Compass           | Current release                                           | Optional graphical database viewer/editor   |

Install [Node.js](https://nodejs.org/en/download), [MongoDB Community Server](https://www.mongodb.com/try/download/community), [MongoDB Shell](https://www.mongodb.com/try/download/shell), and optionally [MongoDB Compass](https://www.mongodb.com/try/download/compass). Install Git too if it is not already available. Node 22 meets [Vite's Node requirement](https://vite.dev/guide/). You do not need MongoDB Shell or a local server if you use an existing shared replica-set deployment.

Verify the tools in a terminal:

```sh
node --version
npm --version
mongod --version
mongosh --version
```

The first two commands should show `v22.23.2` and `10.9.8` for the exact tested setup. With `nvm` installed, run `nvm install` and `nvm use` in the repository root to select `.nvmrc`. A different npm 10.x version is acceptable. If a command is missing, finish installing that tool and open a new terminal before continuing.

## 1. Clone and install

Your GitHub account must have access to the repository if it is private.

macOS/Linux with `nvm`:

```sh
git clone https://github.com/Voklance/Voklance.git
cd Voklance
nvm install
nvm use
npm ci
```

Windows PowerShell, or macOS/Linux without `nvm`, after installing Node.js 22.23.2:

```sh
git clone https://github.com/Voklance/Voklance.git
cd Voklance
npm ci
```

Run `npm ci` at the **repository root**, not separately in each workspace. It installs the exact dependency versions recorded in `package-lock.json`.

## 2. Start local MongoDB with transactions enabled

Voklance uses MongoDB transactions for some event and community actions, so use a local **single-node replica set**. These commands create a separate data directory in your home folder. Keep the `mongod` terminal open while working. If you already run MongoDB on port 27017, stop that service first or choose another port in every command and in `MONGODB_URI`.

macOS/Linux, terminal A:

```sh
mkdir -p "$HOME/voklance-mongo-data"
mongod --dbpath "$HOME/voklance-mongo-data" --replSet rs0 --bind_ip 127.0.0.1 --port 27017
```

Windows PowerShell, terminal A (use the full path to `mongod.exe` if it is not on `PATH`):

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\voklance-mongo-data"
mongod --dbpath "$env:USERPROFILE\voklance-mongo-data" --replSet rs0 --bind_ip 127.0.0.1 --port 27017
```

In terminal B, initialize the replica set **once**, after `mongod` reports that it is waiting for connections:

macOS/Linux:

```sh
mongosh "mongodb://127.0.0.1:27017/?directConnection=true" --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

Windows PowerShell:

```powershell
mongosh "mongodb://127.0.0.1:27017/?directConnection=true" --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: '127.0.0.1:27017'}]})"
```

Wait a few seconds, then check that the node is primary:

macOS/Linux:

```sh
mongosh "mongodb://127.0.0.1:27017/?replicaSet=rs0" --eval 'db.hello().isWritablePrimary'
```

Windows PowerShell:

```powershell
mongosh "mongodb://127.0.0.1:27017/?replicaSet=rs0" --eval "db.hello().isWritablePrimary"
```

The last command should print `true`. On later days, start only the `mongod` command with the same data directory; do not run `rs.initiate` again. These steps follow [MongoDB's replica-set setup](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/). The local server binds to `127.0.0.1`, so it is accessible only from your computer. Do not expose this unauthenticated development server to a network.

## 3. Configure the application

macOS/Linux:

```sh
cp backend/.env.example backend/.env
```

Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

The copied file already contains the local connection string:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/voklance?replicaSet=rs0
```

Keep `EMAIL_VERIFICATION_ENABLED=false` for a basic local run. Password reset, email change, and verification mail need a working SMTP service and the optional settings described in `backend/.env.example`. GitHub portfolio connection also needs a GitHub OAuth app and its three settings; the rest of the app runs without them. You normally do **not** need `frontend/.env`: Vite already sends `/api` and `/socket.io` to the local API.

If the team uses a shared MongoDB deployment instead, replace `MONGODB_URI` in each developer's `backend/.env` with the approved connection string. Use an account with access to the intended development database and any required network allowlist. Keep the connection string private. For a shared deployment, agree on a separate development database so local testing does not change production data.

## 4. Add initial catalog data and run

With MongoDB still running, seed the skills and interests used by onboarding:

```sh
npm run seed:catalogs -w backend
npm run dev
```

The seed command should print `Skill and interest catalogs are ready.` It adds missing catalog entries and can be run again without duplicating them. The second command starts the API and frontend together; leave its terminal open. Open <http://localhost:5173>, select **Create an account**, and complete onboarding. New account, profile, and post data are created through the app; there is no default login. Check <http://localhost:5001/api/v1/health> to confirm that the API is responding.

When you return later, start `mongod` using the same data directory and run `npm run dev` from the repository root. Seed again only if starting with a new database or if catalog seeds changed.

## 5. View and add data in MongoDB Compass

1. Open Compass and choose **New Connection**.
2. Paste the same `MONGODB_URI` that is in `backend/.env`, then select **Connect**. For the local setup it is `mongodb://127.0.0.1:27017/voklance?replicaSet=rs0`.
3. Open the `voklance` database. After seeding, open `skills` and `interests`; after signup, you can also inspect `users`, `profiles`, and other collections. Use **Refresh** if a newly created collection has not appeared yet.
4. To add a **catalog** entry manually, open `skills` or `interests`, choose **Add Data → Insert Document**, and enter a document such as:

   ```json
   { "name": "Rust", "slug": "rust", "category": "Programming" }
   ```

   Use a unique lowercase `slug`; both collections have unique slug indexes. If you add an item to `interests`, choose a suitable interest category. To share a catalog change through GitHub, also add it to `backend/src/database/catalogSeeds.ts`; Compass edits alone stay in that database.

5. To import multiple documents, open the **target collection**, choose **Add Data → Import JSON or CSV file**, select a file, review the field types, and import. Use the app UI to create accounts, posts, connections, and other linked data; those records need validated fields and relationships. [Compass's import guide](https://www.mongodb.com/docs/compass/import-export/) covers accepted JSON and CSV formats.

Compass connects to MongoDB; it does not continuously sync two separate local databases. When the app and Compass use the **same** URI, changes made through either one appear in the other after refresh. If the team wants the same live data on every computer, point each copy of `backend/.env` and Compass at one approved shared MongoDB deployment. Do not commit `.env`, database exports, passwords, session records, or personal data to GitHub. For a one-time transfer of an approved, sanitized database, use [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/) (`mongodump`/`mongorestore`) and coordinate the target database with the team; Compass JSON/CSV import is collection-by-collection and is not a whole-database backup.

## 6. Publish the code and keep a clone current

The project owner can review and publish the working tree to the existing `origin` remote:

```sh
git status --short
git add -A
git diff --cached --stat
git diff --cached --check
git commit -m "Prepare Voklance for team setup"
git push origin main
```

Before committing, inspect the staged file list for private files or data exports. The existing `.gitignore` excludes `backend/.env`, `frontend/.env`, installed dependencies, and build output. If the team uses pull requests, push a feature branch instead of `main` and open a pull request.

After the project owner pushes, colleagues can get updates with `git pull` followed by `npm ci` whenever `package-lock.json` changes. Every developer keeps their own ignored `backend/.env`. Git pushes send source files only; they do not send local MongoDB records. When contributing code, use the team's normal branch and pull-request workflow.

Before sharing a change, run:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

## Quick fixes

| Symptom                                    | Check                                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node` version is wrong                    | Run `nvm use` in the repository root, or install Node.js 22.23.2.                                                                                  |
| `npm ci` fails with an engine warning      | Confirm Node 22 and npm 10, then retry from the repository root.                                                                                   |
| `mongod` reports port 27017 already in use | Stop the existing MongoDB service, or use an unused port consistently in `mongod`, `mongosh`, `backend/.env`, and Compass.                         |
| `rs.initiate` says already initialized     | This is expected after the first setup; run the primary check instead.                                                                             |
| Signup says database unavailable           | Confirm `mongod` is running, the primary check prints `true`, and `backend/.env` has the matching URI. Restart `npm run dev` after editing `.env`. |
| Onboarding has no skills or interests      | Run `npm run seed:catalogs -w backend` against the same URI.                                                                                       |
| Compass cannot connect                     | Copy the URI from `backend/.env`; check the server, replica-set name, credentials, and any shared-server network allowlist.                        |
| The frontend cannot reach the API          | Confirm the API is on port 5001 and the frontend on port 5173; check the health URL above.                                                         |
