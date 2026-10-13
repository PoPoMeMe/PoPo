#!/usr/bin/env python3
"""Epic 30s cinematic bed for PoPo promo v2 (100 BPM, half-time drive).
numpy only. Structure aligned to scene hits; white-flash risers at 8.2/24.0,
tagline boom at 25.9. Royalty-free (fully synthesized)."""
import numpy as np, wave, os
SR=44100; BPM=100; beat=60/BPM; DUR=30.0
N=int(SR*DUR); mix=np.zeros(N); t=np.arange(N)/SR
def add(start,sig,g=1.0):
    i=int(start*SR); j=min(N,i+len(sig));
    if i<N: mix[i:j]+=sig[:j-i]*g
def saw(x): return 2*((x%1)-.5)
def square(x): return np.sign(saw(x))
def adsr(n,a,d,sus,r):
    e=np.ones(n)
    ai=max(1,int(a*SR));di=max(1,int(d*SR));ri=max(1,int(r*SR))
    e[:min(ai,n)]=np.linspace(0,1,min(ai,n))
    if ai<n:
        k=min(di,n-ai); e[ai:ai+k]=np.linspace(1,sus,k); e[ai+k:]=sus
    if ri<n: e[-ri:]*=np.linspace(1,0,ri)
    return e

# KICK (punchy, pitch drop)
def kick(d=0.34):
    n=int(d*SR); tt=np.arange(n)/SR
    f=130*np.exp(-tt*22)+46
    body=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*7.5)
    click=(np.random.rand(n)*2-1)*np.exp(-tt*90)*0.6
    return body+click
K=kick()
# half-time: kick on beats 0 and 2 of each bar (0, 2*beat); plus driving pulse intro
for bar in range(int(DUR/(4*beat))+1):
    for b in (0,2):
        add(bar*4*beat+b*beat,K,1.0)
# extra driving four-on-floor from 8.4 (drop after flash) to 21.4
tb=8.4
while tb<21.4:
    add(tb,K,0.85); tb+=beat

# SNARE/clap on beats 1 & 3
def clap(d=0.22):
    n=int(d*SR);tt=np.arange(n)/SR;o=np.zeros(n)
    for k in (0,.011,.023,.036):
        i=int(k*SR); s=np.random.rand(n-i)*2-1; s=np.diff(s,prepend=0); o[i:]+=s
    # band-ish via simple diff x2
    return o*np.exp(-tt*13)*0.9
CL=clap()
for bar in range(int(DUR/(4*beat))+1):
    add(bar*4*beat+beat,CL,.6); add(bar*4*beat+3*beat,CL,.62)

# HATS 16ths
def hat(d=.045,o=False):
    n=int(d*SR);tt=np.arange(n)/SR;x=np.random.rand(n)*2-1;x=np.diff(x,prepend=0)
    return x*np.exp(-tt*(16 if not o else 5))*.4
H=hat();OH=hat(.2,True)
th=0.0
while th<DUR:
    add(th,H,.16); th+=beat/2
for bar in range(int(DUR/(4*beat))+1):
    add(bar*4*beat+3.5*beat,OH,.2)

# BASS (sub saw, root on bar), Am F C G
roots=[55.0,43.65,65.41,49.0]
def bass(f,d):
    n=int(d*SR);tt=np.arange(n)/SR
    s=saw(f*tt)*.6+np.sin(2*np.pi*f*tt)*.6+np.sin(2*np.pi*f*.5*tt)*.3
    return s*adsr(n,.01,.08,.7,.08)
for bar in range(int(DUR/(4*beat))+1):
    f=roots[bar%4]
    for e in (0,1.5,2,3.5):
        add(bar*4*beat+e*beat,bass(f,beat*.9),.4)

# PULSE intro: heartbeat-ish filtered kick 0..1 (soft)
def softkick(d=.5):
    n=int(d*SR);tt=np.arange(n)/SR
    return np.sin(2*np.pi*(60)*tt)*np.exp(-tt*6)*.8
add(0.0,softkick(),.5); add(0.55,softkick(),.55)

# EPIC PAD (minor, swell) whole bed under sections
def pad(freqs,d,a=.6,r=.8,g=.16):
    n=int(d*SR);tt=np.arange(n)/SR;s=np.zeros(n)
    for f in freqs:
        s+=saw(f*tt)*.22+np.sin(2*np.pi*f*tt)*.28+np.sin(2*np.pi*f*2*tt)*.05
    s/=max(1,len(freqs))
    return s*adsr(n,a,.3,.6,r)*g
chords=[[220.,261.63,329.63],[174.61,220.,261.63],[196.,246.94,293.66],[196.,246.94,392.]]
for bar in range(int(DUR/(4*beat))+1):
    add(bar*4*beat,pad(chords[bar%4],4*beat),.18)

# RISERS into flashes at 8.2 and 24.0, and 25.7
def riser(d=1.4):
    n=int(d*SR);tt=np.arange(n)/SR
    x=np.random.rand(n)*2-1;x=np.diff(x,prepend=0)
    x*=np.linspace(.02,1,n)**2.2
    x+=np.sin(2*np.pi*(180+((tt/d)**2)*1600)*tt)*.18*np.linspace(.1,1,n)
    return x*.5
add(6.9,riser(1.3),.4)
add(22.6,riser(1.4),.5)
def impact(d=1.4,g=1.0):
    n=int(d*SR);tt=np.arange(n)/SR
    f=95*np.exp(-tt*3.5)+42
    k=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*2.6)
    boom=(np.random.rand(n)*2-1)*np.exp(-tt*4.5)*.6
    # sub tail
    sub=np.sin(2*np.pi*42*tt)*np.exp(-tt*2)*.7
    return (k+boom+sub)*g
add(8.3,impact(1.2,.8))
add(24.0,impact(1.6,1.0))
add(25.8,impact(2.2,1.05))

# TAGLINE sparkle arp at 24.1-25.6 (chips section)
def pluck(f,d=.3):
    n=int(d*SR);tt=np.arange(n)/SR
    return (np.sin(2*np.pi*f*tt)+.5*np.sin(4*np.pi*f*tt))*np.exp(-tt*7)*.3
arp=[392.,493.88,587.33,783.99,587.33,493.88]
for i,f in enumerate(arp): add(24.05+i*.27,pluck(f),.3)

# master
mix=np.tanh(mix*1.08)
fi=int(1.0*SR); mix[:fi]*=np.linspace(.35,1,fi)            # soft open heartbeat->in
fo=int(1.1*SR); mix[-fo:]*=np.linspace(1,.18,fo)
mix/=max(1e-9,np.abs(mix).max())/.87
st=np.stack([mix,mix],1)
out="/tmp/popo-rec/promo2/music.wav";os.makedirs("/tmp/popo-rec/promo2",exist_ok=True)
with wave.open(out,"wb") as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((st*32767).astype('<i2').tobytes())
print("wrote",out)
