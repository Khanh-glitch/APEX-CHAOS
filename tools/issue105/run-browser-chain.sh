#!/usr/bin/env bash
# Issue #105 browser chain (CI step "Issue #105 targeted browser gates").
# Same gates, same order, same fail-fast semantics as the former `&&` chain.
# Reporting only: each gate's output is captured, and on failure every FAIL line is
# emitted as a GitHub check annotation (readable from the check-run API), so the
# failing assertion is named without the job log. No gate or threshold changes.
set -u
OUT_DIR="${ISSUE105_OUT:-/tmp/issue105-browser}/chain"
mkdir -p "$OUT_DIR"
GATES="first-play port-1p progress help-account pick-before-draw roster-pairs door lucky-pick battle-popup no-side-outline"
for g in $GATES; do
  echo "::group::issue105 gate ${g}"
  log="$OUT_DIR/${g}.log"
  pnpm "test:issue105:${g}" > "$log" 2>&1
  rc=$?
  cat "$log"
  echo "::endgroup::"
  if [ "$rc" -ne 0 ]; then
    grep -a -E '^(FAIL|GATE ERROR|Error|TimeoutError)' "$log" | head -n 12 | while IFS= read -r line; do
      echo "::error title=issue105 ${g} assertion::${line:0:400}"
    done
    echo "::error title=issue105 browser gate failed::test:issue105:${g} exit=${rc}"
    exit "$rc"
  fi
  echo "issue105 gate ${g}: EXIT=0"
done
echo "issue105 browser chain: all gates EXIT=0"
