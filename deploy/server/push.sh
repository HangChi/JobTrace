#!/usr/bin/env bash
set -Eeuo pipefail

if (($# != 1)); then
  echo "Usage: $0 <ssh-host>" >&2
  echo "Example: $0 deploy@example.com" >&2
  exit 1
fi

remote_host="$1"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "${script_dir}/../.." && pwd)"
env_file="${JOBTRACE_ENV_FILE:-${repo_root}/.env.server}"
remote_source="${JOBTRACE_REMOTE_SOURCE_DIR:-jobtrace-deploy-source}"

if ! [[ "$remote_source" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "JOBTRACE_REMOTE_SOURCE_DIR must be a simple directory name." >&2
  exit 1
fi
if [[ ! -f "$env_file" ]]; then
  echo "Missing server environment file: ${env_file}" >&2
  echo "Copy deploy/server/app.env.example to .env.server and fill it in first." >&2
  exit 1
fi

for command_name in ssh scp rsync; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required local command is missing: ${command_name}" >&2
    exit 1
  fi
done

echo "Uploading JobTrace to ${remote_host}:~/${remote_source}"
ssh "$remote_host" "mkdir -p '${remote_source}' && chmod 700 '${remote_source}'"
rsync \
  --archive \
  --compress \
  --delete \
  --exclude '.git/' \
  --exclude '.env*' \
  --exclude '.next*/' \
  --exclude 'node_modules/' \
  --exclude 'coverage/' \
  --exclude 'test-results/' \
  "${repo_root}/" \
  "${remote_host}:${remote_source}/"
scp -q "$env_file" "${remote_host}:${remote_source}/.env.server"

echo "Installing the release on ${remote_host}"
ssh -t "$remote_host" \
  "cd '${remote_source}' && chmod 600 .env.server && sudo env JOBTRACE_ENV_SOURCE=\"\$PWD/.env.server\" bash deploy/server/install.sh"
