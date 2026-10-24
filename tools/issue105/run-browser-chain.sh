#!/usr/bin/env bash
# Issue #105 browser chain (CI step "Issue #105 targeted browser gates").
# Same gates, same order, same fail-fast semantics as the former `&&` chain.
# Difference: on failure it emits a GitHub check annotation naming the gate, so
# the failing gate is readable from the check-run API without the job log.
set -u
GATES="first-play port-1p progress help-account pick-before-draw door lucky-pick compositor"
for g in $GATES; do
  echo "::group::issue105 gate ${g}"
  pnpm "test:issue105:${g}"
  rc=$?
  echo "::endgroup::"
  if [ "$rc" -ne 0 ]; then
    echo "::error title=issue105 browser gate failed::test:issue105:${g} exit=${rc}"
    exit "$rc"
  fi
  echo "issue105 gate ${g}: EXIT=0"
done
echo "issue105 browser chain: all gates EXIT=0"
