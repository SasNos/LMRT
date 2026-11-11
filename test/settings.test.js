import test from "node:test";
import assert from "node:assert/strict";
import { findVoice, normalizeSettings } from "../src/settings.js";

test("valid settings pass through, rate is clamped", () => {
  assert.deepEqual(normalizeSettings('{"rate":2,"voiceUri":"v1"}'), { rate: 2, voiceUri: "v1" });
  assert.equal(normalizeSettings({ rate: 99 }).rate, 3);
});

test("garbage falls back to defaults", () => {
  const defaults = { rate: 1, voiceUri: "" };
  for (const raw of [null, undefined, "", "{bad", "[1]", "5", 7, [], { rate: "x", voiceUri: 5 }]) {
    assert.deepEqual(normalizeSettings(raw), defaults);
  }
});

test("voice uri is length-limited", () => {
  assert.equal(normalizeSettings({ voiceUri: "é".repeat(500) }).voiceUri.length, 200);
});

test("findVoice returns the match or null", () => {
  const voices = [{ voiceURI: "a" }, { voiceURI: "b" }];
  assert.equal(findVoice(voices, "b"), voices[1]);
  assert.equal(findVoice(voices, "zzz"), null);
  assert.equal(findVoice(voices, ""), null);
});
