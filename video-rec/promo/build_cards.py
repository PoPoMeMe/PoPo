#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT="/tmp/popo-rec/promo/cards"; os.makedirs(OUT,exist_ok=True)
W,H=1440,900
AB="/System/Library/Fonts/Supplemental/Arial Bold.ttf"; AB2="/System/Library/Fonts/Supplemental/Arial Black.ttf"; AR="/System/Library/Fonts/Supplemental/Arial.ttf"
def F(p,s): return ImageFont.truetype(p,s)
GRAD=(255,64,180); CYAN=(56,219,234); WHITE=(245,248,255); MUT=(150,200,210); PURP=(139,124,255)
def bg(src):
    im=Image.open(src).convert("RGB").resize((W,H))
    im=im.filter(ImageFilter.GaussianBlur(6))
    ov=Image.new("RGB",(W,H),(5,9,16)); im=Image.blend(im,ov,0.74)
    d=ImageDraw.Draw(im,"RGBA")
    d.rectangle([0,0,W,H],fill=(5,9,16,120))
    return im
def center_lines(d,lines,y0,font,fill,gap=8,stroke=0,scol=(0,0,0)):
    y=y0
    for ln,fc in lines:
        w=d.textlength(ln,font=font)
        d.text(((W-w)/2,y),ln,font=font,fill=fc,stroke_width=stroke,stroke_fill=scol)
        y+=font.size+gap
    return y
def kicker(d,text,y=150,col=CYAN):
    f=F(AB,26); w=d.textlength(text,font=f)
    d.text(((W-w)/2,y),text,font=f,fill=col)
def brand(d):
    f=F(AB,24); d.text((44,38),"PoPo.meme",font=f,fill=(220,230,240))
    d.ellipse([44+250,46,44+260,56],fill=GRAD)

CDP="/tmp/popo-rec/cdp"
def card(name,src,kick,lines,foot=None,bigfont=92):
    im=bg(src); d=ImageDraw.Draw(im,"RGBA"); brand(d)
    if kick: kicker(d,kick)
    f=F(AB2,bigfont)
    # block height
    hs=[f.size+10 for _ in lines]; y0=(H-sum(hs))//2+10
    center_lines(d,list(zip(lines,[WHITE]*len(lines))),y0,f,WHITE,gap=10,stroke=3)
    if foot:
        ff=F(AB,30); w=d.textlength(foot,font=ff)
        d.rounded_rectangle([(W-w)/2-26,H-210,(W+w)/2+26,H-150],radius=34,fill=(255,64,180,235))
        d.text(((W-w)/2,H-200),foot,font=ff,fill=(255,255,255))
    im.save(f"{OUT}/{name}.png")

# 1 hook over dashboard
card("c1",f"{CDP}/pro-dash.png","",
     ["EVERY AI STORY","IS A MARKET"],
     foot="Launch · predict · trade", bigfont=104)
# 2 hatch
card("c2",f"{CDP}/pro-hatch.png","AI STORY COINS",
     ["Turn AI IP into","tradable coins"], bigfont=88)
# 3 prediction
card("c3",f"{CDP}/pro-mkt.png","PREDICTION MARKETS",
     ["Trade the future","YES or NO"], bigfont=92)
# 4 AI build
card("c4",f"{CDP}/pro-create.png","BUILT WITH AI",
     ["Draft a market","with KIMI"], bigfont=92)
# 5 onchain/monad over market
card("c5",f"{CDP}/pro-predlist.png","ON MONAD TESTNET",
     ["Real on-chain.","Real liquidity."], bigfont=88)
# 6 end over dashboard (logo big), CTA
im=bg(f"{CDP}/pro-dash.png"); d=ImageDraw.Draw(im,"RGBA"); brand(d)
f=F(AB2,108)
center_lines(d,[("PoPo.meme",GRAD)],250,f,GRAD,gap=0,stroke=2)
sub=F(AB,40); s="Every AI story is a market"; w=d.textlength(s,font=sub)
d.text(((W-w)/2,390),s,font=sub,fill=WHITE)
ff=F(AB,34); cta="app.popo.meme"; w=d.textlength(cta,font=ff)
d.rounded_rectangle([(W-w)/2-30,500,(W+w)/2+30,572],radius=36,fill=(56,219,234,240))
d.text(((W-w)/2,512),cta,font=ff,fill=(6,12,20))
im.save(f"{OUT}/c6.png")
print("cards ->",OUT)
