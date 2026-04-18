import type {
  RootContent,
  Paragraph,
  Heading,
  Blockquote,
  List,
  ListItem,
  Code,
  InlineCode,
  Strong,
  Emphasis,
  Delete,
  Link,
  Table,
  Html,
  Text,
} from "mdast";
import { escapeMd } from "./escape.js";
import { renderCodeBlock, renderInlineCode } from "./code-block.js";
import { logger } from "../../utils/logger.js";

export function transformNode(node: RootContent): string {
  switch (node.type) {
    case "text":
      return escapeMd((node as Text).value);

    case "strong":
      return `*${transformChildren(node as Strong)}*`;

    case "emphasis":
      return `_${transformChildren(node as Emphasis)}_`;

    case "delete":
      return `~${transformChildren(node as Delete)}~`;

    case "inlineCode":
      return renderInlineCode((node as InlineCode).value);

    case "code":
      return renderCodeBlock((node as Code).lang ?? null, (node as Code).value) + "\n";

    case "link": {
      const link = node as Link;
      const text = transformChildren(link);
      return `[${text}](${link.url})`;
    }

    case "paragraph":
      return transformChildren(node as Paragraph) + "\n";

    case "heading":
      return `*${transformChildren(node as Heading)}*\n`;

    case "blockquote": {
      const content = transformChildren(node as Blockquote);
      return (
        content
          .split("\n")
          .map((line: string) => `> ${line}`)
          .join("\n") + "\n"
      );
    }

    case "list": {
      const list = node as List;
      const items = list.children.map((item, index) => {
        const content = transformNode(item);
        if (list.ordered) {
          const start = list.start ?? 1;
          return `${start + index}. ${content}`;
        }
        return `• ${content}`;
      });
      return items.join("\n") + "\n";
    }

    case "listItem": {
      const item = node as ListItem;
      return transformChildren(item);
    }

    case "table": {
      const table = node as Table;
      const rows = table.children.map((row) => {
        const cells = row.children.map((cell) =>
          transformChildren(cell).replace(/\n/g, " ").trim(),
        );
        return `| ${cells.join(" | ")} |`;
      });
      if (rows.length > 0) {
        const colCount = table.children[0].children.length;
        const separator = `| ${Array(colCount).fill("---").join(" | ")} |`;
        rows.splice(1, 0, separator);
      }
      return renderCodeBlock("", rows.join("\n")) + "\n";
    }

    case "thematicBreak":
      return "───────────\n";

    case "html":
      return escapeMd((node as Html).value);

    case "break":
      return "\n";

    default:
      logger.debug("[Render] Unknown node type, skipping", { type: node.type });
      return "children" in node
        ? transformChildren(node as unknown as { children: RootContent[] })
        : "";
  }
}

export function transformChildren(parent: { children: RootContent[] }): string {
  return parent.children.map(transformNode).join("");
}
