# Tube2Vid CLI

[![CI](https://github.com/Tube2Vid/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Tube2Vid/cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@tube2vid/cli.svg)](https://www.npmjs.com/package/@tube2vid/cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A command-line YouTube, TikTok and Instagram video downloader. The `tube2vid` command downloads video, audio (MP3) and images from YouTube, TikTok, Instagram, X, Reddit and 1,800+ other sites through the [Tube2Vid download API](https://tube2vid.com), so there is no yt-dlp, ffmpeg or cookie setup on your machine.

## Install

```bash
npm install -g @tube2vid/cli
# or run it once without installing
npx @tube2vid/cli --help
```

Needs Node 18.17+. [Get an API key](https://tube2vid.com/pricing), then:

```bash
export TUBE2VID_API_KEY=tv_live_...
```

## Quickstart

```bash
tube2vid download https://www.youtube.com/watch?v=dQw4w9WgXcQ
tube2vid download https://www.youtube.com/watch?v=dQw4w9WgXcQ --mode audio --format mp3 -o song.mp3
tube2vid download https://www.tiktok.com/@user/video/123 --no-wait   # just queue it, print the job id

tube2vid status <jobId>
tube2vid status <jobId> --events

tube2vid usage
tube2vid platforms
tube2vid platforms --health
```

`download` queues the job, waits for it, and saves the file to the current directory under its original name (or to `-o`). It never overwrites an existing file.

## Configuration

| Option | |
| --- | --- |
| `-k, --api-key <key>` | API key; defaults to `$TUBE2VID_API_KEY` |
| `--base-url <url>` | API origin; defaults to `$TUBE2VID_API_URL` or `https://tube2vid.com` |
| `--mode` | `auto` (default), `video`, `audio` or `gallery` |
| `--format`, `--quality` | e.g. `mp4` / `best` (the defaults), `mp3`, `720p` |
| `--json` | Print raw API JSON |

`platforms` works without a key.

## Errors and exit codes

`0` success, `1` API or download failure (the API's error message is printed to stderr, e.g. a 402 when you are out of credits), `2` bad usage such as a missing API key.

## Links

- [Tube2Vid](https://tube2vid.com): the online video downloader behind the CLI
- [API documentation](https://tube2vid.com/docs) and the [OpenAPI spec](https://github.com/Tube2Vid/api)
- [Pricing and API keys](https://tube2vid.com/pricing)
- [Live platform status](https://tube2vid.com/status)
- Built on the [Tube2Vid TypeScript SDK](https://github.com/Tube2Vid/sdk); AI tools can use the [Tube2Vid MCP server](https://github.com/Tube2Vid/mcp)

SDKs in other languages: [TypeScript](https://github.com/Tube2Vid/sdk), [Python](https://github.com/Tube2Vid/sdk-python), [Go](https://github.com/Tube2Vid/sdk-go), [Java](https://github.com/Tube2Vid/sdk-java), [C#](https://github.com/Tube2Vid/sdk-dotnet), [PHP](https://github.com/Tube2Vid/sdk-php), [Ruby](https://github.com/Tube2Vid/sdk-ruby), [Rust](https://github.com/Tube2Vid/sdk-rust), [Swift](https://github.com/Tube2Vid/sdk-swift).

## Develop

```bash
npm install
npm test
npm run build
```

## License

[MIT](LICENSE), Copyright (c) 2026 Tube2Vid.
