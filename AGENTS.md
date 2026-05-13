# AGENTS.md

## Project Overview

**neesh** is a minimalist interest-based chat community built with TanStack Start and deployed on Netlify. Users authenticate, choose interests, and chat in topic-specific rooms or a global community channel.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (file-based routing, SSR) |
| Frontend | React 19 |
| Routing | TanStack Router v1 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 (utility-first, dark theme) |
| Auth | Netlify Identity via `@netlify/identity` |
| Database | Netlify Database (Postgres) + Drizzle ORM (`@beta`) |
| Deployment | Netlify (edge functions + serverless) |

## Directory Structure

```
├── db/
│   ├── schema.ts          # Drizzle ORM table definitions (source of truth)
│   └── index.ts           # Drizzle client (drizzle-orm/netlify-db)
├── netlify/
│   ├── database/
│   │   └── migrations/    # Auto-generated SQL migrations (DO NOT edit manually)
│   └── functions/
│       └── identity-signup.ts  # Netlify Identity webhook: creates user profile on signup
├── src/
│   ├── components/
│   │   └── CallbackHandler.tsx  # Handles OAuth/email confirm hash tokens
│   ├── lib/
│   │   ├── auth.ts              # getServerUser server function
│   │   └── identity-context.tsx # React context for client-side auth state
│   ├── middleware/
│   │   └── identity.ts          # TanStack Start auth middleware
│   ├── routes/
│   │   ├── __root.tsx           # HTML shell + IdentityProvider + sidebar nav layout
│   │   ├── index.tsx            # Home/dashboard (redirects to /login if unauthenticated)
│   │   ├── login.tsx            # Sign in / sign up / forgot password
│   │   ├── chat.tsx             # Interest-based chat (pick a topic, join a room)
│   │   ├── community.tsx        # Global community chat
│   │   ├── leaderboard.tsx      # Top users ranked by activity score
│   │   ├── profile.tsx          # Edit display name, bio, avatar, interests
│   │   ├── settings.tsx         # Account settings and preferences
│   │   ├── api.community-messages.ts  # GET/POST community messages
│   │   ├── api.chat-messages.ts       # GET/POST interest chat messages
│   │   ├── api.chat-rooms.ts          # POST to create/find a room by interest
│   │   ├── api.profile.ts             # GET/PUT user profile
│   │   └── api.leaderboard.ts         # GET top 50 users by score
│   ├── router.tsx           # TanStack Router setup
│   └── styles.css           # Global styles (Tailwind + scrollbar)
├── drizzle.config.ts        # Drizzle Kit config (output: netlify/database/migrations)
├── netlify.toml             # Build config + edge function exclusion for /.netlify/*
└── package.json
```

## Database Schema

Defined in `db/schema.ts`. Tables:

- **`user_profiles`** — linked to Netlify Identity user ID; stores display name, bio, avatar, interests[], message count, score
- **`community_messages`** — messages in the global community channel
- **`chat_rooms`** — one row per interest tag (e.g., `gaming`, `music`)
- **`chat_messages`** — messages within an interest room, foreign-keyed to `chat_rooms`

### Migrations

Always run `npx drizzle-kit generate` after changing `db/schema.ts`. Never edit migration files manually. Migrations are applied automatically by Netlify on deploy.

## Auth Architecture

- **`@netlify/identity`** handles all auth (JWT cookies, login, signup, logout)
- Auth only works on Netlify deployments — `nf_jwt` cookie is not set on localhost
- `IdentityProvider` in `__root.tsx` wraps the app and exposes `useIdentity()` hook
- `CallbackHandler` processes email confirmation/recovery tokens in the URL hash
- Server functions use `getUser()` from `@netlify/identity` directly

## Routing Conventions

- API routes: `src/routes/api.*.ts` → expose `server.handlers` with `GET`/`POST`/`PUT`
- Page routes: `src/routes/*.tsx` → client-side auth guard via `useIdentity()` + `useEffect`
- Root layout (`__root.tsx`) renders the sidebar nav when authenticated, otherwise passes through `<Outlet />` for the login page

## Scoring

- Community message: +1 point, +1 message count
- Interest chat message: +2 points, +1 message count
- Leaderboard ranks by `score` descending

## Conventions

- All Tailwind styles are utility classes; no CSS modules
- Dark theme throughout: `zinc-950` backgrounds, `zinc-800/700` borders
- No comments unless the logic is non-obvious
- TypeScript strict mode; `@/` alias resolves to `src/`
- Drizzle column names in snake_case strings, TS variables in camelCase
