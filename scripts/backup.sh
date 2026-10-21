#!/usr/bin/env bash

set -Eeuo pipefail

umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
compose_file="$project_root/docker-compose.yml"
env_file="$project_root/.env"
output_dir="$project_root/backups"
project_name=""
archive_image="alpine:3.21"

usage() {
    cat <<'EOF'
Usage: ./scripts/backup.sh [options]

Options:
  --compose-file PATH  Compose file to back up (default: docker-compose.yml)
  --env-file PATH      Environment file (default: .env)
  --output PATH        Backup parent directory (default: backups)
  --project-name NAME  Optional Compose project override
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
    printf 'Backup failed: %s\n' "$1" >&2
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

while [[ $# -gt 0 ]]; do
    case "$1" in
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
        --output)
            [[ $# -ge 2 ]] || fail "--output requires a value"
            output_dir="$(absolute_path "$2")"
            shift 2
            ;;
        --project-name)
            [[ $# -ge 2 ]] || fail "--project-name requires a value"
            project_name="$2"
            shift 2
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
require_command awk
[[ -f "$compose_file" ]] || fail "Compose file not found: $compose_file"
[[ -f "$env_file" ]] || fail "environment file not found: $env_file"

compose=(docker compose --env-file "$env_file" --file "$compose_file")
if [[ -n "$project_name" ]]; then
    compose=(docker compose --project-name "$project_name" --env-file "$env_file" --file "$compose_file")
fi

app_container="$("${compose[@]}" ps -q app)"
db_container="$("${compose[@]}" ps -q db)"
[[ -n "$app_container" ]] || fail "the app service is not running"
[[ -n "$db_container" ]] || fail "the database service is not running"
[[ "$(docker inspect --format '{{.State.Running}}' "$app_container")" == "true" ]] ||
    fail "the app service is not running"
[[ "$(docker inspect --format '{{.State.Running}}' "$db_container")" == "true" ]] ||
    fail "the database service is not running"
[[ "$(docker inspect --format '{{.State.Paused}}' "$app_container")" == "false" ]] ||
    fail "the app service is already paused"

upload_volume="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}' "$app_container")"
keys_volume="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/data-protection-keys"}}{{.Name}}{{end}}{{end}}' "$app_container")"
[[ -n "$upload_volume" ]] || fail "the uploads volume could not be resolved"
[[ -n "$keys_volume" ]] || fail "the data-protection volume could not be resolved"

docker image inspect "$archive_image" >/dev/null 2>&1 || docker pull "$archive_image" >/dev/null

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$output_dir"
final_dir="$output_dir/$timestamp"
temporary_dir="$output_dir/.${timestamp}.incomplete.$$"
[[ ! -e "$final_dir" ]] || fail "a backup already exists for timestamp $timestamp"
mkdir "$temporary_dir"

app_paused=false
backup_complete=false
cleanup() {
    if [[ "$app_paused" == "true" ]]; then
        "${compose[@]}" unpause app >/dev/null 2>&1 || true
    fi
    if [[ "$backup_complete" != "true" && -d "$temporary_dir" ]]; then
        rm -rf -- "$temporary_dir"
    fi
}
trap cleanup EXIT INT TERM

printf 'Pausing writes briefly while the backup snapshot is created...\n'
"${compose[@]}" pause app >/dev/null
app_paused=true

# The variables below are intentionally expanded inside the database container.
# shellcheck disable=SC2016
"${compose[@]}" exec -T db sh -eu -c \
    'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --no-owner --no-acl' \
    > "$temporary_dir/database.dump"

# shellcheck disable=SC2016
database_counts="$("${compose[@]}" exec -T db sh -eu -c \
    'psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --tuples-only --no-align --field-separator="|" --command="SELECT (SELECT COUNT(*) FROM \"AdminUsers\"), (SELECT COUNT(*) FROM \"GameSessions\"), (SELECT COUNT(*) FROM \"GameSessions\" WHERE \"Status\" = 1), (SELECT COUNT(*) FROM \"Challenges\" WHERE \"ImagePath\" LIKE '\''/uploads/%'\'');"')"
IFS='|' read -r admin_count session_count completed_session_count uploaded_image_reference_count <<< "$database_counts"

upload_file_count="$(docker run --rm \
    --mount "type=volume,src=$upload_volume,dst=/source,readonly" \
    "$archive_image" sh -eu -c 'find /source -type f | wc -l' | tr -d '[:space:]')"
key_file_count="$(docker run --rm \
    --mount "type=volume,src=$keys_volume,dst=/source,readonly" \
    "$archive_image" sh -eu -c 'find /source -type f | wc -l' | tr -d '[:space:]')"

docker run --rm \
    --mount "type=volume,src=$upload_volume,dst=/source,readonly" \
    --mount "type=bind,src=$temporary_dir,dst=/backup" \
    "$archive_image" tar -czf /backup/uploads.tar.gz -C /source .
docker run --rm \
    --mount "type=volume,src=$keys_volume,dst=/source,readonly" \
    --mount "type=bind,src=$temporary_dir,dst=/backup" \
    "$archive_image" tar -czf /backup/data-protection-keys.tar.gz -C /source .

"${compose[@]}" unpause app >/dev/null
app_paused=false

"${compose[@]}" exec -T db pg_restore --list < "$temporary_dir/database.dump" >/dev/null
gzip -t "$temporary_dir/uploads.tar.gz"
gzip -t "$temporary_dir/data-protection-keys.tar.gz"

cat > "$temporary_dir/manifest.json" <<EOF
{
  "formatVersion": 1,
  "createdAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database": {
    "administrators": $admin_count,
    "sessions": $session_count,
    "completedSessions": $completed_session_count,
    "uploadedImageReferences": $uploaded_image_reference_count
  },
  "volumes": {
    "uploadFiles": $upload_file_count,
    "dataProtectionKeyFiles": $key_file_count
  }
}
EOF

for backup_file in database.dump uploads.tar.gz data-protection-keys.tar.gz manifest.json; do
    printf '%s  %s\n' "$(sha256 "$temporary_dir/$backup_file")" "$backup_file" \
        >> "$temporary_dir/SHA256SUMS"
done

mv "$temporary_dir" "$final_dir"
backup_complete=true
trap - EXIT INT TERM

printf 'Backup created and validated: %s\n' "$final_dir"
