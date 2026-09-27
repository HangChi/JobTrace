#!/usr/bin/env bash
set -Eeuo pipefail

reminder_url="${JOBTRACE_REMINDER_URL:-http://127.0.0.1:3000}"
reminder_url="${reminder_url%/}"
batch_size="${REMINDER_DELIVERY_BATCH_SIZE:-50}"
lock_file="${JOBTRACE_REMINDER_LOCK_FILE:-/run/jobtrace-reminders/delivery.lock}"

if [[ -z "${REMINDER_DELIVERY_SECRET:-}" ]]; then
  logger -t jobtrace-reminders "delivery failed: REMINDER_DELIVERY_SECRET is missing"
  exit 1
fi
if ! [[ "$batch_size" =~ ^[0-9]+$ ]] || ((batch_size < 1 || batch_size > 100)); then
  logger -t jobtrace-reminders "delivery failed: batch size must be between 1 and 100"
  exit 1
fi

exec 9>"$lock_file"
if ! flock -n 9; then
  logger -t jobtrace-reminders "delivery skipped: another run is active"
  exit 0
fi

response="$({
  curl --fail-with-body --silent --show-error \
    --retry 2 --retry-all-errors --connect-timeout 5 --max-time 45 \
    --request POST \
    --header "Authorization: Bearer ${REMINDER_DELIVERY_SECRET}" \
    --header "Content-Type: application/json" \
    --data "{\"limit\":${batch_size}}" \
    "${reminder_url}/api/internal/reminders/deliver"
})"

claimed="$(jq -er '.claimed | numbers' <<<"$response")"
sent="$(jq -er '.sent | numbers' <<<"$response")"
failed="$(jq -er '.failed | numbers' <<<"$response")"
skipped="$(jq -er '.skipped | numbers' <<<"$response")"
logger -t jobtrace-reminders \
  "claimed=${claimed} sent=${sent} failed=${failed} skipped=${skipped}"
