/*
 * Content comes from content.js (defaults) + edits published from /admin.html.
 * Edits are cached in localStorage and refreshed from the Apps Script endpoint.
 */
const GOOGLE_SHEETS_ENDPOINT = window.YBS_ENDPOINT || "";
const YBS_DEFAULTS = window.YBS_DEFAULTS || {};
const CONTENT_CACHE_KEY = "ybs_content_cache_v1";
const CONTENT_REFRESH_MS = 5 * 60 * 1000;

let translations = {};
let englishProgramIntakes = {};
let programTuition = {};
let partners = [];
let faculty = [];
let programList = [];
let contentStamp = "";

function cloneData(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function applyContent(remote) {
  const defaults = cloneData(YBS_DEFAULTS);
  const edits = (remote && typeof remote === "object" && remote) || {};
  const texts = edits.texts || {};
  translations = {
    en: { ...(texts.en || {}) },
    ru: { ...(defaults.translations?.ru || {}), ...(texts.ru || {}) },
    hy: { ...(defaults.translations?.hy || {}), ...(texts.hy || {}) },
  };
  englishProgramIntakes = { ...(defaults.intakes || {}), ...(edits.intakes || {}) };
  programTuition = edits.tuition
    ? { ...(defaults.tuition || {}), ...edits.tuition }
    : defaults.tuition || {};
  partners = Array.isArray(edits.partners) ? edits.partners : defaults.partners || [];
  faculty = Array.isArray(edits.faculty) ? edits.faculty : defaults.faculty || [];
  programList = Array.isArray(edits.programs) ? edits.programs : defaults.programs || [];
}

function readCachedContent() {
  try {
    return JSON.parse(localStorage.getItem(CONTENT_CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

const cachedContent = readCachedContent();
contentStamp = cachedContent?.updatedAt || "";
applyContent(cachedContent?.content);


const englishText = {};
document.querySelectorAll("[data-i18n]").forEach((element) => {
  englishText[element.dataset.i18n] ??= element.textContent.trim();
});
document.querySelectorAll("[data-i18n-html]").forEach((element) => {
  englishText[element.dataset.i18nHtml] ??= element.innerHTML;
});
document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
  englishText[element.dataset.i18nPlaceholder] ??= element.placeholder;
});
document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
  englishText[element.dataset.i18nAriaLabel] ??=
    element.getAttribute("aria-label");
});

let currentLanguage = "en";
const languageField = document.querySelector("input[name='language']");
const languageButtons = document.querySelectorAll("[data-lang]");
const languageSwitcher = document.querySelector(".language-switcher");
const languageCurrent = document.querySelector(".language-current");
const currentLanguageLabel = document.querySelector(".current-language");
const languageLabels = { en: "EN", ru: "RU", hy: "ՀԱՅ" };
const menuLabels = {
  en: ["Open navigation menu", "Close navigation menu"],
  ru: ["Открыть меню", "Закрыть меню"],
  hy: ["Բացել ընտրացանկը", "Փակել ընտրացանկը"],
};
const formMessages = {
  en: {
    sending: "Sending your application…",
    local:
      "Application saved in this browser. Connect the Google Sheets endpoint to activate delivery.",
    success: "Thank you. Your application has been received.",
    error:
      "We couldn’t send the form. Please email info@ybs.am or call +374 10 525 530.",
  },
  ru: {
    sending: "Отправляем заявку…",
    local:
      "Заявка сохранена только в этом браузере. Подключите адрес Google Sheets, чтобы активировать отправку.",
    success: "Спасибо. Ваша заявка получена.",
    error:
      "Не удалось отправить заявку. Напишите на info@ybs.am или позвоните: +374 10 525 530.",
  },
  hy: {
    sending: "Դիմումն ուղարկվում է…",
    local:
      "Դիմումը պահպանվել է միայն այս դիտարկիչում։ Առաքումն ակտիվացնելու համար միացրեք Google Sheets-ի հասցեն։",
    success: "Շնորհակալություն։ Ձեր դիմումը ստացվել է։",
    error:
      "Չհաջողվեց ուղարկել դիմումը։ Գրեք info@ybs.am հասցեին կամ զանգահարեք +374 10 525 530։",
  },
};

/* ---------- Programs: order, visibility and new programs come from content ---------- */
const courseGrid = document.querySelector(".course-grid");
const upcomingList = document.querySelector(".upcoming-list");
const upcomingCount = document.querySelector(".upcoming-count");
const programSelect = document.querySelector("#application-form select[name='course']");
const staticProgramCards = new Map(
  [...document.querySelectorAll(".course[data-program-key]")].map((card) => [card.dataset.programKey, card]),
);
const originalProgramKeys = new Set(staticProgramCards.keys());
const staticUpcoming = new Map(
  [...document.querySelectorAll(".upcoming-item[data-course]")].map((item) => [item.dataset.course, item]),
);
const staticOptions = new Map(
  [...(programSelect?.options || [])].map((option) => [option.value, option]),
);
const defaultProgramMap = new Map((YBS_DEFAULTS.programs || []).map((p) => [p.key, p]));
const STATUS_FALLBACK = {
  enrolling: "Enrolling",
  open: "Applications open",
  deadline: "Deadline",
  active: "Current cohort",
};
const FORMAT_FALLBACK = { offline: "Offline", online: "Online", hybrid: "Hybrid" };
const BRANDS = {
  efpa: { logo: "assets/partners/efpa.webp", alt: "", key: "course.badgeQualification", small: true },
  ybs: { logo: "assets/logo.webp", alt: "Yerevan Business School", key: "course.badgeExecutive" },
  uba: { logo: "assets/partners/uba.webp", alt: "Union of Banks of Armenia", key: "course.badgeApplied" },
};

function i18nNode(tag, key, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.dataset.i18n = key;
  node.textContent = translations.en?.[key] ?? englishText[key] ?? "";
  return node;
}

function brandNode(brand) {
  const spec = BRANDS[brand];
  if (!spec) return null;
  const wrap = document.createElement("span");
  wrap.className = `course-brand course-brand-${brand}`;
  const image = document.createElement("img");
  image.src = spec.logo;
  image.alt = spec.alt;
  wrap.append(image);
  wrap.append(i18nNode(spec.small ? "small" : "span", spec.key, spec.small ? "" : "sr-only"));
  return wrap;
}

function buildProgramCard(program) {
  const key = program.key;
  const card = document.createElement("button");
  card.type = "button";
  card.className = "course";
  card.dataset.programKey = key;
  const number = document.createElement("span");
  number.className = "course-no";
  card.append(number);
  const brand = brandNode(program.brand);
  if (brand) card.append(brand);
  const body = document.createElement("div");
  const facts = document.createElement("div");
  facts.className = "course-facts";
  facts.append(
    i18nNode("span", `course.${key}.duration`),
    i18nNode("span", `course.${key}.audience`),
    i18nNode("span", `course.format.${program.format || "offline"}`, `course-format course-format-${program.format || "offline"}`),
  );
  body.append(
    i18nNode("p", `course.${key}.category`),
    i18nNode("h3", `course.${key}.title`),
    i18nNode("span", `course.${key}.description`, "course-description"),
    facts,
  );
  const action = document.createElement("span");
  action.className = "course-action";
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  action.append(i18nNode("span", "course.details"), arrow);
  card.append(body, action);
  return card;
}

function buildUpcomingItem(program) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "upcoming-item";
  item.append(
    document.createElement("span"),
    i18nNode("h3", `course.${program.key}.title`),
    i18nNode("p", `upcoming.${program.key}.description`, "upcoming-description"),
    i18nNode("p", `upcoming.${program.key}.meta`, "upcoming-meta"),
  );
  return item;
}

