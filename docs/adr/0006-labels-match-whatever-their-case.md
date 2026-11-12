# Labels match whatever their case

A Program finds a label whatever its case: `program.run("double")` runs the label RASM exports as `DOUBLE`. RASM ignores case in labels and exports them in capitals whenever the source contains a `SAVE`, even with `-ec` (seen in v3.0.9 and v3.3.1). The RASM adapter adds a `SAVE` of its own to read the 64 KB it assembled, so it always gets capitals. Writing labels in capitals in every test, unlike the CPC source, was the alternative; telling the Program through the Assembly which assemblers ignore case was another, with one more notion in the interface for a single assembler.

## Consequences

- The rule holds for every Assembler, including FantAMS, which tells `Loop` from `loop`. A name that matches several labels whatever their case fails and names them all: the test writes another name, never runs one of them by chance. Such labels do not stop the Program from loading; only the ambiguous name fails.
- A failure report shows labels as the Assembler gives them: in capitals with RASM.
- A symbol's value is signed, for every Assembler: `minus equ -16` gives -16. RASM exports it as `#FFFFFFF0`, and its adapter reads that as a signed 32-bit number.
