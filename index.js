const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'panel.html')));
app.get('/panel', (req, res) => res.sendFile(path.join(__dirname, 'public', 'panel.html')));
app.get('/api/data', (req, res) => res.json(db.getDataForDate(req.query.date || db.getSessionDate())));
app.post('/api/reset', (req, res) => {
  db.resetDate(req.query.date || db.getSessionDate(), req.query.group || null);
  res.json({ ok: true });
});

let currentQR = null;

app.get('/qr', (req, res) => {
  if (!currentQR) {
    return res.send(`
      <html>
      <body style="background:#111;color:white;font-family:Arial;text-align:center;padding:50px">
        <h2>✅ WhatsApp Already Connected</h2>
        <p>QR scan ki zarurat nahi hai.</p>
      </body>
      </html>
    `);
  }

  res.send(`
    <html>
    <body style="background:#111;color:white;font-family:Arial;text-align:center;padding:30px">
      <h2>📱 WhatsApp QR Scan Karo</h2>
      <p>WhatsApp → Linked Devices → Link a Device</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(currentQR)}"
           style="margin:20px auto;display:block;border:5px solid white;border-radius:12px">
      <p>QR expire ho sakta hai, page auto-refresh hoga.</p>
      <script>setTimeout(()=>location.reload(),20000);</script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`📱 QR page: /qr`);
});

const GROUPS = {
  DAY: '120363403626551391@g.us',
  NIGHT: '120363419264594279@g.us',
};

const STICKER_STEP_MAP = {
  '8b0d908617115e1a': 1,
  'afa127f1b24ef210': 2,
  '23037cdea033000b': 3,
  '50d9712b47e5e00b': 4,
  'e6d695c5a23d9290': 5,
};

const MARKETS = {
  'kalyan night':'KALYAN NIGHT','kalyan':'KALYAN','kalyaan':'KALYAN','klyan':'KALYAN',
  'milan day':'MILAN DAY','milan night':'MILAN NIGHT','milanday':'MILAN DAY','milannight':'MILAN NIGHT',
  'milan':'MILAN','miln':'MILAN',
  'sridevi':'SRIDEVI','shridevi':'SRIDEVI','shri devi':'SRIDEVI','shiridevi':'SRIDEVI',
  'sri devi':'SRIDEVI','srdevi':'SRIDEVI','shreedevi':'SRIDEVI','sridev':'SRIDEVI',
  'rajdhani day':'RAJDHANI DAY','rajdhani night':'RAJDHANI NIGHT','rajdhani':'RAJDHANI','rajdani':'RAJDHANI',
  'time bazar':'TIME BAZAR','timebazar':'TIME BAZAR',
  'main bazar':'MAIN BAZAR','mainbazar':'MAIN BAZAR',
  'madhur day':'MADHUR DAY','madhur night':'MADHUR NIGHT','madhur':'MADHUR',
  'supreme day':'SUPREME DAY','supreme night':'SUPREME NIGHT','supreme':'SUPREME',
  'mahalaxmi':'MAHALAXMI',
};

function detectMarket(line) {
  const l = line.toLowerCase().trim();
  const sorted = Object.entries(MARKETS).sort((a, b) => b[0].length - a[0].length);

  for (const [alias, name] of sorted) {
    if (l.includes(alias)) return name;
  }

  return null;
}

function extractTotal(line) {
  const l = line.trim();

  if (/^={3,}/.test(l)) {
    const m = l.match(/(\d+)\s*(?:rs|₹)?\s*$/i);
    return m ? parseInt(m[1]) : null;
  }

  if (/^\s*tp\b/i.test(l)) return null;

  let m;
  m = l.match(/total\s*amount[^\d]*(\d+)/i); if (m) return parseInt(m[1]);
  m = l.match(/total[^\d]*(\d+)/i); if (m) return parseInt(m[1]);
  m = l.match(/(?:कुल्ल?|kul)[^\d]*(\d+)/i); if (m) return parseInt(m[1]);
  m = l.match(/\bttl[^\d]*(\d+)/i); if (m) return parseInt(m[1]);
  m = l.match(/\btl[^\d]*(\d+)/i); if (m) return parseInt(m[1]);
  m = l.match(/\bto(?![a-z])[^\d]*(\d+)/i); if (m) return parseInt(m[1]);
  m = l.match(/(?:^|[\s:])t(?!p)[^\d]*(\d+)/i); if (m) return parseInt(m[1]);

  return null;
}

function getSession(line) {
  return /close/i.test(line) ? 'CLOSE' : 'OPEN';
}

function parseMessage(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let market = null;
  let session = 'OPEN';
  let declaredTotal = null;

  for (const line of lines) {
    const tot = extractTotal(line);

    if (tot !== null) {
      declaredTotal = tot;
      continue;
    }

    const mkt = detectMarket(line);

    if (mkt) {
      market = mkt;
      session = getSession(line);
      continue;
    }

    if (/open|close/i.test(line) && !/\d/.test(line)) {
      session = getSession(line);
    }
  }

  return { market, session, declaredTotal };
}

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'main-bot',
    dataPath: '/data/.wwebjs_auth'
  }),
  puppeteer: {
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage"
  ]
}

let currentStep = 1;

client.on('qr', qr => {
  currentQR = qr;
  console.log('\n📱 QR GENERATED');
  console.log('Railway URL ke end me /qr open karo aur scan karo\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  currentQR = null;
  console.log('✅ WhatsApp authenticated, session saved in /data');
});

client.on('auth_failure', msg => {
  console.log('❌ Auth failure:', msg);
});

client.on('ready', () => {
  currentQR = null;
  console.log(`\n✅ Bot LIVE!\n📅 DAY: ${GROUPS.DAY}\n🌙 NIGHT: ${GROUPS.NIGHT}\n`);
  scheduleReset();
});

client.on('message', async (msg) => {
  try {
    const chat = await msg.getChat();
    const gid = chat.id._serialized;

    if (chat.isGroup) {
      console.log(`📋 Group: "${chat.name}" | ID: ${gid}`);
    }

    const session_type = gid === GROUPS.DAY ? 'DAY' : gid === GROUPS.NIGHT ? 'NIGHT' : null;
    if (!session_type) return;

    if (msg.type === 'sticker') {
      try {
        const media = await msg.downloadMedia();

        if (media && media.data) {
          const hash = crypto.createHash('sha256').update(media.data).digest('hex').slice(0, 16);
          console.log(`🎴 Hash: ${hash}`);

          const closedStep = STICKER_STEP_MAP[hash];

          if (closedStep) {
            currentStep = closedStep + 1;
            console.log(`📌 Step ${closedStep} CLOSED → Step ${currentStep} STARTED`);
          }
        }
      } catch (e) {
        console.log('Sticker err:', e.message);
      }

      return;
    }

    if (msg.type === 'image' || msg.type === 'video') return;
    if (msg.type !== 'chat') return;

    const text = msg.body.trim();
    if (!text) return;

    const stepCmd = text.match(/^\/s([1-5])$/i);

    if (stepCmd) {
      const closedStep = parseInt(stepCmd[1]);
      currentStep = closedStep + 1;
      console.log(`📌 /s${closedStep} → Step ${currentStep} STARTED`);
      return;
    }

    if (/❌/.test(text) && msg.hasQuotedMsg) {
      const quotedMsg = await msg.getQuotedMessage();
      const quotedResult = parseMessage(quotedMsg.body || '');

      if (quotedResult.declaredTotal) {
        db.cancelEntry({
          step: currentStep,
          market: quotedResult.market || 'UNKNOWN',
          session: quotedResult.session,
          group: session_type,
          total: -quotedResult.declaredTotal,
          cancelled: true,
          rawMessage: quotedMsg.body || '',
          timestamp: new Date().toISOString(),
          date: db.getSessionDate(),
        });

        console.log(`🚫 CANCELLED | -₹${quotedResult.declaredTotal}`);
      }

      return;
    }

    const result = parseMessage(text);

    if (!result.declaredTotal) {
      if (/\d/.test(text)) {
        db.saveRejected({
          step: currentStep,
          rawMessage: text,
          group: session_type,
          timestamp: new Date().toISOString(),
          date: db.getSessionDate(),
        });

        console.log(`⚠️ REJECTED | Step:${currentStep} | "${text.slice(0, 50)}"`);
      }

      return;
    }

    db.saveEntry({
      step: currentStep,
      market: result.market || 'UNKNOWN',
      session: result.session,
      group: session_type,
      total: result.declaredTotal,
      cancelled: false,
      rawMessage: text,
      timestamp: new Date().toISOString(),
      date: db.getSessionDate(),
    });

    console.log(`✅ Step:${currentStep} | ${session_type} | ${result.market || '?'} | ₹${result.declaredTotal}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
});

function scheduleReset() {
  setInterval(() => {
    const now = new Date();

    if (now.getHours() === 1 && now.getMinutes() === 30) {
      currentStep = 1;
      console.log('🔄 Reset');
    }
  }, 60000);
}

client.initialize();
