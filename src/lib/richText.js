function convertInlineToShopify(node) {
  if (node.type !== "text" || !node.text) return null;
  const marks = node.marks || [];
  const linkMark = marks.find((m) => m.type === "link");
  const textNode = { type: "text", value: node.text };
  if (marks.some((m) => m.type === "bold")) textNode.bold = true;
  if (marks.some((m) => m.type === "italic")) textNode.italic = true;
  if (linkMark) {
    return { type: "link", url: linkMark.attrs?.href || "", children: [textNode] };
  }
  return textNode;
}

function convertBlockToShopify(node) {
  if (node.type === "paragraph") {
    return {
      type: "paragraph",
      children: (node.content || []).map(convertInlineToShopify).filter(Boolean),
    };
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    return {
      type: "list",
      listType: node.type === "orderedList" ? "ordered" : "unordered",
      children: (node.content || []).map((li) => ({
        type: "list-item",
        children: (li.content || [])
          .flatMap((n) =>
            n.type === "paragraph" ? n.content || [] : [n],
          )
          .map(convertInlineToShopify)
          .filter(Boolean),
      })),
    };
  }

  return {
    type: "paragraph",
    children: (node.content || []).map(convertInlineToShopify).filter(Boolean),
  };
}

export function tiptapDocToShopifyRichText(doc) {
  const children = (doc?.content || []).map(convertBlockToShopify);
  return { type: "root", children: children.length ? children : [{ type: "paragraph", children: [] }] };
}

function convertInlineFromShopify(node) {
  if (node.type === "text") {
    if (!node.value) return [];
    const marks = [];
    if (node.bold) marks.push({ type: "bold" });
    if (node.italic) marks.push({ type: "italic" });
    return [{ type: "text", text: node.value, ...(marks.length ? { marks } : {}) }];
  }
  if (node.type === "link") {
    const inner = (node.children || []).flatMap(convertInlineFromShopify);
    return inner.map((t) => ({
      ...t,
      marks: [...(t.marks || []), { type: "link", attrs: { href: node.url || "" } }],
    }));
  }
  return [];
}

function convertBlockFromShopify(node) {
  if (node.type === "list") {
    const items = node.children || [];
    if (!items.length) return null;
    return {
      type: node.listType === "ordered" ? "orderedList" : "bulletList",
      content: items.map((li) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: (li.children || []).flatMap(convertInlineFromShopify),
          },
        ],
      })),
    };
  }
  return {
    type: "paragraph",
    content: (node.children || []).flatMap(convertInlineFromShopify),
  };
}

function extractPlainTextParagraphs(parsed) {
  function collectText(node, out) {
    if (!node || typeof node !== "object") return;
    if (typeof node.value === "string") out.push(node.value);
    for (const child of node.children || []) collectText(child, out);
  }
  const blocks = parsed?.children || [];
  const paragraphs = blocks.map((block) => {
    const out = [];
    collectText(block, out);
    return out.join("");
  });
  const content = paragraphs
    .filter((text) => text)
    .map((text) => ({ type: "paragraph", content: [{ type: "text", text }] }));
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// SheetJS's rich-run-to-html writer closes tags in the same order it opens
// them (e.g. `<b><i>text</b></i>` for a run that's both bold and italic)
// instead of the reverse order proper nesting requires. A regex that pairs
// each `<b>...</b>` / `<i>...</i>` as a matched span breaks on that — it
// swallows the inner `<i>` as literal text and leaks the stray `</i>`. Track
// bold/italic as running state through a flat token stream instead, so
// which tag "belongs" to which doesn't matter — only when each is on or off.
function parseHtmlLineRuns(lineHtml) {
  const stripped = lineHtml.replace(/<\/?span[^>]*>/gi, "");
  const nodes = [];
  const tokenPattern =
    /<\/?b>|<\/?i>|<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?>|[^<]+/gi;
  let bold = false;
  let italic = false;
  let m;
  while ((m = tokenPattern.exec(stripped))) {
    const tok = m[0];
    if (/^<b>$/i.test(tok)) bold = true;
    else if (/^<\/b>$/i.test(tok)) bold = false;
    else if (/^<i>$/i.test(tok)) italic = true;
    else if (/^<\/i>$/i.test(tok)) italic = false;
    else if (tok[0] !== "<") {
      const value = decodeHtmlEntities(tok);
      if (value.length) {
        const node = { type: "text", value };
        if (bold) node.bold = true;
        if (italic) node.italic = true;
        nodes.push(node);
      }
    }
    // any other recognized tag (<s>, <sup>, etc.) is consumed and discarded —
    // formatting we don't support, but its text content is kept.
  }
  return nodes;
}

function isBlankRunLine(runs) {
  return !runs.some((r) => r.value.trim());
}

function stripLeadingChars(runs, n) {
  let remaining = n;
  const out = [];
  for (const r of runs) {
    if (remaining <= 0) {
      out.push(r);
    } else if (r.value.length <= remaining) {
      remaining -= r.value.length;
    } else {
      out.push({ ...r, value: r.value.slice(remaining) });
      remaining = 0;
    }
  }
  return out;
}

export function xlsxCellHtmlToShopifyRichText(html) {
  if (!html) return null;
  const lines = html.split(/<br\s*\/?>|\r?\n/i).map(parseHtmlLineRuns);
  while (lines.length && isBlankRunLine(lines[0])) lines.shift();
  while (lines.length && isBlankRunLine(lines[lines.length - 1])) lines.pop();
  if (!lines.length) return null;

  const children = [];
  let currentList = null;
  for (const runs of lines) {
    if (isBlankRunLine(runs)) {
      currentList = null;
      children.push({ type: "paragraph", children: [] });
      continue;
    }
    const rawConcat = runs.map((r) => r.value).join("");
    const trimmedStart = rawConcat.replace(/^\s+/, "");
    const bulletMatch = trimmedStart.match(/^[-*]\s+/);
    if (bulletMatch) {
      const stripLen = rawConcat.length - trimmedStart.length + bulletMatch[0].length;
      if (!currentList) {
        currentList = { type: "list", listType: "unordered", children: [] };
        children.push(currentList);
      }
      currentList.children.push({
        type: "list-item",
        children: stripLeadingChars(runs, stripLen),
      });
    } else {
      currentList = null;
      children.push({ type: "paragraph", children: runs });
    }
  }
  return JSON.stringify({ type: "root", children });
}

export function shopifyRichTextToTiptapDoc(value) {
  if (!value) return { type: "doc", content: [{ type: "paragraph" }] };
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  try {
    const children = (parsed?.children || [])
      .map(convertBlockFromShopify)
      .filter(Boolean);
    return {
      type: "doc",
      content: children.length ? children : [{ type: "paragraph" }],
    };
  } catch (e) {
    console.warn(
      "[richText] structured conversion failed, falling back to plain text:",
      e,
    );
    return extractPlainTextParagraphs(parsed);
  }
}
