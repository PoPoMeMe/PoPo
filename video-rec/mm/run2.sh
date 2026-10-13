#!/usr/bin/env bash
# PoPo × MetaMask Agent Wallet — recorded demo flow (TAKE 2, tightened).
# Run in a MAXIMIZED Warp on the BUILT-IN display, large font:
#   bash /Users/stark/Desktop/PP/pp-all/hackathon/video-rec/mm/run2.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lib.sh"
# quiet markers (kept for the editor, not shown in the video)
mark() { mkdir -p "$RD"; printf '%s\n' "$(date +%s.%N)" > "$RD/$1"; }
hold() { sleep "$1"; }
pause() { printf '\n\033[1;93m▶ %s  (press Enter)\033[0m\n' "$1"; read -r _ || true; }
M0="0"

# ── 1 ───────────────────────────────────────────────────────────────────────
banner "1/6  Installed plugin · public read commands (no wallet login)"
mark s1.start
mm plugins list 2>&1 | grep -iE 'popo|enabled|version' | head
echo; echo '$ mm popo markets   (public RPC, read-only)'
mm popo markets 2>&1 | head -12
hold 6
pause "Next: quote + wallet reads"
mark s1.done

# ── 2 ───────────────────────────────────────────────────────────────────────
banner "2/6  Exact off-chain quote + wallet state"
mark s2.start
mm popo quote --kind predict --market "$M0" --outcome no --side buy --amount 1 2>&1 | tee "$RD/q.txt" | head -20
echo; echo '$ mm popo vault'; mm popo vault 2>&1 | grep -iE 'erc20BalanceP|vaultBalanceP|wallet' | head
echo '$ mm popo position 0'; mm popo position "$M0" 2>&1 | grep -iE 'yesShares|noShares'
hold 6
pause "Next: guard mode + strict policy"
mark s2.done

# ── 3 ───────────────────────────────────────────────────────────────────────
banner "3/6  GUARD mode · strict policy · every write needs email MFA"
mark s3.start
echo '$ mm wallet trading-mode get'; mm wallet trading-mode get 2>&1 | head -8
echo; echo '$ mm wallet policy get   (effective YAML policy)'
mm wallet policy get --json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['policy'])" 2>/dev/null || mm wallet policy get
echo
if mm wallet policy get --json 2>/dev/null | grep -q '"[^"]*10143'; then
  echo ">> note: a 10143 entry exists"
else
  echo ">> VERIFY: allowlist is EMPTY and chain 10143 is NOT pre-approved; rolling_24h = 0"
fi
hold 8
pause "Next: WRITE #1 deposit — approve the EMAIL within ~1 minute"
mark s3.done

# ── 4 ───────────────────────────────────────────────────────────────────────
banner "4/6  WRITE #1 · deposit 25 \$P  →  approve the email MFA now"
mark s4.start
mm popo deposit 25 2>&1 | tee "$RD/s4-deposit.json"
echo; echo "↑ deposit result above (explorer link included)"
hold 8
mark s4.done
pause "Deposit done. Next: WRITE #2 buy — another email"

# ── 5 ───────────────────────────────────────────────────────────────────────
banner "5/6  WRITE #2 · predict buy 0 NO 1  →  approve the SECOND email now"
mark s5.start
mm popo predict buy "$M0" no 1 2>&1 | tee "$RD/s5-buy.json"
echo; echo "↑ trade result above (tx hash + explorer included)"
hold 8
mark s5.done
pause "Buy done. Next: on-chain verification"

# ── 6 ───────────────────────────────────────────────────────────────────────
banner "6/6  Verified on-chain · Envio index · explorer"
mark s6.start
echo '$ mm popo position 0'; mm popo position "$M0" 2>&1 | grep -iE 'yesShares|noShares'
echo '$ mm popo vault'; mm popo vault 2>&1 | grep -iE 'erc20BalanceP|vaultBalanceP'
echo; echo "● Envio HyperIndex latest prediction trades:"
curl -s http://localhost:8080/v1/graphql -H 'content-type: application/json' \
  -d '{"query":"{ PredictionTrade(limit:3, order_by:{blockNumber:desc}){ side outcome shares blockNumber transactionHash } }"}' 2>&1 | python3 -m json.tool 2>/dev/null | head -40
echo; echo "● Explorers:"
for f in s4-deposit s5-buy; do
  h=$(grep -oE '0x[a-fA-F0-9]{64}' "$RD/$f.json" 2>/dev/null | head -1)
  [ -n "$h" ] && echo "  $f: https://testnet.monadexplorer.com/tx/$h"
done
hold 10
mark s6.done
printf '\n\033[1;92m✔ Flow complete. Tell Cindy to stop the recorder.\033[0m\n'
