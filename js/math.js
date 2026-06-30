// math.js — מנוע תרגילי חשבון מותאם לגיל 6 (כיתה א'), עברית מלאה
// כל פעולה במשחק מייצרת תרגיל. מחזיר אובייקט עם שאלה, תשובה, אפשרויות בחירה,
// עזר חזותי לספירה, רמז, וטקסט להקראה קולית.

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// בונה 4 אפשרויות בחירה סביב התשובה הנכונה (מספרים שלמים אי-שליליים, ללא כפילויות)
function makeChoices(answer, spread = 3, count = 4, min = 0) {
  const set = new Set([answer]);
  let guard = 0;
  while (set.size < count && guard++ < 100) {
    let d = rnd(-spread, spread);
    if (d === 0) continue;
    let c = answer + d;
    if (c < min) continue;
    set.add(c);
  }
  // אם עדיין חסר (תשובות קטנות) — נוסיף כלפי מעלה
  let up = answer + 1;
  while (set.size < count) { if (up >= min) set.add(up); up++; }
  return shuffle([...set]);
}

const EMOJIS = ['🍎', '🥕', '⭐', '🌸', '🐴'];

// טקסט להקראה: ממיר סימנים למילים בעברית
function toSpeech(q) {
  return q
    .replace(/\+/g, ' ועוד ')
    .replace(/−|-/g, ' פחות ')
    .replace(/=/g, ' שווה ')
    .replace(/_/g, ' כמה ')
    .replace(/\?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// טווח התוצאה המקסימלי לפי דרגת קושי (1 = קל מאוד, 10+ = כיתה א' מתקדם)
function maxFor(d) {
  const table = [5, 5, 6, 8, 10, 10, 12, 15, 18, 20];
  return table[Math.min(d, table.length) - 1] || 20;
}

// ---- מחוללי תרגילים ----

function genCount() {
  const n = rnd(2, 9);
  const emoji = pick(EMOJIS);
  return {
    type: 'count',
    question: 'כמה יש כאן?',
    speech: 'כמה יש כאן? תספרי אותם',
    answer: n,
    choices: makeChoices(n, 2, 4, 1),
    visual: { kind: 'count', emoji, count: n },
    hint: 'תגעי בכל אחד ותספרי: אחת, שתיים, שלוש...'
  };
}

function genAddVisual(d) {
  const max = maxFor(d);
  const a = rnd(1, Math.max(2, Math.floor(max / 2)));
  const b = rnd(1, Math.max(1, max - a));
  const ans = a + b;
  const emoji = pick(['🍎', '🥕', '🌸', '⭐']);
  return {
    type: 'add',
    question: `${a} + ${b} = ?`,
    speech: toSpeech(`${a} + ${b}`),
    answer: ans,
    choices: makeChoices(ans, 3, 4, 0),
    visual: { kind: 'group', emoji, a, b, op: '+' },
    hint: 'תספרי את כולם ביחד'
  };
}

function genSubVisual(d) {
  const max = maxFor(d);
  const a = rnd(2, max);
  const b = rnd(1, a);
  const ans = a - b;
  const emoji = pick(['🍎', '🥕', '🌸', '⭐']);
  return {
    type: 'sub',
    question: `${a} - ${b} = ?`,
    speech: toSpeech(`${a} - ${b}`),
    answer: ans,
    choices: makeChoices(ans, 3, 4, 0),
    visual: { kind: 'group', emoji, a, b, op: '-' },
    hint: 'תתחילי מהמספר הגדול ותורידי'
  };
}

function genAddPlain(d) {
  const max = maxFor(d);
  const a = rnd(2, Math.max(3, max - 2));
  const b = rnd(1, Math.max(1, max - a));
  const ans = a + b;
  return {
    type: 'add',
    question: `${a} + ${b} = ?`,
    speech: toSpeech(`${a} + ${b}`),
    answer: ans,
    choices: makeChoices(ans, 3, 4, 0),
    visual: null,
    hint: 'אפשר לספור באצבעות'
  };
}

function genSubPlain(d) {
  const max = maxFor(d);
  const a = rnd(3, max);
  const b = rnd(1, a);
  const ans = a - b;
  return {
    type: 'sub',
    question: `${a} - ${b} = ?`,
    speech: toSpeech(`${a} - ${b}`),
    answer: ans,
    choices: makeChoices(ans, 3, 4, 0),
    visual: null,
    hint: 'כמה צריך להוריד מהמספר הגדול'
  };
}

function genMissing(d) {
  const max = maxFor(d);
  const ans = rnd(1, Math.max(2, max - 1));
  const a = rnd(1, Math.max(1, max - ans));
  const total = a + ans;
  return {
    type: 'missing',
    question: `${a} + _ = ${total}`,
    speech: `${a} ועוד כמה שווה ${total}`,
    answer: ans,
    choices: makeChoices(ans, 2, 4, 0),
    visual: null,
    hint: `כמה צריך להוסיף ל-${a} כדי להגיע ל-${total}`
  };
}

function genCompare(d) {
  const max = maxFor(d);
  let a = rnd(1, max), b = rnd(1, max);
  while (a === b) b = rnd(1, max);
  const bigger = Math.random() < 0.5;
  const ans = bigger ? Math.max(a, b) : Math.min(a, b);
  return {
    type: 'compare',
    question: bigger ? 'איזה מספר גדול יותר?' : 'איזה מספר קטן יותר?',
    speech: bigger ? `איזה מספר גדול יותר? ${a} או ${b}` : `איזה מספר קטן יותר? ${a} או ${b}`,
    answer: ans,
    choices: shuffle([a, b]),
    visual: null,
    hint: bigger ? 'תספרי — איזה מספר הוא יותר?' : 'תספרי — איזה מספר הוא פחות?'
  };
}

function genNeighbor(d) {
  const max = maxFor(d);
  const after = Math.random() < 0.5;
  // "אחרי": n מ-1; "לפני": n מ-2 כדי שלא ייווצר "מה בא לפני 1?" (תשובה 0 מבלבלת)
  const n = after ? rnd(1, max - 1) : rnd(2, max);
  const ans = after ? n + 1 : n - 1;
  return {
    type: 'neighbor',
    question: after ? `מה בא אחרי ${n}?` : `מה בא לפני ${n}?`,
    speech: after ? `איזה מספר בא אחרי ${n}` : `איזה מספר בא לפני ${n}`,
    answer: ans,
    choices: makeChoices(ans, 2, 4, 0),
    visual: null,
    hint: after ? 'מספר אחד יותר' : 'מספר אחד פחות'
  };
}

const NOUN_EMOJI = { 'תפוחים': '🍎', 'גזרים': '🥕', 'פרחים': '🌸', 'כוכבים': '⭐' };

function genWord(d) {
  const max = maxFor(d);
  const plus = Math.random() < 0.55;
  const noun = pick(Object.keys(NOUN_EMOJI));
  const emoji = NOUN_EMOJI[noun];
  if (plus) {
    // a,b ≥ 2 כדי שלא ייווצר "1 תפוחים" (לא תקין בעברית)
    const a = rnd(2, Math.max(2, max - 2));
    const b = rnd(2, Math.max(2, max - a));
    const ans = a + b;
    return {
      type: 'word',
      question: `לאגם יש ${a} ${noun}. היא קיבלה עוד ${b}. כמה ${noun} יש לה עכשיו?`,
      speech: `לאגם יש ${a} ${noun}. היא קיבלה עוד ${b}. כמה ${noun} יש לה עכשיו`,
      answer: ans,
      choices: makeChoices(ans, 3, 4, 0),
      visual: { kind: 'group', emoji, a, b, op: '+' },
      hint: 'מחברים את שתי הקבוצות וסופרים'
    };
  } else {
    const a = rnd(4, max);
    const b = rnd(2, a - 2);   // b ≥ 2 → "נעלמו" תמיד תקין; התוצאה ≥ 2
    const ans = a - b;
    return {
      type: 'word',
      question: `לאגם היו ${a} ${noun}. ${b} מהם נעלמו. כמה ${noun} נשארו?`,
      speech: `לאגם היו ${a} ${noun}. ${b} מהם נעלמו. כמה ${noun} נשארו`,
      answer: ans,
      choices: makeChoices(ans, 3, 4, 0),
      visual: { kind: 'group', emoji, a, b, op: '-' },
      hint: 'סופרים כמה נשארו אחרי שמורידים'
    };
  }
}

// מיפוי סוג-תרגיל → מחולל (לקושי מותאם: לחזק את הסוג החלש)
const GEN = {
  add: (d) => Math.random() < 0.5 ? genAddVisual(d) : genAddPlain(d),
  sub: (d) => Math.random() < 0.5 ? genSubVisual(d) : genSubPlain(d),
  count: (d) => genCount(),
  compare: (d) => genCompare(d),
  missing: (d) => genMissing(d),
  neighbor: (d) => genNeighbor(d),
  word: (d) => genWord(d)
};

// תרגילי משוואה מוצגים משמאל-לימין (כמו בחשבון); משפטים בעברית נשארים מימין-לשמאל
function _mark(p) {
  p.ltr = (p.type === 'add' || p.type === 'sub' || p.type === 'missing');
  return p;
}

// בחירת מחולל לפי דרגת קושי (משקלים); focusType מכריח סוג מסוים (חיזוק החלש)
function generateProblem(difficulty = 1, focusType = null) {
  const d = Math.max(1, Math.min(12, Math.round(difficulty)));
  if (focusType && GEN[focusType]) return _mark(GEN[focusType](d));
  const pool = [];
  const push = (fn, w) => { for (let i = 0; i < w; i++) pool.push(fn); };

  if (d <= 2) {
    push(() => genCount(), 3);
    push(() => genAddVisual(d), 4);
    push(() => genSubVisual(d), 2);
    push(() => genNeighbor(d), 1);
  } else if (d <= 4) {
    push(() => genAddVisual(d), 3);
    push(() => genSubVisual(d), 3);
    push(() => genCompare(d), 1);
    push(() => genNeighbor(d), 1);
    push(() => genCount(), 1);
  } else if (d <= 7) {
    push(() => genAddVisual(d), 2);
    push(() => genSubVisual(d), 2);
    push(() => genAddPlain(d), 2);
    push(() => genSubPlain(d), 2);
    push(() => genMissing(d), 1);
    push(() => genCompare(d), 1);
    push(() => genWord(d), 2);
  } else {
    push(() => genAddPlain(d), 2);
    push(() => genSubPlain(d), 2);
    push(() => genMissing(d), 2);
    push(() => genWord(d), 3);
    push(() => genCompare(d), 1);
    push(() => genNeighbor(d), 1);
  }
  return _mark(pick(pool)());
}

export { generateProblem };
