import { createWriteStream } from "node:fs";
import { createRequire } from "node:module";
import { basename } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { parseArgs } from "node:util";
import { DEFAULT_BASE_URL, Tube2VidApiError, Tube2VidClient, type JobMode } from "@tube2vid/sdk";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const HELP = `tube2vid ${version}: download media through the Tube2Vid API

Usage:
  tube2vid download <url> [-o file] [--mode auto|video|audio|gallery] [--format mp4] [--quality best] [--no-wait]
  tube2vid status <jobId> [--events]
  tube2vid usage
  tube2vid platforms [--health]

Options:
  -k, --api-key <key>   API key (default: $TUBE2VID_API_KEY). Create one at https://tube2vid.com/dashboard
      --base-url <url>  API origin (default: $TUBE2VID_API_URL or ${DEFAULT_BASE_URL})
      --json            Print raw JSON
  -h, --help            Show this help
  -v, --version         Show the version
`;

export type CliDeps = {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  out?: (text: string) => void;
  err?: (text: string) => void;
};

/** Runs the CLI and resolves with the process exit code. */
export async function run(argv: string[], deps: CliDeps = {}): Promise<number> {
  const env = deps.env ?? process.env;
  const out = deps.out ?? ((text: string) => process.stdout.write(text));
  const err = deps.err ?? ((text: string) => process.stderr.write(text));

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        "api-key": { type: "string", short: "k" },
        "base-url": { type: "string" },
        json: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        output: { type: "string", short: "o" },
        mode: { type: "string" },
        format: { type: "string" },
        quality: { type: "string" },
        "no-wait": { type: "boolean" },
        events: { type: "boolean" },
        health: { type: "boolean" }
      }
    });
  } catch (error) {
    err(`${(error as Error).message}\n\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [command, arg] = positionals;

  if (values.version) {
    out(`${version}\n`);
    return 0;
  }
  if (values.help || !command) {
    (values.help ? out : err)(HELP);
    return values.help ? 0 : 2;
  }

  const client = new Tube2VidClient({
    baseUrl: values["base-url"] || env.TUBE2VID_API_URL || DEFAULT_BASE_URL,
    apiKey: values["api-key"] || env.TUBE2VID_API_KEY,
    fetch: deps.fetch
  });
  const print = (data: unknown, text: () => string) => out(values.json ? `${JSON.stringify(data, null, 2)}\n` : `${text()}\n`);
  const needsKey = command !== "platforms";
  if (needsKey && !client.apiKey) {
    err("An API key is required: pass --api-key or set TUBE2VID_API_KEY. Create one at https://tube2vid.com/dashboard\n");
    return 2;
  }

  try {
    switch (command) {
      case "platforms": {
        if (values.health) {
          const rows = await client.getPlatformHealth();
          print(rows, () => rows.map((row) => `${row.platform.padEnd(12)} ${row.status.padEnd(15)} ${row.provider ?? ""}`).join("\n"));
        } else {
          const platforms = await client.listPlatforms();
          print(platforms, () =>
            platforms.map((p) => `${p.slug.padEnd(12)} ${p.name.padEnd(12)} ${p.capabilities.join(", ")}`).join("\n") +
            "\n\nAny other site yt-dlp supports (1,800+) works too."
          );
        }
        return 0;
      }
      case "usage": {
        const usage = await client.getUsage();
        print(usage, () =>
          `Credits: ${usage.creditBalance}\nJobs: ${usage.jobsTotal} total, ${usage.jobsCompleted} completed, ${usage.jobsFailed} failed`
        );
        return 0;
      }
      case "status": {
        if (!arg) return usageError(err, "status needs a job id");
        if (values.events) {
          const events = await client.getJobEvents(arg);
          print(events, () => events.map((e) => `${e.createdAt}  ${e.stage.padEnd(14)} ${e.message}`).join("\n"));
        } else {
          const job = await client.getJobStatus(arg);
          print(job, () =>
            [`Job ${job.id}: ${job.status} (${job.progress}%)`, job.title && `Title: ${job.title}`, job.errorMessage && `Error: ${job.errorMessage}`]
              .filter(Boolean)
              .join("\n")
          );
        }
        return 0;
      }
      case "download": {
        if (!arg) return usageError(err, "download needs a URL");
        const mode = values.mode as JobMode | undefined;
        if (mode && !["auto", "video", "audio", "gallery"].includes(mode)) return usageError(err, `unknown mode "${mode}"`);
        const queued = await client.submitAuthenticatedJob({ url: arg, mode, format: values.format, quality: values.quality });
        if (values["no-wait"]) {
          print(queued, () => `Queued job ${queued.jobId} (${queued.platform}, ~${queued.estimatedCredits} credits)`);
          return 0;
        }
        err(`Queued job ${queued.jobId} (${queued.platform})\n`);
        const job = await client.waitForJob(queued.jobId, {
          onUpdate: (update) => err(`  ${update.status} ${update.progress}%\n`)
        });
        if (job.status === "failed") {
          err(`Download failed: ${job.errorMessage ?? job.errorCode ?? "unknown error"}\n`);
          if (values.json) print(job, () => "");
          return 1;
        }
        const file = await client.downloadJob(job.id);
        const target = values.output || filenameFrom(file.headers.get("content-disposition")) || `${job.id}.${job.format || "bin"}`;
        if (!file.body) throw new Error("The download response had no body");
        // "wx": never overwrite an existing file
        await pipeline(Readable.fromWeb(file.body as WebReadableStream), createWriteStream(target, { flags: "wx" }));
        print({ ...job, savedTo: target }, () => `Saved ${target}`);
        return 0;
      }
      default:
        return usageError(err, `unknown command "${command}"`);
    }
  } catch (error) {
    if (error instanceof Tube2VidApiError) err(`Error ${error.status}: ${error.message}\n`);
    else err(`Error: ${(error as Error).message}\n`);
    return 1;
  }
}

function usageError(err: (text: string) => void, message: string) {
  err(`${message}\n\n${HELP}`);
  return 2;
}

/** Safe local filename from a Content-Disposition header, or undefined. */
export function filenameFrom(header: string | null) {
  const match = header?.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const raw = match?.[1] ? decodeURIComponent(match[1]) : match?.[2];
  const name = raw ? basename(raw.replace(/\\/g, "/")).trim() : "";
  return name && name !== "." && name !== ".." ? name : undefined;
}
