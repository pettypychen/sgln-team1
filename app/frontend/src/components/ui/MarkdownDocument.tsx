import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownDocumentProps {
  content: string;
  compact?: boolean;
}

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
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-0 text-card font-semibold">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-6 text-label font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-5 text-small font-semibold">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-0 mt-3 first:mt-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-0 mt-3 grid gap-1.5 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-0 mt-3 grid gap-1.5 pl-5">{children}</ol>
          ),
          a: ({ children, href }) => (
            <a className="font-semibold underline" href={href}>
              {children}
            </a>
          ),
          table: ({ children }) => (
            <table className="mt-4 min-w-full border-collapse text-left">
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th className="border-b border-hairline bg-stone-100 px-3 py-2 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-hairline px-3 py-2 align-top">
              {children}
            </td>
          ),
          code: ({ children }) => (
            <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[.92em]">
              {children}
            </code>
          ),
        }}
      >
        {stripMarkdownFrontmatter(content)}
      </ReactMarkdown>
    </div>
  );
}
