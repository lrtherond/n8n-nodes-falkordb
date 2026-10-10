# n8n-nodes-falkordb

Version 2.1.1 of `@lrtherond/n8n-nodes-falkordb`: schema-guided graph querying and RAG for self-hosted n8n.

This is an independent community project. It is not affiliated with, endorsed by, or authorized by the makers of FalkorDB. The database name identifies compatibility; the node uses original artwork.

**FalkorDB Graph Query** takes your graph schema and a natural-language question, asks a connected Chat Model to generate Cypher, and submits it to FalkorDB for read-only execution. It supports arbitrary graph schemas; labels, properties, relationships, and retrieval strategies come from your inputs.

Version 2 is a complete replacement for the published 1.x package. It provides the new schema-driven query, retriever, and agent-tool modes. The previous conversation-memory and graph-enrichment node is not included; workflows using that node must be rebuilt. There is no legacy compatibility layer or automatic migration.

## Installation and upgrades

On a compatible self-hosted n8n instance, sign in as an owner or administrator:

1. Open **Settings → Community Nodes → Install**.
2. Enter `@lrtherond/n8n-nodes-falkordb@2.1.1` to install this release explicitly.
3. Review the installation confirmation and select **Install**.

The package installs **one node type, FalkorDB Graph Query, with three modes**: Query, Retriever for Chain, and Tool for AI Agent. Seeing “1 node” in the package list is expected. Add separate instances to your workflows and choose the mode each instance needs.

Stable releases use npm's `latest` tag. Entering `@lrtherond/n8n-nodes-falkordb` without a version installs that release channel. See [n8n's community-node installation and update instructions](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/).

Workflows created with `2.0.0-dev.0` or `2.0.0` retain their configuration in 2.1.1. Existing tool workflows default the new **Question** field to **From AI**. The breaking change from 1.x described above still applies to older workflows.

## Query an existing graph

You need an existing FalkorDB graph, its schema, database credentials, and a Chat Model configured in n8n. Embeddings are optional.

1. Add **FalkorDB Graph Query** and choose a **Mode**.
2. Configure **FalkorDB API** credentials with the database hostname and port as reachable from n8n. The usual database port is `6379`; the Browser HTTP endpoint is not a database connection.
3. Enter the existing **Graph Name** and your **Schema**. Both are required. The schema is a multiline string supporting n8n expressions, such as `{{ $json.schema }}`. It is sent to the connected model on every question and is never executed as DDL.
4. Optionally enter **Retrieval Guidance** for search strategies, ranking rules, fields to return, and example queries. This separate multiline field also supports expressions, such as `{{ $json.retrievalGuidance }}`.
5. Connect a **Chat Model** to FalkorDB Graph Query. Choose a model capable of following JSON-output instructions and generating Cypher.
6. Connect the selected mode as shown below.

| Mode                | Connection and behavior                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Query               | Main input/output. Reads **Question** for each input item; returns the generated query and database rows.        |
| Retriever for Chain | Connect to a **Question and Answer Chain → Retriever**. The chain provides the question and receives documents.  |
| Tool for AI Agent   | Connect to an **AI Agent → Tool**. Set **Tool Description** so the agent knows when to ask the graph a question. |

The chain or agent also needs its own Chat Model connection. You can use the same model node for both connections. In retriever and tool modes, schema and other expressions resolve from the **first input item**, following n8n sub-node behavior. Query mode resolves them independently for every input item.

### Describe your schema

Keep the graph definition in **Schema**: labels, property names and types, relationship directions, available indexes, and what each element means. Plain text, YAML, or a JSON string are suitable; the node passes the definition to the model as text without requiring a particular schema format.

For example, a project graph could use:

```text
Employee {name: STRING} — a person working on projects.
Project {title: STRING, citation: STRING} — title and source reference.
(Employee)-[:WORKS_ON]->(Project)
```

In **Retrieval Guidance**, enter `Use Employee.name to find a person. Return Project.title and Project.citation.` Then ask **Which projects does Alice work on?** The graph need not contain documents or embeddings. Guidance is optional and is sent to query generation separately from the schema in all three modes.

