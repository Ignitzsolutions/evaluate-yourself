import { buildSearchParams, readBoolParam, readStringParam } from "../adminSearchParams";

describe("adminSearchParams", () => {
  test("readStringParam returns trimmed values and falls back for blanks", () => {
    const params = new URLSearchParams({ q: "  support  ", empty: "   " });

    expect(readStringParam(params, "q", "")).toBe("support");
    expect(readStringParam(params, "empty", "fallback")).toBe("fallback");
    expect(readStringParam(params, "missing", "fallback")).toBe("fallback");
  });

  test("readBoolParam accepts admin-style truthy values", () => {
    expect(readBoolParam(new URLSearchParams({ deleted: "1" }), "deleted", false)).toBe(true);
    expect(readBoolParam(new URLSearchParams({ deleted: "yes" }), "deleted", false)).toBe(true);
    expect(readBoolParam(new URLSearchParams(), "deleted", false)).toBe(false);
  });

  test("buildSearchParams omits empty and fallback values", () => {
    const params = buildSearchParams([
      ["q", "  referrals  ", ""],
      ["status", "all", "all"],
      ["deleted", "1", ""],
      ["blank", "   ", ""],
    ]);

    expect(params.toString()).toBe("q=referrals&deleted=1");
  });
});
