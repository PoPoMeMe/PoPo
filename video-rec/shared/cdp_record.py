#!/usr/bin/env python3
"""Record a Chrome tab via CDP Page.startScreencast into an h264 mp4 (1440x900).

Single-reader CDP client (shared/cdp.py) dispatches screencast frames here.
Chrome only streams frames while the page repaints, so an invisible rAF
heartbeat is injected to force ~30fps even on static dashboards.
"""
import base64, os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from cdp import CDP

HEARTBEAT = ("(()=>{const d=document.createElement('div');d.id='__hb';"
  "d.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;z-index:99999;pointer-events:none;background:#000';"
  "document.body.appendChild(d);let i=0;(function f(){d.style.background=(i++%2)?'#000':'#020202';"
  "requestAnimationFrame(f);})();return 1;})()")

class Recorder:
    def __init__(self, url, outdir, w=1440, h=900, dpr=2, quality=82):
        self.url=url; self.outdir=outdir; self.w=w; self.h=h
        os.makedirs(outdir, exist_ok=True)
        self.frames=os.path.join(outdir,"frames"); os.makedirs(self.frames, exist_ok=True)
        for f in os.listdir(self.frames):
            try: os.remove(os.path.join(self.frames,f))
            except OSError: pass
        self.c=CDP.new_tab("about:blank")
        self.c.cmd("Page.enable")
        self.c.set_device(w,h,dpr); self.c.bring_to_front()
        self._frames=[]; self._n=0; self._q=quality; self._collecting=False

    def _drain(self, seconds):
        end=time.time()+seconds
        while time.time()<end:
            ev=self.c.next_event(0.5)
            if ev and ev.get("method")=="Page.screencastFrame" and self._collecting:
                p=ev["params"]
                self.c.cmd("Page.screencastFrameAck",{"sessionId":p["sessionId"]})
                self._n+=1
                fp=os.path.join(self.frames,f"f{self._n:06d}.jpg")
                with open(fp,"wb") as fh: fh.write(base64.b64decode(p["data"]))
                self._frames.append((fp,time.time()-self._wall0))

    def start(self):
        self.c.navigate(self.url)
        self.c.eval(HEARTBEAT, await_promise=False)
        self._collecting=True
        self._wall0=time.time()
        self.c.cmd("Page.startScreencast",{"format":"jpeg","quality":self._q,
                                          "maxWidth":self.w,"maxHeight":self.h,"everyNthFrame":1})

    def eval(self,e,await_promise=True): return self.c.eval(e,await_promise=await_promise)
    def click(self,x,y): self.c.click(x,y)
    def wait(self,s): self._drain(s)

    def stop(self,out_mp4,fps=30):
        self._collecting=False
        try: self.c.cmd("Page.stopScreencast",timeout=5)
        except Exception: pass
        norm=list(self._frames)
        if len(norm)<2:
            self.c.close_tab(); raise RuntimeError(f"only {len(norm)} frames captured")
        wall=max(2.0,norm[-1][1])
        lst=os.path.join(self.outdir,"frames.txt")
        with open(lst,"w") as fh:
            for i,(fp,t) in enumerate(norm):
                d=(norm[i+1][1]-t) if i+1<len(norm) else 0.1
                fh.write(f"file '{fp}'\nduration {d:.4f}\n")
            fh.write(f"file '{norm[-1][0]}'\n")
        subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",lst,
                        "-vf",f"fps={fps},scale={self.w}:{self.h},format=yuv420p",
                        "-c:v","libx264","-preset","medium","-crf","20",out_mp4],check=True)
        self.c.close_tab()
        return out_mp4,len(norm),wall
