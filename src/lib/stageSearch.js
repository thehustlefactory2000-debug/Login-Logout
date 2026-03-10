const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const normalizeKey = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_-]/g, "");

const parseSearchTerms = (query) =>
  normalizeText(query)
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((term) => {
      const separatorIndex = term.indexOf(":");
      if (separatorIndex > 0 && separatorIndex < term.length - 1) {
        return {
          key: normalizeKey(term.slice(0, separatorIndex)),
          value: term.slice(separatorIndex + 1),
        };
      }
      return { key: null, value: term };
    });

export const buildSearchIndex = (fields) => {
  const normalizedFields = {};

  Object.entries(fields || {}).forEach(([key, value]) => {
    normalizedFields[key] = normalizeText(value);
  });

  return {
    fields: normalizedFields,
    searchableText: Object.values(normalizedFields).filter(Boolean).join(" "),
  };
};

export const filterIndexedRows = (indexedRows, query) => {
  const terms = parseSearchTerms(query);
  if (!terms.length) return indexedRows.map((item) => item.row);

  return indexedRows
    .filter(({ index }) =>
      terms.every(({ key, value }) => {
        if (!value) return true;
        if (!key) return index.searchableText.includes(value);

        const fieldValue = Object.entries(index.fields).find(
          ([fieldKey]) => normalizeKey(fieldKey) === key,
        )?.[1];

        return fieldValue ? fieldValue.includes(value) : index.searchableText.includes(value);
      }),
    )
    .map((item) => item.row);
};