function syncProgramCard(card, program) {
  const fallback = defaultProgramMap.get(program.key) || {};
  card.dataset.course = program.course;
  card.setAttribute("aria-haspopup", "dialog");
  card.setAttribute("aria-controls", "program-modal");
  card.classList.remove(
    "course-theme-investment", "course-theme-esg", "course-theme-applied", "course-theme-executive",
  );
  if (program.theme && program.theme !== fallback.theme) card.classList.add(`course-theme-${program.theme}`);
  const isOriginal = originalProgramKeys.has(program.key);
  if (!isOriginal) card.classList.add(`course-theme-${program.theme || "investment"}`);
  if (!card.classList.contains("workshop-course")) {
    if (!isOriginal || (program.brand || "none") !== (fallback.brand || "none")) {
      card.querySelector(".course-brand")?.remove();
      const brand = brandNode(program.brand);
      if (brand) card.querySelector(".course-no").after(brand);
    }
    const format = card.querySelector(".course-format[data-i18n^='course.format.']");
    if (format && program.format) {
      format.className = `course-format course-format-${program.format}`;
      format.dataset.i18n = `course.format.${program.format}`;
      format.textContent = FORMAT_FALLBACK[program.format] || program.format;
    }
  }
}

function renderPrograms() {
  if (!courseGrid) return;
  const visible = programList.filter((p) => p && p.key && p.course && !p.hidden);
  courseGrid.replaceChildren();
  visible.forEach((program, index) => {
    const card = staticProgramCards.get(program.key) || buildProgramCard(program);
    staticProgramCards.set(program.key, card);
    syncProgramCard(card, program);
    const number = card.querySelector(".course-no");
    if (number) {
      const suffix = program.layout === "workshop" ? " · WORKSHOP" : "";
      number.textContent = String(index + 1).padStart(2, "0") + suffix;
    }
    courseGrid.append(card);
  });

  if (upcomingList) {
    const upcoming = visible.filter((p) => p.upcoming);
    upcomingList.replaceChildren();
    upcoming.forEach((program) => {
      let item = staticUpcoming.get(program.course);
      if (!item) {
        item = buildUpcomingItem(program);
        staticUpcoming.set(program.course, item);
      }
      item.dataset.course = program.course;
      item.setAttribute("aria-haspopup", "dialog");
      item.setAttribute("aria-controls", "program-modal");
      const statusKey = program.status || "enrolling";
      const status = document.createElement("span");
      status.className = `status ${statusKey === "deadline" ? "deadline" : "open"}`;
      status.dataset.i18n = `status.${statusKey}`;
      status.textContent = translations.en?.[status.dataset.i18n] ?? englishText[status.dataset.i18n] ?? STATUS_FALLBACK[statusKey] ?? "";
      item.firstElementChild.replaceWith(status);
      upcomingList.append(item);
    });
    if (upcomingCount) upcomingCount.textContent = String(upcoming.length).padStart(2, "0");
    upcomingList.closest("aside")?.toggleAttribute("hidden", !upcoming.length);
  }

  if (programSelect) {
    const current = programSelect.value;
    programSelect.replaceChildren();
    visible.forEach((program) => {
      const option = staticOptions.get(program.course) || document.createElement("option");
      option.value = program.course;
      option.dataset.i18n = `course.${program.key}.title`;
      if (!option.textContent.trim()) option.textContent = translations.en?.[option.dataset.i18n] ?? program.course;
      staticOptions.set(program.course, option);
      programSelect.append(option);
    });
    if ([...programSelect.options].some((o) => o.value === current)) programSelect.value = current;
  }
}
renderPrograms();

