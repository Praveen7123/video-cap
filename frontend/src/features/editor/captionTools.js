// Caption Tools regrouping helpers — all operate on a single track's captions
// at a time (called per-track in the processedCaptions memo) so captions on
// different text tracks never get merged into each other.
export function regroupByWordCount(track, wordsPerLine) {
  const n = parseInt(wordsPerLine, 10);
  if (!n || n < 1) return track;
  const out = [];
  let bucket = [];
  const flush = () => {
    if (!bucket.length) return;
    out.push({
      start: bucket[0].start,
      end: bucket[bucket.length - 1].end,
      text: bucket.map((w) => w.word).join(" ").trim(),
      words: bucket.map((w) => ({ ...w })),
    });
    bucket = [];
  };
  for (const cap of track) {
    if (!cap.words || cap.words.length === 0) {
      flush();
      out.push({ ...cap }); // no word timings to regroup — keep as one line
      continue;
    }
    for (const w of cap.words) {
      bucket.push(w);
      if (bucket.length >= n) flush();
    }
  }
  flush();
  return out;
}

export function splitByMaxChars(track, maxChars) {
  if (!maxChars || maxChars <= 0) return track;
  const out = [];
  for (const cap of track) {
    if (cap.text.length <= maxChars || !cap.words || cap.words.length === 0) {
      out.push(cap);
      continue;
    }
    let lineWords = [], lineLen = 0;
    const flush = () => {
      if (!lineWords.length) return;
      out.push({
        start: lineWords[0].start,
        end: lineWords[lineWords.length - 1].end,
        text: lineWords.map((w) => w.word).join(" ").trim(),
        words: lineWords.map((w) => ({ ...w })),
      });
      lineWords = []; lineLen = 0;
    };
    for (const w of cap.words) {
      const wLen = (w.word || "").length + 1;
      if (lineLen + wLen > maxChars && lineWords.length) flush();
      lineWords.push(w);
      lineLen += wLen;
    }
    flush();
  }
  return out;
}

export function mergeLines(track, linesPerCaption) {
  if (!linesPerCaption || linesPerCaption <= 1) return track;
  const out = [];
  for (let i = 0; i < track.length; i += linesPerCaption) {
    const chunk = track.slice(i, i + linesPerCaption);
    out.push({
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      text: chunk.map((c) => c.text).join("\n"),
      words: chunk.flatMap((c) => c.words || []),
    });
  }
  return out;
}
