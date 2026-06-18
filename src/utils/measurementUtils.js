export function getRangeForKey(rangeMap, key) {
  if (!rangeMap) return null;
  if (rangeMap[key]) return rangeMap[key];
  const n = key.toLowerCase().trim();
  for (const [k, v] of Object.entries(rangeMap)) {
    if (k.toLowerCase().trim() === n) return v;
  }
  return null;
}

export function groupAttributes(attributes, rangeGroups) {
  const general = [];
  const sections = rangeGroups.map((g) => ({
    label: g.label,
    ranges: g.ranges,
    items: [],
  }));
  const hasGroups = sections.length > 0;

  const findSec = (label) => sections.find((s) => s.label === label);

  const PREFIX_ROUTES = [
    ["Vest ", "Vest"],
    ["Jacket ", "Jacket"],
    ["Trouser ", "Trouser"],
    ["Shirt ", "Shirt"],
  ];

  for (const attr of attributes) {
    if (attr.key.startsWith("_")) continue;
    const kl = attr.key.toLowerCase();

    if (kl === "size type") {
      general.push({ key: attr.key, originalKey: attr.key });
      continue;
    }

    if (hasGroups && kl.startsWith("standard")) continue;

    let placed = false;
    for (const [prefix, label] of PREFIX_ROUTES) {
      if (attr.key.startsWith(prefix)) {
        const sec = findSec(label);
        if (sec) {
          sec.items.push({
            key: attr.key.slice(prefix.length),
            originalKey: attr.key,
          });
          placed = true;
          break;
        }
      }
    }
    if (placed) continue;

    if (hasGroups) {
      for (const sec of sections) {
        if (getRangeForKey(sec.ranges, attr.key)) {
          sec.items.push({ key: attr.key, originalKey: attr.key });
          placed = true;
          break;
        }
      }
    }

    if (!placed) general.push({ key: attr.key, originalKey: attr.key });
  }

  return { general, sections };
}
