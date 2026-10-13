#!/usr/bin/env bash
# PoPo × MetaMask Agent Wallet — recorded demo flow.
# Usage in YOUR terminal (Warp), after screen recording starts:
#   bash /Users/stark/Desktop/PP/pp-all/hackathon/video-rec/mm/run.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lib.sh"

M0="0"        # prediction market ref (index 0)
Q=""

pause() { printf '\n\033[1;93m▶ %s  (press Enter)\033[0m\n' "$1"; read -r _ || true; }

# ── 1. plugin + read-only public commands (no login) ────────────────────────
banner "1/6  Installed plugin — public read commands (no wallet login)"
mark s1.start
mm plugins list 2>&1 | grep -iE 'popo|name|version|enabled' || mm plugins list
echo; echo "● mm popo markets  — public RPC, read-only"
mm popo markets 2>&1 | head -20
pause "Markets listed. Next: quote + wallet reads"
mark s1.done

# ── 2. quote + wallet read state ────────────────────────────────────────────
banner "2/6  Off-chain quote + current wallet state"
mark s2.start
mm popo quote --kind predict --market "$M0" --outcome no --side buy --amount 1 2>&1 | tee "$RD/q-buy-no.txt" || true
echo; echo "● vault & position (reads)"
mm popo vault 2>&1 | head -20
mm popo position "$M0" 2>&1 | head -20
pause "Quote and balances shown. Next: prove guard + strict policy"
mark s2.done

# ── 3. guard mode + strict policy ───────────────────────────────────────────
banner "3/6  Trading mode = GUARD · strict policy · every write needs email MFA"
mark s3.start
mm wallet trading-mode get 2>&1
echo; echo "● policy: empty allowlist, chain 10143 NOT allowed, rolling_24h = 0"
mm wallet policy get 2>&1 | grep -nE 'allowlist:|blocklist:|allowed_chains:|rolling_24h:|10143|^\s*- (0x|[0-9]+$)' | head -40 || mm wallet policy get
pause "Guard + strict policy shown. Next: WRITE #1 (deposit) — check your email"
mark s3.done

# ── 4. WRITE #1 deposit (1 email MFA) ───────────────────────────────────────
banner "4/6  WRITE #1 · deposit 25 \$P  →  AWAITING EMAIL MFA (approval #1)"
mark s4.start
mm popo deposit 25 2>&1 | tee "$RD/s4-deposit.json"
mark s4.done
pause "Deposit confirmed. Next: WRITE #2 (predict buy) — check your email again"

# ── 5. WRITE #2 predict buy (1 email MFA) ───────────────────────────────────
banner "5/6  WRITE #2 · predict buy 0 NO 1 share  →  AWAITING EMAIL MFA (#2)"
mark s5.start
mm popo quote --kind predict --market "$M0" --outcome no --side buy --amount 1 2>&1 | tee "$RD/q-buy-no-2.txt" || true
mm popo predict buy "$M0" no 1 2>&1 | tee "$RD/s5-buy.json"
mark s5.done
pause "Buy confirmed. Next: verify on-chain state + explorer"

# ── 6. post-state + cross-proof ─────────────────────────────────────────────
banner "6/6  Verified on-chain: position, vault spend, Envio index, explorer"
mark s6.start
mm popo position "$M0" 2>&1
mm popo vault 2>&1 | head -20
echo; echo "● Envio HyperIndex just ingested this trade (GraphQL)"
curl -s http://localhost:8080/v1/graphql -H 'content-type: application/json' \
  -d '{"query":"{ PredictionTrade(limit:2, order_by:{blockNumber:desc}){ side outcome shares blockNumber transactionHash } }"}' 2>&1 | head -40 || true
echo
echo "● Explorers:"
for f in s4-deposit s5-buy; do
  h=$(grep -oE '0x[a-fA-F0-9]{64}' "$RD/$f.json" 2>/dev/null | head -1)
  [ -n "$h" ] && echo "  $f -> https://testnet.monadexplorer.com/tx/$h"
done
mark s6.done
printf '\n\033[1;92m✔ Flow complete. Stop the screen recording now.\033[0m\n'
