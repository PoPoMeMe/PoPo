#!/usr/bin/env python3
"""Royalty-free 28s energetic synth bed (120 BPM) for the PoPo promo.
Pure numpy -> 16-bit wav. Kick / hat / bass / pluck arp / pad / riser."""
import numpy as np, wave, struct, os
SR=44100; BPM=120; beat=60/BPM; DUR=28.0
N=int(SR*DUR); t=np.arange(N)/SR
mix=np.zeros(N)

def env(n,a,d,s=0.0,r=0.0,sus=0.6):
    e=np.zeros(n); ai=max(1,int(a*SR)); di=max(1,int(d*SR)); ri=max(1,int(r*SR))
    e[:ai]=np.linspace(0,1,ai)
    if ai<n:
        de=min(di,n-ai); e[ai:ai+de]=np.linspace(1,sus,de)
        e[ai+de:]=sus
    if r>0 and ri<n: e[-ri:]*=np.linspace(1,0,ri)
    return e
def saw(x): return 2*((x % 1)-0.5)
def add(start,sig,gain=1.0):
    i=int(start*SR); j=min(N,i+len(sig)); mix[i:j]+=sig[:j-i]*gain

# --- kick: four on the floor every beat ---
def kick(dur=0.28):
    n=int(dur*SR); tt=np.arange(n)/SR
    f=110*np.exp(-tt*28)+45
    ph=2*np.pi*np.cumsum(f)/SR
    body=np.sin(ph)*np.exp(-tt*9)
    click=(np.random.rand(n)*2-1)*np.exp(-tt*120)*0.4
    return body+click
ksig=kick()
for b in range(int(DUR/beat)):
    add(b*beat,ksig,0.95)

# --- clap on beats 2 & 4 (each bar) + hats offbeat ---
def hat(dur=0.05,open_=False):
    n=int(dur*SR); tt=np.arange(n)/SR
    x=np.random.rand(n)*2-1
    # crude highpass via diff
    x=np.diff(x,prepend=0)
    return x*np.exp(-tt*(18 if not open_ else 6))*0.5
hsig=hat(); osig=hat(0.18,True)
for b in range(int(DUR/beat)):
    add(b*beat+beat/2,osig,0.28)           # offbeat open hat
# clap
def clap(dur=0.18):
    n=int(dur*SR); tt=np.arange(n)/SR; out=np.zeros(n)
    for k in (0,0.012,0.026):
        i=int(k*SR); seg=np.random.rand(n-i)*2-1; seg=np.diff(seg,prepend=0)
        out[i:]+=seg
    return out*np.exp(-tt*16)*0.7
csig=clap()
for bar in range(int(DUR/(beat*4))):
    add(bar*4*beat+beat,csig,0.5)
    add(bar*4*beat+3*beat,csig,0.55)

# --- bass line: root eighth-notes, driving (A minor: A,F,C,G progression per bar) ---
roots=[55.0,55.0,43.65,43.65,65.41,65.41,49.0,49.0]  # A1 A1 F1 F1 C2 C2 G1 G1 (per 2 bars?)
# progression one chord per bar: Am, F, C, G repeated
barroots=[55.0,43.65,65.41,49.0]
def bass_note(f,dur=0.24):
    n=int(dur*SR); tt=np.arange(n)/SR
    sig=saw(f*tt)*0.5+np.sin(2*np.pi*f*tt)*0.5
    return sig*env(n,0.005,0.06,0.7,0.05)
bsig=bass_note(55)
for bar in range(int(DUR/(beat*4))+1):
    root=barroots[bar%4]
    for e in range(8):
        add(bar*4*beat+e*beat/2, bass_note(root if e not in(3,7) else root*1.5),0.32)

# --- pluck arp (eighth/sixteenth) following chords, bright ---
chords=[ [220.,261.63,329.63], [174.61,220.,261.63], [196.,246.94,293.66], [196.,246.94,392.] ]
def pluck(f,dur=0.22):
    n=int(dur*SR); tt=np.arange(n)/SR
    sig=np.sin(2*np.pi*f*tt)+0.4*np.sin(2*np.pi*2*f*tt)
    return sig*np.exp(-tt*9)*0.3
for bar in range(int(DUR/(beat*4))+1):
    ch=chords[bar%4]
    seq=[ch[0],ch[1],ch[2],ch[1]]
    for s in range(8):
        f=seq[s%4]*(2 if s in(6,7) else 1)
        add(bar*4*beat+s*beat/2, pluck(f),0.26)

# --- pad chords (soft saw stack) in second half for lift ---
def pad(freqs,dur):
    n=int(dur*SR); tt=np.arange(n)/SR; sig=np.zeros(n)
    for f in freqs:
        sig+=saw(f*tt)*0.25+np.sin(2*np.pi*f*tt)*0.25
    sig/=len(freqs)
    return sig*env(n,0.4,0.2,0.5,0.6)*0.5
for bar in range(2,int(DUR/(beat*4))):
    add(bar*4*beat, pad(chords[bar%4],beat*4),0.18)

# --- riser into end card (22.5 -> 24.5) + impact at 24.5 ---
rs=int(2.0*SR); tt=np.arange(rs)/SR
riser=np.random.rand(rs)*2-1; riser=np.diff(riser,prepend=0)
riser*=np.linspace(0.02,1,rs)**2
# rising tone
riser+=np.sin(2*np.pi*(200+ ( (tt/2.0)**2 )*1400)*tt)*0.15*np.linspace(0.1,1,rs)
add(22.5,riser,0.30)
def impact(dur=1.2):
    n=int(dur*SR); tt2=np.arange(n)/SR
    f=90*np.exp(-tt2*4)+40
    k=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt2*3)
    boom=(np.random.rand(n)*2-1)*np.exp(-tt2*5)*0.5
    return k+boom
add(24.5,impact(),0.7)

# --- structure: soft intro 0-0.5? keep energy full from cut 1; duck final for VO ---
# master
# soft-clip limiter then normalize to safe ceiling (avoid 0 dBFS)
mix=np.tanh(mix*1.05)
fi=int(0.8*SR); mix[-fi:]*=np.linspace(1,0.35,fi)
mix/=max(1e-9,np.abs(mix).max())/0.86
stereo=np.stack([mix,mix],axis=1)
pcm=(stereo*32767).astype('<i2')
out="/tmp/popo-rec/promo/music.wav"; os.makedirs(os.path.dirname(out),exist_ok=True)
with wave.open(out,"wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote",out)
