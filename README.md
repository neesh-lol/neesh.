# neesh

**neesh** is a minimalist interest-based chat community. Users sign up, choose their interests, and are placed in topic-specific chat rooms alongside people who share similar passions — think Discord without the noise.

## Features

- **Interest Chat** — Pick a topic (gaming, music, tech, etc.) and instantly join a shared room with others who chose the same interest
- **Community Chat** — An open channel where everyone on the platform can talk
- **Leaderboard** — See the most active members ranked by activity score
- **Profile** — Customize your display name, bio, avatar, and select your interests
- **Settings** — Manage account preferences

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start |
| Frontend | React 19, TanStack Router |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Auth | Netlify Identity (`@netlify/identity`) |
| Database | Netlify Database + Drizzle ORM (Postgres) |
| Deployment | Netlify |

## Getting Started

### Prerequisites

- Node.js 18+
- Netlify CLI (`npm i -g netlify-cli`)

### Run locally

```bash
npm install
npm run dev
```

> **Note:** Authentication (sign in / sign up) only works when deployed to Netlify. The `nf_jwt` cookie is set by the Netlify Identity backend, which is not available on localhost.

### Deploy

Push to your Netlify site. The database and Identity service are provisioned automatically.

## Environment Variables

No environment variables are required. Netlify Identity and Netlify Database are configured automatically at deploy time.
