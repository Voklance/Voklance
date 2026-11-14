# Voklance

A beginner-friendly TypeScript MERN starter: React + Vite frontend, Express API, and MongoDB through Mongoose. The frontend works on its own; MongoDB is only needed when you start building database-backed features.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- MongoDB Community Server locally, or a MongoDB connection string

## Setup

1. Install the project dependencies from the repository root with `npm install`.
2. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` if you want to connect MongoDB.
3. Run both the API and frontend with `npm run dev`.
4. Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The API is available at `http://localhost:5000/api`; its health check is `/api/health`.

If MongoDB is not configured or available, the API still starts and reports its database as disconnected. The frontend displays the API connection status in its header.

## Useful scripts

- `npm run dev` — start the API and Vite development server together.
- `npm run build` — compile the TypeScript backend and build the frontend bundle in `frontend/dist`.
- `npm start` — start the API in production mode.

## Project layout

- `frontend/` — React TypeScript application and Vite configuration.
- `backend/` — Express TypeScript API, health route, and MongoDB connection helper.
- `backend/.env.example` — local environment variable template.

Add API routes under `backend/src/routes`, and build UI features under `frontend/src`. Never commit `backend/.env` or other secrets.
