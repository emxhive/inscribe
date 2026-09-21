import { describe, expect, it } from "vitest";
import { matchesStartsWith } from "../../src/v2/structural/startsWithQualifier";

describe("STARTS_WITH matching", () => {
  it("accepts exact and indentation-normalized prefixes", () => {
    expect(matchesStartsWith("if (ready) { return value; }", "if (ready) {")).toBe(true);
    expect(
      matchesStartsWith(
        "  if (ready) {\n    return value;\n  }",
        "if (ready) {\n  return value;",
      ),
    ).toBe(true);
  });

  it("accepts internal whitespace differences through the shared matcher", () => {
    expect(matchesStartsWith("if(customer == null){ return; }", "if (customer == null) {")).toBe(true);
  });

  it("accepts compatible quote and separator soft tokens", () => {
    expect(matchesStartsWith('call("ready"), next();', "call('ready');")).toBe(true);
  });

  it("keeps meaningful tokens and hard operators strict", () => {
    expect(matchesStartsWith("if (supplier != null) {", "if (customer == null) {")).toBe(false);
    expect(matchesStartsWith("if (customer != null) {", "if (customer == null) {")).toBe(false);
  });

  it("allows short anchored snippets without SEARCH's whole-file threshold", () => {
    expect(matchesStartsWith("if(ready){ return; }", "if (ready)")).toBe(true);
    expect(matchesStartsWith("for(item in items)", "for (item")).toBe(true);
  });

  it("does not match equivalent text later inside the candidate", () => {
    expect(
      matchesStartsWith(
        "if (supplier != null) { return; } if (customer == null) { return; }",
        "if (customer == null) {",
      ),
    ).toBe(false);
  });
});
