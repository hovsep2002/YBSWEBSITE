/**
 * Yerevan Business School — backend for the website and the admin panel.
 * Runs free on Google Apps Script. No extra hosting needed.
 *
 * What it does
 *   - receives applications from the website form → sheet "Applications"
 *   - serves the editable site content (texts, prices, faculty, partners)
 *   - lets the admin panel (/admin.html) log in, edit, upload images,
 *     view applications and restore earlier versions
 *
 * First-time setup (one time, ~5 minutes) — see ADMIN-SETUP-HY.md
 *   1. Paste this whole file into Extensions → Apps Script of the
 *      applications spreadsheet (replace the old code).
 *   2. Write a password in SETUP_PASSWORD below, choose the function
 *      "setup" at the top and press Run. Allow the permissions.
 *   3. Erase the password from SETUP_PASSWORD again and save.
 *   4. Deploy → Manage deployments → ✎ Edit → Version: "New version" → Deploy.
 *      (Editing the existing deployment keeps the same URL, so the site
 *      keeps working without changes.)
 */

const SETUP_PASSWORD = ""; // used only by setup(); erase after running it

const CONFIG = {
  APPLICATIONS_SHEET: "Applications",
  FOLDER_NAME: "YBS Website Admin",
  CONTENT_FILE: "content.json",
  HISTORY_FOLDER: "history",
  IMAGES_FOLDER: "images",
  HISTORY_KEEP: 40,
  SESSION_SECONDS: 6 * 60 * 60, // 6 hours (Apps Script cache maximum)
  CONTENT_CACHE_SECONDS: 10 * 60,
  MAX_LOGIN_FAILS: 6,
  LOCK_SECONDS: 15 * 60,
  MAX_IMAGE_BYTES: 3 * 1024 * 1024,
};

/* ----------------------------------------------------------------- setup */

function setup() {
  const props = PropertiesService.getScriptProperties();
  const folder = getRootFolder_();
  getSubFolder_(folder, CONFIG.HISTORY_FOLDER);
  getSubFolder_(folder, CONFIG.IMAGES_FOLDER);
  getContentFile_();
  if (SETUP_PASSWORD) {
    if (SETUP_PASSWORD.length < 8) throw new Error("Password must be at least 8 characters.");
    setPassword_(SETUP_PASSWORD);
    Logger.log("Admin password saved. Now erase SETUP_PASSWORD and save the file.");
  } else if (!props.getProperty("ADMIN_HASH")) {
    throw new Error("Write a password in SETUP_PASSWORD first, then run setup again.");
  }
  getApplicationsSheet_();
  Logger.log("Ready. Drive folder: " + folder.getUrl());
}

/* --------------------------------------------------------------- routing */

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "";
  try {
    if (action === "content") return json_(publicContent_());
    return json_({ ok: true, service: "ybs-admin" });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function doPost(e) {
  let data = {};
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (error) {
    return json_({ ok: false, error: "bad_json" });
  }

  // Website application form (no "action" field) — kept compatible.
  if (!data.action) return json_(saveApplication_(data));

  try {
    switch (data.action) {
      case "login":
        return json_(login_(data.password));
      case "logout":
        CacheService.getScriptCache().remove("sess_" + data.token);
        return json_({ ok: true });
    }
    requireSession_(data.token);
    switch (data.action) {
      case "getContent":
        return json_(adminContent_());
      case "saveContent":
        return json_(saveContent_(data.content, data.baseUpdatedAt, data.note));
      case "history":
        return json_(listHistory_());
      case "restore":
        return json_(restoreVersion_(data.id));
      case "applications":
        return json_(listApplications_(data.limit));
      case "uploadImage":
        return json_(uploadImage_(data));
      case "changePassword":
        return json_(changePassword_(data.oldPassword, data.newPassword));
      case "ping":
        return json_({ ok: true });
      default:
        return json_({ ok: false, error: "unknown_action" });
    }
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

/* ---------------------------------------------------------- applications */

function getApplicationsSheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  return book.getSheetByName(CONFIG.APPLICATIONS_SHEET) || book.insertSheet(CONFIG.APPLICATIONS_SHEET);
}

function saveApplication_(data) {
  const sheet = getApplicationsSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Submitted at", "First name", "Last name", "Email", "Phone",
        "Program", "Professional goal", "Consent", "Language", "Source",
      ]);
    }
    sheet.appendRow([
      data.submittedAt || new Date().toISOString(),
      clean_(data.firstName), clean_(data.lastName), clean_(data.email), clean_(data.phone),
      clean_(data.course), clean_(data.goal), clean_(data.consent), clean_(data.language),
      clean_(data.source || "ybs-website"),
    ]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

// Prevent spreadsheet formula injection from form input.
function clean_(value) {
  const text = String(value == null ? "" : value).slice(0, 4000);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function listApplications_(limit) {
  const sheet = getApplicationsSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const max = Math.min(Number(limit) || 1000, 5000);
  if (lastRow < 1) return { ok: true, header: [], rows: [], total: 0, sheetUrl: sheet.getParent().getUrl() };
  const header = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const count = Math.min(max, lastRow - 1);
  const rows = count > 0 ? sheet.getRange(lastRow - count + 1, 1, count, lastCol).getDisplayValues() : [];
  return { ok: true, header: header, rows: rows.reverse(), total: lastRow - 1, sheetUrl: sheet.getParent().getUrl() };
}

/* ----------------------------------------------------------------- content */

function getRootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("FOLDER_ID");
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (error) { /* recreate below */ }
  }
  const folder = DriveApp.createFolder(CONFIG.FOLDER_NAME);
  props.setProperty("FOLDER_ID", folder.getId());
  return folder;
}

function getSubFolder_(parent, name) {
  const found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}

