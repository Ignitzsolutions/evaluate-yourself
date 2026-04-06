export const readStringParam = (searchParams, key, fallback = "") => {
  const value = searchParams.get(key);
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  return trimmed || fallback;
};

export const readBoolParam = (searchParams, key, fallback = false) => {
  const value = String(searchParams.get(key) || "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes";
};

export const buildSearchParams = (pairs = []) => {
  const params = new URLSearchParams();
  pairs.forEach(([key, value, fallback]) => {
    const normalized = typeof value === "string" ? value.trim() : value;
    if (
      normalized == null ||
      normalized === "" ||
      normalized === false ||
      normalized === fallback
    ) {
      return;
    }
    params.set(key, String(normalized));
  });
  return params;
};
