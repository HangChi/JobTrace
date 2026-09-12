#!/usr/bin/env bash
set -Eeuo pipefail

research_url="${JOBTRACE_SYNC_URL:-http://127.0.0.1:3000}"
research_url="${research_url%/}"
lock_file="${JOBTRACE_RESEARCH_LOCK_FILE:-/run/jobtrace-sync/research.lock}"

if [[ "${JOB_MARKET_ENABLED:-false}" != "true" ]]; then
  logger -t jobtrace-research "research skipped: JOB_MARKET_ENABLED is not true"
  exit 0
fi

if [[ -z "${JOB_MARKET_SYNC_SECRET:-}" ]]; then
  logger -t jobtrace-research "research failed: JOB_MARKET_SYNC_SECRET is missing"
  exit 1
fi

exec 9>"$lock_file"
if ! flock -n 9; then
  logger -t jobtrace-research "research skipped: another run is active"
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
    --max-time 600 \
    --request POST \
    --header "Authorization: Bearer ${JOB_MARKET_SYNC_SECRET}" \
    --header "Content-Type: application/json" \
    --data '{"limit":10}' \
    "${research_url}/api/internal/job-market/research-companies"
})"

researched="$(jq -er '.researched | numbers' <<<"$response")"
detected="$(jq -er '.detected | numbers' <<<"$response")"
unrecognized="$(jq -er '.unrecognized | numbers' <<<"$response")"
failed="$(jq -er '.failed | numbers' <<<"$response")"

logger -t jobtrace-research \
  "researched=${researched} detected=${detected} unrecognized=${unrecognized} failed=${failed}"
