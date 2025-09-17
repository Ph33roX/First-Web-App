# Stock Side Bets

A minimal Next.js 14 application for managing friendly stock wagers backed by Vercel Postgres and Drizzle ORM. Create wagers, monitor open bets, and settle results using live market data from Yahoo Finance.

## Getting Started

### 1. Clone and install

```bash
npm install
```

The project uses the Next.js App Router with TypeScript, Tailwind CSS, and shadcn/ui components.

### 2. Environment variables

Copy `.env.example` to `.env` and provide your connection details:

```bash
cp .env.example .env
```

Set `DATABASE_URL` for Drizzle migrations. When using Vercel Postgres locally via the [Vercel CLI](https://vercel.com/docs/storage/vercel-postgres/local-development), the CLI will generate a `postgres://` string you can paste here.

On Vercel, the following environment variables are provisioned automatically when you add a Vercel Postgres database:

- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_DATABASE`
- `POSTGRES_PORT`

No external API keys are required for Yahoo Finance.

### 3. Database setup

Run the schema against your database using Drizzle Kit (the `db:push` script wraps `drizzle-kit push`):

```bash
npm run db:push
```

(Optional) seed development data:

```bash
npm run db:seed
```

### 4. Development server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the dashboard. The “Check now” button and the batch `/api/check-due` endpoint compute returns using mocked or real Yahoo Finance data depending on the environment.

### 5. Tests and linting

```bash
npm test
npm run lint
```

### 6. Deploying to Vercel

1. Create a Vercel project and connect this repository.
2. Add a Vercel Postgres database from the Vercel dashboard and link it to the project.
3. Ensure the database environment variables are available in the **Production** and **Preview** environments (handled automatically when linking the database).
4. Deploy via `vercel --prod` or through the Git integration. Drizzle migrations can be pushed with `npm run db:push` locally before deployment or via a CI step using the pooled `POSTGRES_URL` connection string.

### Scheduled settlements

To automatically settle expired bets, trigger the `/api/check-due` endpoint via a CRON job (e.g., Vercel Cron or GitHub Actions). The route processes every open bet whose `endDate` has passed.

## Project Structure

- `src/app/page.tsx` – dashboard UI with tabs for creating and reviewing bets.
- `src/app/api/*` – REST endpoints for creating bets, listing bets, and settling wagers.
- `src/lib/db` – Drizzle schema and database client.
- `src/lib/services/settle-bet.ts` – shared logic for computing returns via Yahoo Finance.
- `src/lib/finance.ts` – trading-day resolution and return calculations.
- `src/app/api/check/route.test.ts` – integration test for the settlement endpoint (mocks Yahoo Finance).

## Scripts

- `npm run dev` – start Next.js locally.
- `npm run build` / `npm run start` – production build and serve.
- `npm run lint` – run ESLint.
- `npm test` – run Vitest tests.
- `npm run db:push` – apply schema to the database.
- `npm run db:seed` – seed sample data.
- `npm run db:studio` – open the Drizzle Studio UI.
- `npm run db:generate` – generate SQL migrations from schema changes.
