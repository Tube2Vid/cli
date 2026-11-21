import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { filenameFrom, run } from "./cli.js";

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

function harness(responses: Response[], env: Record<string, string> = { TUBE2VID_API_KEY: "tv_live_x" }) {
  const urls: string[] = [];
  let out = "";
  let err = "";
  const deps = {
    env,
    fetch: (async (url: string) => {
      urls.push(String(url));
      return responses.shift() ?? new Response("no more responses", { status: 500 });
    }) as typeof fetch,
    out: (text: string) => void (out += text),
    err: (text: string) => void (err += text)
  };
  return { deps, urls, output: () => out, errors: () => err };
}

test("usage requires an API key", async () => {
  const h = harness([], {});
  assert.equal(await run(["usage"], h.deps), 2);
  assert.match(h.errors(), /API key is required/);
});

test("usage prints the balance from the env key and base URL", async () => {
  const h = harness([json({ creditBalance: 42, jobsTotal: 1, jobsCompleted: 1, jobsFailed: 0 })], {
    TUBE2VID_API_KEY: "tv_live_x",
    TUBE2VID_API_URL: "https://api.example.test"
  });
  assert.equal(await run(["usage"], h.deps), 0);
  assert.equal(h.urls[0], "https://api.example.test/v1/usage");
  assert.match(h.output(), /Credits: 42/);
});

test("download submits, waits and saves the file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tube2vid-cli-"));
  const target = join(dir, "out.mp4");
  const h = harness([
    json({ jobId: "j1", status: "queued", platform: "youtube", estimatedCredits: 10 }),
    json({ id: "j1", status: "completed", progress: 100, format: "mp4" }),
    new Response(null, { status: 302, headers: { location: "https://cdn.example.test/j1.mp4" } }),
    new Response("video-bytes")
  ]);
  assert.equal(await run(["download", "https://youtu.be/x", "-o", target], h.deps), 0);
  assert.equal(await readFile(target, "utf8"), "video-bytes");
  assert.equal(h.urls[3], "https://cdn.example.test/j1.mp4");
});

test("a failed job exits 1 with the reason", async () => {
  const h = harness([
    json({ jobId: "j2", status: "queued", platform: "youtube", estimatedCredits: 10 }),
    json({ id: "j2", status: "failed", progress: 0, errorMessage: "blocked" })
  ]);
  assert.equal(await run(["download", "https://youtu.be/x"], h.deps), 1);
  assert.match(h.errors(), /Download failed: blocked/);
});

test("filenameFrom keeps only a safe basename", () => {
  assert.equal(filenameFrom('attachment; filename="My Video.mp4"'), "My Video.mp4");
  assert.equal(filenameFrom('attachment; filename="../../etc/passwd"'), "passwd");
  assert.equal(filenameFrom("attachment; filename*=UTF-8''caf%C3%A9.mp3"), "café.mp3");
  assert.equal(filenameFrom(null), undefined);
});
