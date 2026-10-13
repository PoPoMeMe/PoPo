#!/usr/bin/env bash
set -euo pipefail
RD=/tmp/popo-rec
SC="$RD/privy-scenes"; LIVE="$RD/privy-live/privy-live.mp4"; CARDS="$RD/privy-cards"; SEG="$RD/privy-seg"
rm -rf "$SEG"; mkdir -p "$SEG"
AUD="/Users/stark/Desktop/PP/pp-all/hackathon/video-rec/privy/audio/narration.m4a"

sil(){ ffmpeg -y -v error -f lavfi -t "$2" -i anullsrc=r=48000:cl=stereo "$3"; }
# still card: $1 png $2 dur $3 out $4 cap?(optional png)
cardseg(){
  local dur="$2"; local out="$3"
  ffmpeg -y -v error -loop 1 -t "$dur" -i "$1" -f lavfi -t "$dur" -i anullsrc=r=48000:cl=stereo \
    -vf "fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 20 -c:a aac "$out"
}
# live/scene segment: $1 src $2 ss $3 dur $4 out $5 caption-or-empty
vidseg(){
  local src="$1" ss="$2" dur="$3" out="$4" cap="$5"
  if [ -n "$cap" ]; then
    ffmpeg -y -v error -ss "$ss" -t "$dur" -i "$src" -loop 1 -t "$dur" -i "$cap" \
      -f lavfi -t "$dur" -i anullsrc=r=48000:cl=stereo \
      -filter_complex "[0:v]fps=30,scale=1440:900,format=yuv420p[bg];[1:v]scale=1440:900[ov];[bg][ov]overlay=0:0:shortest=1[v]" \
      -map "[v]" -map 2:a -t "$dur" -c:v libx264 -preset medium -crf 20 -c:a aac "$out"
  else
    ffmpeg -y -v error -ss "$ss" -t "$dur" -i "$src" -f lavfi -t "$dur" -i anullsrc=r=48000:cl=stereo \
      -map 0:v:0 -map 1:a -c:v libx264 -preset medium -crf 20 -c:a aac "$out"
  fi
}
# live approve: 246..258.7 real (12.656) + freeze last frame 3.4
live(){
  # s4a: dialog shown -> user Approve (246..253.75 = 7.75s) capped; freeze a touch
  ffmpeg -y -v error -ss 246 -t 7.75 -i "$LIVE" -loop 1 -t 7.75 -i "$CARDS/cap_approve.png" \
    -f lavfi -t 7.75 -i anullsrc=r=48000:cl=stereo \
    -filter_complex "[0:v]fps=30,scale=1440:900,format=yuv420p[bg];[1:v]scale=1440:900[ov];[bg][ov]overlay=0:0:shortest=1[v]" \
    -map "[v]" -map 2:a -t 7.75 -c:v libx264 -preset medium -crf 20 -c:a aac "$SEG/s4a.mp4"
  # s4b: processing -> submitted -> bought (253.75..258.7 = 4.95s) + freeze 3.356
  ffmpeg -y -v error -ss 253.75 -t 4.95 -i "$LIVE" -loop 1 -t 8.306 -i "$CARDS/cap_confirmed.png" \
    -f lavfi -t 8.306 -i anullsrc=r=48000:cl=stereo \
    -filter_complex "[0:v]fps=30,scale=1440:900,tpad=stop_mode=clone:stop_duration=3.356,format=yuv420p[bg];[1:v]scale=1440:900[ov];[bg][ov]overlay=0:0:shortest=1[v]" \
    -map "[v]" -map 2:a -t 8.306 -c:v libx264 -preset medium -crf 20 -c:a aac "$SEG/s4b.mp4"
}

# s1: intro card 12.0 + prediction 6.808
cardseg "$CARDS/intro.png" 12.0 "$SEG/s1a.mp4"
vidseg  "$SC/pred.mp4" 2.0 6.808 "$SEG/s1b.mp4" ""
# s2 wallet menu 14.856
vidseg "$SC/wallet.mp4" 2.5 14.856 "$SEG/s2.mp4" "$CARDS/cap_wallet.png"
# s3 market 15.264
vidseg "$SC/market.mp4" 2.0 15.264 "$SEG/s3.mp4" "$CARDS/cap_market.png"
# s4 live approve
live
# s5 recent 15.524
vidseg "$SC/recent.mp4" 2.0 15.524 "$SEG/s5.mp4" "$CARDS/cap_confirmed.png"
cardseg "$CARDS/close.png" 19.328 "$SEG/s6.mp4"

LIST="$SEG/list.txt"; : > "$LIST"
echo "file '$SEG/s1a.mp4'" >> "$LIST"
echo "file '$SEG/s1b.mp4'" >> "$LIST"
for f in s2 s3 s4a s4b s5 s6; do echo "file '$SEG/$f.mp4'" >> "$LIST"; done
ffmpeg -y -v error -f concat -safe 0 -i "$LIST" -c copy "$RD/privy-silent.mp4"
ffmpeg -y -v error -i "$RD/privy-silent.mp4" -i "$AUD" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest "$RD/popo-privy-demo.mp4"
ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$RD/popo-privy-demo.mp4"
