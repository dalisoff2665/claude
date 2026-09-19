/**
 * Узкая обёртка над Claude Code для n8n.
 * Claude пишет ТОЛЬКО edl.json. Ни Bash, ни рендера, ни сети наружу.
 *
 *   node server.js
 *   POST http://127.0.0.1:3230/edl  { "job": "abc123", "brief": "..." }
 *
 * Перед запуском:
 *   export ANTHROPIC_API_KEY=...        отдельный ключ только под этот процесс
 *   export EDL_TOKEN=...                секрет для n8n, в заголовке, не в URL
 *   export JOBS_DIR=/srv/reels/jobs     песочница, смонтирована без доступа к /www
 */
const express = require("express");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 3230;
const JOBS = process.env.JOBS_DIR || "/srv/reels/jobs";
const TOKEN = process.env.EDL_TOKEN;
const PLUGIN = process.env.PLUGIN_ROOT || "/srv/reels/plugin";
const TIMEOUT_MS = 5 * 60 * 1000;

if (!TOKEN) { console.error("нет EDL_TOKEN"); process.exit(1); }

const app = express();
app.use(express.json({ limit: "2mb" }));

// секрет в заголовке. В URL он попал бы в access.log и в историю браузера.
app.use((req, res, next) => {
  const got = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (got !== TOKEN) return res.status(401).json({ error: "unauthorized" });
  next();
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/edl", (req, res) => {
  const { job, brief } = req.body || {};
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(job || "")) {
    return res.status(400).json({ error: "bad job id" });
  }
  const cwd = path.join(JOBS, job);
  if (!cwd.startsWith(JOBS + path.sep)) {
    return res.status(400).json({ error: "path escape" });
  }
  if (!fs.existsSync(path.join(cwd, "words.json"))) {
    return res.status(400).json({ error: "в папке задания нет words.json" });
  }

  const prompt = [
    "Прочитай CLAUDE.md, words.json, broll.json, assets.json и reference/ в текущей папке.",
    "Собери монтажный план и запиши его в edl.json.",
    "Ничего кроме edl.json не создавай. Команды не запускай.",
    "",
    "Бриф:",
    String(brief || "").slice(0, 4000),
  ].join("\n");

  execFile(
    "claude",
    [
      "-p", prompt,
      "--output-format", "json",
      // только запись файлов в песочнице. Bash не даём:
      // промпт собирается из внешних данных, а это путь к RCE.
      "--allowedTools", "Read,Write,Glob",
    ],
    { cwd, timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, PLUGIN_ROOT: PLUGIN } },
    (err, stdout, stderr) => {
      const edlPath = path.join(cwd, "edl.json");
      if (!fs.existsSync(edlPath)) {
        return res.status(500).json({
          error: "edl.json не создан",
          detail: String(stderr || err || "").slice(-1500),
        });
      }
      let edl;
      try { edl = JSON.parse(fs.readFileSync(edlPath, "utf8")); }
      catch (e) { return res.status(500).json({ error: "edl.json невалиден", detail: e.message }); }
      res.json({ ok: true, job, edl });
    }
  );
});

app.listen(PORT, "127.0.0.1", () =>
  console.log(`edl-wrapper на 127.0.0.1:${PORT}, песочница ${JOBS}`)
);
