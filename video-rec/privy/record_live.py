#!/usr/bin/env python3
"""Live Privy recorder. Attaches to the ALREADY-LOGGED-IN tab, drives scripted
navigation with JS clicks, starts a continuous screencast, opens the Privy
approve modal, then WAITS for the human to click Approve in the real window.

Writes status to /tmp/popo-rec/privy-live/status.json for coordination.
Markers carry wall-clock seconds into the continuous clip.
"""
import base64, json, os, subprocess, sys, threading, time, urllib.request
sys.path.insert(0, "/Users/stark/Desktop/PP/pp-all/hackathon/video-rec/shared")
from cdp import CDP

RD="/tmp/popo-rec/privy-live"; FR=os.path.join(RD,"frames")
os.makedirs(FR,exist_ok=True)
for f in os.listdir(FR):
    try: os.remove(os.path.join(FR,f))
    except OSError: pass
STATUS=os.path.join(RD,"status.json")
MARKERS=os.path.join(RD,"markers.json")
MARKET="https://app.popo.meme/10143/prediction/0x8edd4f401c9da493f2e9cc33066b496ae8498f189d5e50767197455f2deb89a6"
PRED="https://app.popo.meme/10143/prediction"
WALLET="0x27724973F99D01a37F6dD2a517936be13c53f2a8"

def st(d):
    d["ts"]=time.time(); open(STATUS,"w").write(json.dumps(d,indent=1)); print("STATE",d.get("phase"),flush=True)

def targets(): return json.load(urllib.request.urlopen("http://127.0.0.1:18800/json",timeout=5))
tab=next(t for t in targets() if t.get("type")=="page" and "popo.meme" in t.get("url",""))
c=CDP(tab["webSocketDebuggerUrl"],tab["id"])
c.cmd("Page.enable"); c.set_device(1440,900,1); c.bring_to_front()

frames=[]; lock=threading.Lock(); n=[0]; collecting=[False]; t0=[0]
def consumer():
    while True:
        ev=c.next_event(0.3)
        if not ev: continue
        if ev.get("method")=="Page.screencastFrame" and collecting[0]:
            p=ev["params"]
            try: c.cmd("Page.screencastFrameAck",{"sessionId":p["sessionId"]},timeout=5)
            except Exception: pass
            n[0]+=1; fp=os.path.join(FR,f"f{n[0]:06d}.jpg")
            with open(fp,"wb") as fh: fh.write(base64.b64decode(p["data"]))
            with lock: frames.append((fp,time.time()-t0[0]))
        if ev.get("method")=="__STOP__": return
th=threading.Thread(target=consumer,daemon=True); th.start()

markers={}
def mark(name): markers[name]=round(time.time()-t0[0],3); print("MARK",name,markers[name],flush=True)

def sleep(s): time.sleep(s)
def body(): return c.eval("(document.body.innerText||'')")
def modal_open(): return "Approve transaction" in body()

st({"phase":"starting"})
c.navigate(PRED); sleep(5)
c.eval("document.documentElement.scrollTop=0",await_promise=False); sleep(1)

# start continuous recording
c.eval(("(()=>{const d=document.createElement('div');d.id='__hb';"
  "d.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;z-index:99999;pointer-events:none;background:#000';"
  "document.body.appendChild(d);let i=0;(function f(){d.style.background=(i++%2)?'#000':'#020202';"
  "requestAnimationFrame(f);})();return 1;})()"),await_promise=False)
collecting[0]=True; t0[0]=time.time()
c.cmd("Page.startScreencast",{"format":"jpeg","quality":82,"maxWidth":1440,"maxHeight":900,"everyNthFrame":1})
mark("record_start"); st({"phase":"recording_prediction"})
sleep(4)

# beat02: open wallet menu via real coordinate click
c.click(127,868); sleep(4); mark("wallet_menu")
sleep(2)
c.cmd("Input.dispatchKeyEvent",{"type":"keyDown","key":"Escape","code":"Escape","windowsVirtualKeyCode":27})
sleep(0.8)

# beat03: open market detail, scroll, choose 1 share
c.navigate(MARKET); sleep(5); mark("market_detail")
c.eval("document.documentElement.scrollTop=Math.min(200,document.documentElement.scrollHeight)",await_promise=False); sleep(1.5)
# set shares = 1 by clicking quick button inside trade panel
clicked=c.eval(r'''(()=>{const btns=[...document.querySelectorAll('button')];
 const q=btns.find(b=>(b.innerText||'').trim()==='1' && b.getBoundingClientRect().x>1000);
 if(q){q.click();return true;} return false;})()''')
print("quick1:",clicked,flush=True); sleep(1)
st({"phase":"ready_to_buy","quick1":clicked}); sleep(1.5)

# open Privy approve modal (scripted; signing stays human)
bought=c.eval(r'''(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='Buy Yes' && x.getBoundingClientRect().y>0 && x.getBoundingClientRect().y<880);
 if(b){b.click();return true;} return false;})()''')
print("buyyes:",bought,flush=True)
# wait modal
for _ in range(40):
    if modal_open(): break
    sleep(0.5)
ok=modal_open(); mark("approve_modal"); st({"phase":"awaiting_approval","modal":ok,"buy_clicked":bought})
if not ok:
    st({"phase":"error","reason":"modal did not open"})
    raise SystemExit(2)

# wait for human to approve (up to 4 min)
approved=False
for i in range(240):
    sleep(1)
    if not modal_open():
        approved=True; break
mark("approved"); st({"phase":"approved_detected"})
sleep(3)

# beat05: scroll recent trades into view and read fresh row / your YES
c.eval("document.documentElement.scrollTop=Math.max(0,document.documentElement.scrollHeight-2000)",await_promise=False); sleep(3)
mark("recent_trades")
info=c.eval(r'''(()=>{const t=document.body.innerText||"";
 const yes=(t.match(/Your YES\s*\n?\s*([0-9,]+)/)||[])[1]||null;
 const m=t.match(/BUY YES[\s\S]{0,80}?1 share/);
 return {yourYes:yes, hasNewOneShare:!!m};})()''')
print("post info:",info,flush=True)
sleep(6)
mark("hold_end")

collecting[0]=False
try: c.cmd("Page.stopScreencast",timeout=5)
except Exception: pass
st({"phase":"encoding","frames":n[0]})
if len(frames)<2: raise SystemExit("too few frames")
wall=frames[-1][1]
lst=os.path.join(RD,"frames.txt")
with open(lst,"w") as fh:
    for i,(fp,t) in enumerate(frames):
        d=(frames[i+1][1]-t) if i+1<len(frames) else 0.1
        fh.write(f"file '{fp}'\nduration {d:.4f}\n")
    fh.write(f"file '{frames[-1][0]}'\n")
out=os.path.join(RD,"privy-live.mp4")
subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",lst,
  "-vf","fps=30,scale=1440:900,format=yuv420p","-c:v","libx264","-preset","medium","-crf","20",out],check=True)
mark["record_wall"]=round(wall,3); mark["frames"]=len(frames); mark["post"]=info
open(MARKERS,"w").write(json.dumps(markers,indent=1))
c.capture(os.path.join(RD,"final.png"))
st({"phase":"done","clip":out,"markers":markers})
c.ws.close()
