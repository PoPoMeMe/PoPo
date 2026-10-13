#!/usr/bin/env python3
"""Minimal CDP client (stdlib websocket) with a SINGLE reader thread that
dispatches command responses and events — safe for Page.startScreencast.

Drives the already-running Chrome (Profile 35, remote-debugging-port=18800).
"""
import base64, json, os, socket, struct, threading, time, urllib.request, secrets, queue

PORT = int(os.environ.get("CDP_PORT", "18800"))

def _http(path, method="GET"):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}{path}", method=method)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())

class WS:
    def __init__(self, url):
        hostport, path = url[5:].split("/", 1)
        host, port = hostport.split(":")
        self.s = socket.create_connection((host, int(port)), timeout=20)
        key = base64.b64encode(secrets.token_bytes(16)).decode()
        req = (f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\n"
               f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.s.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf: buf += self.s.recv(4096)
        self._buf = b""; self._sendlock=threading.Lock()
    def send(self, payload):
        data=payload.encode(); hdr=bytearray([0x81]); n=len(data); mask=secrets.token_bytes(4)
        if n<126: hdr.append(0x80|n)
        elif n<65536: hdr.append(0x80|126); hdr+=struct.pack(">H",n)
        else: hdr.append(0x80|127); hdr+=struct.pack(">Q",n)
        hdr+=mask
        masked=bytes(b ^ mask[i%4] for i,b in enumerate(data))
        with self._sendlock: self.s.sendall(bytes(hdr)+masked)
    def _rd(self,n):
        while len(self._buf)<n:
            chunk=self.s.recv(65536)
            if not chunk: raise IOError("ws closed")
            self._buf+=chunk
        out,self._buf=self._buf[:n],self._buf[n:]
        return out
    def recv(self):
        b0,b1=self._rd(2); ln=b1&0x7f
        if ln==126: ln=struct.unpack(">H",self._rd(2))[0]
        elif ln==127: ln=struct.unpack(">Q",self._rd(8))[0]
        return self._rd(ln).decode("utf-8","replace")
    def close(self):
        try: self.s.close()
        except Exception: pass

class CDP:
    def __init__(self, ws_url, target_id):
        self.ws=WS(ws_url); self.tid=target_id
        self._id=0; self._lock=threading.Lock()
        self._pend={}; self._events=queue.Queue()
        self._running=True
        self._thr=threading.Thread(target=self._reader,daemon=True); self._thr.start()
    @classmethod
    def new_tab(cls,url="about:blank"):
        t=_http(f"/json/new?{urllib.request.quote(url,safe=':/?=&')}","PUT")
        return cls(t["webSocketDebuggerUrl"],t["id"])
    def _reader(self):
        while self._running:
            try: raw=self.ws.recv()
            except Exception:
                break
            if not raw: continue
            try: msg=json.loads(raw)
            except Exception: continue
            if "id" in msg:
                q=self._pend.get(msg["id"])
                if q: q.put(msg)
            elif "method" in msg:
                self._events.put(msg)
    def cmd(self,method,params=None,timeout=30):
        with self._lock: self._id+=1; mid=self._id
        q=queue.Queue(1); self._pend[mid]=q
        self.ws.send(json.dumps({"id":mid,"method":method,"params":params or {}}))
        try: msg=q.get(timeout=timeout)
        finally: self._pend.pop(mid,None)
        if "error" in msg: raise RuntimeError(f"{method}: {msg['error']}")
        return msg.get("result",{})
    def next_event(self,timeout=1.0):
        try: return self._events.get(timeout=timeout)
        except queue.Empty: return None
    def eval(self,expr,timeout=30,await_promise=True):
        r=self.cmd("Runtime.evaluate",{"expression":expr,"returnByValue":True,"awaitPromise":await_promise},timeout)
        if "exceptionDetails" in r: raise RuntimeError(str(r["exceptionDetails"])[:300])
        return r.get("result",{}).get("value")
    def navigate(self,url):
        self.cmd("Page.navigate",{"url":url}); time.sleep(2.0)
    def wait(self,s): time.sleep(s)
    def metrics(self): return self.eval("({w:innerWidth,h:innerHeight,dpr:devicePixelRatio})")
    def set_device(self,w=1440,h=900,dpr=2):
        self.cmd("Emulation.setDeviceMetricsOverride",{"width":w,"height":h,"deviceScaleFactor":dpr,"mobile":False})
    def bring_to_front(self):
        try: self.cmd("Page.bringToFront")
        except Exception: pass
    def click(self,x,y):
        for t in ("mousePressed","mouseReleased"):
            self.cmd("Input.dispatchMouseEvent",{"type":t,"x":x,"y":y,"button":"left","clickCount":1})
    def capture(self,path,fmt="png"):
        r=self.cmd("Page.captureScreenshot",{"format":fmt,"captureBeyondViewport":False})
        with open(path,"wb") as f: f.write(base64.b64decode(r["data"]))
        return path
    def close_tab(self):
        self._running=False
        try: _http(f"/json/close/{self.tid}","GET")
        except Exception: pass
        self.ws.close()
    def __enter__(self): return self
    def __exit__(self,*a): self.close_tab()
