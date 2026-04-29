const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const qrcode = require("qrcode-terminal");

const app = express();
const PORT = process.env.PORT || 3000;

let latestQR = null;

/* ---------- EXPRESS ---------- */

app.get("/", (req, res) => {
  res.send("Bot Running ✅");
});

app.get("/qr", (req, res) => {
  if (!latestQR) {
    return res.send(`
      <html>
      <body style="background:#111;color:#fff;text-align:center;padding:40px;font-family:Arial">
        <h2>WhatsApp Already Connected ✅</h2>
        <p>QR aayega jab session logout hoga.</p>
      </body>
      </html>
    `);
  }

  res.send(`
    <html>
    <body style="background:#111;color:#fff;text-align:center;padding:30px;font-family:Arial">
      <h2>Scan WhatsApp QR</h2>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(latestQR)}" />
      <p>WhatsApp → Linked Devices → Link Device</p>
      <script>
        setTimeout(()=>location.reload(),15000)
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("🌐 Server running on port " + PORT);
});

/* ---------- WHATSAPP ---------- */

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "main-bot",
    dataPath: "/data/.wwebjs_auth"
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-features=ProcessSingleton",
      "--user-data-dir=/tmp/chrome-profile"
    ]
  }
});

client.on("qr", (qr) => {
  latestQR = qr;
  console.log("📱 QR Generated");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  latestQR = null;
  console.log("🚀 Bot Ready");
});

client.on("authenticated", () => {
  latestQR = null;
  console.log("✅ Authenticated");
});

client.on("auth_failure", (msg) => {
  console.log("❌ Auth Failed:", msg);
});

client.on("disconnected", (reason) => {
  console.log("⚠️ Disconnected:", reason);
});

client.on("message", async (msg) => {
  const text = (msg.body || "").toLowerCase().trim();

  if (text === "ping") {
    await msg.reply("pong ✅");
  }

  if (text === "status") {
    await msg.reply("Bot Online ✅");
  }
});

/* Delay startup for Railway */
setTimeout(() => {
  client.initialize();
}, 3000);
