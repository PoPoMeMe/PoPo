#!/usr/bin/env python3
"""Capture clean static scenes by attaching to existing tab. Navigate FIRST,
inject heartbeat, THEN start screencast (avoids stale post-navigation frames)."""
import base64, json, os, subprocess, sys, threading, time, urllib.request
sys.path.insert(0, "/Users/stark/Desktop/PP/pp-all/hackathon/video-rec/shared")
from cdp import CDP
RD="/tmp/popo-rec/privy-scenes"; FR=os.path.join(RD,"frames")
os.makedirs(FR,exist_ok=True)
PRED="https://app.popo.meme/10143/prediction"
MKT="https://app.popo.meme/10143/prediction/0x8edd4f401c9da493f2e9cc33066b496ae8498f189d5e50767197455f2deb89a6"
HB=("(()=>{let d=document.getElementById('__hb');if(!d){d=document.createElement('div');d.id='__hb';"
    "d.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;z-index:99999;pointer-events:none;';document.body.appendChild(d);}"
    "let i=0;(function f(){d.style.background=(i++%2)?'#050505':'#070707';requestAnimationFrame(f);})();return 1;})()")

def targets(): return json.load(urllib.request.urlopen("http://127.0.0.1:18800/json",timeout=5))
tab=next(t for t in targets() if t.get("type")=="page" and "popo.meme" in t.get("url",""))
c=CDP(tab["webSocketDebuggerUrl"],tab["id"])
c.cmd("Page.enable"); c.set_device(1440,900,1); c.bring_to_front()

class Cap:
    def __init__(s,name,dur):
        s.name=name;s.dur=dur;s.fr=[];os.makedirs(os.path.join(FR,name),exist_ok=True)
        for f in os.listdir(os.path.join(FR,name)):
            try:os.remove(os.path.join(FR,name,f))
            except:pass
        s.n=0;s.run=True
    def consume(s,seconds=None):
        end=time.time()+(seconds if seconds is not None else s.dur)
        while time.time()<end and s.run:
            ev=c.next_event(0.3)
            if ev and ev.get("method")=="Page.screencastFrame":
                p=ev["params"]
                try:c.cmd("Page.screencastFrameAck",{"sessionId":p["sessionId"]},timeout=5)
                except:pass
                s.n+=1
                fp=os.path.join(FR,s.name,f"f{s.n:05d}.jpg")
                open(fp,"wb").write(base64.b64decode(p["data"])); s.fr.append(fp)
    def encode(s):
        if len(s.fr)<2: print("WARN few frames",s.name,len(s.fr))
        lst=os.path.join(FR,s.name,"list.txt")
        with open(lst,"w") as fh:
            for f in s.fr: fh.write(f"file '{f}'\nduration 0.0333\n")
            fh.write(f"file '{s.fr[-1]}'\n")
        out=os.path.join(RD,s.name+".mp4")
        subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",lst,
          "-vf","fps=30,scale=1440:900,format=yuv420p","-c:v","libx264","-preset","medium","-crf","20",out],check=True)
        print(s.name,s.n,"frames ->",out)

def start_cast():
    c.cmd("Page.startScreencast",{"format":"jpeg","quality":84,"maxWidth":1440,"maxHeight":900,"everyNthFrame":1})
def stop_cast():
    try:c.cmd("Page.stopScreencast",timeout=5)
    except:pass
    time.sleep(0.3)

# Scene 1: prediction list
c.navigate(PRED); time.sleep(5); c.eval("document.documentElement.scrollTop=0",await_promise=False); c.eval(HB,await_promise=False); time.sleep(0.5)
cap=Cap("pred",8); start_cast(); cap.consume(); stop_cast(); cap.encode()

# Scene 2: wallet menu (click during cast)
start_cast(); c.click(127,868); cap=Cap("wallet",8); cap.consume(8); stop_cast(); cap.encode()
c.cmd("Input.dispatchKeyEvent",{"type":"keyDown","key":"Escape","code":"Escape","windowsVirtualKeyCode":27}); time.sleep(0.6)

# Scene 3: market trade panel scrolled 200
c.navigate(MKT); time.sleep(5); c.eval("document.documentElement.scrollTop=200",await_promise=False); c.eval(HB,await_promise=False); time.sleep(1)
cap=Cap("market",9); start_cast(); cap.consume(); stop_cast(); cap.encode()
c.capture(os.path.join(RD,"market.png"))

# Scene 4: recent trades (scroll bottom)
c.eval("document.documentElement.scrollTop=document.documentElement.scrollHeight",await_promise=False); time.sleep(1.5); c.eval(HB,await_promise=False)
cap=Cap("recent",9); start_cast(); cap.consume(); stop_cast(); cap.encode()
c.capture(os.path.join(RD,"recent.png"))
print("ALL DONE")
c.ws.close()
