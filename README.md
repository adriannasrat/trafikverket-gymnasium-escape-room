# Trafikverket Gymnasium Escape Room

A redevelopment of the Gymnasium escape room experience and management platform I designed and implemented during a university collaboration with Trafikverket.

The application is intended for event computers where teams complete configurable infrastructure-themed challenges. The lowest verified completion time wins. Event staff can securely manage game content, complete answers, images, activation and timing without changing source code.

## Current status

The first production milestone is implemented. A configurable quiz, server-authoritative timing, protected administration, persistent image uploads, audit history and a ranked leaderboard.

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

Stop the stack without deleting event data:

```sh
docker compose down
```

## Development

Start PostgreSQL and the API with Docker:

```sh
docker compose up db api
```

Then run the web application with hot reload:

```sh
cd apps/web
npm install
npm run dev
```

The Vite development server proxies `/api` to the local API.

Run all frontend checks with `npm run lint`, `npm run test` and `npm run build`. The API integration suite runs with `dotnet test EscapeRoom.sln` when .NET 10 is installed, or through the SDK container used by CI.

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
