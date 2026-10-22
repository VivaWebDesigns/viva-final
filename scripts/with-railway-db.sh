#!/bin/sh
# Run one command against the production database through Railway's private SSH tunnel.
# The database has no public address. DATABASE_URL is set for that command only and never printed.
# Usage: sh scripts/with-railway-db.sh npm run db:push
set -eu

PROJECT=d861737f-dd6d-4e9d-9576-40bf63ad8c91
SERVICE="Viva Web Designs Database"
PORT=${RAILWAY_DB_TUNNEL_PORT:-6543}

railway connect "$SERVICE" -p "$PROJECT" -e production --tunnel-only -P "$PORT" >/dev/null 2>&1 &
TUNNEL=$!
trap 'kill "$TUNNEL" 2>/dev/null || true' EXIT INT TERM

tries=0
until nc -z 127.0.0.1 "$PORT" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -gt 30 ]; then
    echo "The Railway tunnel didn't open. Is the CLI logged in (railway login)?" >&2
    exit 1
  fi
  sleep 1
done

DATABASE_URL=$(railway variable list -p "$PROJECT" -e production -s "$SERVICE" --json |
  PORT="$PORT" node -e '
    let input = "";
    process.stdin.on("data", (chunk) => (input += chunk)).on("end", () => {
      const url = new URL(JSON.parse(input).DATABASE_URL);
      url.hostname = "127.0.0.1";
      url.port = process.env.PORT;
      process.stdout.write(url.toString());
    });')
export DATABASE_URL

"$@"
