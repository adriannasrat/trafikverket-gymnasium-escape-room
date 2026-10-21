# Architecture

The application is a modular monolith for a single event computer. It keeps deployment simple while separating player flow, administration, game rules, persistence and infrastructure clearly enough to evolve independently.

## System context

```text
Player / event operator
          |
          v
React + TypeScript web application
          |
          v
ASP.NET Core API
          |
          v
PostgreSQL + persistent upload storage
```

Docker Compose runs the web application, API and database as one reproducible event stack. Nginx serves the production frontend and forwards `/api` and uploaded images to the API.

## Design principles

### Server-owned game state

The browser renders state and sends player intent. The API remains authoritative for:

- current game and challenge;
- answer validation and game-specific rules;
- penalties, challenge deadlines and total elapsed time;
- progression and session completion;
- leaderboard results.

This prevents a player from changing a browser timer or inspecting a response payload to discover secret answers.

### Feature-oriented backend

Endpoints are grouped by feature under `Features/` rather than by technical layer. Session handlers are split by game family, while shared progression and timing helpers remain in the partial `SessionEndpoints` class. Administrative game validation lives separately from HTTP orchestration in `GameConfigurationValidator`.

Domain entities contain persisted state. Infrastructure owns Entity Framework configuration, database initialization and operational integrations. Endpoint code coordinates these pieces but does not define frontend presentation.

### Typed, data-driven frontend

The seven game types form a TypeScript union instead of unrestricted strings. Shared metadata such as route labels and administration terminology is held in one typed game catalog. Adding or renaming a game type therefore produces a compile-time error until its presentation metadata is complete.

Pages coordinate data fetching and state. Reusable components own focused presentation and interaction concerns, including matching, sorting, word assembly, Signalordet, pixel reveal and answer choices.

### Deliberate simplicity

The deployment target does not justify microservices, a message bus or separate databases. A modular monolith gives the project clear boundaries without adding operational failure points to an event computer. New abstractions are introduced when they remove duplicated rules or isolate a meaningful responsibility, not merely to create more files.

## Product boundaries

- The player experience runs without authentication in kiosk mode.
- The administration area uses secure cookie authentication, login throttling and anti-forgery protection.
- Data-protection keys, PostgreSQL data and uploaded images use persistent Docker volumes.
- Games and their content can be edited without rebuilding the application.
- Uploaded images are type- and size-validated before storage.
- Challenges are soft-deleted so historical attempts remain valid.
- Administrative content changes and lifecycle operations create audit entries.

## Game model

All games share a `Game`, ordered `Challenge` records and ordered `ChallengeOption` records. Game-specific meaning is expressed through the game type and the relevant option fields:

| Game | Player interaction | Server validation |
| --- | --- | --- |
| Quiz | Select one of four answers | Correct option |
| Risk & Safety | Match scenarios to risk zones | Complete one-to-one mapping |
| True or false | Select one statement value | Correct option |
| Pixel Hunt | Reveal an image and answer | Correct option plus reveal penalties |
| Sorting | Place cards in target areas | Category for each non-distractor card |
| Word assembly | Order word parts | Complete option order |
| Signalordet | Guess letters | Secret word and mistake limit |

This shared model keeps administration, ordering and progression consistent while dedicated handlers preserve the rules of each game.

## Request flow

1. The player starts a session and receives the current public challenge state.
2. The client submits an answer or game-specific action.
3. The API reloads the session, validates ownership and checks the server deadline.
4. A game-specific handler evaluates the action and records attempts or penalties.
5. Correct completion pauses progression until the player explicitly continues.
6. After the final active game, the API completes the session and exposes its verified time to the leaderboard.

## Quality gates

- TypeScript compilation catches contract and game-catalog drift.
- Oxlint checks frontend code quality.
- Vitest covers isolated frontend rules and shared metadata.
- xUnit integration tests exercise authentication, administration and full session flows against the API.
- GitHub Actions runs the same build, lint and test checks for every pushed change.

## Intentional next steps

The current architecture is suitable for the stated single-computer event deployment. Public deployment now has an explicit backup/restore runbook and file-based Docker secrets. Before using multiple event computers, add centralized observability and move secrets to the deployment provider's managed secret service when one is available.
