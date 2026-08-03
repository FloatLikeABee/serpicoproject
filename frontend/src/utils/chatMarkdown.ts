/** Prepare assistant/user chat text for ReactMarkdown rendering. */
export function normalizeChatMarkdown(content: string): string {
  let text = (content || '').trim();
  if (!text) return '';

  // Whole message wrapped in a fenced code block (common from LLMs).
  const fullFence = text.match(/^```(?:markdown|md|text)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  if (fullFence) {
    text = fullFence[1].trim();
  }

  // Unescape literal \n when the API returned a JSON-escaped string.
  if (text.includes('\\n') && !text.includes('\n')) {
    text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }

  return text;
}
