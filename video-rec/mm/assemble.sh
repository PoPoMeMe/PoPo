#!/usr/bin/env bash
# Assemble the MM demo from take2 + generated cards, aligned to narration.
set -euo pipefail
RD=/tmp/popo-rec
SRC="$RD/mm-take2.mp4"
CARDS="$RD/cards"
SEG="$RD/seg"
rm -rf "$SEG"; mkdir -p "$SEG"

# scale terminal 2992x1934 -> fit 1440x900 keeping every pixel (black side bars)
FIT="scale=1392:900:flags=lanczos,pad=1440:900:(ow-iw)/2:0:black,setsar=1,fps=30,format=yuv420p"

# card clip: $1 png  $2 dur  $3 out
card(){ ffmpeg -y -v error -loop 1 -t "$2" -i "$1" -f lavfi -t "$2" -i anullsrc=r=48000:cl=stereo \
  -vf "fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 20 -c:a aac -shortest "$3"; }

# terminal single clip with optional overlays: $1 ss $2 dur $3 lowerThird(png or -) $4 brand(1/0) $5 out
term(){
  local ss=$1 dur=$2 lt=$3 br=$4 out=$5
  local inputs=("-ss" "$ss" -t "$dur" -i "$SRC")
  local fc="[0:v]$FIT[v0]"; local cur="v0"; local n=1
  if [ "$lt" != "-" ]; then inputs+=( -i "$CARDS/$lt.png" ); fc="$fc;[$n:v]format=rgba[lt];[$cur][lt]overlay=0:0[vl]"; cur="vl"; n=$((n+1)); fi
  if [ "$br" = "1" ]; then inputs+=( -i "$CARDS/brand.png" ); fc="$fc;[$n:v]format=rgba[br];[$cur][br]overlay=24:20[vb]"; cur="vb"; n=$((n+1)); fi
  inputs+=( -f lavfi -t "$dur" -i anullsrc=r=48000:cl=stereo ); local ai=$n
  ffmpeg -y -v error "${inputs[@]}" -filter_complex "$fc" -map "[$cur]" -map "$ai:a" \
    -c:v libx264 -preset medium -crf 20 -c:a aac "$out"
}

# 01 intro card 15.21
card "$CARDS/intro.png" 16.21 "$SEG/01.mp4"
# 02 read 13.17
term 396.5 13.17 cap_read 1 "$SEG/02.mp4"
# 03 quote 12.79
term 704.5 12.79 cap_quote 1 "$SEG/03.mp4"
# 04 guard 13.56
term 722.0 13.56 cap_policy 1 "$SEG/04.mp4"

# 05 deposit 15.05 = waiting(8s) + result(7.05s), with caption + brand
ffmpeg -y -v error -ss 952.0 -t 8 -i "$SRC" -i "$CARDS/cap_dep_wait.png" -i "$CARDS/brand.png" -f lavfi -t 8 -i anullsrc=r=48000:cl=stereo \
  -filter_complex "[0:v]$FIT[v0];[1:v]format=rgba[lt];[v0][lt]overlay=0:0[x];[2:v]format=rgba[br];[x][br]overlay=24:20[v]" -map "[v]" -map 3:a -c:v libx264 -preset medium -crf 20 -c:a aac "$SEG/05a.mp4"
ffmpeg -y -v error -ss 967.0 -t 7.05 -i "$SRC" -i "$CARDS/cap_dep_done.png" -i "$CARDS/brand.png" -f lavfi -t 7.05 -i anullsrc=r=48000:cl=stereo \
  -filter_complex "[0:v]$FIT[v0];[1:v]format=rgba[lt];[v0][lt]overlay=0:0[x];[2:v]format=rgba[br];[x][br]overlay=24:20[v]" -map "[v]" -map 3:a -c:v libx264 -preset medium -crf 20 -c:a aac "$SEG/05b.mp4"

# 06 buy 11.78 = waiting(6s) + result(5.78s)
ffmpeg -y -v error -ss 1203.0 -t 6 -i "$SRC" -i "$CARDS/cap_buy_wait.png" -i "$CARDS/brand.png" -f lavfi -t 6 -i anullsrc=r=48000:cl=stereo \
  -filter_complex "[0:v]$FIT[v0];[1:v]format=rgba[lt];[v0][lt]overlay=0:0[x];[2:v]format=rgba[br];[x][br]overlay=24:20[v]" -map "[v]" -map 3:a -c:v libx264 -preset medium -crf 20 -c:a aac "$SEG/06a.mp4"
ffmpeg -y -v error -ss 1213.5 -t 5.78 -i "$SRC" -i "$CARDS/cap_buy_done.png" -i "$CARDS/brand.png" -f lavfi -t 5.78 -i anullsrc=r=48000:cl=stereo \
  -filter_complex "[0:v]$FIT[v0];[1:v]format=rgba[lt];[v0][lt]overlay=0:0[x];[2:v]format=rgba[br];[x][br]overlay=24:20[v]" -map "[v]" -map 3:a -c:v libx264 -preset medium -crf 20 -c:a aac "$SEG/06b.mp4"

# 07 verify 11.23 = terminal position/vault 8.2s + freeze 3.03s, caption + brand
ffmpeg -y -v error -ss 1287.8 -t 8.2 -i "$SRC" -i "$CARDS/cap_verify.png" -i "$CARDS/brand.png" -f lavfi -t 11.23 -i anullsrc=r=48000:cl=stereo \
  -filter_complex "[0:v]$FIT,tpad=stop_mode=clone:stop_duration=3.03[v0];[1:v]format=rgba[lt];[v0][lt]overlay=0:0[x];[2:v]format=rgba[br];[x][br]overlay=24:20[v]" -map "[v]" -map 3:a -c:v libx264 -preset medium -crf 20 -c:a aac "$SEG/07.mp4"

# 08 envio proof card 11.45
card "$CARDS/envio_proof.png" 11.45 "$SEG/08.mp4"
# 09 close card 14.88
card "$CARDS/close.png" 15.50 "$SEG/09.mp4"

# concat all in order (05/06 are a/b pairs)
LIST="$SEG/list.txt"; : > "$LIST"
for f in 01 02 03 04 05a 05b 06a 06b 07 08 09; do echo "file '$SEG/$f.mp4'" >> "$LIST"; done
ffmpeg -y -v error -f concat -safe 0 -i "$LIST" -c copy "$RD/mm-silent.mp4"
echo "silent assembled:"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$RD/mm-silent.mp4"

# mux narration
ffmpeg -y -v error -i "$RD/mm-silent.mp4" -i "$(dirname "$0")/audio/narration.m4a" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest "$RD/popo-mm-demo.mp4"
echo "FINAL:"
ffprobe -v error -show_entries format=duration,size:stream=codec_type,codec_name,width,height -of default=noprint_wrappers=1 "$RD/popo-mm-demo.mp4"
