# Trafikverket Gymnasium Escape Room

A redevelopment of the Gymnasium escape room experience and management platform I designed and implemented during a university collaboration with Trafikverket.

The application is intended for event computers where players complete configurable infrastructure-themed challenges. Each session has five lives shared by all seven games, and correct answers award more points when they are solved quickly. The highest verified score wins, with the fastest completion time used as the tiebreaker. Event staff can securely manage game content, complete answers, images, activation and timing without changing source code.

## Current status

Seven games are implemented: a configurable quiz, a Risk & Safety matching board, a Digital Safety true or false challenge, Pixel Hunt, a card sorting challenge, a word assembly challenge and Signalordet, a safer railway themed alternative to Hangman.

In Pixel Hunt, each image starts pixelated, the player can then sharpen it up to five times, adding five seconds to their total time per click.

In the sorting challenge, cards are dragged or tapped into Trafikverket areas while distractor cards remain in the pool, an incorrect check adds a ten second penalty.

In the word assembly challenge, players drag or move word parts into the correct order to build Trafikverket related compound words.

All games use server timing and validation. The protected administration supports questions, statements, scenarios, risk zones, image questions, sorting cards and categories, word parts and their correct order, secret Signalordet answers and hints, correct answers and mappings, image uploads, activation, audit history and management of the ranked leaderboard without requiring source code changes.

Each completed challenge awards 100–1,000 points based on the remaining challenge time. Wrong answers consume one shared life, except individual letter guesses in Signalordet, and pause the timer until the player actively starts the next attempt. A timeout in any game immediately consumes all remaining lives and ends the session. Finished sessions, including attempts that ran out of lives, are ranked by score and then by total time; incomplete entries are clearly marked in the leaderboard.

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

The public configuration uses `EXPERIENCE_MODE=Demo`. Local event installations
use `EXPERIENCE_MODE=Event`. New sessions and their leaderboard results are tagged
with that server-controlled mode; the administration can view and clear demo and
event results independently. Changing the mode does not relabel existing data.

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

## Privacy and result retention

Players are asked to choose a nickname instead of entering their full name. The
nickname, elapsed time and registered answers are stored to run the game and
produce its leaderboard. Only the nickname and completion time are shown on the
public leaderboard.

Sessions and their answers are deleted automatically after 30 days by default,
including incomplete sessions. Configure the period with `DATA_RETENTION_DAYS`
and the cleanup interval with `DATA_RETENTION_CLEANUP_HOURS`. The default cleanup
interval is six hours. These settings apply to both event and demo data; the
administration also retains its existing manual deletion controls.

The selected retention period should be reviewed for the actual deployment and
its documented purpose. Restoring an older backup can temporarily reintroduce
expired rows; the cleanup worker runs when the restored application starts.

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

The command above runs the fast browser tests with mocked API responses. To run
the complete launch-critical journey against a real web server, API, and
PostgreSQL database, run this from the repository root:

```bash
./scripts/test-full-stack-e2e.sh
```

The full-stack test logs in as an administrator, edits and reloads a question,
starts a session, completes all seven game types with keyboard activation, verifies the registered time
in both the API and public leaderboard, and then restores the question and
removes the result. It builds a separate temporary Docker Compose project and
always removes its containers and database when the run ends, including after
a failure. Docker and the Playwright Chromium browser must be installed; the CI
workflow installs the browser automatically. If port `18090` is occupied, use a
different local port, for example:

```bash
E2E_PORT=18091 ./scripts/test-full-stack-e2e.sh
```

The API integration suite runs with `dotnet test EscapeRoom.sln` when .NET 10 is installed, or through the SDK container used by CI. GitHub Actions runs both the frontend browser suite and the API integration suite.

Before an event or public release, complete the
[manual rehearsal checklist](docs/manual-rehearsal-checklist.md) with a person
who has not previously seen the project. It covers physical event hardware,
real mobile devices, keyboard use, zoom, reduced motion and interrupted networks,
and distinguishes these human checks from the automated browser coverage.

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
