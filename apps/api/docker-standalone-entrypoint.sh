#!/bin/sh
set -eu

: "${PGDATA:=/var/lib/postgresql/data}"
: "${POSTGRES_HOST:=127.0.0.1}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=catkanban}"
: "${POSTGRES_USER:=catkanban}"
: "${POSTGRES_PASSWORD:=catkanban}"

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
  mkdir -p "$PGDATA"
  chown postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    password_file="$PGDATA/.catkanban-postgres-password"
    su-exec postgres sh -c 'printf "%s" "$POSTGRES_PASSWORD" > "$1"' sh "$password_file"
    chmod 600 "$password_file"
    su-exec postgres initdb \
      --pgdata="$PGDATA" \
      --username="$POSTGRES_USER" \
      --pwfile="$password_file" \
      --auth-local=trust \
      --auth-host=scram-sha-256
    rm -f "$password_file"
  fi

  su-exec postgres pg_ctl \
    -D "$PGDATA" \
    -o "-c listen_addresses='127.0.0.1' -p $POSTGRES_PORT" \
    -w start

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
