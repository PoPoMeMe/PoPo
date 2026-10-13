#!/usr/bin/env bash
set -euo pipefail
RD=/tmp/popo-rec
CARDS="$RD/promo/cards"; SEG="$RD/promo-seg"; mkdir -p "$SEG"; rm -f "$SEG"/*.mp4
MUS="$RD/promo/music.wav"

zp(){
  local WX="2*floor((2880/(1+0.06*n/(30*$2)))/2)" HX="2*floor((1800/(1+0.06*n/(30*$2)))/2)"
  ffmpeg -y -v error -loop 1 -framerate 30 -t "$2" -i "$1" -f lavfi -t "$2" -i anullsrc=r=48000:cl=stereo \
    -filter_complex "[0:v]scale=2880:1800:flags=lanczos,crop=w='${WX}':h='${HX}':x='(in_w-(${WX}))/2':y='(in_h-(${HX}))/2',scale=1440:900:flags=lanczos,fps=30,format=yuv420p[v]" \
    -map "[v]" -map 1:a -t "$2" -c:v libx264 -preset medium -crf 20 -c:a aac "$3"
}
zp "$CARDS/c1.png" 4.5 "$SEG/s1.mp4"
zp "$CARDS/c2.png" 4.0 "$SEG/s2.mp4"
zp "$CARDS/c3.png" 4.0 "$SEG/s3.mp4"
zp "$CARDS/c4.png" 4.0 "$SEG/s4.mp4"
zp "$CARDS/c5.png" 8.0 "$SEG/s5.mp4"
zp "$CARDS/c6.png" 3.5 "$SEG/s6.mp4"

LIST="$SEG/list.txt"; : > "$LIST"
for f in s1 s2 s3 s4 s5 s6; do echo "file '$SEG/$f.mp4'" >> "$LIST"; done
ffmpeg -y -v error -f concat -safe 0 -i "$LIST" -c copy "$RD/promo-silent.mp4"
ffmpeg -y -v error -i "$RD/promo-silent.mp4" -i "$MUS" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -t 28 "$RD/popo-promo.mp4"
ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$RD/popo-promo.mp4"
