#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
compose_file="$project_root/docker-compose.yml"
env_file="$project_root/.env"
source_project_name=""
test_port="${RESTORE_TEST_PORT:-18089}"
test_project_name="escape-room-restore-test-$$"

usage() {
    cat <<'EOF'
Usage: ./scripts/test-restore.sh [options]

Creates a temporary backup of the running local stack, restores it to a new
Compose project, verifies it through the HTTP API and removes the test project.

Options:
  --compose-file PATH         Source/target Compose file (default: docker-compose.yml)
  --env-file PATH             Environment file (default: .env)
  --source-project-name NAME  Optional source Compose project override
  --port PORT                 Temporary restored app port (default: 18089)
  --help                      Show this help
EOF
}

absolute_path() {
    case "$1" in
        /*) printf '%s\n' "$1" ;;
        *) printf '%s/%s\n' "$project_root" "$1" ;;
    esac
}

fail() {
    printf 'Restore test failed: %s\n' "$1" >&2
    exit 1
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
        --source-project-name)
            [[ $# -ge 2 ]] || fail "--source-project-name requires a value"
            source_project_name="$2"
            shift 2
            ;;
        --port)
            [[ $# -ge 2 ]] || fail "--port requires a value"
            test_port="$2"
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

[[ "$test_port" =~ ^[0-9]+$ ]] || fail "--port must be numeric"
[[ -f "$compose_file" ]] || fail "Compose file not found: $compose_file"
[[ -f "$env_file" ]] || fail "environment file not found: $env_file"
if curl --silent --output /dev/null --connect-timeout 1 "http://127.0.0.1:$test_port"; then
    fail "port $test_port is already in use"
fi

temporary_dir="$(mktemp -d "${TMPDIR:-/tmp}/escape-room-restore-test.XXXXXX")"
test_compose=(docker compose --project-name "$test_project_name" --env-file "$env_file" --file "$compose_file")
cleanup() {
    APP_PORT="$test_port" "${test_compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
    rm -rf -- "$temporary_dir"
}
trap cleanup EXIT INT TERM

backup_arguments=(
    --compose-file "$compose_file"
    --env-file "$env_file"
    --output "$temporary_dir/backups"
)
if [[ -n "$source_project_name" ]]; then
    backup_arguments+=(--project-name "$source_project_name")
fi
"$script_dir/backup.sh" "${backup_arguments[@]}"

backup_directories=("$temporary_dir"/backups/*)
[[ ${#backup_directories[@]} -eq 1 ]] || fail "the temporary backup could not be resolved"
backup_dir="${backup_directories[0]}"

printf 'Building the isolated restore target...\n'
APP_PORT="$test_port" "${test_compose[@]}" build app >/dev/null
APP_PORT="$test_port" "$script_dir/restore.sh" \
    --backup "$backup_dir" \
    --project-name "$test_project_name" \
    --compose-file "$compose_file" \
    --env-file "$env_file" \
    --yes
APP_PORT="$test_port" "$script_dir/verify-restore.sh" \
    --backup "$backup_dir" \
    --project-name "$test_project_name" \
    --compose-file "$compose_file" \
    --env-file "$env_file" \
    --url "http://127.0.0.1:$test_port"

printf 'Isolated restore test passed; the temporary containers and volumes will now be removed.\n'
