/*************************************************
 * HOSTEL MEALS — Google Sheets backend
 * Sheet: https://docs.google.com/spreadsheets/d/1U-r-XE6oFChErhaz2ijnO-WyXR5AYJpKf87uvdiH2Jc/
 *
 * SETUP (one time):
 *  1. Open the sheet -> Extensions -> Apps Script -> delete any code -> paste this file -> Save.
 *  2. Deploy -> New deployment -> type "Web app" -> Execute as: Me ->
 *     Who has access: Anyone -> Deploy -> copy the /exec URL.
 *  3. Paste that URL into the app's API_URL (index.html) and rebuild.
 *  4. To make someone a warden: add their login email in the "Admins" tab
 *     (tabs "Users", "Meals", "Admins" are created automatically).
 *************************************************/
const SECRET = "hm2026";   // shared secret — must match the app
const SHEET_ID = "1U-r-XE6oFChErhaz2ijnO-WyXR5AYJpKf87uvdiH2Jc";
const DAY = 86400000;
const HEADERS = {
  Users:  ["email", "password", "name", "dept", "year", "created"],
  Meals:  ["date", "email", "name", "dept", "year", "b", "l", "d", "at"],
  Admins: ["email"]
};

function sh(name) {
  const book = SpreadsheetApp.openById(SHEET_ID);
  let s = book.getSheetByName(name);
  if (!s) { s = book.insertSheet(name); s.appendRow(HEADERS[name]); }
  return s;
}
function out(d) {
  return ContentService.createTextOutput(JSON.stringify(d))
    .setMimeType(ContentService.MimeType.JSON);
}
function tz() { return Session.getScriptTimeZone(); }
function dstr(v) {   // normalize any date cell to "yyyy-MM-dd"
  return (v instanceof Date) ? Utilities.formatDate(v, tz(), "yyyy-MM-dd") : String(v);
}
function rows(name) {   // sheet -> array of objects keyed by header
  const v = sh(name).getDataRange().getValues();
  const h = v.length ? v.shift() : [];
  return v.filter(r => String(r[0]) !== "").map(r => {
    const o = {};
    h.forEach((k, i) => o[k] = (r[i] instanceof Date) ? Utilities.formatDate(r[i], tz(), k === "date" ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm:ss") : r[i]);
    return o;
  });
}
function check(e) { return e.parameter.secret === SECRET; }
function isAdmin(email) {
  return rows("Admins").some(r => String(r.email).toLowerCase() === String(email).toLowerCase());
}
function findUser(email) {
  return rows("Users").find(r => String(r.email).toLowerCase() === String(email).toLowerCase());
}
function pub(u, email) {
  return { email: String(email), name: u.name, dept: u.dept, year: String(u.year), admin: isAdmin(email) };
}

/* ---------- GET: login, me, day, warden ---------- */
function doGet(e) {
  if (!check(e)) return out({ ok: false, error: "Unauthorized" });
  const p = e.parameter;
  try {
    if (p.action === "login")  return login(p.email, p.password);
    if (p.action === "me")     return me(p.email);
    if (p.action === "day")    return day(p.email, p.date);
    if (p.action === "warden") return warden(p.date);
    return out({ ok: false, error: "Unknown action" });
  } catch (err) { return out({ ok: false, error: String(err) }); }
}

/* ---------- POST: signup, submit (upsert meal) ---------- */
function doPost(e) {
  if (!check(e)) return out({ ok: false, error: "Unauthorized" });
  const b = JSON.parse(e.postData.contents || "{}");
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let r;
    if (e.parameter.action === "signup")      r = signup(b);
    else if (e.parameter.action === "submit") r = submit(b);
    else r = { ok: false, error: "Unknown action" };
    return out(r);
  } catch (err) { return out({ ok: false, error: String(err) }); }
  finally { lock.releaseLock(); }
}

function login(email, password) {
  const u = findUser(email);
  if (!u) return { ok: false, error: "No account found for this email." };
  if (String(u.password) !== String(password)) return { ok: false, error: "Wrong password." };
  return { ok: true, user: pub(u, String(email)) };
}
function me(email) {
  const u = findUser(email);
  if (!u) return { ok: false, error: "Account not found." };
  return { ok: true, user: pub(u, String(email)) };
}
function signup(b) {
  if (!b.email || !b.password || !b.name || !b.dept || !b.year) return { ok: false, error: "Missing fields." };
  if (String(b.password).length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (findUser(b.email)) return { ok: false, error: "This email is already registered. Please log in." };
  sh("Users").appendRow([b.email, b.password, b.name, b.dept, String(b.year), Utilities.formatDate(new Date(), tz(), "yyyy-MM-dd HH:mm:ss")]);
  return { ok: true, user: pub({ name: b.name, dept: b.dept, year: b.year }, String(b.email)) };
}
function day(email, date) {
  const m = rows("Meals").find(r => dstr(r.date) === String(date) && String(r.email).toLowerCase() === String(email).toLowerCase());
  return { ok: true, meal: m ? { b: Number(m.b), l: Number(m.l), d: Number(m.d) } : null };
}
function submit(b) {
  if (!b.date || !b.email) return { ok: false, error: "Missing fields." };
  cleanup();
  const s = sh("Meals"), v = s.getDataRange().getValues();
  const row = [b.date, b.email, b.name, b.dept, String(b.year), b.b ? 1 : 0, b.l ? 1 : 0, b.d ? 1 : 0, Utilities.formatDate(new Date(), tz(), "yyyy-MM-dd HH:mm:ss")];
  const i = v.findIndex((r, idx) => idx > 0 && dstr(r[0]) === String(b.date) && String(r[1]).toLowerCase() === String(b.email).toLowerCase());
  if (i > 0) s.getRange(i + 1, 1, 1, row.length).setValues([row]);
  else s.appendRow(row);
  return { ok: true };
}
function warden(date) {
  cleanup();
  const list = rows("Meals").filter(r => dstr(r.date) === String(date));
  return { ok: true, rows: list.map(r => ({ email: r.email, name: r.name, dept: r.dept, year: String(r.year), b: Number(r.b), l: Number(r.l), d: Number(r.d) })) };
}
function cleanup() {   // delete meal rows older than 30 days
  const s = sh("Meals"), v = s.getDataRange().getValues();
  if (v.length < 2) return;
  const cut = Utilities.formatDate(new Date(Date.now() - 30 * DAY), tz(), "yyyy-MM-dd");
  for (let i = v.length - 1; i >= 1; i--)
    if (dstr(v[i][0]) < cut) s.deleteRow(i + 1);
}
