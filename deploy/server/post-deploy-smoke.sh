#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <app-base-url>" >&2
  exit 1
fi

APP_BASE_URL="${1%/}"

check_route() {
  local path="$1"
  local accepted_codes="$2"
  local url="${APP_BASE_URL}${path}"
  local code

  code="$(curl -sS -o /tmp/deploy_route_check.out -w "%{http_code}" "${url}" || true)"
  for expected in ${accepted_codes}; do
    if [ "${code}" = "${expected}" ]; then
      echo "✓ ${path} -> ${code}"
      return 0
    fi
  done

  echo "❌ ${path} -> ${code} (expected one of: ${accepted_codes})"
  head -c 300 /tmp/deploy_route_check.out || true
  echo ""
  exit 1
}

check_route "/" "200"
check_route "/health" "200"
check_route "/favicon.ico" "200 301 302 304"
check_route "/api/me" "401 403"
