# Architecture

The application is a modular monolith designed primarily for a single event computer, with a separate hardened configuration for a public demo. It keeps deployment simple while separating player flow, administration, game rules, persistence and infrastructure clearly enough to evolve independently.

## System context

```text
Player / event operator
          |
          v
React + TypeScript web application
          |
          v
ASP.NET Core application and game engine
          |
          +-- PostgreSQL
          +-- persistent upload storage
          +-- persistent data-protection keys
```

The runtime image contains both the compiled React application and the ASP.NET Core API. Local Docker Compose exposes that application on a loopback-only port and keeps PostgreSQL internal. The public Compose configuration adds Caddy as the only internet-facing service; it terminates HTTPS and forwards traffic to the application over a private Docker network.

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

Endpoints are grouped by feature under `Features/` rather than by technical
layer. Thin session HTTP handlers are split by game family into partial endpoint
modules. Session lifecycle, progression, response shaping and time calculations
live in `SessionService`, `SessionProgressService`,
`CurrentChallengeResponseBuilder` and `SessionTimeCalculator`. Administrative
game validation lives separately from HTTP orchestration in
`GameConfigurationValidator`.

Domain entities contain persisted state. Infrastructure owns Entity Framework configuration, database initialization and operational integrations. Endpoint code coordinates these pieces but does not define frontend presentation.

### Typed, data-driven frontend

The seven game types form a TypeScript union instead of unrestricted strings. Shared metadata such as route labels and administration terminology is held in one typed game catalog. Adding or renaming a game type therefore produces a compile-time error until its presentation metadata is complete.

Pages coordinate focused feature hooks rather than individual game rules. A
typed gameplay registry selects an independent component for each game type,
while the administration uses its own registry for type-specific editors.
Reusable hooks own session loading, timing, timeout, retry and navigation.

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
- Playwright covers every player interaction, network recovery, responsive layouts and an isolated full-stack journey.
- Recovery tooling verifies restored database rows, images and authentication keys in an isolated environment.
- GitHub Actions runs the same build, lint and test checks for every pushed change.

## Intentional next steps

The current architecture is suitable for the stated single-computer event
deployment and a restricted public demo. Before a public launch, complete the
manual rehearsal and verify the chosen host, domain, HTTPS and recovery process.
Before using multiple event computers, add centralized observability and move
secrets to the deployment provider's managed secret service when one is
available.
