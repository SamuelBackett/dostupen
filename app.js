const FORM_ENDPOINT = "https://formspree.io/f/mwvjggll";
const STORAGE_KEY = "dostupen-request-ids";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const requestForm = document.querySelector("#request-form");
const requestSection = document.querySelector("#request-section");
const requestToggle = document.querySelector("#request-toggle");
const requestBody = document.querySelector("#request-body");
const requestIdInput = document.querySelector("#request-id-input");
const dataTokenInput = document.querySelector("#data-token-input");
const encryptionKeyInput = document.querySelector("#encryption-key-input");
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

const currentRequest = {
  id: crypto.randomUUID(),
  token: DostupenCrypto.randomSecret(),
  key: DostupenCrypto.randomSecret(),
};

requestIdInput.value = currentRequest.id;
dataTokenInput.value = currentRequest.token;
encryptionKeyInput.value = currentRequest.key;
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

function isValidRequestAccess(value) {
  return (
    value &&
    UUID_PATTERN.test(value.id) &&
    TOKEN_PATTERN.test(value.token) &&
    TOKEN_PATTERN.test(value.key)
  );
}

function getStoredValue() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function getSavedRequests() {
  return getStoredValue().filter(isValidRequestAccess);
}

function saveRequest(request) {
  const requests = [
    request,
    ...getSavedRequests().filter((savedRequest) => savedRequest.id !== request.id),
  ].slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  renderSavedRequests();
}

function requestUrl(request) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("request", request.id);
  url.hash = new URLSearchParams({
    token: request.token,
    key: request.key,
  }).toString();
  return url.toString();
}

function renderSavedRequests() {
  const requests = getSavedRequests();
  saved.hidden = requests.length === 0;
  savedList.replaceChildren();

  requests.forEach((request) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = request.id;
    button.addEventListener("click", () => {
      lookupInput.value = request.id;
      checkResolution(request);
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

function accessFromUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    return {
      id: url.searchParams.get("request")?.toLowerCase() || "",
      token: fragment.get("token") || "",
      key: fragment.get("key") || "",
    };
  } catch {
    return null;
  }
}

function accessFromInput(value) {
  const normalized = value.trim();

  if (UUID_PATTERN.test(normalized)) {
    return getSavedRequests().find(
      (request) => request.id === normalized.toLowerCase(),
    );
  }

  return accessFromUrl(normalized);
}

async function checkResolution(request) {
  if (!isValidRequestAccess(request)) {
    showResolution(
      "error",
      "Недостаточно данных",
      "Откройте полную сохранённую ссылку. Одного номера заявки на новом устройстве недостаточно.",
    );
    return;
  }

  lookupInput.value = request.id;
  showResolution("pending", "Проверяем", "Загружаем актуальный статус заявки…");

  try {
    const response = await fetch(`./data/${request.token}.json?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      showResolution(
        "pending",
        "На рассмотрении",
        "Ответ пока не опубликован. Сохраните эту страницу и проверьте её позже.",
      );
      return;
    }

    if (!response.ok) {
      throw new Error("Could not load resolution");
    }

    const payload = await response.json();
    const answer = await DostupenCrypto.decryptText(payload, request.key);
    showResolution("ready", "Ответ готов", answer);
    saveRequest(request);
  } catch {
    showResolution(
      "error",
      "Не удалось прочитать ответ",
      "Файл ответа повреждён либо ссылка содержит неверный ключ.",
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

    saveRequest(currentRequest);
    successId.textContent = currentRequest.id;
    requestForm.hidden = true;
    success.hidden = false;

    const url = requestUrl(currentRequest);
    window.history.replaceState({}, "", url);
    lookupInput.value = currentRequest.id;
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
    await navigator.clipboard.writeText(requestUrl(currentRequest));
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
  checkResolution(accessFromInput(lookupInput.value));
});

const requestFromUrl = accessFromUrl(window.location.href);
if (requestFromUrl?.id) {
  lookupInput.value = requestFromUrl.id;
  checkResolution(requestFromUrl);
  document.querySelector("#resolution-section").scrollIntoView();
}

renderSavedRequests();
setRequestCollapsed(getStoredValue().length > 0);
