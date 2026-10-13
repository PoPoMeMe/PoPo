#!/usr/bin/env python3
"""Record the four Envio screen scenarios to separate mp4 clips via CDP."""
import os, sys, time
sys.path.insert(0, "/Users/stark/Desktop/PP/pp-all/hackathon/video-rec/shared")
from cdp_record import Recorder

BASE="http://127.0.0.1:9999"
OUT="/tmp/popo-rec/envio-clips"; os.makedirs(OUT,exist_ok=True)

def click_xy(r,x,y): r.click(x,y)

def record(name,url,dur,scenario):
    r=Recorder(url,os.path.join(OUT,name))
    r.start()
    try: scenario(r)
    except Exception as e: print("scenario",name,"error",e)
    r.wait(dur)
    mp4=os.path.join(OUT,name+".mp4")
    mp4,n,d=r.stop(mp4)
    print(name,"frames",n,"wall",round(d,2),"->",mp4)

# tab x centers (from layout): config ~110, schema ~300, handler ~560 at dpr logical px
TAB_X=[110,300,565]; TAB_Y=118

def code_config(r):
    # start on config tab (default); settle
    r.wait(2.5)
def code_impl(r):
    r.wait(1.5)
    click_xy(r,TAB_X[1],TAB_Y); r.wait(8.5)      # schema tab
    click_xy(r,TAB_X[2],TAB_Y)                    # handler tab until end

def stats(r):
    r.wait(1.0)

def trades(r):
    r.wait(6.0)
    # open raw JSON panel (button near top-right of dashboard, under live chip)
    r.eval("showRaw()");

record("b2-config", BASE+"/code.html", 16.2, code_config)
record("b3-impl",   BASE+"/code.html", 19.4, code_impl)
record("b4-stats",  BASE+"/dashboard.html", 14.4, stats)
record("b5-trades", BASE+"/dashboard.html", 22.1, trades)
print("ALL DONE")
