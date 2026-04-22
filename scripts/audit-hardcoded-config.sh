#!/bin/bash
# scripts/audit-hardcoded-config.sh
# Audit for hardcoded port numbers and API URLs that should come from config.
# Run this after changing defaults to catch stale hardcoded values.
#
# Usage: bash scripts/audit-hardcoded-config.sh

set -euo pipefail

echo "=== Hardcoded Port Audit ==="
grep -rn "4096\|4097\|localhost:4" src/ --include="*.ts" \
  | grep -v "node_modules" \
  | grep -v ".test.ts" \
  | grep -v "config.ts" \
  || echo "  (none found)"

echo ""
echo "=== Hardcoded API URL Audit ==="
grep -rn "http://localhost" src/ --include="*.ts" \
  | grep -v "node_modules" \
  | grep -v ".test.ts" \
  | grep -v "config.ts" \
  || echo "  (none found)"

echo ""
echo "=== Config Source of Truth ==="
grep -n "apiUrl\|apiKey\|port" src/config.ts

echo ""
echo "=== Spawn Commands (should derive port from config) ==="
grep -rn "spawn\|exec\|execSync" src/ --include="*.ts" \
  | grep -v "node_modules" \
  | grep -v ".test.ts" \
  || echo "  (none found)"
