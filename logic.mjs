// Чистая логика бота: план, сводки, выгрузка. Без сети и файлов — легко проверять.

export const START = "2026-11-16";
export const END = "2027-03-15";
export const QUIT_DATE = "2026-12-01";
export const START_WEIGHT = 92;
export const GOAL_WEIGHT = 81;
export const TOTAL_DAYS = 120;

export const CHECKS = [
  ["wake", "Подъём в 6:00"],
  ["light", "10 минут света утром"],
  ["train", "Тренировка по плану / отдых"],
  ["back", "15 минут на спину и шею"],
  ["steps", "10 000 шагов"],
  ["food", "3 приёма, без сладкого и голодовки"],
  ["protein", "Белок 140+ г"],
  ["water", "Вода 2,5 л"],
  ["skin", "Уход утро и вечер"],
  ["supps", "Добавки по схеме"],
  ["read", "Чтение 30 минут"],
  ["phone", "Телефон вне спальни"],
  ["journal", "Сброс мыслей на бумагу"],
];

// Вопросы отчёта по порядку. optional — можно пропустить знаком «-».
export const STEPS = [
  { key: "sleep", q: "Сколько часов спал?", min: 0, max: 16 },
  { key: "cigs", q: "Сколько сигарет за день?", min: 0, max: 80, int: true },
  { key: "screen", q: "Экранное время, часов?", min: 0, max: 24 },
  { key: "weight", q: "Вес, кг? (по воскресеньям, иначе «-»)", min: 40, max: 200, optional: true },
  { key: "waist", q: "Талия по пупку, см? (по воскресеньям, иначе «-»)", min: 50, max: 160, optional: true },
  { key: "mood", q: "Оценка дня 1–10?", min: 1, max: 10, int: true },
];

const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
export function isoUTC(d) { return d.toISOString().slice(0, 10); }
export function addDays(s, n) { const d = parseDate(s); d.setUTCDate(d.getUTCDate() + n); return isoUTC(d); }
export function diffDays(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 864e5); }
export function weekday(s) { return parseDate(s).getUTCDay(); }
export function short(s) { return s.slice(8, 10) + "." + s.slice(5, 7); }

