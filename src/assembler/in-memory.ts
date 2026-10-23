import type { Assembler, Assembly } from "./assembler.ts";

/** An Assembler that returns hand-written Assemblies, keyed by source file name. */
export function inMemoryAssembler(
  sources: Readonly<Record<string, Assembly>>,
): Assembler {
  return {
    async assemble(source) {
      const assembly = sources[source];
      if (assembly === undefined) {
        throw new Error(
          `No source file "${source}" in the in-memory Assembler`,
        );
      }
      return assembly;
    },
  };
}
