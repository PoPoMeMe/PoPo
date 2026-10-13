#!/usr/bin/env bash
set -euo pipefail
RD=/tmp/popo-rec
CL="$RD/alchemy-clips"; CARDS="$RD/alchemy-cards"; SEG="$RD/alchemy-seg"
rm -rf "$SEG"; mkdir -p "$SEG"
AUD="/Users/stark/Desktop/PP/pp-all/hackathon/video-rec/alchemy/audio/narration.m4a"
SRC="$CL/a-full.mp4"; RAW="$CL/b-raw.mp4"

card(){ ffmpeg -y -v error -loop 1 -t "$2" -i "$1" -f lavfi -t "$2" -i anullsrc=r=48000:cl=stereo \
  -vf "fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 20 -c:a aac -shortest "$3"; }
# from full dashboard, crop a region x,y,w,h and zoom to fill 1440x900, for given window from src ss
cropzoom(){ # $1 src $2 ss $3 dur $4 x $5 y $6 w $7 h $8 out
  ffmpeg -y -v error -ss "$2" -t "$3" -i "$1" -f lavfi -t "$3" -i anullsrc=r=48000:cl=stereo \
    -filter_complex "[0:v]crop=$6:$7:$4:$5,scale=1440:900:force_original_aspect_ratio=decrease:flags=lanczos,pad=1440:900:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[v]" \
    -map "[v]" -map 1:a -c:v libx264 -preset medium -crf 20 -c:a aac "$8";
}
full(){ ffmpeg -y -v error -ss "$2" -t "$3" -i "$1" -f lavfi -t "$3" -i anullsrc=r=48000:cl=stereo \
  -map 0:v:0 -map 1:a -c:v libx264 -preset medium -crf 20 -c:a aac "$4"; }

# beat windows (sum 105.96 visual + tail handled by t 106.96)
card "$CARDS/intro.png" 18.19 "$SEG/01.mp4"
# 02 supernode: full dashboard (chips incl. chainId + RPC strategy + fallback code) 22.03
full     "$SRC" 0.5 22.03 "$SEG/02.mp4"
# 03 balance: left balance panel (x40 y250 w706 h268) 23.19
cropzoom "$SRC" 1.0 23.19 40 250 706 405 "$SEG/03.mp4"
# 04 transfers: right panel + raw JSON. panel crop (x754 y250 w646 h268) 9s, then raw clip from b-raw (panel opens at 4s) 13.22
cropzoom "$SRC" 1.0 9.0 754 250 646 405 "$SEG/04a.mp4"
full     "$RAW" 5.0 13.22 "$SEG/04b.mp4"
# 05 close: full dashboard 5 + close card 12.23
full     "$SRC" 1.0 5.0 "$SEG/05a.mp4"
card "$CARDS/close.png" 16.40 "$SEG/05b.mp4"

LIST="$SEG/list.txt"; : > "$LIST"
for f in 01 02 03 04a 04b 05a 05b; do echo "file '$SEG/$f.mp4'" >> "$LIST"; done
ffmpeg -y -v error -f concat -safe 0 -i "$LIST" -c copy "$RD/alchemy-silent.mp4"
echo "silent:"; ffprobe -v error -show_entries format=duration -of csv=p=0 "$RD/alchemy-silent.mp4"
ffmpeg -y -v error -i "$RD/alchemy-silent.mp4" -i "$AUD" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest "$RD/popo-alchemy-demo.mp4"
echo "FINAL:"; ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$RD/popo-alchemy-demo.mp4"