export function parseNum(text) {
  const t = String(text).trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** Проверка ответа на шаг. Возвращает {ok, value} или {ok:false, error}. */
export function validateStep(step, text) {
  const t = String(text).trim();
  if (step.optional && (t === "-" || t === "—" || t.toLowerCase() === "нет")) return { ok: true, value: null };
  const v = parseNum(t);
  if (v === null) return { ok: false, error: "Нужно число" + (step.optional ? " или «-»" : "") + "." };
  if (v < step.min || v > step.max) return { ok: false, error: `Число от ${step.min} до ${step.max}.` };
  if (step.int && !Number.isInteger(v)) return { ok: false, error: "Целое число." };
  return { ok: true, value: v };
}

export function phaseOf(date) { return date <= "2026-12-28" ? 1 : date <= "2027-02-08" ? 2 : 3; }

export function planFor(date) {
  const wd = weekday(date), ph = phaseOf(date);
  let title, details = "";
  if (ph === 1) {
    if (wd === 1 || wd === 3 || wd === 5) {
      title = "Тренировка: всё тело";
      details = [
        "Отжимания от стола/подоконника — 4 × 12–15",
        "Тяга рюкзака одной рукой с упором — 4 × 10–12 на руку",
        "Приседания — 4 × 15–20",
        "Румынская тяга с рюкзаком — 3 × 12",
        "Планка — 3 × 45–60 с",
        "Тяга полотенца/петли к лицу — 3 × 15",
      ].map((s) => "• " + s).join("\n") + "\nРежущая боль под лопатками или в шее — упражнение стоп.";
    } else title = "День восстановления";
  } else if (ph === 2) {
    title = { 1: "Тренировка: верх", 3: "Тренировка: низ", 5: "Тренировка: верх", 6: "Тренировка: низ", 2: "Бег: чередуй бег и ходьбу", 4: "Бег: чередуй бег и ходьбу", 0: "Бег: длинный спокойный" }[wd];
    details = "Подтягивания с резиной в каждой тренировке верха.";
  } else {
    title = { 1: "Тренировка: верх", 2: "Тренировка: низ", 3: "Интервальный бег + кор", 5: "Тренировка: верх", 6: "Тренировка: низ", 4: "Лёгкий бег 30 минут", 0: "Отдых" }[wd];
    details = "Чистые подтягивания в каждой тренировке верха.";
  }
  const always = "Каждый день: 15 минут на спину и шею, 10 000 шагов." + (wd === 0 ? "\nВоскресенье: взвешивание натощак и замер талии." : "");
  return `${WD[wd]}, ${short(date)} · фаза ${ph}\n<b>${title}</b>${details ? "\n" + details : ""}\n${always}`;
}

export function dayNumber(today) {
  if (today < START) return 0;
  return Math.min(TOTAL_DAYS, diffDays(START, today) + 1);
}

export function checksDone(r) { return r && r.checks ? CHECKS.filter(([id]) => r.checks[id]).length : 0; }
export function checksPct(r) { return Math.round(checksDone(r) / CHECKS.length * 100); }

export function streak(records, today) {
  let n = 0, d = records[today] ? today : addDays(today, -1);
  while (records[d] && checksPct(records[d]) >= 80) { n++; d = addDays(d, -1); }
  return n;
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
const f1 = (v) => (v == null ? "—" : (Math.round(v * 10) / 10).toString().replace(".", ","));

export function smokeFreeDays(records) {
  const dates = Object.keys(records).sort();
  let n = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    const c = records[dates[i]].cigs;
    if (c == null) continue;
    if (c === 0) n++; else break;
  }
  return n;
}

export function stats(records, today) {
  const dates = Object.keys(records).sort();
  const ws = dates.filter((d) => records[d].weight != null);
  const wa = dates.filter((d) => records[d].waist != null);
  const lines = [];
  lines.push(`<b>День ${dayNumber(today)} из ${TOTAL_DAYS}</b> · фаза ${phaseOf(today < START ? START : today)} · до 15 марта ${Math.max(0, diffDays(today, END))} дн.`);
  if (ws.length) {
    const w = records[ws[ws.length - 1]].weight;
    lines.push(`Вес: ${f1(w)} кг (${w - START_WEIGHT > 0 ? "+" : ""}${f1(w - START_WEIGHT)} от старта, до цели ${f1(Math.max(0, w - GOAL_WEIGHT))})`);
    // нужный темп
    const left = diffDays(today, END);
    if (left > 0 && w > GOAL_WEIGHT) lines.push(`Нужный темп: −${f1((w - GOAL_WEIGHT) / left * 7)} кг в неделю`);
  } else lines.push("Вес: ещё нет взвешиваний");
  if (wa.length) {
    const first = records[wa[0]].waist, last = records[wa[wa.length - 1]].waist;
    lines.push(`Талия: ${f1(last)} см (${last - first > 0 ? "+" : ""}${f1(last - first)} с первого замера)`);
  }
  const sleep7 = [...Array(7)].map((_, i) => records[addDays(today, -i)]?.sleep).filter((v) => v != null);
  lines.push(`Сон за 7 дней: ${sleep7.length ? f1(avg(sleep7)) + " ч в среднем" : "нет данных"}`);
  const sf = smokeFreeDays(records);
  if (sf > 0) lines.push(`Без сигарет: ${sf} дн. подряд`);
  else if (today < QUIT_DATE) lines.push(`До отказа от сигарет: ${diffDays(today, QUIT_DATE)} дн.`);
  lines.push(`Серия дней с чек-листом от 80%: ${streak(records, today)}`);
  lines.push(`Отчётов всего: ${dates.length}`);
  return lines.join("\n");
}

/** Недельная сводка: таблица + средние + сравнение с прошлой неделей. */
export function weekSummary(records, endDate) {
  const days = [...Array(7)].map((_, i) => addDays(endDate, i - 6));
  const prev = [...Array(7)].map((_, i) => addDays(endDate, i - 13));
  const rows = days.map((d) => {
    const r = records[d];
    if (!r) return `${WD[weekday(d)]} ${short(d)}  —  нет отчёта`;
    return `${WD[weekday(d)]} ${short(d)} ${pad(f1(r.weight), 5)} ${pad(f1(r.sleep), 4)} ${pad(r.cigs ?? "—", 3)} ${pad(checksDone(r) + "/" + CHECKS.length, 5)} ${pad(r.mood ?? "—", 2)}`;
  });
  const pick = (ds, k) => ds.map((d) => records[d]?.[k]).filter((v) => v != null);
  const cmp = (k, unit, lowerBetter) => {
    const a = avg(pick(days, k)), b = avg(pick(prev, k));
    if (a == null) return null;
    let s = `${f1(a)}${unit}`;
    if (b != null) { const d = a - b; const good = lowerBetter ? d <= 0 : d >= 0; s += ` (${d > 0 ? "+" : ""}${f1(d)} к прошлой неделе ${good ? "✅" : "⚠️"})`; }
    return s;
  };
  const reported = days.filter((d) => records[d]).length;
  const out = [
    `<b>Неделя ${short(days[0])} – ${short(days[6])}</b>`,
    "<pre>день       вес   сон  сиг чек   оц",
    ...rows,
    "</pre>",
    `Отчётов: ${reported}/7${reported < 7 ? " — пропуски считаются проваленными днями" : ""}`,
  ];
  const lines = [["Вес", cmp("weight", " кг", true)], ["Сон", cmp("sleep", " ч", false)], ["Сигареты в день", cmp("cigs", "", true)], ["Экран", cmp("screen", " ч", true)], ["Оценка дня", cmp("mood", "", false)]];
  lines.forEach(([n, v]) => { if (v) out.push(`${n}: ${v}`); });
  // какие пункты чек-листа проваливаются чаще всего
  const misses = CHECKS.map(([id, label]) => [label, days.filter((d) => records[d] && !records[d].checks?.[id]).length]).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  if (misses.length) out.push("Чаще всего проваливаешь: " + misses.slice(0, 3).map(([l, n]) => `${l.toLowerCase()} (${n})`).join(", "));
  return out.join("\n");
}

function pad(v, n) { return String(v).padStart(n, " "); }

/** Текст для пересылки Claude. Без HTML, чтобы копировался чисто. */
export function exportText(records, endDate, nDays, slipNote) {
  const days = [...Array(nDays)].map((_, i) => addDays(endDate, i - nDays + 1));
  const out = [`ОТЧЁТ ДЛЯ CLAUDE · ${short(days[0])}–${short(endDate)} · день ${dayNumber(endDate)} из ${TOTAL_DAYS}`];
  if (slipNote) out.push(`СРЫВ: ${slipNote}`);
  for (const d of days) {
    const r = records[d];
    if (!r) { out.push(`${d} (${WD[weekday(d)]}): нет отчёта`); continue; }
    const missed = CHECKS.filter(([id]) => !r.checks?.[id]).map(([, l]) => l.toLowerCase());
    const parts = [
      r.weight != null ? `вес ${f1(r.weight)}` : null, `сон ${f1(r.sleep)}`, `сиг ${r.cigs ?? "—"}`, `экран ${f1(r.screen)}`,
      r.waist != null ? `талия ${f1(r.waist)}` : null, `оценка ${r.mood ?? "—"}`,
      `чек-лист ${checksDone(r)}/${CHECKS.length}` + (missed.length ? ` (не выполнено: ${missed.join(", ")})` : ""),
      r.note ? `заметка: ${r.note}` : null,
      r.slips?.length ? `срывы: ${r.slips.join("; ")}` : null,
    ].filter(Boolean);
    out.push(`${d} (${WD[weekday(d)]}): ${parts.join(" | ")}`);
  }
  out.push("");
  out.push(stats(records, endDate).replace(/<[^>]+>/g, ""));
  return out.join("\n");
}
