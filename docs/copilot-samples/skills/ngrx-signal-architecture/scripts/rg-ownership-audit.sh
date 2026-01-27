#!/usr/bin/env bash
set -euo pipefail

# Quick audit for common ownership leaks.
# Adjust patterns for your repo naming.
#
# Usage:
#   ./rg-ownership-audit.sh                    # Scan current dir with default pattern
#   ./rg-ownership-audit.sh ./libs             # Scan specific directory
#   ./rg-ownership-audit.sh . "customPattern"  # Use custom regex pattern

ROOT="${1:-.}"
PATTERN="${2:-watchlist|search|profile|securityDetails|recentSearch|trading|portfolio|market-data}"

echo "🔍 Scanning for cross-domain state leaks..."
echo "   Root: $ROOT"
echo "   Pattern: $PATTERN"
echo ""

rg -n "$PATTERN" "$ROOT" \
  --glob '!.git/**' \
  --glob '!dist/**' \
  --glob '!**/node_modules/**' \
  --glob '!**/coverage/**' \
  --glob '!**/*.md' \
  --glob '!**/package*.json' \
  --type ts \
  || echo "No matches found - looking good!"