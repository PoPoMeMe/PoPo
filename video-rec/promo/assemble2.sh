#!/usr/bin/env bash
set -euo pipefail
RD=/tmp/popo-rec/promo2; FR="$RD/frames"; SEG="$RD/seg"; mkdir -p "$SEG"; rm -f "$SEG"/*.mp4
MUS="$RD/music.wav"

# smooth Ken-Burns on a still, cover 1920x1080. $1 png $2 dur $3 dir(in=+ / out=-) $4 out
zp(){
  local sign; [ "$3" = "out" ] && sign="-" || sign=""
  ffmpeg -y -v error -loop 1 -framerate 30 -t "$2" -i "$1" -f lavfi -t "$2" -i anullsrc=r=48000:cl=stereo \
   -filter_complex "[0:v]scale=3840:2160:flags=lanczos,crop=w='2*floor((3840/(1+${sign}0.05*n/(30*$2)))/2)':h='2*floor((2160/(1+${sign}0.05*n/(30*$2)))/2)':x='(in_w-(2*floor((3840/(1+${sign}0.05*n/(30*$2)))/2)))/2':y='(in_h-(2*floor((2160/(1+${sign}0.05*n/(30*$2)))/2)))/2',scale=1920:1080:flags=lanczos,fps=30,format=yuv420p[v]" \
   -map "[v]" -map 1:a -t "$2" -c:v libx264 -preset medium -crf 19 -c:a aac "$4"
}
# white flash $1 dur $2 out (quick in/out)
fl(){
  ffmpeg -y -v error -f lavfi -t "$1" -i "color=c=white:s=1920x1080:r=30" -f lavfi -t "$1" -i anullsrc=r=48000:cl=stereo \
   -filter_complex "[0:v]format=yuva420p,fade=t=in:st=0:d=0.06:alpha=1,fade=t=out:st=$(python3 -c "print(round($1-0.16,3))"):d=0.16:alpha=1,format=yuv420p[v]" \
   -map "[v]" -map 1:a -t "$1" -c:v libx264 -preset medium -crf 19 -c:a aac "$2"
}

zp "$FR/s0.png" 4.0 in  "$SEG/00.mp4"
zp "$FR/s1.png" 4.3 in  "$SEG/01.mp4"
fl 0.35               "$SEG/02.mp4"
zp "$FR/s2.png" 3.6 in  "$SEG/03.mp4"
zp "$FR/s3.png" 3.55 out "$SEG/04.mp4"
zp "$FR/s4.png" 2.6 in  "$SEG/05.mp4"
zp "$FR/s5.png" 3.0 in  "$SEG/06.mp4"
zp "$FR/s6.png" 2.5 out "$SEG/07.mp4"
fl 0.30               "$SEG/08.mp4"
zp "$FR/s7.png" 1.7 in  "$SEG/09.mp4"
fl 0.35               "$SEG/10.mp4"
zp "$FR/s8.png" 3.75 in "$SEG/11.mp4"

LIST="$SEG/list.txt"; :> "$LIST"
for f in 00 01 02 03 04 05 06 07 08 09 10 11; do echo "file '$SEG/$f.mp4'" >> "$LIST"; done
ffmpeg -y -v error -f concat -safe 0 -i "$LIST" -c copy "$RD/silent.mp4"
ffmpeg -y -v error -i "$RD/silent.mp4" -i "$MUS" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t 30 "$RD/popo-promo-epic.mp4"
ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$RD/popo-promo-epic.mp4"
