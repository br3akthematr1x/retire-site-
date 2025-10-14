// server.js
// Minimal email backend for RETIRE "Tell Us Your Why"
// Usage: node server.js  (or deploy to your Node host / render / railway)
// Requires env vars below (.env example provided)

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT = 587,
  SMTP_USER,
  SMTP_PASS,
  TO_EMAIL = 'retireonsol@gmail.com',
  FROM_EMAIL // optional: e.g. "RETIRE <no-reply@yourdomain.com>"
} = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.warn('[WARN] SMTP credentials missing. Set SMTP_HOST, SMTP_USER, SMTP_PASS.');
}

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(cors({ origin: true })); // same-origin / local dev friendly

// basic rate-limit for abuse protection
const limiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
app.use('/api/why', limiter);

// health check
app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/why', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const message = String(req.body?.message || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email' });
    }
    if (!message || message.length < 10) {
      return res.status(400).json({ ok: false, error: 'Please include a longer message.' });
    }
    if (message.length > 5000) {
      return res.status(400).json({ ok: false, error: 'Message too long.' });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465, // true for 465, false for 587/25
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    const subject = 'New WHY submission — RETIRE Community';
    const text = [
      `From: ${email}`,
      '',
      'Message:',
      message
    ].join('\n');

    await transporter.sendMail({
      from: FROM_EMAIL || SMTP_USER,
      to: TO_EMAIL,
      replyTo: email,
      subject,
      text
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Serve your static site if you want from here (optional):
// app.use(express.static('public')); // if your built site lives in /public

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RETIRE backend listening on :${PORT}`));
