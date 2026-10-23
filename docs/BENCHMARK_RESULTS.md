# Recorded real-repository scan results

Recorded on 2026-10-24. These are static inventories from actual executions at fixed commits. They reuse recorded runs across implementation versions; this table is not a fresh full-corpus rescan or an accuracy evaluation. Private logs and full candidate inventories remain in the local delivery ZIP.

Of 20 acquisition attempts, 13 complete checkouts have scan evidence: 11 with the default scope and 2 with explicit exclusions below. The other 7 acquisition failures remain recorded in the local audit. No target repository code or dependencies were installed or executed.

| Repository | Fixed commit | Candidates | Scan scope |
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

Explicit exclusions, retained in the original manifests, reports and resume checks:

- `vercel/ai`: `packages/google/src/interactions/__fixtures__/image-output-modify.json`
- `vercel/ai`: `packages/google/src/interactions/__fixtures__/image-output.json`
- `langfuse/langfuse`: `web/src/__tests__/json-utils.clienttest.ts`

These three test fixtures exceed the 1,000,000-character single-line limit. Their exclusion does not validate their contents. Default scope also retains the scanner's documented file-type and ignored-directory boundaries.

Human-reviewed gold records: **0**. Real TP, FP, FN, precision, recall and F1: **N/A**. Candidate counts include reviewable references and are not automatically true positives. The separate constructed benchmark (36 cases; TP 25, FP 0, FN 0) measures only its synthetic fixtures.

License file excerpts and default branches were collected in the local reports. License suitability, independent searches for missed references, gold labeling and actual application evals still require review. In particular, repositories can have multiple license regions; a top-level LICENSE alone does not approve redistribution of their contents. No cloned source is redistributed here.

See the [annotation and scoring protocol](../data/real-repo-benchmark/README.md) and [validation status](VALIDATION.md).
