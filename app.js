const FORM_ENDPOINT = "https://formspree.io/f/mwvjggll";
const STORAGE_KEY = "dostupen-request-ids";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requestForm = document.querySelector("#request-form");
const requestSection = document.querySelector("#request-section");
const requestToggle = document.querySelector("#request-toggle");
const requestBody = document.querySelector("#request-body");
const requestIdInput = document.querySelector("#request-id-input");
const registrarSelect = document.querySelector("#registrar");
const registrarOtherField = document.querySelector("#registrar-other-field");
const registrarOtherInput = document.querySelector("#registrar-other");
const hostingSelect = document.querySelector("#hosting");
const hostingOtherField = document.querySelector("#hosting-other-field");
const hostingOtherInput = document.querySelector("#hosting-other");
const formStatus = document.querySelector("#form-status");
const success = document.querySelector("#success");
const successId = document.querySelector("#success-id");
const copyLinkButton = document.querySelector("#copy-link");
const lookupForm = document.querySelector("#lookup-form");
const lookupInput = document.querySelector("#lookup-id");
const resolution = document.querySelector("#resolution");
const resolutionLabel = document.querySelector("#resolution-label");
const resolutionContent = document.querySelector("#resolution-content");
const saved = document.querySelector("#saved");
const savedList = document.querySelector("#saved-list");

let currentRequestId = crypto.randomUUID();
requestIdInput.value = currentRequestId;
document.querySelector("#year").textContent = new Date().getFullYear();

function setRequestCollapsed(collapsed) {
  requestBody.hidden = collapsed;
  requestToggle.setAttribute("aria-expanded", String(!collapsed));
  requestSection.classList.toggle("is-collapsed", collapsed);
}

function toggleOtherField(select, field, input) {
  const show = select.value === "Другое";
  field.hidden = !show;
  input.disabled = !show;
  input.required = show;

  if (!show) {
    input.value = "";
  }
}

function getSavedIds() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id) => UUID_PATTERN.test(id)) : [];
  } catch {
    return [];
  }
}

function saveId(id) {
  const ids = [id, ...getSavedIds().filter((savedId) => savedId !== id)].slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  renderSavedIds();
}

function requestUrl(id) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("request", id);
  return url.toString();
}

function renderSavedIds() {
  const ids = getSavedIds();
  saved.hidden = ids.length === 0;
  savedList.replaceChildren();

  ids.forEach((id) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = id;
    button.addEventListener("click", () => {
      lookupInput.value = id;
      checkResolution(id);
    });
    savedList.append(button);
  });
}

function showResolution(type, label, message) {
  resolution.className = `resolution resolution--${type}`;
  resolutionLabel.textContent = label;
  resolutionContent.replaceChildren();
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  resolutionContent.append(paragraph);
  resolution.hidden = false;
}

async function checkResolution(rawId) {
  const id = rawId.trim().toLowerCase();

  if (!UUID_PATTERN.test(id)) {
    showResolution("error", "Неверный номер", "Проверьте номер заявки и попробуйте ещё раз.");
    return;
  }

  lookupInput.value = id;
  showResolution("pending", "Проверяем", "Загружаем актуальный статус заявки…");

  try {
    const response = await fetch(`./resolutions.json?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Could not load resolutions");
    }

    const resolutions = await response.json();
    const result = resolutions[id];

    if (!result) {
      showResolution(
        "pending",
        "На рассмотрении",
        "Ответ пока не опубликован. Сохраните эту страницу и проверьте её позже.",
      );
      return;
    }

    const answer = typeof result === "string" ? result : result.answer;
    if (!answer) {
      throw new Error("Invalid resolution format");
    }

    showResolution("ready", "Ответ готов", answer);
    saveId(id);
  } catch {
    showResolution(
      "error",
      "Не удалось проверить",
      "Обновите страницу или попробуйте ещё раз немного позже.",
    );
  }
}

requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = requestForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Отправляем…";
  formStatus.textContent = "";

  try {
    const response = await fetch(FORM_ENDPOINT, {
      method: "POST",
      body: new FormData(requestForm),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("Form submission failed");
    }

    saveId(currentRequestId);
    successId.textContent = currentRequestId;
    requestForm.hidden = true;
    success.hidden = false;

    const url = requestUrl(currentRequestId);
    window.history.replaceState({}, "", url);
    lookupInput.value = currentRequestId;
  } catch {
    formStatus.textContent =
      "Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.";
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Отправить заявку";
  }
});

requestToggle.addEventListener("click", () => {
  setRequestCollapsed(requestToggle.getAttribute("aria-expanded") === "true");
});

registrarSelect.addEventListener("change", () => {
  toggleOtherField(registrarSelect, registrarOtherField, registrarOtherInput);
});

hostingSelect.addEventListener("change", () => {
  toggleOtherField(hostingSelect, hostingOtherField, hostingOtherInput);
});

copyLinkButton.addEventListener("click", async () => {
  const originalText = copyLinkButton.querySelector("span").textContent;

  try {
    await navigator.clipboard.writeText(requestUrl(currentRequestId));
    copyLinkButton.querySelector("span").textContent = "Ссылка скопирована";
  } catch {
    copyLinkButton.querySelector("span").textContent = "Не удалось скопировать";
  }

  window.setTimeout(() => {
    copyLinkButton.querySelector("span").textContent = originalText;
  }, 2200);
});

lookupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  checkResolution(lookupInput.value);
});

const requestIdFromUrl = new URLSearchParams(window.location.search).get("request");
if (requestIdFromUrl) {
  lookupInput.value = requestIdFromUrl;
  checkResolution(requestIdFromUrl);
  document.querySelector("#resolution-section").scrollIntoView();
}

renderSavedIds();
setRequestCollapsed(getSavedIds().length > 0);
