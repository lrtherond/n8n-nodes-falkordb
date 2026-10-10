# Development guide

Contributor setup, testing, and local validation for `@lrtherond/n8n-nodes-falkordb`. For node usage, see the [project README](../README.md). Run the commands below from the repository root.

Use Node.js 24 LTS and npm. Dependency versions are pinned and `package-lock.json` is committed; keep dependencies and generated build output out of version control.

```sh
nvm use
npm ci
npm run check
npm run dev
```

`check` runs strict TypeScript checks (including tests), n8n's ESLint rules, Markdown lint, formatting checks, unit tests with coverage enforcement, and the official n8n build. `dev` uses the official n8n community-node CLI. Use `npm run test:watch` while developing.

`npm run test:coverage` uses Vitest's V8 provider and requires at least **90% statements, branches, functions, and lines in every production TypeScript file** under `nodes/` and `credentials/`, including files not imported by tests. CI and the prepublication check enforce this through `npm run check`. The HTML report is `coverage/index.html`, and machine-readable reports are in the same directory. See the [Vitest coverage documentation](https://vitest.dev/guide/coverage.html).

Use `npm run lint:markdown` to check project Markdown against `.markdownlint.jsonc`. Tables require aligned columns and outer pipes; `npm run format` formats them with Prettier. Markdown checks exclude dependencies and generated output.

## Database integration tests

Docker is required. The test service binds only to localhost, uses a test password, and has no persistent volume.

```sh
docker compose -f compose.test.yaml up -d --wait
npm run test:integration
npm run test:n8n
docker compose -f compose.test.yaml down
```

Tests use unique graph names and delete only their own graphs. Override `FALKORDB_HOST`, `FALKORDB_PORT`, and `FALKORDB_PASSWORD` to use another test database. Defaults are `127.0.0.1:16379` and password `revival-test-only`.

