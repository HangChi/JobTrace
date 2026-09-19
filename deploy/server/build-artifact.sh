#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "${script_dir}/../.." && pwd)"
env_file="${JOBTRACE_ENV_FILE:-${repo_root}/.env.server}"
output_file="${JOBTRACE_ARTIFACT_FILE:-${repo_root}/jobtrace-release-linux-amd64.tar.gz}"
pnpm_version="${JOBTRACE_BUILD_PNPM_VERSION:-11.22.0}"
build_dir="$(mktemp -d)"

cleanup() {
  rm -rf -- "$build_dir"
}
trap cleanup EXIT

if [[ ! -f "$env_file" ]]; then
  echo "Missing server environment file: ${env_file}" >&2
  exit 1
fi
for command_name in docker rsync tar; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required local command is missing: ${command_name}" >&2
    exit 1
  fi
done

mkdir -p "${build_dir}/source"
rsync \
  --archive \
  --delete \
  --exclude '.git/' \
  --exclude '.env*' \
  --exclude '.next*/' \
  --exclude 'node_modules/' \
  --exclude 'coverage/' \
  --exclude 'test-results/' \
  "${repo_root}/" \
  "${build_dir}/source/"

echo "Building the Linux amd64 standalone release locally"
docker run --rm \
  --platform linux/amd64 \
  --env-file "$env_file" \
  --volume "${build_dir}/source:/workspace" \
  --workdir /workspace \
  node:24-bookworm \
  bash -c "
    set -Eeuo pipefail
    npx --yes pnpm@${pnpm_version} install --frozen-lockfile
    npx --yes pnpm@${pnpm_version} build
    mkdir -p .next/standalone/.next
    cp -R .next/static .next/standalone/.next/static
  "

rm -f -- "$output_file"
tar -C "${build_dir}/source" \
  -czf "$output_file" \
  .next/standalone \
  scripts/db_migrate.py \
  scripts/env.py \
  supabase/migrations

echo "Release artifact: ${output_file}"
shasum -a 256 "$output_file" 2>/dev/null || sha256sum "$output_file"
