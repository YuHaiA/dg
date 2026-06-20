export function parseDomainList(value) {
  return [...new Set(value.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean))];
}

export function formatDomainList(rows) {
  return [...new Set(rows.map((row) => row?.name).filter(Boolean))];
}