The FalkorDB test image is pinned to the 6.0.2 multi-platform digest. Local tests default to Docker Hub; GitHub CI sets `FALKORDB_TEST_IMAGE` to the identical image in [Google's public Docker Hub cache](https://docs.cloud.google.com/artifact-registry/docs/pull-cached-dockerhub-images) to avoid anonymous Docker Hub pull limits. Cache availability is not guaranteed; the same variable can select another registry containing that digest if needed. Update the version and digest in both `compose.test.yaml` and CI when changing the test image.

Tests cover separate schema, retrieval guidance, and question forwarding, arbitrary graph traversal, full-text ranking, citations, empty results, server-enforced rejection of generated writes, parameter validation, all three query interfaces, credential testing, and connection cleanup. AI responses are deterministic fixtures; no paid model account is required. These tests validate integration behavior, not real-provider Cypher generation quality.

`test:n8n` installs the packed package into an isolated stable n8n 2.42.6 container. It verifies the exact package contents, separate schema and retrieval guidance expressions, and a Question and Answer Chain retrieving different evidence from the main query with a visible retriever execution trace. It also checks Agent node versions 2.2 and 3, covering direct tool invocation and engine-scheduled execution with existing defaults, named From AI arguments, fixed questions, and expression-based questions. Both paths must deliver graph rows and citations to the parent agent and record each tool call's input, output, and successful execution status.

## Interactive local n8n

Start or rebuild the persistent development instance with:

```sh
npm run dev:docker
```

Open [localhost:5678](http://localhost:5678). On first launch, complete n8n's owner-account form. `compose.dev.yaml` uses the tested n8n 2.42.6 image, binds the editor to localhost, and attaches to the existing `stoic-kg_default` Docker network. Start the Stoic project's FalkorDB container first. From n8n, the database address is **`stoic-kg-falkordb:6379`**, and the working graph is **`stoa`**. Host port `6390` is for connections from macOS; `localhost` inside n8n refers to n8n itself.

The `n8n-falkordb-dev_n8n_data` volume persists workflows, encrypted credentials, and n8n's encryption key. `dev:docker` builds and packs the local node, installs the new archive, and recreates only the development n8n container. Run it after source changes. It preserves workflow edits and credentials. This development service is separate from `compose.test.yaml` and stays running for interactive use.

The initial setup includes **stoa · Graph Query**, **stoa · RAG Chain**, and **stoa · Agent RAG**, plus a **Stoa · local FalkorDB** credential. Each workflow has a manual trigger and an **Inputs** node containing an editable question, schema, and separate retrieval guidance. The seed templates select `gpt-6.1-sol` through n8n's Responses API support; select an OpenAI credential in **Chat Model**, or replace that model node with another provider. Exported workflows preserve your chosen model and its credential reference. Running a workflow uses that provider's API.

The local `.n8n/stoa-schema.yaml` is a copy of the Stoic project's `schema/schema.yaml`. Retrieval guidance is stored separately in `.n8n/stoa-retrieval-guidance.yaml`. The **Inputs** node embeds each file as a separate string, referenced by the graph node's **Schema** and **Retrieval Guidance** fields. Editing these files does not automatically update n8n. Both remain user inputs; the node works with other graphs and also accepts plain text or JSON.

For a fresh manual retrieval test, unpin the **FalkorDB Graph Query**, **Question and Answer Chain**, or **AI Agent** output in the workflow being tested. A pinned output reuses saved data and skips that node's execution, including its retriever or tool calls. You can keep **Inputs** pinned for repeatable inputs. The example questions and chain/agent system prompts require complete, verbatim quotations with citations and work titles, without summaries or inserted ellipses. Validate prose quotations against the retrieved rows; Query mode returns the original database text directly.

The three local exports preserve the workflows downloaded from the development instance, including model choices, credential references, and layouts:

| Workflow           | Export                                   |
| ------------------ | ---------------------------------------- |
| stoa · Graph Query | `.n8n/workflows/stoa · Graph Query.json` |
| stoa · RAG Chain   | `.n8n/workflows/stoa · RAG Chain.json`   |
| stoa · Agent RAG   | `.n8n/workflows/stoa · Agent RAG.json`   |

These files and the schema snapshot are git-ignored local configuration. Each JSON file can be imported separately into n8n. To reset the examples to the initial generated templates explicitly:

```sh
node dev/n8n/seed-workflows.mjs stoa .n8n/stoa-schema.yaml .n8n/stoa-retrieval-guidance.yaml
```

The seed script writes `graph-query.json`, `rag-chain.json`, and `agent-rag.json` into `.n8n/workflows/`. These template files are separate from the downloaded exports listed above. It overwrites the live workflows with IDs `local-graph-query`, `local-graph-retriever`, and `local-graph-tool`, replacing any edits made in n8n. It does not run them or change graph data. The database credential is provisioned separately; exports include credential references, not their passwords or API keys.

```sh
npm run dev:docker:logs
npm run dev:docker:stop
```

Stopping with `dev:docker:stop` preserves the volume. Do not use `down -v` unless you intend to delete this development instance's stored workflows and credentials.

## Dependency policy and compatibility

Prefer the latest stable dependency release, then verify it against n8n. Versions checked on 2026-10-09:

| Dependency            | Version | Selection                                                                            |
| --------------------- | ------- | ------------------------------------------------------------------------------------ |
| FalkorDB client       | 6.8.0   | Latest stable                                                                        |
| LangChain core        | 1.2.17  | Latest stable                                                                        |
| n8n node CLI          | 0.51.4  | npm `latest` channel                                                                 |
| Vitest                | 5.0.3   | Latest stable                                                                        |
| Vitest V8 coverage    | 5.0.3   | Latest stable; exact match to Vitest                                                 |
| Prettier              | 3.9.9   | Latest stable                                                                        |
| TypeScript            | 6.0.3   | TypeScript 7.0.2 breaks n8n's parser: missing compiler API `Intrinsic`               |
| ESLint                | 9.39.5  | ESLint 10.12.0 breaks n8n's rules: removed `context.getFilename`                     |
| Zod                   | 3.25.76 | Exact peer requirement of `n8n-workflow`                                             |
| n8n workflow API      | 2.42.3  | Exact API dependency of stable n8n 2.42.6; npm's `latest` tag points to older 2.16.0 |
| Node type definitions | 24.19.1 | Latest stable on the supported Node 24 runtime line                                  |

The release audit on 2026-10-09 reported zero findings with `npm audit --omit=dev`. The full `npm audit` reported 24 findings (3 low, 6 moderate, 14 high, and 1 critical), all on entries marked as development dependencies in the lockfile. The critical finding affects Handlebars 4.7.9, pinned by `@n8n/node-cli` for template generation; npm reports no available fix through that CLI version. These development-dependency findings remain unresolved. The omitted tree also includes the development copy of the `n8n-workflow` peer dependency, so the zero-finding result does not assess the host n8n installation's dependencies.

## Artwork

The original [node icon](../nodes/FalkorDb/graph-query.png) was generated with OpenAI's built-in image-generation tool. The [generation prompt](../nodes/FalkorDb/graph-query.prompt.txt) records the design brief and exclusions. No FalkorDB logo or vendor artwork is used.

## Release checks and publication

Version `2.0.0` is the first stable release of the replacement package. It registers one node with Query, Retriever for Chain, and Tool for AI Agent modes. Existing 1.x memory workflows require rebuilding; workflows using the `2.0.0-dev.0` query node retain their configuration.

Version `2.1.0` adds execution records for directly invoked agent tools and exposes tool inputs through n8n's fixed-value, expression, and From AI controls. Existing 2.0.0 tool workflows retain agent-supplied questions by default.

Validate the release from a clean checkout with Node.js 24 and Docker:

```sh
npm ci
npm run check
(
  set -e
  trap 'docker compose -f compose.test.yaml down' EXIT
  docker compose -f compose.test.yaml up -d --wait
  npm run test:integration
  npm run test:n8n
)
npm pack --dry-run
npm publish --access public --tag latest --dry-run
```

Only the compiled query implementation, credential, and original icon are distributed, alongside the package manifest, README, and MIT license. The smoke test checks the exact archive file list to prevent retired nodes or development artifacts from returning. The publication preview runs `prepublishOnly`, including the full coverage gate, without uploading a package.

After the release commit is pushed and both GitHub CI jobs pass, publish separately from the repository root:

```sh
npm login --registry=https://registry.npmjs.org/
npm publish --access public --tag latest
npm view @lrtherond/n8n-nodes-falkordb@latest version
```

`publishConfig` sets the public npm registry, public access, and the `latest` tag. Publishing updates `latest` to the version in `package.json`. Installing a prerelease through `next` does not make n8n's subsequent updates follow that tag; keep stable releases on `latest`. Every publication requires a new package version. Committing, pushing, and running CI do not publish to npm.
