#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont
OUT="/tmp/popo-rec/alchemy-cards"; os.makedirs(OUT,exist_ok=True)
W,H=1440,900
MENLO="/System/Library/Fonts/Menlo.ttc"; AB="/System/Library/Fonts/Supplemental/Arial Bold.ttf"; AR="/System/Library/Fonts/Supplemental/Arial.ttf"
BG=(7,11,20); BLUE=(96,165,250); CYAN=(56,219,234); WHITE=(233,240,248); MUT=(147,163,187); GREEN=(74,222,128)
def F(p,s): return ImageFont.truetype(p,s)
def wrap(d,t,f,m):
    ws=t.split();L=[];c=""
    for w in ws:
        x=(c+" "+w).strip()
        if d.textlength(x,font=f)<=m:c=x
        else:
            if c:L.append(c)
            c=w
    if c:L.append(c)
    return L
def card(name,kicker,title,bullets,foot=None):
    im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im)
    d.rectangle([0,0,W,6],fill=BLUE)
    x=110;y=230
    d.text((x,y),kicker.upper(),font=F(AB,28),fill=BLUE);y+=54
    for ln in wrap(d,title,F(AB,58),W-2*x): d.text((x,y),ln,font=F(AB,58),fill=WHITE);y+=70
    y+=26
    for b in bullets:
        d.text((x+6,y),"•",font=F(AR,30),fill=CYAN)
        for j,ln in enumerate(wrap(d,b,F(AR,30),W-2*x-46)): d.text((x+38,y+j*40),ln,font=F(AR,30),fill=MUT)
        y+=40*max(1,len(wrap(d,b,F(AR,30),W-2*x-46)))+14
    if foot:
        d.rounded_rectangle([x,H-170,W-x,H-110],radius=10,outline=(28,41,64),width=2,fill=(11,19,34))
        d.text((x+22,H-154),foot,font=F(MENLO,22),fill=(125,211,252))
    im.save(f"{OUT}/{name}.png")

card("intro","PoPo.meme × Alchemy",
     "Supernode RPC + Enhanced APIs on Monad",
     ["Monad testnet · chainId 10143",
      "Supernode is the primary RPC; public & dRPC are fallbacks",
      "alchemy_getTokenBalances · alchemy_getAssetTransfers"],
     "monad-testnet.g.alchemy.com/v2/<key>")
card("close","PoPo.meme × Alchemy",
     "Reliable RPC and token data, safely gated",
     ["No API key  →  app keeps the exact original public RPCs",
      "No getLogs-heavy scanning (Monad caps eth_getLogs range)",
      "Real faucet mint & balances straight from the Supernode"],
     "env-driven: VITE_ALCHEMY_API_KEY")
print("cards ->",OUT)
