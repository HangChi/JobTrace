#!/usr/bin/env bash
set -Eeuo pipefail

sync_url="${JOBTRACE_SYNC_URL:-http://127.0.0.1:3000}"
sync_url="${sync_url%/}"
batch_size="${JOB_MARKET_SYNC_BATCH_SIZE:-10}"
max_batches="${JOBTRACE_SYNC_MAX_BATCHES:-30}"
lock_file="${JOBTRACE_SYNC_LOCK_FILE:-/run/jobtrace-sync/sync.lock}"

if [[ "${JOB_MARKET_ENABLED:-false}" != "true" ]]; then
  logger -t jobtrace-sync "synchronization skipped: JOB_MARKET_ENABLED is not true"
  exit 0
fi

if [[ -z "${JOB_MARKET_SYNC_SECRET:-}" ]]; then
  logger -t jobtrace-sync "synchronization failed: JOB_MARKET_SYNC_SECRET is missing"
  exit 1
fi

if ! [[ "$batch_size" =~ ^[0-9]+$ ]] || ((batch_size < 1 || batch_size > 10)); then
  logger -t jobtrace-sync "synchronization failed: batch size must be between 1 and 10"
  exit 1
fi

if ! [[ "$max_batches" =~ ^[0-9]+$ ]] || ((max_batches < 1 || max_batches > 30)); then
  logger -t jobtrace-sync "synchronization failed: max batches must be between 1 and 30"
  exit 1
fi

exec 9>"$lock_file"
if ! flock -n 9; then
  logger -t jobtrace-sync "synchronization skipped: another run is active"
  exit 0
fi

for ((batch = 1; batch <= max_batches; batch++)); do
  response="$({
    curl \
      --fail-with-body \
      --silent \
      --show-error \
      --retry 2 \
      --retry-all-errors \
      --connect-timeout 10 \
      --max-time 180 \
      --request POST \
      --header "Authorization: Bearer ${JOB_MARKET_SYNC_SECRET}" \
      --header "Content-Type: application/json" \
      --data "{\"limit\":${batch_size}}" \
      "${sync_url}/api/internal/job-market/sync"
  })"

  claimed="$(jq -er '.claimed | numbers' <<<"$response")"
  succeeded="$(jq -er '.succeeded | numbers' <<<"$response")"
  partial="$(jq -er '.partial | numbers' <<<"$response")"
  failed="$(jq -er '.failed | numbers' <<<"$response")"

  logger -t jobtrace-sync \
    "batch=${batch} claimed=${claimed} succeeded=${succeeded} partial=${partial} failed=${failed}"

  if ((claimed < batch_size)); then
    logger -t jobtrace-sync "due-source queue drained after ${batch} batch(es)"
    break
  fi
done
