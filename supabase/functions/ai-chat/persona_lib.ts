// Turns a persona Markdown file into the system prompt the model sees.
// Keeps only the ```text block, drops held Queries and PROPOSED notes, and drops any line carrying
// the retired status line (Jasmine 10-25). Praxia's lines come from the book; nothing is swapped for her.
export function extractPrompt(markdown: string): string {
  const m = markdown.match(/```text\n([\s\S]*?)```/);
  if (!m) throw new Error('persona file has no ```text block');
  return sanitizePrompt(m[1]);
}

export function sanitizePrompt(text: string): string {
  const lines = text
    .replace(/\s*\[QUERY[^\]]*\]/g, '')
    .replace(/\s*\(PROPOSED[^)]*\)/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''));
  const out: string[] = [];
  for (const line of lines) {
    if (/GRID OK|IKG VIEWPORT|DEEP TIME/i.test(line)) continue;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
