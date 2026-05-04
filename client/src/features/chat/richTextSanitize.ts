export function sanitizeHtml(html: string): string {
  const allowed = ["p", "br", "strong", "em", "s", "a", "ul", "ol", "li", "code"];
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT);
  const toReplace: Element[] = [];
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node instanceof Element) {
      const tag = node.tagName.toLowerCase();
      if (!allowed.includes(tag)) {
        toReplace.push(node);
      } else if (tag === "a") {
        const href = node.getAttribute("href") ?? "";
        if (!/^https?:\/\//.test(href) && !/^mailto:/.test(href)) {
          node.removeAttribute("href");
        }
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
    node = walker.nextNode();
  }
  for (const el of toReplace) {
    el.replaceWith(...Array.from(el.childNodes));
  }
  return tmp.innerHTML;
}
