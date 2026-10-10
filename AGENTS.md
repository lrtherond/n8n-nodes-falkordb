# How to Code

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions; those win on conflict.

## 1. Think Before Coding

- Minor ambiguity? State your assumption and proceed. Ambiguity that changes the design? Stop. Name it. Ask.
- Multiple interpretations? Present them — don't pick silently.
- Simpler approach exists? Say so. Push back.
- Unsure of an API? Read the docs or source. Don't guess.

## 2. Specifications Require Judgment

A specification records a decision. It does not replace judgment.

- Follow it by default.
- If evidence shows it is wrong, name the flaw and its consequence.
- If the decision changes, update the specification, tests, and code together. Never drift silently.

## 3. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No preemptive "flexibility" or "configurability."
- No error handling for impossible scenarios.
- 200 lines that could be 50? Rewrite.

## 4. Surgical Changes

Touch only what you must.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor what isn't broken.
- Match existing style, even if you'd do it differently.
- Remove only what your change orphaned. Pre-existing dead code? Mention it — don't delete it.

Every changed line must trace directly to the request.

## 5. Goal-Driven Execution

Define success criteria. Loop until verified.

- "Add validation" → write tests for invalid inputs, then make them pass.
- "Fix the bug" → write a test that reproduces it, then make it pass.
- "Refactor X" → ensure tests pass before and after.

Multi-step tasks get a brief plan:

