#!/bin/bash
# kill stale vite on the harness port, then run the shot harness
for p in $(netstat -ano | grep ":5199" | awk '{print $5}' | sort -u); do taskkill //PID $p //F >/dev/null 2>&1; done
sleep 1
node tools/shots.mjs "$@" 2>&1 | grep -v "GL Driver\|Deprecation\|trace-dep\|toNonIndexed"
for p in $(netstat -ano | grep ":5199" | awk '{print $5}' | sort -u); do taskkill //PID $p //F >/dev/null 2>&1; done
