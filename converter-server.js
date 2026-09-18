import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PORT = 5175;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify({ status: "ok", ffmpeg: true, port: PORT }));
    return;
  }

  if (req.url === "/api/convert-prores" && req.method === "POST") {
    console.log("[Converter] Received WebM for ProRes conversion...");
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const body = Buffer.concat(chunks);
        console.log(`[Converter] Read ${body.length} bytes WebM.`);
        const tempId = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        const inPath = path.join(os.tmpdir(), `input_${tempId}.webm`);
        const outPath = path.join(os.tmpdir(), `output_${tempId}.mov`);

        await fs.promises.writeFile(inPath, body);

        // Convert transparent VP9 WebM (yuva420p) to Apple ProRes 4444 (yuva444p10le) with 12-bit alpha
        const ffmpeg = spawn("ffmpeg", [
          "-y",
          "-c:v", "libvpx-vp9",
          "-i", inPath,
          "-c:v", "prores_ks",
          "-profile:v", "4",
          "-pix_fmt", "yuva444p10le",
          "-c:a", "pcm_s16le",
          outPath,
        ]);

        ffmpeg.stderr.on("data", () => {});

        ffmpeg.on("close", async (code) => {
          if (code !== 0 || !fs.existsSync(outPath)) {
            console.error("[Converter] FFmpeg error code:", code);
            res.statusCode = 500;
            res.end("FFmpeg conversion failed with code " + code);
            try { await fs.promises.unlink(inPath); } catch {}
            return;
          }

          const movData = await fs.promises.readFile(outPath);
          console.log(`[Converter] Conversion complete! ProRes MOV size: ${movData.length} bytes.`);
          res.setHeader("Content-Type", "video/quicktime");
          res.setHeader("Content-Disposition", 'attachment; filename="voice-animation-prores4444.mov"');
          res.setHeader("Content-Length", movData.length);
          res.end(movData);

          try { await fs.promises.unlink(inPath); } catch {}
          try { await fs.promises.unlink(outPath); } catch {}
        });

        ffmpeg.on("error", (err) => {
          console.error("[Converter] FFmpeg spawn error:", err);
          res.statusCode = 500;
          res.end("FFmpeg error: " + err.message);
        });
      } catch (err) {
        console.error("[Converter] Server error:", err);
        res.statusCode = 500;
        res.end("Server error: " + err.message);
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`[Converter] ProRes 4444 microservice listening on http://localhost:${PORT}`);
});
