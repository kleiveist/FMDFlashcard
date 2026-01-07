import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const markdownSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
  ],
  attributes: {
    ...defaultSchema.attributes,
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
  },
};

type ExamMarkdownProps = {
  content: string;
  className?: string;
};

export const ExamMarkdown = ({ content, className }: ExamMarkdownProps) => {
  const classes = ["exam-markdown", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSchema]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
