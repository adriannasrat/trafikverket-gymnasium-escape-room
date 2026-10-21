# Backup and restore runbook

The escape room stores recoverable application state in three Docker volumes:

- PostgreSQL contains game configuration, administrator password hashes and results.
- The uploads volume contains administrator-uploaded challenge images.
- The data-protection volume contains the keys used to protect authentication and
  antiforgery cookies.

The public proxy's certificate cache is not part of the application backup. Caddy
can obtain a new certificate from the configured domain. Production password files
also stay outside the backup; keep them in a password manager or another protected
secret store and never commit them.

## How consistency is preserved

`backup.sh` checks that the application and database are running, downloads the
small archive helper image before the backup window, and then pauses the application
container briefly. While writes are paused it:

1. creates a PostgreSQL custom-format dump with `pg_dump`,
2. archives uploaded images,
3. archives data-protection keys,
4. records non-sensitive row and file counts.

The database remains running. `pg_dump` produces a transactionally consistent
snapshot, while pausing the only application writer ensures that the database and
the two file volumes represent the same application moment. A trap always unpauses
the application if a command fails.

Before publishing the backup directory, the script validates the database archive
with `pg_restore --list`, tests both compressed archives and writes SHA-256 checksums.
An incomplete run is removed instead of being mistaken for a valid backup.

## Prerequisites

- Docker Engine with Docker Compose
- Bash, `curl`, `jq`, `awk`, `gzip` and either `sha256sum` or `shasum`
- enough free disk space for the database and both file volumes

Run all commands from the repository root.

## Create a local backup

The local stack must already be running:

```sh
./scripts/backup.sh
```

Backups are written to `backups/<UTC timestamp>/`. The `backups/` directory is
ignored by Git.

To choose another destination:

```sh
./scripts/backup.sh --output /safe/path/escape-room-backups
```

## Create a production backup

```sh
./scripts/backup.sh \
  --compose-file docker-compose.production.yml \
  --env-file .env.production \
  --output /safe/path/escape-room-backups
```

Each completed directory contains:

```text
database.dump
uploads.tar.gz
data-protection-keys.tar.gz
manifest.json
SHA256SUMS
```

Backups contain player names, administrator password hashes and authentication
keys. Store them with restricted access and use encrypted storage when copying them
off the server. A backup kept only on the same VPS is not sufficient disaster
recovery.

## Automated isolated restore test

The safest routine check uses the local stack as its source:

```sh
./scripts/test-restore.sh
```

It performs a real backup, builds a separate Compose project, restores all three
data stores, starts the restored application on `127.0.0.1:18089`, and verifies:

- database and volume counts against the manifest,
- database readiness and application health,
- administrator login and authenticated cookies,
- challenge image delivery when the source contains an image,
- completed results through the administration API.

The original application is only paused during the short snapshot. The test uses
different containers and volumes and removes only that isolated project when done.
Set `RESTORE_TEST_PORT` if port 18089 is occupied.

## Restore to a separate environment manually

Build or pull the target application image first. The following example restores a
local backup to a new project named `escape-room-recovery-check`:

```sh
docker compose \
  --project-name escape-room-recovery-check \
  --env-file .env \
  --file docker-compose.yml \
  build app

APP_PORT=18089 ./scripts/restore.sh \
  --backup backups/20261021T120000Z \
  --project-name escape-room-recovery-check \
  --env-file .env \
  --compose-file docker-compose.yml \
  --yes

APP_PORT=18089 ./scripts/verify-restore.sh \
  --backup backups/20261021T120000Z \
  --project-name escape-room-recovery-check \
  --env-file .env \
  --compose-file docker-compose.yml \
  --url http://127.0.0.1:18089
```

When verification is complete, remove only the explicitly named test project:

```sh
APP_PORT=18089 docker compose \
  --project-name escape-room-recovery-check \
  --env-file .env \
  --file docker-compose.yml \
  down --volumes
```

## Restore the production environment

`restore.sh` replaces the database, uploads and data-protection keys in the target
project. Confirm the backup path and project name before using `--yes`.

```sh
docker compose \
  --project-name trafikverket-escape-room \
  --env-file .env.production \
  --file docker-compose.production.yml \
  build app

./scripts/restore.sh \
  --backup /safe/path/escape-room-backups/20261021T120000Z \
  --project-name trafikverket-escape-room \
  --env-file .env.production \
  --compose-file docker-compose.production.yml \
  --yes

docker compose \
  --project-name trafikverket-escape-room \
  --env-file .env.production \
  --file docker-compose.production.yml \
  up -d web

./scripts/verify-restore.sh \
  --backup /safe/path/escape-room-backups/20261021T120000Z \
  --project-name trafikverket-escape-room \
  --env-file .env.production \
  --compose-file docker-compose.production.yml \
  --url https://your-domain.example
```

The configured administrator credentials are authoritative when the restored app
starts. Preserve the production credential files, or intentionally configure new
strong credentials before recovery.
