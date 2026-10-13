#!/usr/bin/env python3
"""Cinematic title-card frames for PoPo promo v2 (1920x1080).
Black + PoPo pink (#E13B57), heavy uppercase Impact, small spaced kickers,
neon chips. Backgrounds = blurred/darkened real product UI."""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
UI="/tmp/popo-rec/ref-ui"; OUT="/tmp/popo-rec/promo2/frames"; os.makedirs(OUT,exist_ok=True)
W,H=1920,1080
IMPACT="/System/Library/Fonts/Supplemental/Impact.ttf"
AB="/System/Library/Fonts/Supplemental/Arial Bold.ttf"; AR="/System/Library/Fonts/Supplemental/Arial.ttf"
PINK=(225,59,87); MAG=(255,46,147); CYAN=(64,224,232); WHITE=(246,248,255); MUT=(150,158,175)
DARK=(8,9,15)
def F(p,s): return ImageFont.truetype(p,s)
def spaced(d,x,y,text,font,fill,sp=6,anchor="lm"):
    # draw letter-spaced uppercase text centered on x if anchor m
    widths=[d.textlength(ch,font=font) for ch in text]
    total=sum(widths)+sp*(len(text)-1)
    cx=x-total/2 if anchor in ("m","mm") else x
    for ch,w in zip(text,widths):
        d.text((cx,y),ch,font=font,fill=fill,anchor="lm"); cx+=w+sp
    return total
def wrap_center(d,text,font,maxw):
    words=text.split();lines=[];cur=""
    for w in words:
        x=(cur+" "+w).strip()
        if d.textlength(x,font=font)<=maxw:cur=x
        else:
            if cur:lines.append(cur)
            cur=w
    if cur:lines.append(cur)
    return lines
def bgfile(name,dark=0.80,blur=7,zoomfill=True):
    im=Image.open(f"{UI}/{name}").convert("RGB")
    # cover 1920x1080
    r=max(W/im.width,H/im.height)
    im=im.resize((int(im.width*r),int(im.height*r)))
    x=(im.width-W)//2;y=(im.height-H)//2
    im=im.crop((x,y,x+W,y+H))
    im=im.filter(ImageFilter.GaussianBlur(blur))
    black=Image.new("RGB",(W,H),DARK)
    im=Image.blend(im,black,dark)
    # vignette
    vig=Image.new("L",(W,H),0); vd=ImageDraw.Draw(vig)
    vd.ellipse([-W*0.25,-H*0.35,W*1.25,H*1.35],fill=255)
    vig=vig.filter(ImageFilter.GaussianBlur(200))
    dark2=Image.new("RGB",(W,H),(0,0,0))
    im=Image.composite(im,dark2,vig.point(lambda p:int(p*0.55+110)))
    return im
def kicker(d,text,col=MAG,y=150,sp=10):
    f=F(AB,26); spaced(d,W/2,y,text.upper(),f,col,sp)
def big(d,lines,y=470,size=138,gap=18,stroke=4,colors=None):
    f=F(IMPACT,size)
    colors=colors or [WHITE]*len(lines)
    for i,(ln,col) in enumerate(zip(lines,colors)):
        yy=y+i*(size+gap)
        spaced(d,W/2,yy,ln.upper(),f,col,2,anchor="mm")
def progress(d,frac):
    # top thin progress line (like ref)
    d.rectangle([0,0,W,5],fill=(255,255,255,40))
    d.rectangle([0,0,int(W*frac),5],fill=MAG)
def logo(d):
    # simplified P mark + wordmark
    f=F(AB,34); d.text((64,44),"PoPo.meme",font=f,fill=(230,235,242))
def chip(d,cx,cy,text,tcol=MAG,fs=34,pad=22):
    f=F(AB,fs); tw=d.textlength(text,font=f)
    w=tw+pad*2; h=fs+pad
    d.rounded_rectangle([cx-w/2,cy-h/2,cx+w/2,cy+h/2],radius=10,outline=tcol,width=3,fill=(255,255,255,12))
    d.text((cx,cy-2),text,font=f,fill=tcol,anchor="mm")

