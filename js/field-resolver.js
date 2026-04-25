const IMAGE_HEADER_RE = /photo|image|url|avatar/i;
const SHORT_AVG_LIMIT = 80;

function avgLen(cards, header) {
  if (!cards.length) return 0;
  let total = 0;
  let count = 0;
  for (const c of cards) {
    const v = c[header];
    if (v == null) continue;
    total += String(v).length;
    count++;
  }
  return count ? total / count : 0;
}

function autoDetect(headers, cards, idField) {
  const isImage = (h) => IMAGE_HEADER_RE.test(h);
  const isId = (h) => h === idField;

  const imageHeader = headers.find((h) => !isId(h) && isImage(h));
  const textHeaders = headers.filter((h) => !isId(h) && !isImage(h));

  const stats = textHeaders.map((h) => ({ header: h, avg: avgLen(cards, h) }));

  let frontTitle;
  let frontSubtitle;
  for (const s of stats) {
    if (s.avg > SHORT_AVG_LIMIT) continue;
    if (!frontTitle) { frontTitle = s.header; continue; }
    if (!frontSubtitle) { frontSubtitle = s.header; break; }
  }

  // Fallbacks if every column is long (or there are very few columns):
  // still need *something* to render on the front of the card.
  if (!frontTitle && textHeaders.length) frontTitle = textHeaders[0];
  if (!frontSubtitle && textHeaders.length > 1 && textHeaders[1] !== frontTitle) {
    // only assign if we wouldn't be repeating frontTitle
    const candidate = textHeaders.find((h) => h !== frontTitle);
    if (candidate && avgLen(cards, candidate) <= SHORT_AVG_LIMIT) {
      frontSubtitle = candidate;
    }
  }

  let backBody;
  let longest = null;
  for (const s of stats) {
    if (s.header === frontTitle || s.header === frontSubtitle) continue;
    if (!longest || s.avg > longest.avg) longest = s;
  }
  if (longest && longest.avg > SHORT_AVG_LIMIT) backBody = longest.header;

  const used = new Set([frontTitle, frontSubtitle, backBody].filter(Boolean));
  const backFields = textHeaders.filter((h) => !used.has(h));

  const fields = {
    frontTitle,
    frontSubtitle,
    frontImage: imageHeader,
    backBody,
    backFields,
  };

  const searchFields = textHeaders.slice();

  return { fields, searchFields };
}

export function resolveFields(headers, cards, sheetName, config) {
  const idField = config?.idField || 'id';
  const sheetMap = config?.sheets || null;
  const entry = sheetMap && sheetName ? sheetMap[sheetName] : null;

  if (entry && entry.fields) {
    return {
      fields: entry.fields,
      searchFields: entry.searchFields || [],
    };
  }

  const topFields = config?.fields || {};
  const topTitle = topFields.frontTitle;
  const headerSet = new Set(headers);

  const explicitAuto = !!(entry && entry.auto);
  const topTitleMissing = topTitle && !headerSet.has(topTitle);
  const sheetUnmapped = sheetMap && sheetName && !sheetMap[sheetName];

  if (explicitAuto || topTitleMissing || sheetUnmapped) {
    return autoDetect(headers, cards, idField);
  }

  return {
    fields: topFields,
    searchFields: config?.searchFields || [],
  };
}