function setLanguage(language) {
  currentLanguage = translations[language] ? language : "en";
  const dictionary = translations[currentLanguage] || {};
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    element.textContent =
      dictionary[key] ?? translations.en?.[key] ?? englishText[key] ?? element.textContent;
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    const key = element.dataset.i18nHtml;
    element.innerHTML =
      dictionary[key] ?? translations.en?.[key] ?? englishText[key] ?? element.innerHTML;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    element.placeholder =
      dictionary[key] ?? translations.en?.[key] ?? englishText[key] ?? element.placeholder;
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    element.setAttribute(
      "aria-label",
      dictionary[key] ?? translations.en?.[key] ?? englishText[key] ?? element.getAttribute("aria-label"),
    );
  });
  languageButtons.forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.lang === currentLanguage),
    );
  });
  if (currentLanguageLabel)
    currentLanguageLabel.textContent = languageLabels[currentLanguage];
  if (languageSwitcher) languageSwitcher.classList.remove("open");
  if (languageCurrent) languageCurrent.setAttribute("aria-expanded", "false");
  if (languageField) languageField.value = currentLanguage;
  const titles = {
    en: "Yerevan Business School — Think sharper, lead further.",
    ru: "Yerevan Business School — мыслите точнее, действуйте смелее.",
    hy: "Yerevan Business School — մտածեք հստակ, առաջնորդեք վստահ։",
  };
  document.title = titles[currentLanguage];
  try {
    localStorage.setItem("ybs_language", currentLanguage);
  } catch {}
  document.dispatchEvent(new CustomEvent("ybs:languagechange"));
}

