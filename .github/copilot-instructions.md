# Voklance workspace instructions

- This repository is a TypeScript MERN starter with npm workspaces: `frontend` is React + Vite; `backend` is Express + Mongoose.
- Keep frontend code in `frontend/src` and backend code in `backend/src`.
- Use environment variables for backend configuration; never commit secrets. Copy `backend/.env.example` to `backend/.env` for local database configuration.
- Keep the client usable when MongoDB is not configured. API health checks should report database connectivity separately from server availability.
- Run `npm run build` to verify the client and `npm run dev` to start both workspaces.
