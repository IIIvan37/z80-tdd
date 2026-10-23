import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { type Assembler, rasmAssembler } from "./assembler/index.ts";
import {
  ADDRESS_TAKES,
  isAddress,
  isNopLimit,
  NOP_LIMIT_TAKES,
} from "./run.ts";

const FILE = "z80-tdd.config.ts";

/** The project-wide settings of `z80-tdd.config.ts`; a test file may give any of them to `loadProgram()`. */
export interface ConfigurationFile {
  /** RASM on the PATH by default. */
  readonly assembler?: Assembler;
  /** The source file `loadProgram()` assembles, from the project root. */
  readonly source?: string;
  /** The SP a Run starts with; #C000 by default. */
  readonly sp?: number;
  /** The longest a Run may last, in NOPs; 1,000,000 by default. */
  readonly nopLimit?: number;
  /** The bits of a port address a Port read matches on; #FF00 by default, as the CPC decodes. */
  readonly portMask?: number;
}

/** Each setting a Program needs, a test file's over the configuration file's, over the defaults, and the project root. */
type ResolvedSettings = Required<ConfigurationFile> & {
  /** The folder of the configuration file, or the working directory without one; no setting changes it. */
  readonly root: string;
};

interface Setting {
  accepts(value: unknown): boolean;
  /** Ends the message that refuses a value: "it takes …". */
  readonly takes: string;
}

const SETTINGS: Readonly<Record<keyof ConfigurationFile, Setting>> = {
  assembler: {
    accepts: (value) =>
      typeof (value as Partial<Assembler> | undefined)?.assemble === "function",
    takes: 'an Assembler, such as rasmAssembler({ path: "/path/to/rasm" })',
  },
  source: {
    accepts: (value) => typeof value === "string" && value !== "",
    takes: "the path of a source file",
  },
  sp: {
    accepts: isAddress,
    takes: ADDRESS_TAKES,
  },
  nopLimit: { accepts: isNopLimit, takes: NOP_LIMIT_TAKES },
  portMask: {
    accepts: isAddress,
    takes: ADDRESS_TAKES,
  },
};

/** Types the settings of `z80-tdd.config.ts`. */
export function defineConfig(settings: ConfigurationFile): ConfigurationFile {
  return settings;
}

/** The settings of the nearest configuration file at or above the working directory, with a test file's on top. */
export async function loadSettings(
  overrides: ConfigurationFile,
): Promise<ResolvedSettings> {
  check(overrides, "loadProgram()");
  const { path, root } = findFile();
  const {
    assembler = rasmAssembler(),
    source,
    sp = 0xc000,
    nopLimit = 1_000_000,
    portMask = 0xff00,
  } = {
    ...(path === undefined ? {} : await loadFile(path)),
    ...defined(overrides),
  };
  if (source === undefined) {
    throw new Error(
      `No source file to assemble: set "source" in ${FILE}, or pass it to loadProgram()`,
    );
  }
  return { assembler, source, root, sp, nopLimit, portMask };
}

// Vitest may run from a folder below the project root, as an editor does for one test file.
function findFile(): { path?: string; root: string } {
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    const path = join(dir, FILE);
    if (existsSync(path)) {
      return { path, root: dir };
    }
    if (dirname(dir) === dir) {
      return { root: process.cwd() };
    }
  }
}

async function loadFile(path: string): Promise<ConfigurationFile> {
  const module = await import(pathToFileURL(path).href).catch(
    (error: unknown) => {
      throw new Error(
        `${FILE} failed to load: ${error instanceof Error ? error.message : error}`,
        { cause: error },
      );
    },
  );
  const settings: unknown = module.default;
  if (typeof settings !== "object" || settings === null) {
    throw new Error(
      `${FILE} has no default export of settings: write export default defineConfig({ ... })`,
    );
  }
  check(settings, FILE);
  return settings;
}

// A setting given as undefined leaves the one below it in place.
function defined(settings: ConfigurationFile): ConfigurationFile {
  return Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined),
  );
}

function check(settings: object, origin: string): void {
  for (const [name, value] of Object.entries(settings)) {
    if (!Object.hasOwn(SETTINGS, name)) {
      throw new Error(
        `"${name}" of ${origin} is not a setting: the settings are ${Object.keys(SETTINGS).join(", ")}`,
      );
    }
    const { accepts, takes } = SETTINGS[name as keyof ConfigurationFile];
    if (value !== undefined && !accepts(value)) {
      throw new Error(
        `The setting "${name}" of ${origin} cannot be ${JSON.stringify(value)}: it takes ${takes}`,
      );
    }
  }
}
