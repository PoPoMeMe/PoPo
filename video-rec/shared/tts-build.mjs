#!/usr/bin/env node
/**
 * Render narrations from a beats.json into per-beat m4a + one mixed narration
 * track + timeline.json, using Volcengine big-model TTS (x-api-key).
 * Usage: node tts-build.mjs <beats.json> <outDir>
 */
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs"
import path from "node:path"

const [, , beatsPath, outDir] = process.argv
if (!beatsPath || !outDir) { console.error("usage: tts-build.mjs <beats.json> <outDir>"); process.exit(1) }
const cfg = JSON.parse(readFileSync(beatsPath, "utf8"))
mkdirSync(outDir, { recursive: true })

// load VOLC_* from app/.env.local if present
const envFile = "/Users/stark/Desktop/PP/pp-all/app/.env.local"
if (existsSync(envFile)) for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "")
}
const KEY = process.env.VOLC_TTS_API_KEY
const VOLC_VOICE = process.env.VOLC_TTS_VOICE
// TTS_ENGINE=say forces the local macOS voice; otherwise try Volc and fall back.
const FORCE_SAY = process.env.TTS_ENGINE === "say"
const SAY_VOICE = process.env.SAY_VOICE || "Samantha"
const SAY_RATE = Number(process.env.SAY_RATE || "172")
const SPEED = cfg.speed ?? 1.05
const ENDPOINT = "https://openspeech.bytedance.com/api/v1/tts"
let backend = ""

function synthSay(text, m4a) {
  const aiff = path.join(outDir, `.say-${process.pid}.aiff`)
  rmSync(aiff, { force: true })
  execFileSync("say", ["-v", SAY_VOICE, "-r", String(SAY_RATE), "-o", aiff, text])
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", aiff, "-ar", "44100", "-ac", "1", "-c:a", "aac", "-b:a", "128k", m4a])
  rmSync(aiff, { force: true })
}

async function synthVolcOnce(text, m4a) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "x-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      app: { appid: "default", cluster: "volcano_tts" },
      user: { uid: "popo-demo" },
      audio: { voice_type: VOLC_VOICE, encoding: "mp3", rate: 24000, speed_ratio: SPEED },
      request: { reqid: crypto.randomUUID(), text, operation: "query" },
    }),
  })
  const j = await res.json()
  if (j.code !== 3000 || !j.data) throw new Error(`Volc TTS ${res.status} ${j.code}: ${j.message || j.msg}`)
  const mp3 = path.join(outDir, `.tts-${process.pid}.mp3`)
  writeFileSync(mp3, Buffer.from(j.data, "base64"))
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", mp3, "-ar", "44100", "-ac", "1", "-c:a", "aac", "-b:a", "128k", m4a])
  rmSync(mp3, { force: true })
}

async function synthVolc(text, m4a) {
  let last
  for (let attempt = 1; attempt <= 5; attempt++) {
    try { await synthVolcOnce(text, m4a); return }
    catch (e) { last = e; console.warn(`  volc attempt ${attempt} failed: ${e.message}`); await new Promise(r => setTimeout(r, 2000 * attempt)) }
  }
  throw last
}

let volcBroken = FORCE_SAY || !KEY || !VOLC_VOICE
async function synth(text, m4a) {
  if (!volcBroken) {
    try { await synthVolc(text, m4a); if (!backend) backend = `volc:${VOLC_VOICE}@${SPEED}x`; return }
    catch (e) { console.warn("Volc failed, switching to local say:", e.message); volcBroken = true }
  }
  synthSay(text, m4a)
  if (!backend) backend = `say:${SAY_VOICE}@${SAY_RATE}`
}
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", f], { encoding: "utf8" }).trim())

const { leadIn = 1, gap = 0.6, tail = 2.5 } = cfg
let cursor = leadIn
const timeline = []
const files = []
for (const b of cfg.beats) {
  const f = path.join(outDir, `${b.id}.m4a`)
  await synth(b.narration, f)
  const d = dur(f)
  const start = Number(cursor.toFixed(3)), end = Number((cursor + d).toFixed(3))
  timeline.push({ ...b, start, duration: d, end })
  files.push(f)
  console.log(`${b.id.padEnd(12)} ${start.toFixed(2)}–${end.toFixed(2)} (${d.toFixed(2)}s)`)
  cursor = end + gap
}
const total = Number((cursor - gap + tail).toFixed(3))
writeFileSync(path.join(outDir, "timeline.json"), JSON.stringify({ total, backend, voice: backend, speed: SPEED, leadIn, gap, tail, beats: timeline }, null, 2))

// mix one narration track
const args = ["-y", "-v", "error"]
for (const f of files) args.push("-i", f)
const fc = []
timeline.forEach((b, i) => fc.push(`[${i}:a]aresample=44100,aformat=channel_layouts=mono,adelay=${Math.round(b.start * 1000)}|${Math.round(b.start * 1000)}[a${i}]`))
fc.push(`${timeline.map((_, i) => `[a${i}]`).join("")}amix=inputs=${timeline.length}:normalize=0,atrim=0:${total},apad=whole_dur=${total},loudnorm=I=-16:TP=-1.5:LRA=11[out]`)
args.push("-filter_complex", fc.join(";"), "-map", "[out]", "-c:a", "aac", "-b:a", "160k", path.join(outDir, "narration.m4a"))
execFileSync("ffmpeg", args)
console.log(`\nTOTAL ${total.toFixed(2)}s (limit 300 for MM) -> ${path.join(outDir, "narration.m4a")}`)
if (total > 300) { console.error("OVER 300s"); process.exit(2) }
