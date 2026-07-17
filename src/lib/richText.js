// Converts between Tiptap/ProseMirror doc JSON and Shopify's rich text
// metafield JSON schema (https://shopify.dev/docs/apps/build/custom-data/metafields/types#rich-text-field).
// Only the node types the DescriptionEditor toolbar can produce are handled:
// paragraph, text (bold/italic marks), link mark, bulletList, orderedList.

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
  // Unknown block types (e.g. blockquote) — fall back to a plain paragraph
  // of their inline content so nothing silently disappears.
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
    // ProseMirror text nodes cannot be empty (throws "Empty text nodes are
    // not allowed") — Shopify admin writes these as blank-line separators
    // between paragraphs. Drop the node; the enclosing (now-empty) paragraph
    // still renders as a blank line.
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
    // ProseMirror's bulletList/orderedList schema requires at least one
    // listItem — an emptied-out list (e.g. all items deleted directly in
    // Shopify admin, leaving a bare list node) would otherwise be invalid
    // content and throw when Tiptap loads it, blanking the whole editor.
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
  // paragraph and heading (rendered as a paragraph — no heading button in the toolbar)
  return {
    type: "paragraph",
    content: (node.children || []).flatMap(convertInlineFromShopify),
  };
}

// Last-resort fallback — walk any shape of Shopify rich text and pull out
// every text "value" it can find, one paragraph per top-level block. Used
// when the structured conversion above fails, so a shape mismatch loses
// formatting rather than the entire description.
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
