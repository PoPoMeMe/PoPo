# Shared helpers for recorded PoPo MM steps. Sourced by each step script.
export NODE_USE_ENV_PROXY=1
export HTTPS_PROXY=http://127.0.0.1:7897
export HTTP_PROXY=http://127.0.0.1:7897
export ALL_PROXY=http://127.0.0.1:7897
export NO_PROXY=localhost,127.0.0.1
RD=/tmp/popo-rec
banner() {
  clear
  printf '\n\033[1;96m'
  printf '══════════════════════════════════════════════════════════\n'
  printf ' %s\n' "$1"
  printf '══════════════════════════════════════════════════════════\n'
  printf '\033[0m\n'
}
mark() { mkdir -p "$RD"; printf '%s\n' "$(date +%s.%N)" > "$RD/$1"; echo "[marker] $1 @ $(cat "$RD/$1")"; }
waitkey() { printf '\n\033[1;93m[press Enter to continue]\033[0m'; read -r _ || true; }
