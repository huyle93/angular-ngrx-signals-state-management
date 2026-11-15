#!/bin/sh
# Generic forbidden-term scan for staged content and commit messages.
#
# Purpose: this repository must never contain app/brand names, business-specific
# naming, or external-context content in any committed file, doc, or commit
# message. This scan is the enforcement gate.
#
# Deny-list source (first match wins):
#   1. $FORBIDDEN_TERMS_FILE environment override
#   2. external-context/forbidden-terms.pattern
#
# The pattern file is intentionally gitignored: the forbidden terms themselves
# must never be committed to this repository. Format: one case-insensitive
# POSIX extended regex per line. Empty lines and lines starting with '#' are
# ignored.
#
# If no pattern file exists, this scan cannot run. It prints setup guidance
# and passes so it never blocks on a fresh clone that has no local context.
#
# Usage:
#   forbidden-term-scan.sh --staged          (pre-commit)
#   forbidden-term-scan.sh --message <file>  (commit-msg)

set -u

PATTERN_FILE="${FORBIDDEN_TERMS_FILE:-external-context/forbidden-terms.pattern}"

if [ ! -f "$PATTERN_FILE" ]; then
  cat >&2 <<EOF
[note] Forbidden-term scan skipped: no pattern file at $PATTERN_FILE.
Set up local enforcement:
  1. Create the gitignored pattern file: $PATTERN_FILE
  2. Add one case-insensitive regex per line (forbidden brand terms).
  3. Never commit the pattern file or the terms themselves.
EOF
  exit 0
fi

# Keep only non-empty, non-comment regex lines; bail out cleanly if none remain.
PATTERNS="$(mktemp)"
trap 'rm -f "$PATTERNS"' EXIT
sed -e 's/[[:space:]]*$//' "$PATTERN_FILE" \
  | grep -v '^[[:space:]]*$' \
  | grep -v '^#' > "$PATTERNS" || true
if [ ! -s "$PATTERNS" ]; then
  echo "[note] Forbidden-term scan skipped: pattern file has no usable patterns." >&2
  exit 0
fi

mode="$1"

fail() {
  cat >&2 <<EOF

X Commit blocked: forbidden term matched (rule: no brand / external-context
  content in committed files, docs, or commit messages).
  Matched above in: $1
  Deny-list: $PATTERN_FILE
  Fix by rewording to neutral naming (e.g. "example app", "mobile-app").
  Do NOT bypass with --no-verify.

EOF
  exit 1
}

case "$mode" in
  --staged)
    files="$(git diff --cached --name-only --diff-filter=ACMR)"
    status=0
    for f in $files; do
      if git show ":$f" 2>/dev/null | grep -inE -f "$PATTERNS"; then
        echo "  ^^ forbidden term in staged file: $f" >&2
        status=1
      fi
    done
    [ "$status" -eq 1 ] && fail "staged file"
    exit 0
    ;;
  --message)
    msg_file="$2"
    if grep -inE -f "$PATTERNS" "$msg_file"; then
      echo "  ^^ forbidden term in commit message" >&2
      fail "commit message"
    fi
    exit 0
    ;;
  *)
    echo "usage: forbidden-term-scan.sh --staged | --message <file>" >&2
    exit 2
    ;;
esac
