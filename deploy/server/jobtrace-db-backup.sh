#!/usr/bin/env bash
#
# JobTrace 数据库备份
#
# 行为：
#   1. 用容器内的 pg_dump 导出为 custom 格式（自带压缩），写到 <时间戳>.dump.part
#   2. 校验导出文件非空且目录结构可读（证明是完整 dump，不是被截断的）
#   3. 只有校验通过才改名为正式文件（失败则既有的备份全部不受影响）
#   4. 更新 jobtrace-latest.dump 软链，指向最新一份
#   5. 按份数保留，超出部分自动删除旧文件
#   6. 同步到异地服务器（可关闭）。本地备份已成功的前提下才做；
#      同步失败会以非 0 退出，便于 systemd 标记，但不会影响本地备份。
#
# 命名：jobtrace-YYYYMMDD-HHMMSS.dump（字典序即时序，最新的排在最后）
#
# 可用环境变量覆盖：
#   JOBTRACE_DB_CONTAINER        默认 1Panel-postgresql-px4K
#   JOBTRACE_DB_NAME             默认 jobtrace
#   JOBTRACE_DB_USER             默认从容器的 POSTGRES_USER 自动探测
#   JOBTRACE_BACKUP_DIR          默认 /var/backups/jobtrace
#   JOBTRACE_BACKUP_KEEP         默认 7（保留份数，≥1）
#   JOBTRACE_OFFSITE_DEST        默认 ubuntu@122.51.43.231:/srv/jobtrace-backups
#                                设为空字符串可关闭异地同步
#   JOBTRACE_OFFSITE_KEY         默认 /etc/jobtrace/keys/offsite
#   JOBTRACE_OFFSITE_PORT        默认 2002
#
set -Eeuo pipefail

container="${JOBTRACE_DB_CONTAINER:-1Panel-postgresql-px4K}"
db_name="${JOBTRACE_DB_NAME:-jobtrace}"
backup_dir="${JOBTRACE_BACKUP_DIR:-/var/backups/jobtrace}"
keep="${JOBTRACE_BACKUP_KEEP:-7}"

offsite_dest="${JOBTRACE_OFFSITE_DEST-ubuntu@122.51.43.231:/srv/jobtrace-backups}"
offsite_key="${JOBTRACE_OFFSITE_KEY:-/etc/jobtrace/keys/offsite}"
offsite_port="${JOBTRACE_OFFSITE_PORT:-2002}"

# 该容器的超级用户名由 POSTGRES_USER 决定（本机为 user_ZEe4Xd，并非 postgres），
# 因此默认从容器环境自动探测，避免写死导致 "role does not exist"。
db_user="${JOBTRACE_DB_USER:-}"
if [[ -z "$db_user" ]]; then
  db_user="$(docker exec "$container" printenv POSTGRES_USER 2>/dev/null | tr -d '\r\n' || true)"
  db_user="${db_user:-postgres}"
fi

log() { logger -t jobtrace-db-backup -- "$*" 2>/dev/null || true; printf '%s %s\n' "$(date -Is)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[[ $(id -u) -eq 0 ]] || die "必须以 root 运行"
[[ "$keep" =~ ^[0-9]+$ ]] || die "JOBTRACE_BACKUP_KEEP 必须是非负整数，收到：$keep"
(( keep >= 1 )) || die "JOBTRACE_BACKUP_KEEP 必须 ≥1，收到：$keep"

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

stamp="$(date +%Y%m%d-%H%M%S)"
final="${backup_dir}/jobtrace-${stamp}.dump"
link="${backup_dir}/jobtrace-latest.dump"
staging="${final}.part"

cleanup() { rm -f "$staging" "${backup_dir}/.stderr"; }
trap cleanup EXIT

# 1) 导出到 .part（避免中途失败产生半截文件）
if ! docker exec "$container" pg_dump -U "$db_user" -d "$db_name" \
      --format=custom --compress=6 --no-owner --no-privileges \
      >"$staging" 2>"${backup_dir}/.stderr"; then
  die "pg_dump 失败: $(tail -c 400 "${backup_dir}/.stderr" 2>/dev/null | tr '\n' ' ')"
fi
rm -f "${backup_dir}/.stderr"

# 2) 校验
[[ -s "$staging" ]] || die "导出文件为空"
docker exec -i "$container" pg_restore --list <"$staging" >/dev/null 2>&1 \
  || die "导出文件校验失败（pg_restore --list 无法解析）"

# 3) 落盘（改名为正式文件本身就是原子操作）
chmod 600 "$staging"
mv -f "$staging" "$final"

# 4) 原子更新 latest 软链（相对路径，便于整个目录搬迁）
ln -sfn "$(basename "$final")" "${link}.tmp"
mv -Tf "${link}.tmp" "$link"

# 5) 只保留最近 $keep 份
mapfile -t stale < <(
  find "$backup_dir" -maxdepth 1 -type f -name 'jobtrace-*.dump' \
       ! -name 'jobtrace-latest.dump' -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | cut -d' ' -f2- | tail -n +$((keep + 1))
)
if (( ${#stale[@]} > 0 )); then
  for f in "${stale[@]}"; do rm -f -- "$f"; done
  log "已清理 ${#stale[@]} 份超期备份"
fi

trap - EXIT

kept="$(find "$backup_dir" -maxdepth 1 -type f -name 'jobtrace-*.dump' \
        ! -name 'jobtrace-latest.dump' | wc -l)"
log "OK ${db_name} -> $(basename "$final") ($(du -h "$final" | cut -f1))，现存 ${kept} 份"

# 6) 异地副本
#    排除 YYYYMMDD-* 形式的目录（那是部署前快照，不属于日常备份）
#    --delete 让目标端与源端的保留策略保持一致
if [[ -n "$offsite_dest" ]]; then
  if [[ ! -f "$offsite_key" ]]; then
    log "ERROR 异地副本：私钥不存在 ${offsite_key}"
    exit 1
  fi
  if ! rsync_out="$(rsync -az --delete \
        --exclude='/????????-*/' \
        -e "ssh -i ${offsite_key} -p ${offsite_port} -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/etc/jobtrace/keys/known_hosts" \
        "${backup_dir}/" "${offsite_dest}/" 2>&1)"; then
    log "ERROR 异地副本同步失败 -> ${offsite_dest}（本地备份不受影响）：$(printf '%s' "$rsync_out" | tail -c 300 | tr '\n' ' ')"
    exit 1
  fi
  log "异地副本已同步 -> ${offsite_dest}"
fi
