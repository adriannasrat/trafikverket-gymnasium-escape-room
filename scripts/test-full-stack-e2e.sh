#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
compose_file="$project_root/docker-compose.e2e.yml"
test_port="${E2E_PORT:-18090}"
project_name="escape-room-e2e-$$"
base_url="http://127.0.0.1:$test_port"
compose=(docker compose --project-name "$project_name" --file "$compose_file")
export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-e2e-admin-$project_name-password}"
export E2E_DATABASE_PASSWORD="${E2E_DATABASE_PASSWORD:-e2e-database-$project_name-password}"

fail() {
    printf 'Full-stack E2E test failed: %s\n' "$1" >&2
    exit 1
}

command -v docker >/dev/null 2>&1 || fail "required command 'docker' was not found"
command -v curl >/dev/null 2>&1 || fail "required command 'curl' was not found"
[[ "$test_port" =~ ^[0-9]+$ ]] || fail "E2E_PORT must be numeric"
if curl --silent --output /dev/null --connect-timeout 1 "$base_url"; then
    fail "port $test_port is already in use"
fi

cleanup() {
    E2E_PORT="$test_port" "${compose[@]}" down --volumes --remove-orphans --rmi local >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

printf 'Starting isolated full-stack E2E environment on %s...\n' "$base_url"
E2E_PORT="$test_port" "${compose[@]}" up --build --detach --wait

if ! (
    cd "$project_root/apps/web"
    E2E_BASE_URL="$base_url" \
    E2E_ADMIN_USERNAME="e2e-admin" \
    npm run test:e2e:full-stack
); then
    printf '\nContainer logs from the failed E2E run:\n' >&2
    "${compose[@]}" logs --no-color >&2 || true
    exit 1
fi

printf 'Full-stack E2E journey passed; isolated containers and data will now be removed.\n'