languageButtons.forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.lang));
});
languageCurrent?.addEventListener("click", () => {
  const open = !languageSwitcher.classList.contains("open");
  languageSwitcher.classList.toggle("open", open);
  languageCurrent.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (event) => {
  if (!languageSwitcher?.contains(event.target)) {
    languageSwitcher?.classList.remove("open");
    languageCurrent?.setAttribute("aria-expanded", "false");
  }
});
try {
  setLanguage(localStorage.getItem("ybs_language") || "en");
} catch {
  setLanguage("en");
}

const navigation = document.querySelector(".nav");
const menuToggle = document.querySelector(".menu-toggle");
function setMenu(open) {
  navigation.classList.toggle("menu-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute(
    "aria-label",
    menuLabels[currentLanguage][open ? 1 : 0],
  );
}
menuToggle.addEventListener("click", () =>
  setMenu(!navigation.classList.contains("menu-open")),
);
document
  .querySelectorAll(".nav-links a")
  .forEach((link) => link.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  setMenu(false);
  languageSwitcher?.classList.remove("open");
  languageCurrent?.setAttribute("aria-expanded", "false");
});

const sectionLinks = [
  ...document.querySelectorAll(".nav-links a[href^='#']:not(.nav-mobile-cta)"),
];
const observedSections = sectionLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);
if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      sectionLinks.forEach((link) => {
        const active = link.getAttribute("href") === `#${visible.target.id}`;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-30% 0px -55%", threshold: [0, 0.2, 0.5] },
  );
  observedSections.forEach((section) => sectionObserver.observe(section));
}

