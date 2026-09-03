#!/usr/bin/env bash
set -Eeuo pipefail

if ((EUID != 0)); then
  echo "Run this installer with sudo or as root." >&2
  exit 1
fi

source_dir="${JOBTRACE_SOURCE_DIR:-$PWD}"
app_user="${JOBTRACE_APP_USER:-jobtrace}"
app_group="${JOBTRACE_APP_GROUP:-jobtrace}"
app_root="${JOBTRACE_APP_ROOT:-/opt/jobtrace}"
app_current="${app_root}/current"
releases_dir="${app_root}/releases"
env_dir="${JOBTRACE_ENV_DIR:-/etc/jobtrace}"
env_file="${env_dir}/app.env"
sync_bin="${JOBTRACE_SYNC_BIN:-/usr/local/libexec/jobtrace-sync}"
env_source="${JOBTRACE_ENV_SOURCE:-}"

if [[ ! -f "${source_dir}/package.json" || ! -d "${source_dir}/deploy/server" ]]; then
  echo "JOBTRACE_SOURCE_DIR must point to the JobTrace repository root." >&2
  exit 1
fi

for command_name in \
  node pnpm uv rsync curl jq flock logger systemctl runuser \
  getent groupadd useradd usermod journalctl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
pnpm_major="$(pnpm --version | sed -E 's/^([0-9]+).*/\1/')"
if ((node_major < 24)); then
  echo "Node.js 24 or newer is required." >&2
  exit 1
fi
if ((pnpm_major < 10)); then
  echo "pnpm 10 or newer is required." >&2
  exit 1
fi

if ! getent group "$app_group" >/dev/null; then
  groupadd --system "$app_group"
fi
if ! id "$app_user" >/dev/null 2>&1; then
  useradd \
    --system \
    --gid "$app_group" \
    --home-dir "/var/lib/${app_user}" \
    --create-home \
    --shell /usr/sbin/nologin \
    "$app_user"
fi
if ! id -nG "$app_user" | tr ' ' '\n' | grep -Fxq "$app_group"; then
  usermod -a -G "$app_group" "$app_user"
fi

install -d -m 0750 -o "$app_user" -g "$app_group" "$app_root" "$releases_dir"
install -d -m 0750 -o root -g "$app_group" "$env_dir"
install -d -m 0755 -o root -g root "$(dirname "$sync_bin")"

if [[ -n "$env_source" ]]; then
  if [[ ! -f "$env_source" ]]; then
    echo "JOBTRACE_ENV_SOURCE does not exist: ${env_source}" >&2
    exit 1
  fi
  install -m 0640 -o root -g "$app_group" "$env_source" "$env_file"
  if [[ "$env_source" != "$env_file" ]]; then
    rm -f -- "$env_source"
  fi
elif [[ ! -f "$env_file" ]]; then
  install \
    -m 0640 \
    -o root \
    -g "$app_group" \
    "${source_dir}/deploy/server/app.env.example" \
    "$env_file"
  echo "Created ${env_file}. Fill in its production values, then rerun this installer." >&2
  exit 2
fi

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

required_variables=(
  DATABASE_URL
  BETTER_AUTH_SECRET
  BETTER_AUTH_URL
  JOB_MARKET_SYNC_SECRET
)
for variable_name in "${required_variables[@]}"; do
  if [[ -z "${!variable_name:-}" || "${!variable_name}" == *replace-with* ]]; then
    echo "Set a production value for ${variable_name} in ${env_file}." >&2
    exit 1
  fi
done

