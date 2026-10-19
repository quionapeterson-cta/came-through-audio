#!/usr/bin/env bash
# Keep Claude Code's login, settings and memory in /workspaces, which survives
# Codespace rebuilds, by symlinking ~/.claude and ~/.claude.json to it.
set -euo pipefail

persist=/workspaces/.claude-home
mkdir -p "$persist"
chmod 700 "$persist"

for name in .claude .claude.json; do
  target="$persist/$name"
  link="$HOME/$name"

  [ -L "$link" ] && continue

  if [ -e "$link" ]; then
    if [ -e "$target" ]; then
      # Persisted copy wins; keep the fresh container's version as a backup.
      mv "$link" "$link.pre-link.$(date +%s)"
    else
      mv "$link" "$target"
    fi
  fi

  ln -s "$target" "$link"
done
