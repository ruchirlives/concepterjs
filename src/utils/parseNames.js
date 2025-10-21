export function parseNames(namesInput, { splitByComma } = {}) {
  if (!namesInput || typeof namesInput !== "string") return [];
  const pattern = splitByComma ? /\r?\n|,/ : /\r?\n/;
  return namesInput
    .split(pattern)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

