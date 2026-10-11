#!/usr/bin/env bash
# Force this plugin to use the SAME physical @metamask/agent-wallet install as
# the globally running `mm` CLI. This is required to preserve PluginCommand
# class identity; two physical copies make mm reject the command with
# PLUGIN_INVALID_BASE.
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MM_ROOT="${MM_ROOT:-$(npm root -g 2>/dev/null)/@metamask/agent-wallet}"

if [ ! -f "$MM_ROOT/package.json" ]; then
  echo "error: global @metamask/agent-wallet not found at $MM_ROOT" >&2
  echo "Install it first: npm install -g @metamask/agent-wallet@latest" >&2
  exit 1
fi

mkdir -p "$PLUGIN_DIR/node_modules/@metamask"
ln -sfn "$MM_ROOT" "$PLUGIN_DIR/node_modules/@metamask/agent-wallet"
echo "linked @metamask/agent-wallet -> $MM_ROOT"