function getContentFile_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("CONTENT_FILE_ID");
  if (id) {
    try { return DriveApp.getFileById(id); } catch (error) { /* recreate below */ }
  }
  const file = getRootFolder_().createFile(CONFIG.CONTENT_FILE, JSON.stringify({ content: null, updatedAt: "" }), "application/json");
  props.setProperty("CONTENT_FILE_ID", file.getId());
  return file;
}

function readStored_() {
  try {
    const stored = JSON.parse(getContentFile_().getBlob().getDataAsString("UTF-8") || "{}");
    return { content: stored.content || null, updatedAt: stored.updatedAt || "" };
  } catch (error) {
    return { content: null, updatedAt: "" };
  }
}

function publicContent_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("public_content");
  if (cached) return JSON.parse(cached);
  const stored = readStored_();
  const result = { ok: true, content: stored.content, updatedAt: stored.updatedAt };
  const text = JSON.stringify(result);
  if (text.length < 95000) cache.put("public_content", text, CONFIG.CONTENT_CACHE_SECONDS);
  return result;
}

function adminContent_() {
  const stored = readStored_();
  return { ok: true, content: stored.content, updatedAt: stored.updatedAt };
}

function saveContent_(content, baseUpdatedAt, note) {
  if (content !== null && typeof content !== "object") throw new Error("bad_content");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const current = readStored_();
    if (baseUpdatedAt !== undefined && current.updatedAt && baseUpdatedAt !== current.updatedAt) {
      return { ok: false, error: "conflict", updatedAt: current.updatedAt };
    }
    const updatedAt = new Date().toISOString();
    const payload = JSON.stringify({ content: content, updatedAt: updatedAt, note: String(note || "").slice(0, 200) });
    getContentFile_().setContent(payload);
    const history = getSubFolder_(getRootFolder_(), CONFIG.HISTORY_FOLDER);
    history.createFile("content-" + updatedAt.replace(/[:.]/g, "-") + ".json", payload, "application/json");
    pruneHistory_(history);
    CacheService.getScriptCache().remove("public_content");
    return { ok: true, updatedAt: updatedAt };
  } finally {
    lock.releaseLock();
  }
}

function pruneHistory_(folder) {
  const files = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) files.push(iterator.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(CONFIG.HISTORY_KEEP).forEach(function (file) { file.setTrashed(true); });
}

function listHistory_() {
  const folder = getSubFolder_(getRootFolder_(), CONFIG.HISTORY_FOLDER);
  const items = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    const file = iterator.next();
    let note = "";
    try { note = JSON.parse(file.getBlob().getDataAsString("UTF-8")).note || ""; } catch (error) { /* ignore */ }
    items.push({ id: file.getId(), date: file.getDateCreated().toISOString(), size: file.getSize(), note: note });
  }
  items.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  return { ok: true, items: items };
}

function restoreVersion_(id) {
  const folder = getSubFolder_(getRootFolder_(), CONFIG.HISTORY_FOLDER);
  const file = DriveApp.getFileById(id);
  const parents = file.getParents();
  if (!parents.hasNext() || parents.next().getId() !== folder.getId()) throw new Error("not_a_history_file");
  const stored = JSON.parse(file.getBlob().getDataAsString("UTF-8"));
  return saveContent_(stored.content, undefined, "Restored version from " + (stored.updatedAt || file.getDateCreated().toISOString()));
}

/* ------------------------------------------------------------------ images */

function uploadImage_(data) {
  const mime = String(data.mimeType || "");
  if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(mime)) throw new Error("unsupported_image_type");
  const bytes = Utilities.base64Decode(String(data.base64 || ""));
  if (!bytes.length || bytes.length > CONFIG.MAX_IMAGE_BYTES) throw new Error("image_too_large");
  const name = String(data.name || "image").replace(/[^\w.\-]+/g, "-").slice(0, 80);
  const folder = getSubFolder_(getRootFolder_(), CONFIG.IMAGES_FOLDER);
  const file = folder.createFile(Utilities.newBlob(bytes, mime, Date.now() + "-" + name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, id: file.getId(), url: "https://lh3.googleusercontent.com/d/" + file.getId() };
}

/* -------------------------------------------------------------------- auth */

function hash_(password, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + "::" + password,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(digest);
}

function setPassword_(password) {
  const salt = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperties({
    ADMIN_SALT: salt,
    ADMIN_HASH: hash_(password, salt),
  });
}

function checkPassword_(password) {
  const props = PropertiesService.getScriptProperties();
  const salt = props.getProperty("ADMIN_SALT");
  const expected = props.getProperty("ADMIN_HASH");
  if (!salt || !expected) throw new Error("not_configured");
  return hash_(String(password || ""), salt) === expected;
}

function login_(password) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get("login_fails") || 0);
  if (fails >= CONFIG.MAX_LOGIN_FAILS) return { ok: false, error: "locked" };
  if (!checkPassword_(password)) {
    cache.put("login_fails", String(fails + 1), CONFIG.LOCK_SECONDS);
    Utilities.sleep(800);
    return { ok: false, error: "wrong_password" };
  }
  cache.remove("login_fails");
  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put("sess_" + token, "1", CONFIG.SESSION_SECONDS);
  return { ok: true, token: token, expiresIn: CONFIG.SESSION_SECONDS };
}

function requireSession_(token) {
  if (!token || !CacheService.getScriptCache().get("sess_" + token)) throw new Error("unauthorized");
}

function changePassword_(oldPassword, newPassword) {
  if (!checkPassword_(oldPassword)) return { ok: false, error: "wrong_password" };
  if (!newPassword || String(newPassword).length < 8) return { ok: false, error: "password_too_short" };
  setPassword_(String(newPassword));
  return { ok: true };
}

/* ------------------------------------------------------------------ helpers */

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
