import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  a: ({ node: _node, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="break-words font-medium text-primary underline underline-offset-2 hover:opacity-80"
    />
  ),
  p: ({ node: _node, ...props }) => <p {...props} className="my-2 first:mt-0 last:mb-0" />,
  ul: ({ node: _node, ...props }) => <ul {...props} className="my-2 list-disc space-y-1 pl-5" />,
  ol: ({ node: _node, ...props }) => <ol {...props} className="my-2 list-decimal space-y-1 pl-5" />,
  li: ({ node: _node, ...props }) => <li {...props} className="pl-0.5" />,
  h1: ({ node: _node, ...props }) => (
    <h1 {...props} className="mb-2 mt-4 text-base font-semibold first:mt-0" />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 {...props} className="mb-2 mt-4 text-base font-semibold first:mt-0" />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 {...props} className="mb-1 mt-3 text-sm font-semibold first:mt-0" />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4 {...props} className="mb-1 mt-3 text-sm font-semibold first:mt-0" />
  ),
  strong: ({ node: _node, ...props }) => <strong {...props} className="font-semibold" />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      {...props}
      className="my-2 border-l-2 border-border pl-3 text-muted-foreground italic"
    />
  ),
  hr: () => <hr className="my-3 border-border" />,
  code: ({ node: _node, className, ...props }) => {
    const isBlock = /language-/.test(className ?? "");
    return (
      <code
        {...props}
        className={
          isBlock
            ? `${className} font-mono text-xs`
            : "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        }
      />
    );
  },
  pre: ({ node: _node, ...props }) => (
    <pre
      {...props}
      className="my-2 overflow-x-auto rounded-md border bg-background p-3 font-mono text-xs [&_code]:bg-transparent [&_code]:p-0"
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table {...props} className="w-full border-collapse text-xs" />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th {...props} className="border bg-muted px-2 py-1 text-left font-semibold" />
  ),
  td: ({ node: _node, ...props }) => <td {...props} className="border px-2 py-1 align-top" />,
};

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