```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

Strong criteria let you loop independently. Weak criteria require constant clarification.

## 6. Naming

Names you introduce must be clear and descriptive — they are the documentation.

- Bad existing names? Mention them — don't rename.

## 7. Stop When Done

Correct, tested, readable, and within scope is done.

- Every further change must justify its risk and review cost.
- “No issues found” is a valid review.
- Report real defects. Do not invent polish.

---

## FalkorDB n8n Node Package — Project Context

This section records the project guidance for the development baseline and the current agreed scope. Keep this context current when the architecture, tooling, or agreed scope changes.

### Product Scope and Development Status

The intended product is a general n8n community integration for interacting with any FalkorDB graph. Graphs may have arbitrary labels, properties, and relationships, with or without documents, full-text indexes, or embeddings. The user's Stoic Knowledge Graph is the first validation dataset; its schema must not become a requirement of the package.

The primary capability is generating Cypher from a graph schema definition and a user's natural-language query. Cypher execution belongs to FalkorDB. The integration's retrieval workflows submit generated queries to FalkorDB and return its results to n8n; generic query execution alone does not satisfy the product goal.

The requested retrieval capabilities are:

1. Return ranked documents or passages for a query.
2. Support RAG by providing retrieval to AI nodes.
3. Support agentic RAG by acting as a tool for AI Agent nodes.

Document insertion is deferred. The schema is a required, expression-capable multiline node input supplied by the workflow author; automatic schema discovery is deferred. Keep the graph definition separate from the optional, expression-capable Retrieval Guidance field for search strategies, ranking rules, result fields, and example queries. Pass both inputs separately to query generation in all three modes. Keep text fields, citation mappings, embedding models, and graph traversal patterns in graph-specific configuration or examples. Embeddings are not required for natural-language graph queries; ranked document retrieval depends on suitable content and a defined retrieval strategy.

FalkorDB Graph Query implements schema-guided Cypher generation with a connected Chat Model. Its modes provide Main workflow execution, an AiRetriever for chains, and an AiTool for agents. All queries use GRAPH.RO_QUERY. Ranked retrieval depends on a search method described in the supplied schema or retrieval guidance; there is no embedding generation or automatic query repair. The Stoic Knowledge Graph remains an external validation dataset, not an implementation dependency. Version 2 is a complete replacement for the published 1.x package. The previous conversation-memory and graph-enrichment feature is removed, with no legacy compatibility layer or automatic migration. Preserve the new query, retriever, and agent-tool modes.

This is an independent community project, not affiliated with, endorsed by, or authorized by the makers of FalkorDB. Prefix node display names and default canvas names with FalkorDB (FalkorDB Graph Query) to identify compatibility. Keep original artwork; do not use its logo or imply endorsement.

### Current Development Baseline

The 2.1.1 package of `@lrtherond/n8n-nodes-falkordb` registers only FalkorDB Graph Query. One node supplies the Query, Retriever for Chain, and Tool for AI Agent modes. Stable npm publication uses the `latest` tag and remains separate from committing, pushing, and CI.

- `FalkorDbQuery` defines the n8n UI and wiring, including the credential connection test.
- `FalkorDbQueryEngine` sends the supplied schema, retrieval guidance, question, and limit to the connected Chat Model. It validates generated Cypher and parameters before read-only execution.
- `FalkorDbRetriever` turns result rows into LangChain documents while retaining citations and metadata.
- `FalkorDbApi` configures host, port, optional username/password, and TLS. `FalkorDbClient` connects through the official native client, normally on port `6379`.
- Database connections must be closed on initialization failure, after each query or tool call, and through n8n's supplied cleanup function for retrievers.

See `README.md` for the three query modes, schema and guidance inputs, execution limits, and compatibility. Deterministic model fixtures establish wiring and database behavior; they do not establish real-model Cypher accuracy.

Keep `README.md` focused on people installing and using the integration. Local datasets, stoa workflows, export paths, contributor tooling, and development-instance setup belong in `dev/README.md`, not the public README.

### Repository Map

| Path                                     | Purpose                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `nodes/FalkorDb/FalkorDbClient.ts`       | Credential validation and native database connection                       |
| `credentials/FalkorDbApi.credentials.ts` | n8n credential fields                                                      |
| `nodes/FalkorDb/graph-query.png`         | Original, unbranded node and credential icon                               |
| `nodes/FalkorDb/FalkorDbQuery.node.ts`   | Query UI, credential test, Main execution, retriever and agent-tool wiring |
| `nodes/FalkorDb/FalkorDbQuery.ts`        | Schema-guided generation, validation, read-only queries, and documents     |
| `tests/*.test.ts`                        | Unit tests                                                                 |
| `tests/integration/`                     | Tests against a real FalkorDB database                                     |
| `tests/n8n/`                             | Packaged-node smoke test and deterministic model fixtures                  |
| `compose.test.yaml`                      | Isolated FalkorDB test service                                             |
| `eslint.config.mjs`                      | n8n lint configuration and documented exceptions                           |
| `.prettierrc.js`                         | Formatting configuration                                                   |
| `.markdownlint.jsonc`                    | Markdown rules, including aligned table columns                            |
| `tsconfig.json`, `tsconfig.test.json`    | Strict TypeScript checks for source and tests                              |
| `vitest.config.mts`                      | Unit and integration test projects                                         |
| `.github/workflows/ci.yml`               | Continuous integration checks                                              |
| `dev/README.md`                          | Contributor setup, testing, dependency rationale, and local validation     |

`dist/` is generated build output and `node_modules/` contains installed dependencies. Keep both out of version control. The package's `n8n` manifest registers the query node and credential. Restrict the published implementation to `dist/nodes` and `dist/credentials`, alongside the manifest, README, and MIT license; the packaged smoke test checks the exact archive contents. Documentation metadata currently lives in the node description's `codex` field.

`compose.dev.yaml` and `dev/n8n/` provide the persistent interactive n8n instance at `http://localhost:5678`. It joins the existing `stoic-kg_default` Docker network and uses `stoic-kg-falkordb:6379` for graph `stoa`. `npm run dev:docker` rebuilds/reinstalls the package and recreates n8n while preserving its volume. Local schema snapshots and workflow exports belong in git-ignored `.n8n/`; database passwords and model API keys belong in n8n's encrypted credential store. Keep this development instance running when requested for interactive use. The cleanup requirement below applies to the separate disposable test services.

### Stack and Dependency Policy

- Use Node.js 24 as selected by `.nvmrc`, npm, strict TypeScript, the official `@n8n/node-cli`, ESLint, markdownlint-cli2, Prettier, and Vitest.
- Runtime libraries are `falkordb`, `@langchain/core`, and `zod`; `n8n-workflow` is a peer dependency and a development dependency.
- Prioritize the latest stable release of each dependency. Verify compatibility with the target stable n8n release before upgrading; do not assume npm's `latest` tag always identifies the appropriate workflow API version.
- Keep dependency versions pinned and update `package-lock.json` with dependency changes. Use `npm ci` for reproducible installation.
- Document concrete dependency blockers and version exceptions in `dev/README.md`. Its compatibility table records the current rationale; `package.json` and the lockfile record the installed versions. Keep user-facing runtime compatibility in `README.md`.
- The package currently targets self-hosted n8n and uses `n8n.strict: false` for its native database connection and runtime libraries. Keep lint exceptions narrow and justified. n8n Cloud support is not established.
- Enforce at least 90% statements, branches, functions, and lines per production source file using Vitest V8 coverage. Include all TypeScript in `nodes/` and `credentials/`, even when untested. Add meaningful behavioral tests; do not exclude code or lower thresholds to pass. `npm run check` must include this coverage gate in local development, CI, and prepublication.

### Development and Verification

Start with:

```sh
nvm use
npm ci
npm run check
```

| Command                 | Purpose                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `npm run dev`           | Develop with the official n8n community-node CLI                          |
| `npm run build`         | Compile and copy package assets with the official CLI                     |
| `npm run typecheck`     | Check source and test types                                               |
| `npm run lint`          | Check n8n and TypeScript lint rules                                       |
| `npm run lint:markdown` | Check all project Markdown files and table alignment                      |
| `npm run lintfix`       | Apply lint fixes; review the resulting diff                               |
| `npm run format:check`  | Check formatting without modifying files                                  |
| `npm run format`        | Apply formatting; avoid unrelated changes                                 |
| `npm test`              | Run Vitest unit tests                                                     |
| `npm run test:coverage` | Run unit tests and enforce 90% per-file coverage in all four metrics      |
| `npm run test:watch`    | Run unit tests during development                                         |
| `npm run check`         | Run type checks, lint, formatting checks, coverage enforcement, and build |

For database behavior or n8n integration changes, use the isolated Docker test service:

```sh
docker compose -f compose.test.yaml up -d --wait
npm run test:integration
npm run test:n8n
docker compose -f compose.test.yaml down
```

Always clean up the test service after testing, including after failures. Tests use unique graph names and remove their own data. Use a dedicated test database when overriding connection settings; see `dev/README.md` for environment variables. Deterministic model fixtures exercise integration behavior without a paid model account; they do not establish real-provider Cypher generation quality.

Run checks appropriate to the change and report actual results. Documentation-only edits do not require database tests. For package changes, also inspect `npm pack --dry-run` to confirm the compiled files and assets are included. `prepublishOnly` runs `npm run check`; publication remains a separate release step.

### Implementation Conventions and Troubleshooting

- Follow the target n8n version's node interfaces and official examples. Read source or documentation when an API is uncertain.
- Keep parameter names, descriptions, connection types, and documentation metadata consistent with the actual behavior. Update affected documentation and tests alongside implementation changes.
- Preserve type safety and validate external data at its boundary. Surface actionable errors rather than silently discarding failed extraction or database operations.
- Expose tool inputs as node parameters supporting fixed values, expressions, and From AI. Tool mode's Question defaults to From AI; derive tool arguments from the configured From AI expressions. Use plain JSON Schema for agent-tool arguments crossing the community-package boundary: n8n's Zod instance checks can misclassify a separately installed Zod schema. Validate tool inputs locally too. Record retriever and direct tool calls, including failures; LangChain callbacks alone do not create n8n execution traces. For direct tools, `cloneWith` records input and gives each invocation its own context for resolving From AI expressions; record its result with `addOutputData`.
- For build or type errors, inspect the relevant configuration, dependency types, and documented compatibility constraints before changing versions or weakening checks.
- For missing icons or package files, run the official build and inspect `dist/`, the package manifest, and the package contents.
