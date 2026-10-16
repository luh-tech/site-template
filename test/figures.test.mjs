import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadFigures, configureFigures, figureFor } from "../src/content/figures.ts";

const rec = (id) => ({ figureId: `urn:luhtech:luhtech:figure:${id}`, title: id });

test("figure records load by figureId; a missing dir is no figures", () => {
  const dir = mkdtempSync(join(tmpdir(), "figs-"));
  writeFileSync(join(dir, "a.json"), JSON.stringify(rec("a")));
  writeFileSync(join(dir, "b.json"), JSON.stringify(rec("b")));
  assert.deepEqual(Object.keys(loadFigures(dir)), ["urn:luhtech:luhtech:figure:a", "urn:luhtech:luhtech:figure:b"]);
  assert.deepEqual(loadFigures(join(dir, "none")), {});
  writeFileSync(join(dir, "c.json"), JSON.stringify(rec("a")));
  assert.throws(() => loadFigures(dir), /appears twice/);
});

test("a figureRef resolves through the site's registry, and a dangling one fails the build", () => {
  assert.throws(() => figureFor("urn:luhtech:luhtech:figure:a"), /not called configureFigures/);
  configureFigures({ records: { "urn:luhtech:luhtech:figure:a": rec("a") }, theme: { brandId: "x" } });
  assert.equal(figureFor("urn:luhtech:luhtech:figure:a").record.title, "a");
  assert.throws(() => figureFor("urn:luhtech:luhtech:figure:zzz"), /not among this site's figure records/);
});
