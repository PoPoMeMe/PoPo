#!/usr/bin/env bash
# Background screen recorder for the MM demo. Records the built-in display
# ("Capture screen 0" = avfoundation index 3) until this script is killed.
set -u
RD=/tmp/popo-rec
OUT="${1:-$RD/mm-raw.mp4}"
mkdir -p "$RD"
rm -f "$RD"/s*.start "$RD"/s*.done "$RD"/q-*.txt "$RD"/s4-deposit.json "$RD"/s5-buy.json 2>/dev/null
echo "recording -> $OUT"
echo "recStartEpoch=$(date +%s.%N)" | tee "$RD/rec.start"
# stop cleanly on Ctrl-C so mp4 moov is written
exec ffmpeg -hide_banner -loglevel warning \
  -f avfoundation -capture_cursor 1 -capture_mouse_clicks 1 -i "3:none" \
  -vf "fps=30" -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
  "$OUT"
