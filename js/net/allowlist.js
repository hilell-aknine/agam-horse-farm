// allowlist.js — רשימת המיילים המורשים להיכנס לחווה (מייל של הורה, בלי סיסמה).
// המיילים לא כתובים כאן גלויים: נשמר רק טביעת SHA-256 של המייל באותיות קטנות,
// כדי שמי שפותח את קוד האתר לא יראה מיילים של הורים.
//
// להוסיף מייל (הלל): להריץ בטרמינל ולהדביק את התוצאה לרשימה, ואז commit + push.
//   node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1].trim().toLowerCase()).digest('hex'))" parent@example.com
//
// ⚠️ זו שכבת השער בצד הדפדפן. השכבה בצד השרת היא FARM_ALLOWED_EMAILS בפונקציה farm-email-login
// (חייבת להכיל את אותם מיילים, כטקסט גלוי, כסוד של Supabase).
const ALLOWED_HASHES = new Set([
  '6f5da6b7c3a976bbf9a063b290bae6c84e1679f958abc75a3759a5d31901ce7f', // הלל (htjewelry)
  'd0c5d43986a57a3103bdb6d22da0de5cb5539363835672987a7a7d617de3000a', // הלל וטוהר (hilelltohar)
]);

const norm = (e) => String(e || '').trim().toLowerCase();

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// true = מורשה. בלי crypto.subtle (דף שלא ב-https) — לא מכניסים, ומדווחים למתקשר.
async function isAllowedEmail(email) {
  if (!(globalThis.crypto && crypto.subtle)) throw new Error('no_crypto');
  return ALLOWED_HASHES.has(await sha256Hex(norm(email)));
}

export { isAllowedEmail };