# ---- 00 intro ----
im=bgfile("dash.png",.88); d=ImageDraw.Draw(im,"RGBA"); progress(d,.02); logo(d)
# two real microdrama posters on the right (FIX / VARMINTS), cover-cropped to portrait
def poster_card(src,cx,cy,pw=300,ph=400):
    p=Image.open(src).convert("RGB")
    r=max(pw/p.width,ph/p.height)
    p=p.resize((int(p.width*r),int(p.height*r)))
    # bias crop toward faces (upper-center)
    x=(p.width-pw)//2; y=max(0,int((p.height-ph)*0.30)); p=p.crop((x,y,x+pw,y+ph))
    shadow=Image.new("RGBA",(pw+40,ph+40),(0,0,0,0)); sd=ImageDraw.Draw(shadow)
    sd.rounded_rectangle([20,20,pw+20,ph+20],radius=10,fill=(0,0,0,170))
    shadow=shadow.filter(ImageFilter.GaussianBlur(14))
    im.paste(shadow,(cx-pw//2-20,cy-ph//2-14),shadow)
    mask=Image.new("L",(pw,ph),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,pw,ph],radius=10,fill=255)
    im.paste(p,(cx-pw//2,cy-ph//2),mask)
    d.rounded_rectangle([cx-pw//2,cy-ph//2,cx+pw//2,cy+ph//2],radius=10,outline=MAG,width=3)
poster_card(f"{UI}/poster0.webp",1300,560)
poster_card(f"{UI}/poster1.webp",1640,560)
# warm glow behind posters
f=F(IMPACT,118)
x0=250
spaced(d,x0,430,"THE NEXT",f,WHITE,2,anchor="lm")
spaced(d,x0,548,"CULT HIT",f,WHITE,2,anchor="lm")
spaced(d,x0,666,"STARTS HERE.",f,(232,236,244),2,anchor="lm")
spaced(d,x0,752,"AI-MADE MICRODRAMAS",F(AB,30),MAG,8,anchor="lm")
im.save(f"{OUT}/s0.png")

# ---- 01 one creator ----
im=bgfile("hatch.png",.82); d=ImageDraw.Draw(im,"RGBA"); progress(d,.14); logo(d); kicker(d,"AI-made microdramas")
big(d,["ONE CREATOR.","A UNIVERSE."],430,118)
im.save(f"{OUT}/s1.png")

# ---- 02 launch coin ----
im=bgfile("createcoin.png",.80); d=ImageDraw.Draw(im,"RGBA"); progress(d,.28); logo(d); kicker(d,"LAUNCH")
big(d,["LAUNCH A COIN","FOR EVERY STORY."],430,104)
im.save(f"{OUT}/s2.png")

# ---- 03 no presale ----
im=bgfile("createcoin.png",.84); d=ImageDraw.Draw(im,"RGBA"); progress(d,.40); logo(d)
kicker(d,"NO PRESALE")
big(d,["NO PRESALE.","FAIR LAUNCH."],440,128,colors=[WHITE,MAG])
im.save(f"{OUT}/s3.png")

# ---- 04 back the story ----
im=bgfile("preddetail.png",.80); d=ImageDraw.Draw(im,"RGBA"); progress(d,.54); logo(d); kicker(d,"TRADE · UNLOCK · EARN")
big(d,["BACK THE STORY","YOU BELIEVE IN."],440,104)
im.save(f"{OUT}/s4.png")

# ---- 05 every trade on-chain ----
im=bgfile("predlist.png",.83); d=ImageDraw.Draw(im,"RGBA"); progress(d,.68); logo(d); kicker(d,"LIVE TRADING")
big(d,["EVERY TRADE.","ON-CHAIN."],450,128,colors=[WHITE,CYAN])
im.save(f"{OUT}/s5.png")

# ---- 06 theories & threads ----
im=bgfile("hatch.png",.80); d=ImageDraw.Draw(im,"RGBA"); progress(d,.78); logo(d); kicker(d,"FANDOM")
f=F(IMPACT,104); x0=W/2-360; y0=330
for i,ln in enumerate(["THEORIES.","THREADS.","TRIBES."]):
    spaced(d,x0,y0+i*(104+22),ln,f,WHITE,2,anchor="lm")
im.save(f"{OUT}/s6.png")

# ---- 07 chips (built on) ----
im=bgfile("dash.png",.90); d=ImageDraw.Draw(im,"RGBA"); progress(d,.86); logo(d)
spaced(d,W/2,250,"BUILT ON",F(AB,24),MUT,12,"mm")
chip(d,W/2,360,"MONAD TESTNET",MAG,40)
chip(d,W/2,470,"PRIVY WALLETS",CYAN,40)
chip(d,W/2,580,"ON-CHAIN LIQUIDITY",WHITE,40)
im.save(f"{OUT}/s7.png")

# ---- 08 end ----
im=bgfile("dash.png",.93)
d=ImageDraw.Draw(im,"RGBA"); progress(d,1.0)
# wordmark
wf=F(IMPACT,104)
# draw "PoPo" pink ".meme" white via two-part centered
p1="PoPo"; p2=".meme"
w1=d.textlength(p1,font=wf); w2=d.textlength(p2,font=wf); tot=w1+w2; x0=(W-tot)/2
d.text((x0,360),p1,font=wf,fill=MAG); d.text((x0+w1,360),p2,font=wf,fill=WHITE)
spaced(d,W/2,560,"EVERY AI STORY IS A MARKET.",F(AB,40),WHITE,4,"mm")
chip(d,W/2-170,680,"popo.meme",PINK,30); chip(d,W/2+170,680,"app.popo.meme",CYAN,30)
spaced(d,W/2,800,"LIVE ON MONAD TESTNET",F(AB,24),MUT,10,"mm")
im.save(f"{OUT}/s8.png")
print("frames ->",OUT, sorted(os.listdir(OUT)))
