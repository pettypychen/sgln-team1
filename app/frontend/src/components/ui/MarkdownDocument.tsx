import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ComponentPropsWithoutRef } from "react";

interface MarkdownDocumentProps {
  content: string;
  compact?: boolean;
}

const COMPONENTS: Components = {
  h1: (p: ComponentPropsWithoutRef<"h1">) => <h1 className="mb-3 mt-0 text-card font-semibold">{p.children}</h1>,
  h2: (p: ComponentPropsWithoutRef<"h2">) => <h2 className="mb-2 mt-6 text-label font-semibold">{p.children}</h2>,
  h3: (p: ComponentPropsWithoutRef<"h3">) => <h3 className="mb-2 mt-5 text-small font-semibold">{p.children}</h3>,
  p: (p: ComponentPropsWithoutRef<"p">) => <p className="mb-0 mt-3 first:mt-0">{p.children}</p>,
  ul: (p: ComponentPropsWithoutRef<"ul">) => <ul className="mb-0 mt-3 grid gap-1.5 pl-5">{p.children}</ul>,
  ol: (p: ComponentPropsWithoutRef<"ol">) => <ol className="mb-0 mt-3 grid gap-1.5 pl-5">{p.children}</ol>,
  a: (p: ComponentPropsWithoutRef<"a">) => <a className="font-semibold underline" href={p.href}>{p.children}</a>,
  table: (p: ComponentPropsWithoutRef<"table">) => <table className="mt-4 min-w-full border-collapse text-left">{p.children}</table>,
  th: (p: ComponentPropsWithoutRef<"th">) => <th className="border-b border-hairline bg-stone-100 px-3 py-2 font-semibold">{p.children}</th>,
  td: (p: ComponentPropsWithoutRef<"td">) => <td className="border-b border-hairline px-3 py-2 align-top">{p.children}</td>,
  code: (p: ComponentPropsWithoutRef<"code">) => <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[.92em]">{p.children}</code>,
};

export function stripMarkdownFrontmatter(content: string) {
  return content.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

export function MarkdownDocument({
  content,
  compact = false,
}: MarkdownDocumentProps) {
  return (
    <div
      className={
        compact
          ? "min-w-0 text-small leading-relaxed"
          : "min-w-0 text-small leading-relaxed text-ink"
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={COMPONENTS}
      >
        {stripMarkdownFrontmatter(content)}
      </ReactMarkdown>
    </div>
  );
}