if [[ "$BETTER_AUTH_URL" != https://* ]]; then
  echo "BETTER_AUTH_URL must use HTTPS in production." >&2
  exit 1
fi
if ((${#BETTER_AUTH_SECRET} < 32)); then
  echo "BETTER_AUTH_SECRET must contain at least 32 characters." >&2
  exit 1
fi
if [[ "${JOB_MARKET_ENABLED:-false}" != "true" ]]; then
  echo "JOB_MARKET_ENABLED must be true for scheduled recruitment sync." >&2
  exit 1
fi
if ((${#JOB_MARKET_SYNC_SECRET} < 32)); then
  echo "JOB_MARKET_SYNC_SECRET must contain at least 32 characters." >&2
  exit 1
fi

release_id="$(date -u +%Y%m%d%H%M%S)"
release_dir="${releases_dir}/${release_id}"
previous_release=""
if [[ -L "$app_current" ]]; then
  previous_release="$(readlink -f "$app_current")"
fi

install -d -m 0750 -o "$app_user" -g "$app_group" "$release_dir"
rsync \
  --archive \
  --delete \
  --exclude '.git/' \
  --exclude '.env*' \
  --exclude '.next*/' \
  --exclude 'node_modules/' \
  --exclude 'coverage/' \
  --exclude 'test-results/' \
  "${source_dir}/" \
  "${release_dir}/"
chown -R "$app_user:$app_group" "$release_dir"

runuser -u "$app_user" -- \
  env PATH="$PATH" HOME="/var/lib/${app_user}" \
  bash -c '
    set -Eeuo pipefail
    set -a
    source "$1"
    set +a
    cd "$2"
    pnpm install --frozen-lockfile
    pnpm db
    pnpm build
    mkdir -p .next/standalone/.next
    cp -R .next/static .next/standalone/.next/static
  ' _ "$env_file" "$release_dir"

install -m 0750 -o root -g "$app_group" \
  "${source_dir}/deploy/server/jobtrace-sync.sh" "$sync_bin"

node_bin="$(command -v node)"
sed \
  -e "s|@@APP_USER@@|${app_user}|g" \
  -e "s|@@APP_GROUP@@|${app_group}|g" \
  -e "s|@@APP_CURRENT@@|${app_current}|g" \
  -e "s|@@ENV_FILE@@|${env_file}|g" \
  -e "s|@@NODE_BIN@@|${node_bin}|g" \
  -e "s|@@APP_ROOT@@|${app_root}|g" \
  "${source_dir}/deploy/server/jobtrace.service.in" \
  > /etc/systemd/system/jobtrace.service
sed \
  -e "s|@@APP_USER@@|${app_user}|g" \
  -e "s|@@APP_GROUP@@|${app_group}|g" \
  -e "s|@@ENV_FILE@@|${env_file}|g" \
  -e "s|@@APP_PORT@@|${PORT:-3000}|g" \
  -e "s|@@SYNC_BIN@@|${sync_bin}|g" \
  "${source_dir}/deploy/server/jobtrace-sync.service.in" \
  > /etc/systemd/system/jobtrace-sync.service
install -m 0644 -o root -g root \
  "${source_dir}/deploy/server/jobtrace-sync.timer" \
  /etc/systemd/system/jobtrace-sync.timer

if command -v systemd-analyze >/dev/null 2>&1; then
  systemd-analyze verify \
    /etc/systemd/system/jobtrace.service \
    /etc/systemd/system/jobtrace-sync.service \
    /etc/systemd/system/jobtrace-sync.timer
fi

ln -sfn "$release_dir" "${app_root}/.current-new"
mv -Tf "${app_root}/.current-new" "$app_current"

systemctl daemon-reload
systemctl enable jobtrace.service jobtrace-sync.timer >/dev/null
systemctl restart jobtrace.service

healthy=false
for _attempt in {1..30}; do
  if curl --fail --silent --show-error \
    "http://127.0.0.1:${PORT:-3000}/api/health/ready" >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done

if [[ "$healthy" != "true" ]]; then
  echo "The new release failed its readiness check." >&2
  journalctl -u jobtrace.service -n 50 --no-pager >&2 || true
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    ln -sfn "$previous_release" "${app_root}/.current-new"
    mv -Tf "${app_root}/.current-new" "$app_current"
    systemctl restart jobtrace.service
    echo "Rolled back to ${previous_release}." >&2
  else
    systemctl stop jobtrace.service
    rm -f -- "$app_current"
  fi
  exit 1
fi

systemctl restart jobtrace-sync.timer

echo "JobTrace release ${release_id} is healthy."
echo "Application: http://127.0.0.1:${PORT:-3000}"
echo "Timer: $(systemctl is-active jobtrace-sync.timer)"
echo "Run the first catalog initialization from /admin/job-market."
