#!/usr/bin/env python3
"""Generate all overlay PNGs (title cards + per-segment lower-third captions +
corner brand) for the MM demo at 1440x900."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = "/tmp/popo-rec/cards"
os.makedirs(OUT, exist_ok=True)
W, H = 1440, 900

MENLO = "/System/Library/Fonts/Menlo.ttc"
ARIAL_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"

def font(path, size):
    return ImageFont.truetype(path, size)

BG = (8, 12, 20)
CYAN = (56, 219, 234)
WHITE = (236, 242, 248)
MUTED = (150, 164, 180)
GREEN = (74, 222, 128)
AMBER = (251, 191, 36)
PANEL = (15, 22, 34)

def wrap(draw, text, fnt, maxw):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= maxw:
            cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def title_card(name, kicker, title, bullets=None, note=None):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    f_kick = font(ARIAL_B, 30)
    f_title = font(ARIAL_B, 60)
    f_b = font(ARIAL, 30)
    f_note = font(ARIAL, 24)
    x = 110
    y = 250
    d.text((x, y), kicker.upper(), font=f_kick, fill=CYAN)
    y += 56
    for ln in wrap(d, title, f_title, W - 2*x):
        d.text((x, y), ln, font=f_title, fill=WHITE); y += 72
    y += 24
    if bullets:
        for b in bullets:
            d.text((x + 6, y), "•", font=f_b, fill=CYAN)
            for j, ln in enumerate(wrap(d, b, f_b, W - 2*x - 44)):
                d.text((x + 36, y + j*38), ln, font=f_b, fill=MUTED)
            y += 38 * max(1, len(wrap(d, b, f_b, W - 2*x - 44))) + 12
    if note:
        d.rectangle([x, H-180, W-x, H-110], outline=AMBER, width=2, fill=(40, 30, 8))
        for i, ln in enumerate(wrap(d, note, f_note, W - 2*x - 40)[:2]):
            d.text((x + 20, H-168 + i*30), ln, font=f_note, fill=AMBER)
    img.save(f"{OUT}/{name}.png")

# brand corner overlay (transparent)
def brand():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = font(ARIAL_B, 20)
    txt = "PoPo.meme  ·  MetaMask Agent Wallet  ·  Monad testnet 10143"
    tw = int(d.textlength(txt, font=f))
    pad = 14
    x0 = W - 24 - tw - pad*2
    d.rounded_rectangle([x0, 20, W - 24, 20 + 32 + pad], radius=8, fill=(10, 16, 26, 205), outline=(56, 219, 234, 160), width=1)
    d.text((x0 + pad, 20 + pad//2), txt, font=f, fill=(190, 235, 245, 255))
    img.save(f"{OUT}/brand.png")

# lower-third caption (transparent, short English chapter subtitle)
def lower_third(name, kicker, line):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f_k = font(ARIAL_B, 22)
    f_l = font(ARIAL, 30)
    bar_h = 118
    d.rectangle([0, H - bar_h - 14, W, H], fill=(6, 10, 18, 205))
    d.rectangle([0, H - bar_h - 14, 10, H], fill=CYAN)
    x = 44
    d.text((x, H - bar_h + 6), kicker.upper(), font=f_k, fill=CYAN)
    lines = wrap(d, line, f_l, W - 2*x)
    for i, ln in enumerate(lines[:2]):
        d.text((x, H - bar_h + 36 + i*36), ln, font=f_l, fill=WHITE)
    img.save(f"{OUT}/{name}.png")

brand()

title_card("intro", "PoPo.meme × MetaMask Agent Wallet",
           "A trader CLI plugin, fully guarded",
           ["Monad testnet · chainId 10143",
            "Every write is routed through the Agent Wallet",
            "Signing, policy and email MFA are never bypassed"])

title_card("mfa_email_1", "Approval required — check your email",
           "Owner confirms the exact request",
           ["The command pauses at AWAITING_MFA",
            "An approval email is sent to the dashboard account",
            "Only after confirmation is it signed and broadcast"],
           note="No whitelist · no beast mode · every write gets its own email")

title_card("mfa_email_2", "Second write — a fresh approval",
           "Consent cannot be replayed",
           ["The trade triggers a brand-new approval email",
            "Each transaction needs its own human confirmation"])

title_card("envio", "Composability — Envio HyperIndex",
           "The same trade lands in the indexer",
           ["PredictionTrade rows indexed by block",
            "One trade powers the CLI and an analytics backend"])

# Live Envio proof card (real numbers queried from the local Hasura endpoint)
def envio_proof():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    f_kick = font(ARIAL_B, 28); f_h = font(ARIAL_B, 40); f_mono = font(MENLO, 24); f_b = font(ARIAL, 26)
    x = 100; y = 90
    d.text((x, y), "ENVIO HYPERINDEX · LIVE GRAPHQL (Monad 10143)", font=f_kick, fill=CYAN); y += 50
    d.text((x, y), "The plugin's own trade is indexed in real time", font=f_h, fill=WHITE); y += 84
    stats = ["61 meme coins indexed", "24 traders", "704 Hatch trades", "7 prediction markets"]
    for i, s in enumerate(stats):
        col, row = i % 2, i // 2
        d.text((x + col * 620, y + row * 56), "•  " + s, font=f_b, fill=MUTED)
    y += 130
    d.text((x, y), "PredictionTrade (latest, desc block):", font=f_b, fill=WHITE); y += 44
    lines = [
        '{ side: "buy", outcome: "no", shares: "1",',
        '  blockNumber: 70633389,',
        '  transactionHash: "0x784d7597285b1ada20b365b39b4b45",',
        '  ... "b451666b6765190e55b5822023410da0e3020" }',
    ]
    for ln in lines:
        d.text((x + 18, y), ln, font=f_mono, fill=GREEN); y += 36
    y += 10
    d.text((x + 18, y), "# same tx hash the Agent Wallet plugin just signed", font=font(MENLO, 20), fill=AMBER)
    img.save(f"{OUT}/envio_proof.png")

envio_proof()

title_card("close", "Summary",
           "Powerful for agents, safe by default",
           ["Installable oclif plugin · 9 trader commands",
            "No private keys or tokens handled by the plugin",
            "No bypass of signing, policy or MFA"])

# lower thirds for terminal segments
L = lower_third
L("cap_read", "Public read commands", "Markets and venues are read over a public RPC — no wallet login required.")
L("cap_quote", "Exact off-chain quote", "The curve is priced locally; the vault spend will match this, wei for wei.")
L("cap_policy", "Guard mode · strict policy", "Empty allowlist, chain 10143 not pre-approved, rolling 24h spend limit 0.")
L("cap_dep_wait", "Write #1 · deposit 25 $P", "Paused at AWAITING_MFA — the owner must approve the email.")
L("cap_dep_done", "Write #1 confirmed", "After email approval the deposit is broadcast and confirmed on-chain.")
L("cap_buy_wait", "Write #2 · buy 1 NO share", "A new AWAITING_MFA request — a second, separate email approval.")
L("cap_buy_done", "Write #2 confirmed", "The trade is confirmed; output includes the tx hash and explorer link.")
L("cap_verify", "On-chain verification", "Position increases, the vault spends the quoted cost, and Envio ingests the trade.")
L("cap_popup", "Native wallet approval", "The MetaMask Agent Wallet dialog shows the exact request — Deny or Approve. Nothing is auto-approved.")

print("cards generated in", OUT)
for f in sorted(os.listdir(OUT)):
    print(" -", f)
