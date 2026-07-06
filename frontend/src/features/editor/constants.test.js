import { formatTime } from "./constants";

describe("formatTime", () => {
  it("formats zero as 00:00.000", () => {
    expect(formatTime(0)).toBe("00:00.000");
  });

  it("formats sub-minute durations", () => {
    expect(formatTime(1.5)).toBe("00:01.500");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(61.25)).toBe("01:01.250");
  });

  it("clamps negative values to zero", () => {
    expect(formatTime(-5)).toBe("00:00.000");
  });

  it("returns a placeholder for non-finite input", () => {
    expect(formatTime(Infinity)).toBe("00:00.000");
    expect(formatTime(NaN)).toBe("00:00.000");
  });
});
