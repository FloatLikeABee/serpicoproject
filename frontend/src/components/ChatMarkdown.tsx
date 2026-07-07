import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatMarkdownSize = 'xs' | 'sm';

interface ChatMarkdownProps {
  content: string;
  size?: ChatMarkdownSize;
  inverted?: boolean;
}

const sizeClasses: Record<ChatMarkdownSize, { prose: string; text: string }> = {
  xs: { prose: 'prose-xs', text: 'text-xs' },
  sm: { prose: 'prose-sm', text: 'text-sm' },
};

export default function ChatMarkdown({ content, size = 'sm', inverted = false }: ChatMarkdownProps) {
  const { prose, text } = sizeClasses[size];
  const codeBg = inverted ? 'bg-blue-900/50' : 'bg-gray-800 dark:bg-gray-900';
  const linkClass = inverted ? 'text-blue-100 underline' : 'text-serpico-blue dark:text-serpico-blue-light underline';

  return (
    <div className={`${prose} dark:prose-invert max-w-none ${text} chat-markdown`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className={`mb-2 last:mb-0 ${text}`}>{children}</p>,
          ul: ({ children }) => <ul className={`list-disc list-outside pl-4 mb-2 space-y-1 ${text}`}>{children}</ul>,
          ol: ({ children }) => <ol className={`list-decimal list-outside pl-4 mb-2 space-y-1 ${text}`}>{children}</ol>,
          li: ({ children }) => <li className={text}>{children}</li>,
          h1: ({ children }) => <h1 className="text-lg font-bold mb-2 font-display tracking-wide">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mb-2 font-display tracking-wide">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mb-1.5 font-display tracking-wide">{children}</h3>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full text-left border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-gray-500/40">{children}</thead>,
          th: ({ children }) => <th className="px-2 py-1 font-bold">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1 border-t border-gray-500/20">{children}</td>,
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className={`${codeBg} px-1 py-0.5 rounded text-xs font-mono`}>{children}</code>
            ) : (
              <code className={`block ${codeBg} p-2 rounded mb-2 overflow-x-auto text-xs font-mono`}>{children}</code>
            );
          },
          pre: ({ children }) => <pre className={`${codeBg} p-2 rounded mb-2 overflow-x-auto`}>{children}</pre>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-400/60 pl-3 italic mb-2 opacity-90">{children}</blockquote>
          ),
          hr: () => <hr className="my-2 border-gray-500/30" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
