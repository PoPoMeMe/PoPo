#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont
OUT="/tmp/popo-rec/privy-cards"; os.makedirs(OUT,exist_ok=True)
W,H=1440,900
MENLO="/System/Library/Fonts/Menlo.ttc"; AB="/System/Library/Fonts/Supplemental/Arial Bold.ttf"; AR="/System/Library/Fonts/Supplemental/Arial.ttf"
BG=(8,11,18); PURPLE=(139,124,255); CYAN=(56,219,234); WHITE=(235,239,248); MUT=(150,160,178); GREEN=(74,222,128)
def F(p,s): return ImageFont.truetype(p,s)
def wrap(d,t,f,m):
    L=[];c=""
    for w in t.split():
        x=(c+" "+w).strip()
        if d.textlength(x,font=f)<=m:c=x
        else:
            if c:L.append(c)
            c=w
    if c:L.append(c)
    return L
def card(name,kicker,title,bullets,foot=None):
    im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im)
    d.rectangle([0,0,W,6],fill=PURPLE)
    x=110;y=210
    d.text((x,y),kicker.upper(),font=F(AB,28),fill=PURPLE);y+=56
    for ln in wrap(d,title,F(AB,58),W-2*x): d.text((x,y),ln,font=F(AB,58),fill=WHITE);y+=70
    y+=24
    for b in bullets:
        d.text((x+6,y),"•",font=F(AR,30),fill=CYAN)
        ls=wrap(d,b,F(AR,30),W-2*x-46)
        for j,ln in enumerate(ls): d.text((x+38,y+j*42),ln,font=F(AR,30),fill=MUT)
        y+=42*len(ls)+16
    if foot:
        d.rounded_rectangle([x,H-170,W-x,H-108],radius=10,outline=(40,46,66),width=2,fill=(14,18,28))
        d.text((x+22,H-152),foot,font=F(MENLO,22),fill=(167,184,255))
    im.save(f"{OUT}/{name}.png")

card("intro","PoPo.meme × Privy",
     "Embedded wallets on Monad testnet",
     ["Self-custodial embedded wallet 0x2772…f2a8",
      "Signs every business transaction in the app",
      "On-chain vault balance · Monad chain id 10143"],
     "embedded wallet · self-custodial · gas 6.7 MON")
card("close","PoPo.meme × Privy",
     "One signing path across the whole app",
     ["All business signatures & writes use the Privy embedded wallet",
      "Off-chain writes: EIP-712 typed data, verified at the edge",
      "External injected wallets are used only for top-ups"],
     "no fallback to injected wallets for business actions")

# lower-third captions (transparent), band at y~812
def cap(name,text):
    im=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    f=F(AB,27)
    tw=d.textlength(text,font=f)
    bw=int(tw)+56; bx=(W-bw)//2; by=812; bh=52
    d.rounded_rectangle([bx,by,bx+bw,by+bh],radius=12,fill=(10,13,22,214),outline=(139,124,255,180),width=2)
    d.text((bx+28,by+11),text,font=f,fill=(226,230,246,255))
    im.save(f"{OUT}/{name}.png")
cap("cap_wallet","Embedded wallet 0x2772…f2a8 · real on-chain account")
cap("cap_market","Buy 1 YES · paid from on-chain vault $P")
cap("cap_approve","Privy approve dialog · user clicks Approve — nothing is auto-signed")
cap("cap_confirmed","Signed by Privy · submitted & confirmed on Monad")
print("cards ->",OUT)
