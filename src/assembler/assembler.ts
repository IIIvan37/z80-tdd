export interface Block {
  readonly address: number;
  readonly bytes: readonly number[];
}

/** What an Assembler produces from one source file: machine code at its load addresses, and the symbol table. */
export interface Assembly {
  readonly blocks: readonly Block[];
  readonly symbols: Readonly<Record<string, number>>;
}

export interface Assembler {
  /** `root` is the folder a relative path starts from: the project root, or the working directory by default. */
  assemble(source: string, root?: string): Promise<Assembly>;
}
