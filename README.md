# TellNab

TellNab is a React + TypeScript platform for honest advice, now including a secure account system and admin console.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Express, Prisma (SQLite), JWT auth, role-based access control
- Security: `helmet`, CORS policy, `httpOnly` cookies, rate limiting, strong password policy, server-side role checks

## Quick setup

1. Install dependencies

```bash
npm install
```

2. Environment files

```bash
# Backend profiles
# - Local: config/local/server.env
# - Live:  config/live/server.env

# Frontend profiles
# - Local build/dev: .env.development
# - Live build:      .env.production
```

3. Generate/migrate database and seed admin

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

4. Run backend and frontend (separate terminals)

```bash
npm run dev:server:local
```

```bash
npm run dev:frontend:local
```

Frontend: http://localhost:5173
Backend health: http://localhost:4000/api/health

## Auth & admin features

- Register and login endpoints
- Session via secure cookie + JWT
- Protected routes (`/profile`) and admin-only route (`/admin`)
- Admin user management:
  - View all users
  - Promote/demote between MEMBER and ADMIN
  - Activate/suspend accounts

## Available frontend routes

- `/` Home
- `/ask` Submit question
- `/feed` Advice feed
- `/profile` Account profile (protected)
- `/admin` Admin console (admin only)
- `/login` Login
- `/register` Register
- `/about` About
- `/terms` Terms

## Scripts

```bash
npm run dev
npm run dev:server
npm run dev:server:local
npm run start:live
npm run dev:frontend:local
npm run build:frontend:live
npm run build
npm run preview
npm run test:run
npm run smoke:advice
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Security notes

- Use a long random `JWT_SECRET` (32+ chars minimum)
- Replace seed admin credentials in `.env` immediately
- Keep `CORS_ORIGIN` restricted to trusted frontend origins
- In production, serve over HTTPS and keep cookies `secure`

## Google OAuth setup (required for Google sign-in)

- Frontend build env must include `VITE_GOOGLE_CLIENT_ID`
- Backend runtime env must include:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
- `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` must be the exact same value.
- The Google OAuth app must be **Web application** type.
- Add authorized JavaScript origins in Google Cloud:
  - `https://tellnab.com`
  - `https://www.tellnab.com` (if used)
  - `http://localhost:5173` (local)

## Render deployment (PostgreSQL)

- This repo keeps local SQLite schema in [prisma/schema.prisma](prisma/schema.prisma)
- Use PostgreSQL schema for live deploy: [prisma/schema.live.prisma](prisma/schema.live.prisma)

Recommended Render commands:

- Build command:

```bash
npm install && npm run prisma:generate:live && npm run prisma:dbpush:live && npm run prisma:seed
```

- Start command:

```bash
npm run start:live
```
