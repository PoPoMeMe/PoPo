#!/usr/bin/env bash
# Assemble TAKE 3 (Volc TTS 147.64s) — whole-screen-fit terminal + native popup.
set -euo pipefail
RD=/tmp/popo-rec
SRC="$RD/mm-take3.mp4"
CARDS="$RD/cards"
SEG="$RD/seg3"; rm -rf "$SEG"; mkdir -p "$SEG"
TMP="$RD/seg3/tmp"; mkdir -p "$TMP"

FIT="scale=1392:900:flags=lanczos,pad=1440:900:(ow-iw)/2:0:black,setsar=1,fps=30,format=yuv420p"
POP="crop=1000:1250:1230:855,scale=720:900:flags=lanczos,pad=1440:900:(ow-iw)/2:0:black,setsar=1,fps=30,format=yuv420p"

card(){ ffmpeg -y -v error -loop 1 -t "$2" -i "$1" -f lavfi -t "$2" -i anullsrc=r=48000:cl=stereo \
  -vf "fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 20 -c:a aac -shortest "$3"; }

# Build a fitted terminal beat from one or more "ss:dur" ranges, then pad/freeze to
# the target window and overlay caption + brand.
#   beat <windowDur> <captionPng|-> <out> <ss:dur> [<ss:dur> ...]
beat(){
  local win=$1 cap=$2 out=$3; shift 3
  local i=0; local list="$TMP/$RANDOM.txt"; : > "$list"
  local srcDur=0
  for r in "$@"; do
    local ss=${r%%:*}; local dr=${r#*:}
    ffmpeg -y -v error -ss "$ss" -t "$dr" -i "$SRC" -an -vf "$FIT" -c:v libx264 -preset medium -crf 20 "$TMP/p$i.mp4"
    echo "file '$TMP/p$i.mp4'" >> "$list"
    srcDur=$(python3 -c "print($srcDur+$dr)"); i=$((i+1))
  done
  ffmpeg -y -v error -f concat -safe 0 -i "$list" -c copy "$TMP/joined.mp4"
  local freeze; freeze=$(python3 -c "print(max(0.0,$win-$srcDur))")
  if [ "$(python3 -c "print(1 if $freeze>0.02 else 0)")" = 1 ]; then
    ffmpeg -y -v error -i "$TMP/joined.mp4" -vf "tpad=stop_mode=clone:stop_duration=$freeze" -c:v libx264 -preset medium -crf 20 "$TMP/pad.mp4"
  else
    cp "$TMP/joined.mp4" "$TMP/pad.mp4"
  fi
  local ins=( -i "$TMP/pad.mp4" ); local fc=""; local n=1; local last="v0"
  if [ "$cap" != "-" ]; then ins+=( -i "$CARDS/$cap.png" ); fc="[$n:v]format=rgba[lt];[v0][lt]overlay=0:0[vlt$n]"; last="vlt$n"; n=$((n+1)); fi
  ins+=( -i "$CARDS/brand.png" ); local br=$n
  if [ -z "$fc" ]; then fc="[$br:v]format=rgba[br];[v0][br]overlay=W-w-24:20[vb]"; else fc="$fc;[$br:v]format=rgba[br];[$last][br]overlay=W-w-24:20[vb]"; fi
  last="vb"
  ffmpeg -y -v error "${ins[@]}" -f lavfi -t "$win" -i anullsrc=r=48000:cl=stereo \
    -filter_complex "[0:v]fps=30,format=yuv420p[v0];$fc" -map "[$last]" -map "$((br+1)):a" \
    -t "$win" -c:v libx264 -preset medium -crf 20 -c:a aac "$out"
}
pclip(){ ffmpeg -y -v error -ss "$1" -t "$2" -i "$SRC" -i "$CARDS/cap_popup.png" -i "$CARDS/brand.png" -f lavfi -t "$2" -i anullsrc=r=48000:cl=stereo \
  -filter_complex "[0:v]$POP[v0];[1:v]format=rgba[lt];[v0][lt]overlay=0:0[x];[2:v]format=rgba[br];[x][br]overlay=W-w-24:20[v]" \
  -map "[v]" -map 3:a -c:v libx264 -preset medium -crf 20 -c:a aac "$3"; }

# beat windows sum to 147.64
card "$CARDS/intro.png"        20.14 "$SEG/01.mp4"
beat 16.84 cap_read    "$SEG/02.mp4" 343:6 354:10.84
beat 16.32 cap_quote   "$SEG/03.mp4" 367:16.32
beat 16.47 cap_policy  "$SEG/04.mp4" 407.5:16.47
card "$CARDS/mfa_email_1.png"   5.40 "$SEG/05a.mp4"
beat 4.00  cap_dep_wait "$SEG/05b.mp4" 434:4
beat 8.60  cap_dep_done "$SEG/05c.mp4" 484:8.60
beat 3.00  cap_buy_wait "$SEG/06a.mp4" 525:3
pclip 569.5 5.00 "$SEG/06b.mp4"
beat 6.35  cap_buy_done "$SEG/06c.mp4" 593.5:6.35
beat 13.75 cap_verify  "$SEG/07.mp4" 620.3:13.45
card "$CARDS/envio_proof.png"  13.97 "$SEG/08.mp4"
card "$CARDS/close.png"        17.80 "$SEG/09.mp4"

LIST="$SEG/list.txt"; : > "$LIST"
for f in 01 02 03 04 05a 05b 05c 06a 06b 06c 07 08 09; do echo "file '$SEG/$f.mp4'" >> "$LIST"; done
ffmpeg -y -v error -f concat -safe 0 -i "$LIST" -c copy "$RD/mm3-silent.mp4"
echo "silent:"; ffprobe -v error -show_entries format=duration -of csv=p=0 "$RD/mm3-silent.mp4"
ffmpeg -y -v error -i "$RD/mm3-silent.mp4" -i "$(dirname "$0")/audio/narration.m4a" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest "$RD/popo-mm-demo-v3.mp4"
echo "FINAL:"; ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$RD/popo-mm-demo-v3.mp4"
