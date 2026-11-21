#!/usr/bin/env node
import { run } from "./cli.js";

// `tube2vid platforms | head` closes stdout early; that is not an error.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") process.exit(0);
  throw error;
});

process.exitCode = await run(process.argv.slice(2));
