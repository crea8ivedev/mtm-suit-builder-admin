import { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Link2 } from "lucide-react";
import {
  tiptapDocToShopifyRichText,
  shopifyRichTextToTiptapDoc,
} from "../../lib/richText";
import { useClickOutside } from "../../hooks/useClickOutside";

function ToolbarButton({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex items-center justify-center w-[30px] h-[30px] rounded-[4px] cursor-pointer transition-colors ${active
          ? "bg-gc-primary text-white"
          : "text-gc-near-black hover:bg-gc-bg-warm"
        }`}
    >
      {children}
    </button>
  );
}

export default function DescriptionEditor({ value, onChange }) {
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkRange, setLinkRange] = useState(null);
  const linkPopoverRef = useRef(null);
  useClickOutside(linkPopoverRef, () => setLinkInputOpen(false));

  const editor = useEditor({
    // This is a client-only SPA (no SSR) — without this, Tiptap v3 defaults
    // to immediatelyRender: false and the editor mounts empty, never picking
    // up the initial `content` below.
    immediatelyRender: true,
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: shopifyRichTextToTiptapDoc(value),
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(tiptapDocToShopifyRichText(editor.getJSON())));
    },
    editorProps: {
      attributes: {
        class:
          "font-hanken min-h-[120px] px-[14px] py-[10px] text-[14px] text-gc-near-black outline-none prose-sm [&_ul]:list-disc [&_ul]:pl-[20px] [&_ol]:list-decimal [&_ol]:pl-[20px] [&_a]:text-gc-primary [&_a]:underline",
      },
    },
  });

  if (!editor) return null;

  function openLinkInput() {
    const { from, to } = editor.state.selection;
    setLinkRange({ from, to });
    setLinkDraft(editor.getAttributes("link").href || "");
    setLinkInputOpen(true);
  }

  function applyLink() {
    const url = linkDraft.trim();
    if (!url) return;
    const chain = editor.chain().focus();
    if (linkRange) chain.setTextSelection(linkRange);
    chain.extendMarkRange("link").setLink({ href: url }).run();
    setLinkInputOpen(false);
  }

  function removeLink() {
    const chain = editor.chain().focus();
    if (linkRange) chain.setTextSelection(linkRange);
    chain.extendMarkRange("link").unsetLink().run();
    setLinkInputOpen(false);
  }

  return (
    <div className="w-full max-w-[480px] rounded-[4px] border border-gc-scrollbar-thumb/60 bg-white">
      <div className="flex items-center gap-[4px] px-[8px] py-[6px] border-b border-gc-divider">
        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Link"
          active={editor.isActive("link") || linkInputOpen}
          onClick={openLinkInput}
        >
          <Link2 size={15} />
        </ToolbarButton>
      </div>
      {linkInputOpen && (
        <div
          ref={linkPopoverRef}
          className="flex items-center gap-[6px] px-[8px] py-[6px] border-b border-gc-divider bg-gc-bg-warm"
        >
          <input
            type="text"
            autoFocus
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                setLinkInputOpen(false);
              }
            }}
            placeholder="Enter a URL…"
            className="font-hanken flex-1 h-[28px] px-[8px] rounded-[4px] text-[13px] text-gc-near-black outline-none border border-gc-scrollbar-thumb/60 placeholder:text-gc-muted"
          />
          <button
            type="button"
            onClick={applyLink}
            className="font-hanken h-[28px] px-[10px] rounded-[4px] text-[12px] font-semibold text-white bg-gc-primary hover:bg-gc-primary-dark cursor-pointer"
          >
            Link
          </button>
          <button
            type="button"
            onClick={removeLink}
            className="font-hanken h-[28px] px-[10px] rounded-[4px] text-[12px] font-semibold text-gc-near-black hover:bg-gc-divider cursor-pointer"
          >
            Unlink
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
