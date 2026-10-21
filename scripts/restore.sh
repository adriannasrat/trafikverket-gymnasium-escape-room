#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
compose_file="$project_root/docker-compose.yml"
env_file="$project_root/.env"
backup_dir=""
project_name=""
confirmed=false
archive_image="alpine:3.21"

usage() {
    cat <<'EOF'
Usage: ./scripts/restore.sh --backup PATH --project-name NAME --yes [options]

Restoration replaces all data in the selected target project. Use a unique
project name for a test restore.

Options:
  --backup PATH        Backup directory created by backup.sh
  --project-name NAME  Exact target Compose project (required)
  --compose-file PATH  Target Compose file (default: docker-compose.yml)
  --env-file PATH      Target environment file (default: .env)
  --yes                Confirm destructive replacement of the target data
  --help               Show this help
EOF
}

absolute_path() {
    case "$1" in
        /*) printf '%s\n' "$1" ;;
        *) printf '%s/%s\n' "$project_root" "$1" ;;
    esac
}

fail() {
    printf 'Restore failed: %s\n' "$1" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "required command '$1' was not found"
}

sha256() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    else
        shasum -a 256 "$1" | awk '{print $1}'
    fi
}

volume_file_count() {
    docker run --rm \
        --mount "type=volume,src=$1,dst=/source,readonly" \
        "$archive_image" sh -eu -c 'find /source -type f | wc -l' | tr -d '[:space:]'
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --backup)
            [[ $# -ge 2 ]] || fail "--backup requires a value"
            backup_dir="$(absolute_path "$2")"
            shift 2
            ;;
        --project-name)
            [[ $# -ge 2 ]] || fail "--project-name requires a value"
            project_name="$2"
            shift 2
            ;;
        --compose-file)
            [[ $# -ge 2 ]] || fail "--compose-file requires a value"
            compose_file="$(absolute_path "$2")"
            shift 2
            ;;
        --env-file)
            [[ $# -ge 2 ]] || fail "--env-file requires a value"
            env_file="$(absolute_path "$2")"
            shift 2
            ;;
        --yes)
            confirmed=true
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            fail "unknown option '$1'"
            ;;
    esac
done

require_command docker
require_command jq
require_command awk
[[ -n "$backup_dir" ]] || fail "--backup is required"
[[ -n "$project_name" ]] || fail "--project-name is required"
[[ "$project_name" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]+$ ]] || fail "invalid project name"
[[ "$confirmed" == "true" ]] || fail "--yes is required because restoration replaces target data"
[[ -f "$compose_file" ]] || fail "Compose file not found: $compose_file"
[[ -f "$env_file" ]] || fail "environment file not found: $env_file"
[[ -d "$backup_dir" ]] || fail "backup directory not found: $backup_dir"

for required_file in database.dump uploads.tar.gz data-protection-keys.tar.gz manifest.json SHA256SUMS; do
    [[ -f "$backup_dir/$required_file" ]] || fail "backup is missing $required_file"
done
[[ "$(jq -r '.formatVersion' "$backup_dir/manifest.json")" == "1" ]] ||
    fail "unsupported backup format"

while read -r expected_hash backup_file; do
    [[ -n "$expected_hash" && -n "$backup_file" ]] || fail "invalid checksum file"
    [[ "$(sha256 "$backup_dir/$backup_file")" == "$expected_hash" ]] ||
        fail "checksum mismatch for $backup_file"
done < "$backup_dir/SHA256SUMS"

compose=(docker compose --project-name "$project_name" --env-file "$env_file" --file "$compose_file")
docker image inspect "$archive_image" >/dev/null 2>&1 || docker pull "$archive_image" >/dev/null

printf 'Stopping the target application before replacing its data...\n'
"${compose[@]}" stop app >/dev/null 2>&1 || true
if "${compose[@]}" config --services | grep -qx web; then
    "${compose[@]}" stop web >/dev/null 2>&1 || true
fi

"${compose[@]}" up -d db >/dev/null
database_ready=false
for _ in $(seq 1 60); do
    # The variables below are intentionally expanded inside the database container.
    # shellcheck disable=SC2016
    if "${compose[@]}" exec -T db sh -eu -c \
        'pg_isready --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' >/dev/null 2>&1; then
        database_ready=true
        break
    fi
    sleep 1
done
[[ "$database_ready" == "true" ]] || fail "the target database did not become ready"

"${compose[@]}" create app >/dev/null
app_container="$("${compose[@]}" ps -aq app)"
[[ -n "$app_container" ]] || fail "the target app container could not be created"
upload_volume="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}' "$app_container")"
keys_volume="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/data-protection-keys"}}{{.Name}}{{end}}{{end}}' "$app_container")"
[[ -n "$upload_volume" ]] || fail "the target uploads volume could not be resolved"
[[ -n "$keys_volume" ]] || fail "the target data-protection volume could not be resolved"

# shellcheck disable=SC2016
"${compose[@]}" exec -T db sh -eu -c \
    'dropdb --username="$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb --username="$POSTGRES_USER" "$POSTGRES_DB" && pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --exit-on-error --no-owner --no-acl' \
    < "$backup_dir/database.dump"

docker run --rm \
    --mount "type=volume,src=$upload_volume,dst=/target" \
    --mount "type=bind,src=$backup_dir,dst=/backup,readonly" \
    "$archive_image" sh -eu -c \
    'find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -xzf /backup/uploads.tar.gz -C /target'
docker run --rm \
    --mount "type=volume,src=$keys_volume,dst=/target" \
    --mount "type=bind,src=$backup_dir,dst=/backup,readonly" \
    "$archive_image" sh -eu -c \
    'find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -xzf /backup/data-protection-keys.tar.gz -C /target'

expected_upload_files="$(jq -r '.volumes.uploadFiles' "$backup_dir/manifest.json")"
expected_key_files="$(jq -r '.volumes.dataProtectionKeyFiles' "$backup_dir/manifest.json")"
[[ "$(volume_file_count "$upload_volume")" == "$expected_upload_files" ]] ||
    fail "the restored uploads volume has an unexpected file count"
[[ "$(volume_file_count "$keys_volume")" == "$expected_key_files" ]] ||
    fail "the restored data-protection volume has an unexpected file count"

# shellcheck disable=SC2016
restored_counts="$("${compose[@]}" exec -T db sh -eu -c \
    'psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --tuples-only --no-align --field-separator="|" --command="SELECT (SELECT COUNT(*) FROM \"AdminUsers\"), (SELECT COUNT(*) FROM \"GameSessions\"), (SELECT COUNT(*) FROM \"GameSessions\" WHERE \"Status\" = 1), (SELECT COUNT(*) FROM \"Challenges\" WHERE \"ImagePath\" LIKE '\''/uploads/%'\'');"')"
expected_counts="$(jq -r '[.database.administrators, .database.sessions, .database.completedSessions, .database.uploadedImageReferences] | join("|")' "$backup_dir/manifest.json")"
[[ "$restored_counts" == "$expected_counts" ]] ||
    fail "the restored database counts do not match the backup manifest"

"${compose[@]}" up -d app >/dev/null
app_healthy=false
for _ in $(seq 1 90); do
    app_container="$("${compose[@]}" ps -q app)"
    app_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$app_container" 2>/dev/null || true)"
    if [[ "$app_status" == "healthy" || "$app_status" == "running" ]]; then
        app_healthy=true
        break
    fi
    [[ "$app_status" != "unhealthy" ]] || fail "the restored application became unhealthy"
    sleep 1
done
[[ "$app_healthy" == "true" ]] || fail "the restored application did not become healthy"

printf 'Restore completed for isolated target project: %s\n' "$project_name"
printf 'Run verify-restore.sh against its URL before using this restored environment.\n'
