# Disbux Admin Portal

The admin portal is built with Next.js, React, and TypeScript using the App Router.

Route screens live directly in `app/`. TanStack Query manages API data, Axios sends
HTTP requests, Zustand holds admin UI state, and React Hook Form with Zod handles
validated forms. The dashboard uses Recharts; Lucide React provides interface icons.

## Development

```bash
npm install
npm run dev
```

The development server starts at [http://localhost:3000](http://localhost:3000). On localhost, the portal sends API requests to `http://localhost:4000/api`; on other hosts, it uses the configured default API URL in `src/services/config.ts`.

## Production

```bash
npm run build
npm start
```

Run `npm run lint` and `npm run typecheck` to validate changes.

## Routes

- `/login` — staff login and email verification
- `/dashboard` — operational overview
- `/kyc` — KYC review
- `/announcements` — announcement management
- `/giveaways` — redirects to announcements
