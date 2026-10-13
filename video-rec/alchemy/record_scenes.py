#!/usr/bin/env python3
import os, sys
sys.path.insert(0, "/Users/stark/Desktop/PP/pp-all/hackathon/video-rec/shared")
from cdp_record import Recorder
BASE="http://127.0.0.1:9999/alchemy/dashboard.html"
OUT="/tmp/popo-rec/alchemy-clips"; os.makedirs(OUT,exist_ok=True)

# take A: full dashboard, settle, gentle highlight (no overlay) ~ 30s
r=Recorder(BASE, os.path.join(OUT,"a-full"))
r.start(); r.wait(30.0)
mp4,n,d=r.stop(os.path.join(OUT,"a-full.mp4")); print("A frames",n,"wall",round(d,2))

# take B: full 4s -> open raw JSON, hold ~26s
r=Recorder(BASE, os.path.join(OUT,"b-raw"))
r.start(); r.wait(4.0)
print("raw open:", r.eval("(document.getElementById('rawbtn').click(),document.getElementById('rawpanel').style.display)"))
r.wait(27.0)
mp4,n,d=r.stop(os.path.join(OUT,"b-raw.mp4")); print("B frames",n,"wall",round(d,2))
print("DONE")
