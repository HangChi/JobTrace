#!/usr/bin/env bash
set -Eeuo pipefail

collect_url="${JOBTRACE_SYNC_URL:-http://127.0.0.1:3000}"
collect_url="${collect_url%/}"
lock_file="${JOBTRACE_COLLECT_LOCK_FILE:-/run/jobtrace-sync/collect.lock}"

if [[ "${JOB_MARKET_ENABLED:-false}" != "true" ]]; then
  logger -t jobtrace-collect "collection skipped: JOB_MARKET_ENABLED is not true"
  exit 0
fi

if [[ -z "${JOB_MARKET_SYNC_SECRET:-}" ]]; then
  logger -t jobtrace-collect "collection failed: JOB_MARKET_SYNC_SECRET is missing"
  exit 1
fi

exec 9>"$lock_file"
if ! flock -n 9; then
  logger -t jobtrace-collect "collection skipped: another run is active"
  exit 0
fi

response="$({
  curl \
    --fail-with-body \
    --silent \
    --show-error \
    --retry 2 \
    --retry-all-errors \
    --connect-timeout 10 \
    --max-time 300 \
    --request POST \
    --header "Authorization: Bearer ${JOB_MARKET_SYNC_SECRET}" \
    --header "Content-Type: application/json" \
    --data '{}' \
    "${collect_url}/api/internal/job-market/collect-wechat"
})"

extracted="$(jq -er '.extracted | numbers' <<<"$response")"
queued="$(jq -er '.queued | numbers' <<<"$response")"
pending="$(jq -er '.candidates | numbers' <<<"$response")"
engines="$(jq -cr '[.engines[] | (.engine + ":" + .status)] | join(",")' <<<"$response")"

logger -t jobtrace-collect \
  "extracted=${extracted} queued=${queued} pending=${pending} engines=${engines:-none}"
