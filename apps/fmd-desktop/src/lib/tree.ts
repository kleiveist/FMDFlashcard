import { normalizeRelativePath } from "./path";

export type VaultFile = {
  path: string;
  relative_path: string;
};

export type TreeNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: TreeNode[];
  file?: VaultFile;
  fullPath?: string;
};

export const buildTree = (files: VaultFile[]): TreeNode[] => {
  const root: TreeNode = {
    name: "__root__",
    path: "",
    type: "dir",
    children: [],
  };

  for (const file of files) {
    const relative = normalizeRelativePath(file.relative_path);
    const parts = relative.split("/").filter(Boolean);
    if (parts.length === 0) {
      continue;
    }
    let current = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (isFile) {
        const existing = current.children?.find(
          (child) => child.type === "file" && child.path === currentPath,
        );
        if (!existing) {
          current.children = current.children ?? [];
          current.children.push({
            name: part,
            path: currentPath,
            type: "file",
            file,
            fullPath: file.path,
          });
        }
        return;
      }

      let next = current.children?.find(
        (child) => child.type === "dir" && child.name === part,
      );
      if (!next) {
        next = {
          name: part,
          path: currentPath,
          type: "dir",
          children: [],
        };
        current.children = current.children ?? [];
        current.children.push(next);
      }
      current = next;
    });
  }

  return sortNodes(root.children ?? []);
};

export const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return sorted.map((node) => {
    if (node.type === "dir" && node.children) {
      return { ...node, children: sortNodes(node.children) };
    }
    return node;
  });
};
