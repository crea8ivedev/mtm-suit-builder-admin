import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Link2 } from "lucide-react";
import {
  tiptapDocToShopifyRichText,
  shopifyRichTextToTiptapDoc,
} from "../../lib/richText";

function ToolbarButton({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex items-center justify-center w-[30px] h-[30px] rounded-[4px] cursor-pointer transition-colors ${
        active
          ? "bg-gc-primary text-white"
          : "text-gc-near-black hover:bg-gc-bg-warm"
      }`}
    >
      {children}
    </button>
  );
}

export default function DescriptionEditor({ value, onChange }) {
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

  function setLink() {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Link URL", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
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
        <ToolbarButton title="Link" active={editor.isActive("link")} onClick={setLink}>
          <Link2 size={15} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
