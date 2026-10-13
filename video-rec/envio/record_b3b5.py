#!/usr/bin/env python3
"""Re-record b3 (code tab switch via show()) and b5 (trades + raw JSON)."""
import os, sys
sys.path.insert(0, "/Users/stark/Desktop/PP/pp-all/hackathon/video-rec/shared")
from cdp_record import Recorder
BASE="http://127.0.0.1:9999"; OUT="/tmp/popo-rec/envio-clips"; os.makedirs(OUT,exist_ok=True)

# b3: config -> schema (at ~5s) -> handler (at ~14s)
r=Recorder(BASE+"/code.html", os.path.join(OUT,"b3-impl"))
r.start()
r.wait(5.0); print("-> schema", r.eval("(show(1),document.querySelectorAll('.tab')[1].classList.contains('on'))"))
r.wait(9.0); print("-> handler", r.eval("(show(2),document.querySelectorAll('.tab')[2].classList.contains('on'))"))
r.wait(6.0)
mp4,n,d=r.stop(os.path.join(OUT,"b3-impl.mp4")); print("b3 frames",n,"wall",round(d,2))

# b5: table 6s -> open raw JSON and hold ~16s -> close near end -> table
r=Recorder(BASE+"/dashboard.html", os.path.join(OUT,"b5-trades"))
r.start()
r.wait(6.5)
disp=r.eval("(async()=>{await showRaw();return document.getElementById('rawpanel').style.display;})()")
print("raw panel:",disp)
r.wait(15.0)
r.eval("document.getElementById('rawclose').click()"); 
r.wait(3.0)
mp4,n,d=r.stop(os.path.join(OUT,"b5-trades.mp4")); print("b5 frames",n,"wall",round(d,2))
print("DONE")
