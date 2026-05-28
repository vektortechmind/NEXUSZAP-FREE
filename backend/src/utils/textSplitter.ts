export function splitLongText(text: string, maxChunkLen: number): string[] {
  const t = String(text ?? "").trim();
  if (!t) return [];

  // Quebra por parágrafos
  const paragraphs = t.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  
  const pushChunk = (s: string) => {
    const v = s.trim();
    if (!v) return;
    
    if (v.length <= maxChunkLen) {
      chunks.push(v);
      return;
    }
    
    // Se ainda estiver grande, quebra por frases
    const sentences = v.split(/(?<=[.!?])\s+/g);
    let cur = "";
    
    for (const sentence of sentences) {
      const candidate = cur ? `${cur} ${sentence}` : sentence;
      if (candidate.length <= maxChunkLen) {
        cur = candidate;
      } else {
        if (cur) chunks.push(cur.trim());
        cur = sentence;
        // Fallback: quebra “na marra”
        while (cur.length > maxChunkLen) {
          chunks.push(cur.slice(0, maxChunkLen));
          cur = cur.slice(maxChunkLen);
        }
      }
    }
    if (cur.trim()) chunks.push(cur.trim());
  };

  for (const p of paragraphs) pushChunk(p);
  return chunks;
}