function seededShuffle(items) {
  const result = [...items];
  let seed = 20260915;
  for (let i = result.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function assetUrl(path, folder) {
  if (!path) return "";
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:") || path.includes("/"))
    return path;
  return `assets/${folder}/${path}`;
}

function partnerMarkup(partner, duplicate = false) {
  const item = document.createElement("div");
  item.className = "partner-mark";
  if (duplicate) item.setAttribute("aria-hidden", "true");
  if (partner.logo) {
    const image = document.createElement("img");
    image.src = assetUrl(partner.logo, "partners");
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    if (partner.darken) image.className = "logo-darken";
    image.addEventListener("error", () => image.remove());
    item.append(image);
  }
  const name = document.createElement("strong");
  name.textContent = partner.name;
  item.append(name);
  return item;
}

const partnerTrack = document.querySelector(".partner-track");
function renderPartners() {
  if (!partnerTrack) return;
  partnerTrack.replaceChildren();
  const partnerOrder = seededShuffle(partners.filter((p) => p && p.name && !p.hidden));
  for (const partner of partnerOrder) partnerTrack.append(partnerMarkup(partner));
  for (const partner of partnerOrder)
    partnerTrack.append(partnerMarkup(partner, true));
}
renderPartners();

const facultyGrid = document.querySelector(".faculty-grid");
function renderFaculty() {
  if (!facultyGrid || !faculty.length) return;
  facultyGrid.replaceChildren();
  faculty
    .filter((person) => person && person.name && !person.hidden)
    .forEach((person) => {
      const article = document.createElement("article");
      article.className = "person";
      const photo = document.createElement("div");
      photo.className = "person-photo";
      if (person.photo) {
        const image = document.createElement("img");
        image.src = assetUrl(person.photo, "faculty");
        image.alt = person.name;
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        photo.append(image);
      }
      const name = document.createElement("h3");
      name.textContent = person.name;
      const role = document.createElement("p");
      const roles = person.role || {};
      role.textContent = roles[currentLanguage] || roles.en || "";
      article.append(photo, name, role);
      facultyGrid.append(article);
    });
}
renderFaculty();
document.addEventListener("ybs:languagechange", renderFaculty);

const form = document.querySelector("#application-form");
const courseSelect = form.querySelector("select[name='course']");
const formStatus = form.querySelector(".form-status");
const programModal = document.querySelector("#program-modal");
const programModalDialog = programModal.querySelector(".program-modal-dialog");
const programModalTitle = programModal.querySelector("#program-modal-title");
const programModalDescription = programModal.querySelector(
  "#program-modal-description",
);
const programModalBrand = programModal.querySelector("#program-modal-brand");
const programModalNumber = programModal.querySelector("#program-modal-number");
const programModalFacts = programModal.querySelector("#program-modal-facts");
const programModalCredential = programModal.querySelector(
  "#program-modal-credential",
);
const programModalIntake = programModal.querySelector("#program-modal-intake");
const programModalTuition = programModal.querySelector(
  "#program-modal-tuition",
);
const programModalApply = programModal.querySelector("#program-modal-apply");

let selectedProgram = "";
let lastProgramTrigger = null;

function clearStaleScrollLock() {
  if (!programModal.classList.contains("is-open")) {
    document.body.classList.remove("modal-open");
  }
}

clearStaleScrollLock();
window.addEventListener("pageshow", () => {
  programModal.classList.remove("is-open");
  programModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
});

function localizedIntake(programKey) {
  if (currentLanguage === "en")
    return englishProgramIntakes[programKey] || englishProgramIntakes.eip;
  return (
    translations[currentLanguage]?.[`modal.intake.${programKey}`] ||
    englishProgramIntakes[programKey] ||
    englishProgramIntakes.eip
  );
}

function programCardFor(courseName) {
  return [...document.querySelectorAll(".course-grid .course[data-course]")].find(
    (card) => card.dataset.course === courseName,
  );
}

function renderProgramTuition(programKey) {
  const languagePrices = programTuition[currentLanguage] || programTuition.en;
  const rows = languagePrices[programKey] || languagePrices.default;
  programModalTuition.replaceChildren();
  rows.forEach(({ label, value }) => {
    const row = document.createElement("span");
    if (label) {
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      row.append(labelNode);
    }
    const valueNode = document.createElement("strong");
    valueNode.textContent = value;
    row.append(valueNode);
    programModalTuition.append(row);
  });
}

function renderProgramModal() {
  const source = programCardFor(selectedProgram);
  if (!source) return;
  const key = source.dataset.programKey;
  const title =
    source.querySelector("h3")?.textContent.trim() || selectedProgram;
  const description =
    source.querySelector(".course-description")?.textContent.trim() || "";
  const brandParts = [
    ...source.querySelectorAll(".course-brand strong, .course-brand small"),
  ]
    .map((part) => part.textContent.trim())
    .filter(Boolean);
  let brand = brandParts.length
    ? brandParts.join(" · ")
    : source
        .querySelector(".course-brand")
        ?.textContent.trim()
        .replace(/\s+/g, " ") ||
      source.querySelector("p")?.textContent.trim() ||
      "YBS";
  if (source.querySelector(".course-brand-efpa")) brand = `EFPA · ${brand}`;
  if (source.querySelector(".course-brand-ybs")) brand = `YBS · ${brand}`;
  programModalTitle.textContent = title;
  programModalDescription.textContent = description;
  programModalBrand.textContent =
    source.querySelector("p")?.textContent.trim() || brand;
  programModalNumber.textContent =
    source.querySelector(".course-no")?.textContent.trim().split("·")[0] || "";
  programModalCredential.textContent = brand;
  programModalIntake.textContent = localizedIntake(key);
  renderProgramTuition(key);
  programModalFacts.replaceChildren();
  source.querySelectorAll(".course-facts span").forEach((fact) => {
    const chip = document.createElement("span");
    chip.textContent = fact.textContent.trim();
    programModalFacts.append(chip);
  });
}

function openProgramModal(trigger) {
  selectedProgram = trigger.dataset.course;
  lastProgramTrigger = trigger;
  setMenu(false);
  renderProgramModal();
  programModal.classList.add("is-open");
  programModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => programModalDialog.focus());
}

function closeProgramModal(restoreFocus = true) {
  if (!programModal.classList.contains("is-open")) return;
  programModal.classList.remove("is-open");
  programModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (restoreFocus) lastProgramTrigger?.focus({ preventScroll: true });
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest?.("button[data-course]");
  if (trigger && !trigger.closest("#program-modal")) openProgramModal(trigger);
});
programModal.querySelectorAll("[data-modal-close]").forEach((button) => {
  button.addEventListener("click", () => closeProgramModal());
});
programModalApply.addEventListener("click", () => {
  courseSelect.value = selectedProgram;
  closeProgramModal(false);
  document.querySelector("#apply").scrollIntoView({ behavior: "smooth" });
  form.classList.add("is-selected");
  window.setTimeout(() => form.classList.remove("is-selected"), 1600);
});
document.addEventListener("ybs:languagechange", () => {
  if (programModal.classList.contains("is-open")) renderProgramModal();
});
document.addEventListener("keydown", (event) => {
  if (!programModal.classList.contains("is-open")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeProgramModal();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [
    ...programModalDialog.querySelectorAll(
      "button, a, input, select, textarea, [tabindex]:not([tabindex='-1'])",
    ),
  ].filter((element) => !element.disabled && element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector("button[type='submit']");
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.submittedAt = new Date().toISOString();
  payload.source = "ybs-website";
  submitButton.disabled = true;

  try {
    if (!GOOGLE_SHEETS_ENDPOINT) {
      localStorage.setItem("ybs_application", JSON.stringify(payload));
      form.innerHTML = `
        <div class="form-success-alert">
          🎉 ${formMessages[currentLanguage].success || "Thank you. Your application has been received."}
        </div>
      `;
      return;
    }
    await fetch(GOOGLE_SHEETS_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    form.reset();
    form.innerHTML = `
      <div class="form-success-alert">
        🎉 ${formMessages[currentLanguage].success || "Thank you. Your application has been received."}
      </div>
    `;
  } catch (error) {
    formStatus.textContent = formMessages[currentLanguage].error;
    submitButton.disabled = false;
  }
});

async function refreshContent() {
  if (!GOOGLE_SHEETS_ENDPOINT) return;
  const fresh = cachedContent && Date.now() - (cachedContent.fetchedAt || 0) < CONTENT_REFRESH_MS;
  const forced = /[?&]fresh\b/.test(location.search);
  if (fresh && !forced) return;
  try {
    const response = await fetch(`${GOOGLE_SHEETS_ENDPOINT}?action=content`, { cache: "no-store" });
    const data = await response.json();
    if (!data || !data.ok) return;
    try {
      localStorage.setItem(
        CONTENT_CACHE_KEY,
        JSON.stringify({ content: data.content || null, updatedAt: data.updatedAt || "", fetchedAt: Date.now() }),
      );
    } catch {}
    if ((data.updatedAt || "") === contentStamp) return;
    contentStamp = data.updatedAt || "";
    applyContent(data.content);
    renderPrograms();
    setLanguage(currentLanguage);
    renderPartners();
    renderFaculty();
  } catch {
    /* Network or endpoint issue: keep defaults / cached content. */
  }
}
refreshContent();
