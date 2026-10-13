import assert from "node:assert";
import test from "node:test";
import { Money } from "../src/lib/money";

test("Money.round - rounds half up", () => {
  assert.strictEqual(Money.round(10.4), 10);
  assert.strictEqual(Money.round(10.5), 11);
  assert.strictEqual(Money.round(10.6), 11);
});

test("Money.formatNaira - formats kobo to NGN currency", () => {
  const formatted = Money.formatNaira(150000); // 1,500 NGN
  assert.ok(formatted.includes("1,500") || formatted.includes("1500"));
});
