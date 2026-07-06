import { regroupByWordCount, splitByMaxChars, mergeLines } from "./captionTools";

function words(...specs) {
  // specs: ["word", start, end]
  return specs.map(([word, start, end]) => ({ word, start, end }));
}

describe("regroupByWordCount", () => {
  it("returns the track unchanged when wordsPerLine is falsy", () => {
    const track = [{ start: 0, end: 1, text: "hi", words: words(["hi", 0, 1]) }];
    expect(regroupByWordCount(track, "default")).toBe(track);
  });

  it("groups words into buckets of the given size", () => {
    const track = [{
      start: 0, end: 2, text: "one two three four",
      words: words(["one", 0, 0.5], ["two", 0.5, 1], ["three", 1, 1.5], ["four", 1.5, 2]),
    }];
    const out = regroupByWordCount(track, "2");
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("one two");
    expect(out[1].text).toBe("three four");
    expect(out[0].start).toBe(0);
    expect(out[0].end).toBe(1);
  });

  it("keeps captions with no word timings as single lines", () => {
    const track = [{ start: 0, end: 1, text: "no timings", words: [] }];
    const out = regroupByWordCount(track, "2");
    expect(out).toEqual([{ start: 0, end: 1, text: "no timings", words: [] }]);
  });
});

describe("splitByMaxChars", () => {
  it("returns the track unchanged when maxChars is falsy", () => {
    const track = [{ start: 0, end: 1, text: "hi", words: words(["hi", 0, 1]) }];
    expect(splitByMaxChars(track, 0)).toBe(track);
  });

  it("leaves short captions alone", () => {
    const track = [{ start: 0, end: 1, text: "short", words: words(["short", 0, 1]) }];
    expect(splitByMaxChars(track, 24)).toEqual(track);
  });

  it("splits long captions at the character limit", () => {
    const track = [{
      start: 0, end: 2, text: "aaaa bbbb cccc dddd",
      words: words(["aaaa", 0, 0.5], ["bbbb", 0.5, 1], ["cccc", 1, 1.5], ["dddd", 1.5, 2]),
    }];
    const out = splitByMaxChars(track, 10);
    // "aaaa bbbb" (9 chars) fits; adding "cccc" would exceed 10
    expect(out.map((c) => c.text)).toEqual(["aaaa bbbb", "cccc dddd"]);
  });
});

describe("mergeLines", () => {
  it("returns the track unchanged when linesPerCaption <= 1", () => {
    const track = [{ start: 0, end: 1, text: "a", words: [] }];
    expect(mergeLines(track, 1)).toBe(track);
  });

  it("merges N consecutive captions into one, joined by newlines", () => {
    const track = [
      { start: 0, end: 1, text: "line one", words: words(["line", 0, 0.5], ["one", 0.5, 1]) },
      { start: 1, end: 2, text: "line two", words: words(["line", 1, 1.5], ["two", 1.5, 2]) },
    ];
    const out = mergeLines(track, 2);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("line one\nline two");
    expect(out[0].start).toBe(0);
    expect(out[0].end).toBe(2);
    expect(out[0].words).toHaveLength(4);
  });
});
