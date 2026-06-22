const adminForm = document.querySelector("#admin-form");
const tokenInput = document.querySelector("#admin-token");
const keyInput = document.querySelector("#admin-key");
const answerInput = document.querySelector("#admin-answer");
const adminStatus = document.querySelector("#admin-status");

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminStatus.textContent = "";

  try {
    const payload = await DostupenCrypto.encryptText(
      answerInput.value,
      keyInput.value.trim(),
    );
    const contents = `${JSON.stringify(payload, null, 2)}\n`;
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${tokenInput.value.trim()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    adminStatus.textContent = "Файл создан. Поместите его в папку data и опубликуйте сайт.";
  } catch {
    adminStatus.textContent = "Не удалось создать файл. Проверьте токен и ключ.";
  }
});
