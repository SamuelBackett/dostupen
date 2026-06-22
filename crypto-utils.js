(function initCryptoUtils() {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function bytesToBase64Url(bytes) {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
  }

  function base64UrlToBytes(value) {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(normalized + padding);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function randomSecret(size = 32) {
    return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(size)));
  }

  async function importKey(encodedKey) {
    return crypto.subtle.importKey(
      "raw",
      base64UrlToBytes(encodedKey),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }

  async function encryptText(text, encodedKey) {
    const key = await importKey(encodedKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(text),
    );

    return {
      version: 1,
      algorithm: "AES-GCM",
      iv: bytesToBase64Url(iv),
      ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    };
  }

  async function decryptText(payload, encodedKey) {
    if (
      payload?.version !== 1 ||
      payload?.algorithm !== "AES-GCM" ||
      typeof payload.iv !== "string" ||
      typeof payload.ciphertext !== "string"
    ) {
      throw new Error("Invalid encrypted payload");
    }

    const key = await importKey(encodedKey);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(payload.iv) },
      key,
      base64UrlToBytes(payload.ciphertext),
    );

    return decoder.decode(plaintext);
  }

  window.DostupenCrypto = {
    decryptText,
    encryptText,
    randomSecret,
  };
})();