For a document graph with a full-text index, put search terms, ranking semantics, and working query examples in **Retrieval Guidance**, such as `db.idx.fulltext.queryNodes` with `ORDER BY score DESC`. The node preserves database result order; relevance ranking requires a supported search method described in the supplied schema or guidance. It does not invent scores or generate embeddings.

The workflow author maintains the schema and any retrieval guidance. Automatic schema discovery, document ingestion, vector embedding generation, and automatic query repair are outside this version.

### Results and execution boundaries

Query mode returns one item per question, including an empty `rows` array when nothing matches:

```json
{
	"cypher": "MATCH (e:Employee {name: $name})-[:WORKS_ON]->(p:Project) RETURN p.title AS text, p.citation AS citation LIMIT $limit",
	"parameters": { "name": "Alice", "limit": 10 },
	"rows": [{ "text": "Apollo", "citation": "P1" }],
	"truncated": false
}
```

Tool mode gives the agent the same structure as JSON, wrapped in n8n's output-item array when executed by the current Agent. Retriever mode creates one LangChain document per row, preserving the whole row in both JSON page content and metadata so citations remain available to a chain. FalkorDB Graph Query returns evidence; the downstream chain or agent produces the prose answer.

For complete quotations, tell the answering chain or agent to quote each selected passage's entire returned text verbatim, preserving words, punctuation, and paragraphs. Require source citations and prohibit summaries or inserted ellipses. This instruction belongs in the chain's system prompt or agent's system message; **Retrieval Guidance** controls query generation. Verify quotations against the retrieved rows, since model-generated answers can still alter text. Query mode returns the database rows directly.

Each retriever or tool invocation records its input, generated Cypher, parameters, and returned rows in n8n's execution log. Failures are recorded on the node and propagated to the calling chain or agent.

In Tool for AI Agent mode, **Question** defaults to **From AI**: the agent supplies a `question` argument on each call and can reformulate your request or make successive searches. Switch the field to a fixed value or an expression referencing a previous node to control the question yourself. Other query settings also support From AI. The tool's argument schema follows the parameters marked From AI; fixed values and ordinary expressions are resolved by n8n. Existing tool workflows continue to receive their question from the agent.

Generated JSON and parameter names are validated before execution. All FalkorDB Graph Query database queries use `GRAPH.RO_QUERY`, including the initial access check; no graph or index is created. FalkorDB enforces the read-only boundary. Invalid model output, unsupported Cypher, missing graphs, timeouts, and model-reported unanswerable questions fail with an error. Query mode honors n8n's continue-on-fail setting.

**Limit** defaults to 10 rows (maximum 1,000). The model is instructed to include a corresponding `LIMIT`, and the node caps the returned rows independently. `truncated` indicates this local cap, not whether more matches exist in the graph. A **Query Timeout** defaults to 10,000 ms (maximum 60,000 ms) and applies to each database query. The output cap does not bound database work, response bytes, or model runtime; large aggregate values still occupy one row. Read-only queries can still be expensive or semantically wrong, so evaluate your model against representative questions and keep the schema accurate.

Credentials support an optional ACL username/password and TLS with certificate verification. FalkorDB Graph Query needs `INFO` and `GRAPH.RO_QUERY`; the credential test additionally calls `GRAPH.LIST`. Use a database account appropriate to the graphs the workflow should access.

## Compatibility

Version 2.1.1 is tested with n8n 2.42.6 and FalkorDB server 6.0.2, with isolated test graphs. Earlier 2.0.0 validation also covered FalkorDB server 4.20.7. The packaged n8n smoke test uses server 6.0.2. The package requires `n8n-workflow >=2.42.3 <3`. Compatibility with older n8n releases is not claimed.

This package targets self-hosted n8n. n8n Cloud support is not established. Node.js 24 or newer is required.

## References

- [FalkorDB TypeScript client](https://github.com/FalkorDB/falkordb-ts)
- [FalkorDB 6.0.2 release](https://github.com/FalkorDB/FalkorDB/releases/tag/v6.0.2)

## License

Licensed under the [MIT License](LICENSE).
