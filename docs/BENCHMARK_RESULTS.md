# Recorded real-repository scan results

Recorded on 2026-10-24. These inventories come from actual static executions at fixed commits across recorded implementation versions. Previous successful repositories were not rescanned. This is not a uniform fresh full-corpus accuracy evaluation.

**20 repositories have scan evidence:** 14 full checkouts (12 default scan scopes and 2 with explicit fixture exclusions) plus 6 explicitly sparse checkouts. The six historical full-acquisition resource failures remain recorded. Sparse successes validate only the listed directories and Git cone-mode root/ancestor files, within the unchanged 250 MB / 50,000-entry budgets. No target dependencies or repository code were installed or executed.

| Repository | Fixed commit | Candidates | Scope |
| --- | --- | ---: | --- |
| [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | [0dc4cf152bff1f50bdc0e41f28808563406545b2](https://github.com/openai/openai-agents-python/tree/0dc4cf152bff1f50bdc0e41f28808563406545b2) | 1350 | default |
| [openai/openai-python](https://github.com/openai/openai-python) | [81792ff040a2ca2b70348163049d3d69d5ba95cf](https://github.com/openai/openai-python/tree/81792ff040a2ca2b70348163049d3d69d5ba95cf) | 1180 | default |
| [anthropics/anthropic-sdk-python](https://github.com/anthropics/anthropic-sdk-python) | [9313f13a5a643ceed10fafba6785eab8e04b6e6e](https://github.com/anthropics/anthropic-sdk-python/tree/9313f13a5a643ceed10fafba6785eab8e04b6e6e) | 853 | default |
| [googleapis/python-genai](https://github.com/googleapis/python-genai) | [92f72b3a236a5bc56e8e3327ab9563f77dd119c3](https://github.com/googleapis/python-genai/tree/92f72b3a236a5bc56e8e3327ab9563f77dd119c3) | 886 | default |
| [langchain-ai/langchain](https://github.com/langchain-ai/langchain) | [adf1e687d87fd565ec2115888edc1f21d1c95d09](https://github.com/langchain-ai/langchain/tree/adf1e687d87fd565ec2115888edc1f21d1c95d09) | 1593 | default |
| [huggingface/smolagents](https://github.com/huggingface/smolagents) | [96f33faaf028479119ec8d34507b47694cf14e34](https://github.com/huggingface/smolagents/tree/96f33faaf028479119ec8d34507b47694cf14e34) | 147 | default |
| [microsoft/autogen](https://github.com/microsoft/autogen) | [004749e6b7102c8fd317b9b1499ce5807223c278](https://github.com/microsoft/autogen/tree/004749e6b7102c8fd317b9b1499ce5807223c278) | 518 | default |
| [browser-use/browser-use](https://github.com/browser-use/browser-use) | [3df5806a0d097a1546d92c49bcf1b28c9972c3bd](https://github.com/browser-use/browser-use/tree/3df5806a0d097a1546d92c49bcf1b28c9972c3bd) | 600 | default |
| [instructor-ai/instructor](https://github.com/instructor-ai/instructor) | [6cd771c5254a69f6a6cf9cdf357fb2f9523f0b85](https://github.com/instructor-ai/instructor/tree/6cd771c5254a69f6a6cf9cdf357fb2f9523f0b85) | 940 | default |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | [9d68e5b3eb1a63027b05e9f0152149ea0284dcdb](https://github.com/langchain-ai/langgraph/tree/9d68e5b3eb1a63027b05e9f0152149ea0284dcdb) | 87 | default |
| [agno-agi/agno](https://github.com/agno-agi/agno) | [44fb447c61e5f302897c065fe3865971d05c6e2a](https://github.com/agno-agi/agno/tree/44fb447c61e5f302897c065fe3865971d05c6e2a) | 1902 | default |
| [vercel/ai](https://github.com/vercel/ai) | [e623e8c88b55066dde769614a16ae51d424974aa](https://github.com/vercel/ai/tree/e623e8c88b55066dde769614a16ae51d424974aa) | 5691 | explicit-exclusions |
| [langfuse/langfuse](https://github.com/langfuse/langfuse) | [c83198b03f6b63e7d57c0daf016bb4d3ab052913](https://github.com/langfuse/langfuse/tree/c83198b03f6b63e7d57c0daf016bb4d3ab052913) | 2023 | explicit-exclusions |
| [microsoft/semantic-kernel](https://github.com/microsoft/semantic-kernel) | [483ffb487a33a1644886992d56599feae3b69b76](https://github.com/microsoft/semantic-kernel/tree/483ffb487a33a1644886992d56599feae3b69b76) | 858 | default |
| [BerriAI/litellm](https://github.com/BerriAI/litellm) | [428c9f6bf38730518d8ff13273a8d88445f2becc](https://github.com/BerriAI/litellm/tree/428c9f6bf38730518d8ff13273a8d88445f2becc) | 9771 | sparse-checkout |
| [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai) | [120891d166555a20060650b9e0e699a530808b0d](https://github.com/pydantic/pydantic-ai/tree/120891d166555a20060650b9e0e699a530808b0d) | 123 | sparse-checkout |
| [run-llama/llama_index](https://github.com/run-llama/llama_index) | [619d74664e8404612038bc15a1a40c686037277c](https://github.com/run-llama/llama_index/tree/619d74664e8404612038bc15a1a40c686037277c) | 183 | sparse-checkout |
| [continuedev/continue](https://github.com/continuedev/continue) | [5522c6f44ca0ac3528b37244818fbfa39b5af470](https://github.com/continuedev/continue/tree/5522c6f44ca0ac3528b37244818fbfa39b5af470) | 226 | sparse-checkout |
| [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | [07361f6dc5f96d22efe565ff89297d22bce4a90f](https://github.com/crewAIInc/crewAI/tree/07361f6dc5f96d22efe565ff89297d22bce4a90f) | 4641 | sparse-checkout |
| [mastra-ai/mastra](https://github.com/mastra-ai/mastra) | [308ca4d3fd58aadaa5121466622cd35df86f3a2c](https://github.com/mastra-ai/mastra/tree/308ca4d3fd58aadaa5121466622cd35df86f3a2c) | 1620 | sparse-checkout |

Explicit exclusions for the two full checkouts:

- `vercel/ai`: `packages/google/src/interactions/__fixtures__/image-output-modify.json`
- `vercel/ai`: `packages/google/src/interactions/__fixtures__/image-output.json`
- `langfuse/langfuse`: `web/src/__tests__/json-utils.clienttest.ts`

These three fixtures exceed the scanner's 1,000,000-character single-line limit; excluded contents are not validated.

Sparse checkout directories (also pinned in [scoped-budget-repos.json](../data/real-repo-benchmark/scoped-budget-repos.json)):

- `BerriAI/litellm`: `litellm/llms`
- `pydantic/pydantic-ai`: `pydantic_ai_slim/pydantic_ai/models`, `pydantic_ai_slim/pydantic_ai/providers`
- `run-llama/llama_index`: `llama-index-core/llama_index/core`
- `continuedev/continue`: `core/llm`
- `crewAIInc/crewAI`: `lib/crewai/src/crewai`
- `mastra-ai/mastra`: `packages/core/src/llm`, `packages/core/src/agent`

**35,192 candidates; 0 human-reviewed gold records.** Real TP/FP/FN, precision, recall and F1 remain **N/A**. Candidate counts are review queues, not true positives. The 36-case constructed benchmark is a separate fixture regression test.

The delivered local review pack contains candidates.csv, licenses.csv, review-template.json and review-progress.json. Reviewer/decision fields are empty; reviewed:false and the incomplete missed-reference search flags remain explicit. It can be regenerated from recorded reports using scripts/prepare-benchmark-review.mjs. CSV formula prefixes are escaped for display while JSON preserves exact model identities.

License files, hashes and default branches were collected. GitHub classified litellm/mastra license metadata as NOASSERTION; this does not establish absence of a license. License suitability, independent missed-reference search and complete-scope human labeling remain review tasks. No cloned source is redistributed in the public repository.

See the [annotation protocol](../data/real-repo-benchmark/README.md) and [validation status](VALIDATION.md).
