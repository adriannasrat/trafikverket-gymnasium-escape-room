# Trafikverket Gymnasium Escape Room

A redevelopment of the Gymnasium escape room experience and management platform I designed and implemented during a university collaboration with Trafikverket.

The application is intended for event computers where teams complete configurable infrastructure-themed challenges. The lowest verified completion time wins. Event staff can securely manage game content, complete answers, images, activation and timing without changing source code.

## Current status

Seven games are implemented: a configurable quiz, a Risk & Safety matching board, a Digital Safety true or false challenge, Pixel Hunt, a card sorting challenge, a word assembly challenge and Signalordet, a safer railway themed alternative to Hangman.

In Pixel Hunt, each image starts pixelated, the player can then sharpen it up to five times, adding five seconds to their total time per click.

In the sorting challenge, cards are dragged or tapped into Trafikverket areas while distractor cards remain in the pool, an incorrect check adds a ten second penalty.

In the word assembly challenge, players drag or move word parts into the correct order to build Trafikverket related compound words.

All games use server timing and validation. The protected administration supports questions, statements, scenarios, risk zones, image questions, sorting cards and categories, word parts and their correct order, secret Signalordet answers and hints, correct answers and mappings, image uploads, activation, audit history and management of the ranked leaderboard without requiring source code changes.

## Technology

- React 19, TypeScript, and Vite 8
- ASP.NET Core on .NET 10 LTS
- Entity Framework Core and PostgreSQL
- Cookie authentication and anti-forgery protection
- Docker Compose for reproducible event deployment
- xUnit and Vitest
- GitHub Actions continuous integration

## Run the event stack

1. Copy `.env.example` to `.env`.
2. Replace both placeholder passwords with long, unique values.
3. Start the stack:

```sh
docker compose up --build -d
```

Open `http://localhost:8088` for the player experience and `http://localhost:8088/admin` for administration.
The local port is bound to `127.0.0.1`, so this development/event configuration is
only reachable from the computer that runs Docker and must not be used as an
internet-facing deployment.
The administrator username and password are the `ADMIN_USERNAME` and `ADMIN_PASSWORD`
values in `.env`. After changing either value, run `docker compose up -d app` to apply
the new credentials without deleting games or event results.

Image uploads are enabled for the local event stack. A hosted demo without
persistent file storage can set `Features__ChallengeImageUploads=false`. Existing
project images remain playable, while administration clearly marks image replacement
as unavailable instead of saving files that would disappear after a restart.

Production environments use secure authentication and antiforgery cookies by
default. The local Docker stack explicitly keeps `SECURE_COOKIES_ENABLED=false`
because it is served over `http://localhost`.

Stop the stack without deleting event data:

```sh
docker compose down
```

## Public deployment on a VPS

The public stack is deliberately separate from the local stack. Caddy is the only
service that publishes host ports. It obtains and renews the HTTPS certificate,
redirects HTTP to HTTPS and forwards requests to the application over an internal
Docker network. PostgreSQL and application port `8080` are never published.

Prerequisites:

- a Linux VPS with Docker Compose and inbound ports 80 and 443 available,
- a domain whose DNS record points to the VPS,
- no other service listening on ports 80 or 443.

Create the untracked production configuration and secret files:

```sh
cp .env.production.example .env.production
mkdir -p secrets
openssl rand -base64 32 > secrets/postgres-password.txt
openssl rand -base64 32 > secrets/admin-password.txt
chmod 600 secrets/*.txt
```

Replace `PUBLIC_DOMAIN` and `ADMIN_USERNAME` in `.env.production`. Do not put a
protocol or path in `PUBLIC_DOMAIN`. The `.env.production` file and the entire
`secrets/` directory are ignored by Git; never add their contents to source
control, screenshots or logs.

Validate and start the standalone production stack:

```sh
docker compose --env-file .env.production -f docker-compose.production.yml config
docker compose --env-file .env.production -f docker-compose.production.yml up --build -d
```

Open `https://<PUBLIC_DOMAIN>`. The application refuses to start a public
deployment if HTTPS, secure cookies, explicit host filtering, persistent data
protection keys, a trusted reverse proxy or a sufficiently long administrator
password is missing. The initial HSTS lifetime is 30 days and can be adjusted
with `HSTS_MAX_AGE_DAYS` after HTTPS has been verified in production.

Session creation is limited per client address. The default is five new sessions
per minute and can be adjusted with `SESSION_STARTS_PER_MINUTE`. This is an abuse
control, not a replacement for provider-level DDoS protection.

Inspect the deployment without exposing secrets:

```sh
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs app web
```

Stop it without deleting persistent data or TLS state:

```sh
docker compose --env-file .env.production -f docker-compose.production.yml down
```

## Backup and recovery

The repository includes consistent backup, guarded restore and isolated recovery
test scripts for PostgreSQL, uploaded images and authentication keys. See the
[backup and restore runbook](docs/backup-and-restore.md) before operating on a
production environment.

## Development

Start PostgreSQL and the application server with Docker:

```sh
docker compose up db app
```

Then run the web application with hot reload:

```sh
cd apps/web
npm install
npm run dev
```

The Vite development server proxies backend requests through the same local
application address at `http://localhost:8088`. The API has no separate public
host port.

Run the frontend checks with `npm run lint`, `npm run test` and `npm run build`.
The browser suite uses deterministic mocked API responses so it can verify every
player game type without changing local event data. Install its browser once and
then run the tests:

```sh
cd apps/web
npx playwright install chromium
npm run test:e2e
```

The API integration suite runs with `dotnet test EscapeRoom.sln` when .NET 10 is installed, or through the SDK container used by CI. GitHub Actions runs both the frontend browser suite and the API integration suite.

## Repository structure

```text
apps/
  api/       ASP.NET Core API and database migrations
  web/       React player and administration interfaces
tests/
  api/       API integration tests
docs/        Architecture and product decisions
```

## Project origin

This repository focuses on the Gymnasium experience and supporting administration/backend system. The earlier university team repository remains preserved separately as historical reference.

## License

No open-source license has been granted for this repository. Trafikverket names, logos and visual assets remain the property of their respective rights holders.
