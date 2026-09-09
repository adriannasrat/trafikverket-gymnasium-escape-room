# Architecture

The application is a modular monolith designed for a single offline-capable event computer.

## Runtime

- **Web:** React and TypeScript, served by Nginx in event mode.
- **API:** ASP.NET Core on .NET 10 LTS.
- **Database:** PostgreSQL with a persistent Docker volume.
- **Deployment:** Docker Compose starts the complete stack with one command.

## Product boundaries

- The player experience is available without authentication in kiosk mode.
- The administration area uses cookie authentication and anti-forgery protection.
- The server owns session start/completion timestamps and leaderboard results.
- Challenge countdowns communicate urgency; total elapsed session time determines ranking.
- Games are data-driven so content can be edited without rebuilding the application.
- Uploaded challenge images are validated and stored in a dedicated persistent volume.
- Questions can be added and soft-deleted so historical attempts remain intact.
- Administrative changes, question lifecycle events, and image uploads create audit entries.

## Initial vertical slice

The first slice proves the whole architecture with one configurable quiz game:

1. An event operator signs into the protected administration area.
2. The operator edits the game, its answers, time limit, and active state.
3. A player starts a server-timed session.
4. The player answers the challenge.
5. The server validates the answer and records completion time.
6. The leaderboard ranks the lowest valid elapsed time first.

Additional game types will reuse these session, administration, audit, and deployment foundations.
