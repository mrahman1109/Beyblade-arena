# Strategy Hub

An internal management platform for tracking strategy, actions, meetings, and 1-on-1s — built for 3C Energy Group.

## Features

- **Strategy & OKRs** — set strategic goals with key results and progress tracking
- **Actions** — kanban board to assign tasks to team members with priorities and due dates
- **Meetings** — schedule team meetings with structured agendas, notes, and decisions
- **1-on-1s** — running agendas and notes for individual check-ins
- **People** — manage your 60+ person team (admin)

## Getting Started

### Prerequisites
- Node.js 18+
- npm 8+

### Setup

```bash
# Clone and install
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env: set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# Start development (server + client together)
npm run dev
```

The server runs on **http://localhost:3001** and the client on **http://localhost:5173**.

Default admin login: `admin@company.com` / `admin123` (change in `.env`)

### Production

```bash
# Build the client
npm run build

# Run the server (serves built client at /)
NODE_ENV=production npm start
```

The entire app is served from port 3001 in production.

## Deployment

Deploy to any Node.js host (Railway, Render, Fly.io, or a VPS):

1. Set environment variables: `PORT`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NODE_ENV=production`
2. Run `npm run build && npm start`
3. The SQLite database (`server/strategy.db`) is created automatically on first run

## Project Structure

```
├── server/          Express API + SQLite database
│   ├── db.js        Schema & initialization
│   ├── routes/      auth, users, goals, actions, meetings, one-on-ones
│   └── middleware/  JWT auth
└── client/          React + Vite + Tailwind frontend
    └── src/
        ├── pages/   Dashboard, Strategy, Actions, Meetings, 1-on-1s, People
        └── components/
```
