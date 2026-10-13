#!/usr/bin/env bash
set -euo pipefail
RD=/tmp/popo-rec
CL="$RD/envio-clips"; CARDS="$RD/envio-cards"; SEG="$RD/envio-seg"
rm -rf "$SEG"; mkdir -p "$SEG"
AUD="/Users/stark/Desktop/PP/pp-all/hackathon/video-rec/envio/audio/narration.m4a"

card(){ ffmpeg -y -v error -loop 1 -t "$2" -i "$1" -f lavfi -t "$2" -i anullsrc=r=48000:cl=stereo \
  -vf "fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 20 -c:a aac -shortest "$3"; }
# screen clips already 1440x900 30fps; trim to exact window from the head
trim(){ ffmpeg -y -v error -ss 0 -i "$1" -t "$2" -f lavfi -t "$2" -i anullsrc=r=48000:cl=stereo \
  -map 0:v:0 -map 1:a -c:v libx264 -preset medium -crf 20 -c:a aac "$3"; }

card "$CARDS/intro.png" 18.19 "$SEG/01.mp4"
trim "$CL/b2-config.mp4" 16.30 "$SEG/02.mp4"
trim "$CL/b3-impl.mp4"   19.51 "$SEG/03.mp4"
trim "$CL/b4-stats.mp4"  14.50 "$SEG/04.mp4"
trim "$CL/b5-trades.mp4" 22.20 "$SEG/05.mp4"
card "$CARDS/close.png" 11.36 "$SEG/06.mp4"

LIST="$SEG/list.txt"; : > "$LIST"
for f in 01 02 03 04 05 06; do echo "file '$SEG/$f.mp4'" >> "$LIST"; done
ffmpeg -y -v error -f concat -safe 0 -i "$LIST" -c copy "$RD/envio-silent.mp4"
echo "silent:"; ffprobe -v error -show_entries format=duration -of csv=p=0 "$RD/envio-silent.mp4"
ffmpeg -y -v error -i "$RD/envio-silent.mp4" -i "$AUD" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -t 102.96 "$RD/popo-envio-demo.mp4"
echo "FINAL:"; ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$RD/popo-envio-demo.mp4"
