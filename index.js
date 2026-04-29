const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const qrcode = require("qrcode-terminal");

const app = express();
const PORT = process.env.PORT || 3000;

let latestQR = null;

// Home
app.get("/", (req, res) => {
  res.send("Bot Running ✅");
});

// QR Page
app.get("/qr", (req, res) => {
  if (!latestQR) {
    return res.send(`
      <h2 style="font-family:Arial;text-align:center;margin-top:50px;">
        WhatsApp Already Connected ✅
      </h2>
    `);
  }

  res.send(`
    <html>
      <body style="background:#111;color:#fff;text-align:center;font-family:Arial;padding:30px">
        <h2>Scan WhatsApp QR</h2>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(latestQR)}" />
        <p>WhatsApp → Linked Devices → Link Device</p>
      </body>
    </html>
  `);
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log("🌐 Server running on port " + PORT);
  console.log("📱 QR page: /qr");
});

// WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "main-bot",
    dataPath: "/data/.wwebjs_auth"
  }),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  }
});

// QR Event
client.on("qr", (qr) => {
  latestQR = qr;
  console.log("📱 QR Generated");
  qrcode.generate(qr, { small: true });
});

// Auth Saved
client.on("authenticated", () => {
  latestQR = null;
  console.log("✅ Session Saved");
});

// Ready
client.on("ready", () => {
  latestQR = null;
  console.log("🚀 Bot LIVE");
});

// Demo Message
client.on("message", async (msg) => {
  const text = msg.body.toLowerCase().trim();

  if (text === "ping") {
    msg.reply("pong ✅");
  }

  if (text === "status") {
    msg.reply("Bot online hai ✅");
  }
});

// Error Catch
client.on("auth_failure", msg => {
  console.log("❌ Auth Failed:", msg);
});

client.on("disconnected", reason => {
  console.log("⚠️ Disconnected:", reason);
});

client.initialize();
