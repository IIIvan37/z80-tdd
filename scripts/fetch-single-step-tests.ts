// Downloads SingleStepTests/z80 into .cache/single-step-tests/v1, once per pinned commit.
// The suite is 1.3 GB of JSON, too big for the repository; CI caches the folder.
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";

const COMMIT = "ebe1875d48f374bcfd4b505d8eb8ee751568b5f7";
const TARBALL = `https://codeload.github.com/SingleStepTests/z80/tar.gz/${COMMIT}`;
const TARGET = ".cache/single-step-tests";
const STAMP = join(TARGET, "commit");

if (existsSync(STAMP) && readFileSync(STAMP, "utf8") === COMMIT) {
  console.log(`SingleStepTests/z80 ${COMMIT.slice(0, 7)} already in ${TARGET}`);
} else {
  rmSync(TARGET, { recursive: true, force: true });
  mkdirSync(TARGET, { recursive: true });
  console.log(
    `Downloading SingleStepTests/z80 ${COMMIT.slice(0, 7)} (about 290 MB)…`,
  );
  const response = await fetch(TARBALL);
  if (!response.ok || response.body === null) {
    throw new Error(`Download failed: ${response.status} ${TARBALL}`);
  }
  // The tarball's top folder is z80-<commit>/; keep only its v1/ folder.
  const tar = spawn(
    "tar",
    ["-xz", "-C", TARGET, "--strip-components=1", `z80-${COMMIT}/v1`],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  Readable.fromWeb(response.body).pipe(tar.stdin);
  const code = await new Promise<number | null>((resolve) =>
    tar.on("close", resolve),
  );
  if (code !== 0) {
    throw new Error(`tar exited with code ${code}`);
  }
  writeFileSync(STAMP, COMMIT);
  console.log(`SingleStepTests/z80 extracted to ${join(TARGET, "v1")}`);
}
