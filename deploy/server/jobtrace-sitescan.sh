#!/usr/bin/env bash
set -Eeuo pipefail

scan_url="${JOBTRACE_SYNC_URL:-http://127.0.0.1:3000}"
scan_url="${scan_url%/}"
lock_file="${JOBTRACE_SITESCAN_LOCK_FILE:-/run/jobtrace-sync/sitescan.lock}"

if [[ "${JOB_MARKET_ENABLED:-false}" != "true" ]]; then
  logger -t jobtrace-sitescan "scan skipped: JOB_MARKET_ENABLED is not true"
  exit 0
fi

if [[ -z "${JOB_MARKET_SYNC_SECRET:-}" ]]; then
  logger -t jobtrace-sitescan "scan failed: JOB_MARKET_SYNC_SECRET is missing"
  exit 1
fi

exec 9>"$lock_file"
if ! flock -n 9; then
  logger -t jobtrace-sitescan "scan skipped: another run is active"
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
    "${scan_url}/api/internal/job-market/scan-ats-boards"
})"

hits="$(jq -er '.hits | numbers' <<<"$response")"
queued="$(jq -er '.queued | numbers' <<<"$response")"
known="$(jq -er '.knownCompanies | numbers' <<<"$response")"

logger -t jobtrace-sitescan "hits=${hits} queued=${queued} known=${known}"
