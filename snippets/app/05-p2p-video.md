# Snippet — P2P-Assisted Video Delivery (Service Worker + WebRTC)

> Excerpt from `app/src/lib/p2p-media.ts`.
> Paid episodes are video files in Supabase Storage; origin egress is a real
> cost when a coin's episode goes viral. The app opportunistically offloads
> byte delivery onto a viewer-to-viewer P2P mesh — as a pure enhancement that
> can never break playback.

## How it works

1. A Service Worker (`/sw.js`, media-proxy) intercepts HTTP range requests for
   media.
2. Viewers exchange byte pieces over WebRTC via the P2P engine; bytes served by
   peers never hit the origin bucket.
3. App code never assigns a raw URL to `<video>` — it calls `getP2PUrl(src)`
   and sets the (possibly proxied) returned URL.

## Lazy, feature-detected, fail-safe initialization

```ts
const SW_FILE = "/sw.js"

// ~136 KB engine: code-split, loaded only when a video is actually played.
let engine: P2PEngineMediaType | null = null
let engineFailed = false
let enginePromise: Promise<P2PEngineMediaType | null> | null = null

async function getEngine(): Promise<P2PEngineMediaType | null> {
  if (engine || engineFailed) return engine
  if (enginePromise) return enginePromise

  enginePromise = (async () => {
    try {
      // Feature detect BEFORE downloading the chunk:
      // secure context + Service Worker + WebRTC are hard requirements.
      const capable =
        typeof window !== "undefined" &&
        window.isSecureContext &&
        "serviceWorker" in navigator &&
        typeof RTCPeerConnection !== "undefined"
      if (!capable) { engineFailed = true; return null }

      const P2PEngineMedia = (await import("@swarmcloud/media")).default
      if (!P2PEngineMedia.isSupported?.()) {
        engineFailed = true
        return null
      }

      engine = new P2PEngineMedia({
        swFile: SW_FILE,
        logLevel: "none",
        showSlogan: false,
        ...(TRACKER_ZONE ? { trackerZone: TRACKER_ZONE } : {}),
        ...(TOKEN ? { token: TOKEN } : {}),
      })
      return engine
    } catch (err) {
      // Any failure: permanent soft-fail for this tab, direct playback wins.
      console.warn("[p2p-media] engine init failed, using direct playback", err)
      engineFailed = true
      return null
    } finally {
      enginePromise = null
    }
  })()

  return enginePromise
}

/** Never rejects: returns a proxied URL when P2P is available, else original. */
export async function getP2PUrl(originalUrl: string): Promise<string> {
  if (!originalUrl || !originalUrl.startsWith("http")) return originalUrl
  try {
    const p2p = await getEngine()
    if (!p2p) return originalUrl
    return await p2p.getProxiedUrl(originalUrl)
  } catch (err) {
    console.warn("[p2p-media] proxy resolution failed, direct URL used", err)
    return originalUrl
  }
}
```

## Where it fits the product

- The video component (episode player dialog) resolves every source through
  `getP2PUrl`; token-gating is already enforced on-chain (`episodeAccess`)
  before the player is offered.
- Dashboard stats show offload ratio, which directly maps to saved Storage
  egress per creator coin.

## Why it matters for judges

- **Cost-aware creator economy**: episode distribution gets cheaper per
  additional viewer instead of more expensive — the opposite of a normal
  centralized video stack.
- **Progressive enhancement discipline**: one tab-level singleton, dynamic
  import, preflight capability check, cached negative result, and catch-all
  fallback mean P2P can never block content access.
- **Security posture unchanged**: P2P only moves encrypted bytes fetched with
  the same storage URLs the player was already authorized to use; access
  control stays in the smart contract + signed upload endpoints.
