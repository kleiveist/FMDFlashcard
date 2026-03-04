import { Children, isValidElement, type ReactNode } from "react";

const flattenTextContent = (value: ReactNode): string | null => {
  const nodes = Children.toArray(value);
  let text = "";
  for (const node of nodes) {
    if (typeof node === "string" || typeof node === "number") {
      text += String(node);
      continue;
    }
    return null;
  }
  return text;
};

export const extractSvgCodeBlockSource = (children: ReactNode): string | null => {
  const nodes = Children.toArray(children);
  if (nodes.length !== 1) {
    return null;
  }

  const child = nodes[0];
  if (!isValidElement(child) || child.type !== "code") {
    return null;
  }

  const props = child.props as { className?: string; children?: ReactNode };
  if (props.className !== "language-svg") {
    return null;
  }

  return flattenTextContent(props.children ?? null);
};
