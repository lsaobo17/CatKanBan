#!/bin/sh
set -eu

: "${POSTGRES_VOLUME_DIR:=/var/lib/postgresql/data}"
if [ -z "${PGDATA:-}" ]; then
  PGDATA="${POSTGRES_VOLUME_DIR%/}/pgdata"
fi
: "${POSTGRES_HOST:=127.0.0.1}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=catkanban}"
: "${POSTGRES_USER:=catkanban}"
: "${POSTGRES_PASSWORD:=catkanban}"

export POSTGRES_VOLUME_DIR
export PGDATA
export POSTGRES_HOST
export POSTGRES_PORT
export POSTGRES_DB
export POSTGRES_USER
export POSTGRES_PASSWORD

should_start_internal_postgres() {
  mode="${CATKANBAN_INTERNAL_POSTGRES:-auto}"

  case "$mode" in
    true | 1 | yes)
      return 0
      ;;
    false | 0 | no)
      return 1
      ;;
  esac

  if [ -n "${DATABASE_URL:-}" ]; then
    return 1
  fi

  case "$POSTGRES_HOST" in
    127.0.0.1 | localhost | ::1)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

start_internal_postgres() {
  normalize_pgdata
  postgres_parent_dir="$(dirname "$PGDATA")"

  mkdir -p "$postgres_parent_dir" "$PGDATA"
  chown postgres:postgres "$postgres_parent_dir" "$PGDATA"
  chmod 700 "$PGDATA"

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    initialize_internal_postgres "$postgres_parent_dir"
  fi

  su-exec postgres pg_ctl \
    -D "$PGDATA" \
    -o "-c listen_addresses='localhost' -p $POSTGRES_PORT" \
    -w start

  ensure_internal_database
}

normalize_pgdata() {
  volume_dir="${POSTGRES_VOLUME_DIR%/}"
  default_pgdata="$volume_dir/pgdata"
  current_pgdata="${PGDATA%/}"

  if [ -f "$volume_dir/PG_VERSION" ] && [ "$current_pgdata" = "$default_pgdata" ]; then
    PGDATA="$volume_dir"
    export PGDATA
    return
  fi

  if [ "$current_pgdata" = "$volume_dir" ] && [ ! -f "$volume_dir/PG_VERSION" ]; then
    PGDATA="$default_pgdata"
    export PGDATA
  fi
}

initialize_internal_postgres() {
  postgres_parent_dir="$1"
  password_file="$postgres_parent_dir/.catkanban-postgres-password"

  rm -f "$password_file"
  su-exec postgres sh -c 'umask 077; printf "%s" "$POSTGRES_PASSWORD" > "$1"' sh "$password_file"

  set +e
  su-exec postgres initdb \
    --pgdata="$PGDATA" \
    --username="$POSTGRES_USER" \
    --pwfile="$password_file" \
    --auth-local=trust \
    --auth-host=scram-sha-256
  initdb_status="$?"
  set -e

  rm -f "$password_file"
  if [ "$initdb_status" -ne 0 ]; then
    return "$initdb_status"
  fi
}

ensure_internal_database() {
  export PGPASSWORD="$POSTGRES_PASSWORD"
  database_exists="$(
    psql \
      -h "$POSTGRES_HOST" \
      -p "$POSTGRES_PORT" \
      -U "$POSTGRES_USER" \
      -d postgres \
      -v "db=$POSTGRES_DB" \
      -tAc "SELECT 1 FROM pg_database WHERE datname = :'db'"
  )"

  if [ "$database_exists" != "1" ]; then
    createdb \
      -h "$POSTGRES_HOST" \
      -p "$POSTGRES_PORT" \
      -U "$POSTGRES_USER" \
      --maintenance-db=postgres \
      "$POSTGRES_DB"
  fi
}

if should_start_internal_postgres; then
  start_internal_postgres
  started_internal_postgres=true
else
  started_internal_postgres=false
fi

stop_internal_postgres() {
  if [ "$started_internal_postgres" = "true" ]; then
    su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 || true
  fi
}

shutdown() {
  if [ -n "${app_pid:-}" ]; then
    kill -TERM "$app_pid" 2>/dev/null || true
    wait "$app_pid" 2>/dev/null || true
  fi

  stop_internal_postgres
}

trap 'shutdown; exit 143' INT TERM

node apps/api/docker-entrypoint.mjs &
app_pid="$!"

set +e
wait "$app_pid"
app_status="$?"
set -e

stop_internal_postgres
exit "$app_status"
