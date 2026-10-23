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
      name: "test-in-folder-imports-only-index",
      comment:
        "A test inside a module folder imports only that folder's index.ts.",
      severity: "error",
      from: { path: "^src/([^/]+)/[^/]+\\.test\\.ts$" },
      to: { path: "^src/", pathNot: "^src/$1/index\\.ts$" },
    },
    {
      name: "test-at-top-imports-only-its-module",
      comment:
        "A test beside a file module imports only that file; `<module>.<topic>.test.ts` tests `<module>.ts`.",
      severity: "error",
      from: { path: "^src/([^/.]+)[^/]*\\.test\\.ts$" },
      to: { path: "^src/", pathNot: "^src/$1\\.ts$" },
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
