#!/usr/bin/env bash

set -Eeuo pipefail

umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
compose_file="$project_root/docker-compose.yml"
env_file="$project_root/.env"
backup_dir=""
project_name=""
base_url=""

usage() {
    cat <<'EOF'
Usage: ./scripts/verify-restore.sh --backup PATH --project-name NAME --url URL [options]

Options:
  --backup PATH        Backup directory used for the restore
  --project-name NAME  Restored Compose project
  --url URL            Restored application base URL
  --compose-file PATH  Compose file (default: docker-compose.yml)
  --env-file PATH      Environment file (default: .env)
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
    printf 'Verification failed: %s\n' "$1" >&2
    exit 1
}

container_environment_value() {
    docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$1" |
        awk -v requested_key="$2" 'index($0, requested_key "=") == 1 { print substr($0, length(requested_key) + 2); exit }'
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
        --url)
            [[ $# -ge 2 ]] || fail "--url requires a value"
            base_url="${2%/}"
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
        --help)
            usage
            exit 0
            ;;
        *)
            fail "unknown option '$1'"
            ;;
    esac
done

command -v docker >/dev/null 2>&1 || fail "required command 'docker' was not found"
command -v curl >/dev/null 2>&1 || fail "required command 'curl' was not found"
command -v jq >/dev/null 2>&1 || fail "required command 'jq' was not found"
[[ -n "$backup_dir" && -f "$backup_dir/manifest.json" ]] || fail "a valid --backup is required"
[[ -n "$project_name" ]] || fail "--project-name is required"
[[ -n "$base_url" ]] || fail "--url is required"
[[ -f "$compose_file" ]] || fail "Compose file not found: $compose_file"
[[ -f "$env_file" ]] || fail "environment file not found: $env_file"

compose=(docker compose --project-name "$project_name" --env-file "$env_file" --file "$compose_file")
app_container="$("${compose[@]}" ps -q app)"
[[ -n "$app_container" ]] || fail "the restored app service is not running"

admin_username="$(container_environment_value "$app_container" 'Admin__Username')"
admin_password="$(container_environment_value "$app_container" 'Admin__Password')"
if [[ -z "$admin_password" ]]; then
    password_file="$(container_environment_value "$app_container" 'Secrets__AdminPasswordFile')"
    [[ -n "$password_file" ]] || fail "administrator credentials could not be resolved"
    admin_password="$("${compose[@]}" exec -T app cat "$password_file")"
fi
[[ -n "$admin_username" && -n "$admin_password" ]] ||
    fail "administrator credentials could not be resolved"

temporary_dir="$(mktemp -d "${TMPDIR:-/tmp}/escape-room-restore-verification.XXXXXX")"
cleanup() {
    rm -rf -- "$temporary_dir"
}
trap cleanup EXIT INT TERM

curl --silent --show-error --fail "$base_url/health/ready" >/dev/null
csrf_response="$(curl --silent --show-error --fail \
    --cookie-jar "$temporary_dir/cookies" \
    "$base_url/api/auth/csrf")"
csrf_token="$(printf '%s' "$csrf_response" | jq -er '.token')"
login_payload="$(jq -nc --arg username "$admin_username" --arg password "$admin_password" \
    '{username: $username, password: $password}')"
login_status="$(curl --silent --show-error \
    --output "$temporary_dir/login-response.json" \
    --write-out '%{http_code}' \
    --cookie "$temporary_dir/cookies" \
    --cookie-jar "$temporary_dir/cookies" \
    --header 'Content-Type: application/json' \
    --header "X-CSRF-TOKEN: $csrf_token" \
    --data "$login_payload" \
    "$base_url/api/auth/login")"
[[ "$login_status" == "200" ]] || fail "administrator login returned HTTP $login_status"

auth_status="$(curl --silent --show-error --fail \
    --cookie "$temporary_dir/cookies" \
    "$base_url/api/auth/me")"
[[ "$(printf '%s' "$auth_status" | jq -r '.authenticated')" == "true" ]] ||
    fail "the restored administrator session was not accepted"

games_json="$(curl --silent --show-error --fail \
    --cookie "$temporary_dir/cookies" \
    "$base_url/api/admin/games")"
results_json="$(curl --silent --show-error --fail \
    --cookie "$temporary_dir/cookies" \
    "$base_url/api/admin/results")"

expected_results="$(jq -r '.database.completedSessions' "$backup_dir/manifest.json")"
actual_results="$(printf '%s' "$results_json" | jq 'length')"
[[ "$actual_results" == "$expected_results" ]] ||
    fail "the API returned $actual_results completed results; expected $expected_results"

image_path="$(printf '%s' "$games_json" |
    jq -r '[.[].challenges[].imagePath | select(. != null and . != "")][0] // empty')"
if [[ -n "$image_path" ]]; then
    curl --silent --show-error --fail "$base_url$image_path" >/dev/null
else
    expected_image_references="$(jq -r '.database.uploadedImageReferences' "$backup_dir/manifest.json")"
    [[ "$expected_image_references" == "0" ]] ||
        fail "the restored database references images but none were returned by the API"
    printf 'No challenge image was present in this source backup; volume integrity was verified separately.\n'
fi

printf 'Restore verification passed: login, images and %s completed result(s).\n' "$actual_results"
