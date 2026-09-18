import { fileURLToPath, URL } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

export function proresMiddleware() {
  const handler = async (req: any, res: any, next: any) => {
    const url = req.url || ""
    const isProRes = url.startsWith("/api/convert-prores")
    const isMp4 = url.startsWith("/api/convert-mp4")
    const isHealth = url.startsWith("/health")

    if (!isProRes && !isMp4 && !isHealth) {
      return next()
    }

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, HEAD, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "*")

    if (req.method === "OPTIONS") {
      res.statusCode = 204
      res.end()
      return
    }

    // Health check endpoint
    if (req.method === "HEAD" || req.method === "GET" || isHealth) {
      res.setHeader("Content-Type", "application/json")
      res.setHeader("X-FFmpeg-Available", "true")
      res.statusCode = 200
      res.end(
        JSON.stringify({
          status: "ready",
          ffmpeg: true,
          codecs: ["prores_ks", "libvpx-vp9", "libx264"],
          pix_fmt: "yuva444p10le",
        })
      )
      return
    }

    if (req.method !== "POST") {
      res.statusCode = 405
      res.end("Method Not Allowed")
      return
    }

    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", async () => {
      const tempId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const inPath = path.join(os.tmpdir(), `vui_in_${tempId}.webm`)
      const outExt = isProRes ? "mov" : "mp4"
      const outPath = path.join(os.tmpdir(), `vui_out_${tempId}.${outExt}`)

      try {
        const body = Buffer.concat(chunks)
        await fs.promises.writeFile(inPath, body)

        const ffmpegArgs = isProRes
          ? [
              "-y",
              "-c:v", "libvpx-vp9",
              "-i", inPath,
              "-c:v", "prores_ks",
              "-profile:v", "4",
              "-pix_fmt", "yuva444p10le",
              "-c:a", "pcm_s16le",
              outPath,
            ]
          : [
              "-y",
              "-i", inPath,
              "-c:v", "libx264",
              "-preset", "fast",
              "-pix_fmt", "yuv420p",
              "-c:a", "aac",
              "-b:a", "192k",
              outPath,
            ]

        const ffmpeg = spawn("ffmpeg", ffmpegArgs)
        let stderr = ""
        ffmpeg.stderr.on("data", (d) => {
          stderr += d.toString()
        })

        ffmpeg.on("close", async (code) => {
          try {
            if (code !== 0 || !fs.existsSync(outPath)) {
              console.error(`[proresMiddleware] FFmpeg failed with code ${code}:`, stderr)
              res.statusCode = 500
              res.end(`FFmpeg conversion failed with code ${code}`)
              return
            }

            const outputData = await fs.promises.readFile(outPath)
            if (isProRes) {
              res.setHeader("Content-Type", "video/quicktime")
              res.setHeader(
                "Content-Disposition",
                'attachment; filename="voice-animation-prores4444.mov"'
              )
            } else {
              res.setHeader("Content-Type", "video/mp4")
              res.setHeader(
                "Content-Disposition",
                'attachment; filename="voice-animation-chroma.mp4"'
              )
            }
            res.setHeader("Content-Length", outputData.length)
            res.end(outputData)
          } finally {
            try { await fs.promises.unlink(inPath) } catch {}
            try { await fs.promises.unlink(outPath) } catch {}
          }
        })

        ffmpeg.on("error", async (err) => {
          console.error("[proresMiddleware] Spawn error:", err)
          res.statusCode = 500
          res.end(`FFmpeg spawn error: ${err.message}`)
          try { await fs.promises.unlink(inPath) } catch {}
          try { await fs.promises.unlink(outPath) } catch {}
        })
      } catch (err: any) {
        console.error("[proresMiddleware] Handler error:", err)
        res.statusCode = 500
        res.end(`Server error: ${err.message}`)
        try { await fs.promises.unlink(inPath) } catch {}
        try { await fs.promises.unlink(outPath) } catch {}
      }
    })
  }

  return {
    name: "prores-converter",
    configureServer(server: any) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), proresMiddleware()],
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 5174,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
