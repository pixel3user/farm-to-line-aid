import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

type MarkdownRendererProps = {
  content: string;
  className?: string;
  compact?: boolean;
};

export default function MarkdownRenderer({
  content,
  className,
  compact = false,
}: MarkdownRendererProps) {
  if (!content?.trim()) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={cn(
        compact
          ? 'prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0'
          : 'prose max-w-none',
        className
      )}
    >
      {content}
    </ReactMarkdown>
  );
}
