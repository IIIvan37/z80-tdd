// Enforces the module structure of CODING_STANDARDS.md (ADR 0003).
// Modules are top-level files or top-level folders of src/; deeper nesting
// will need these patterns generalised.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-deep-import-from-folder",
      comment:
        "Only a module folder's index.ts may be imported from outside the folder.",
      severity: "error",
      from: { path: "^src/([^/]+)/" },
      to: {
        path: "^src/[^/]+/",
        pathNot: ["^src/$1/", "^src/[^/]+/index\\.ts$"],
      },
    },
    {
      name: "no-deep-import-from-top",
      comment:
        "Only a module folder's index.ts may be imported from outside the folder.",
      severity: "error",
      from: { path: "^src/[^/]+$" },
      to: { path: "^src/[^/]+/", pathNot: "^src/[^/]+/index\\.ts$" },
    },
    {
      name: "test-imports-only-its-interface",
      comment:
        "A test imports only its module's interface: its file, or its folder's index.ts.",
      severity: "error",
      from: { path: "^src/(|.+/)([^/]+)\\.test\\.ts$" },
      to: {
        path: "^src/",
        pathNot: ["^src/$1$2\\.ts$", "^src/$1index\\.ts$"],
      },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
