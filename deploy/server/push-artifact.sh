#!/usr/bin/env bash
set -Eeuo pipefail

if (($# != 1)); then
  echo "Usage: $0 <ssh-host>" >&2
  echo "Example: JOBTRACE_SSH_PORT=2002 $0 ubuntu@example.com" >&2
  exit 1
fi

remote_host="$1"
ssh_port="${JOBTRACE_SSH_PORT:-22}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "${script_dir}/../.." && pwd)"
env_file="${JOBTRACE_ENV_FILE:-${repo_root}/.env.server}"
artifact_file="${JOBTRACE_ARTIFACT_FILE:-${repo_root}/jobtrace-release-linux-amd64.tar.gz}"
remote_source="${JOBTRACE_REMOTE_SOURCE_DIR:-jobtrace-deploy-source}"
remote_artifact="${remote_source}/.jobtrace-release.tar.gz"

if ! [[ "$ssh_port" =~ ^[0-9]+$ ]] || ((ssh_port < 1 || ssh_port > 65535)); then
  echo "JOBTRACE_SSH_PORT must be a valid TCP port." >&2
  exit 1
fi
if ! [[ "$remote_source" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "JOBTRACE_REMOTE_SOURCE_DIR must be a simple directory name." >&2
  exit 1
fi
if [[ ! -f "$env_file" ]]; then
  echo "Missing server environment file: ${env_file}" >&2
  exit 1
fi
for command_name in ssh scp rsync; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required local command is missing: ${command_name}" >&2
    exit 1
  fi
done

JOBTRACE_ENV_FILE="$env_file" \
JOBTRACE_ARTIFACT_FILE="$artifact_file" \
  "${script_dir}/build-artifact.sh"

echo "Uploading deployment metadata to ${remote_host}:~/${remote_source}"
ssh -p "$ssh_port" "$remote_host" \
  "mkdir -p '${remote_source}' && chmod 700 '${remote_source}'"
rsync \
  --archive \
  --compress \
  --delete \
  --exclude '.git/' \
  --exclude '.env*' \
  --exclude '.next*/' \
  --exclude 'node_modules/' \
  --exclude 'jobtrace-release-*.tar.gz' \
  --exclude 'coverage/' \
  --exclude 'test-results/' \
  --rsh "ssh -p ${ssh_port}" \
  "${repo_root}/" \
  "${remote_host}:${remote_source}/"
scp -P "$ssh_port" -q "$env_file" \
  "${remote_host}:${remote_source}/.env.server"
scp -P "$ssh_port" -q "$artifact_file" \
  "${remote_host}:${remote_artifact}"

echo "Installing the prebuilt release on ${remote_host}"
ssh -t -p "$ssh_port" "$remote_host" \
  "cd '${remote_source}' && chmod 600 .env.server && sudo env JOBTRACE_ENV_SOURCE=\"\$PWD/.env.server\" JOBTRACE_RELEASE_ARTIFACT=\"\$PWD/.jobtrace-release.tar.gz\" bash deploy/server/install.sh && rm -f .jobtrace-release.tar.gz"
