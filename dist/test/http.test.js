import test from "node:test";
import assert from "node:assert/strict";
import { boundedText } from "../providers/http.js";
import { fetchOfficialLifecyclePage } from "../providers/live-page.js";
import { fetchOpenAILifecycle } from "../providers/openai.js";
test("bounded source reader rejects declared and streamed overflow", async () => {
    await assert.rejects(boundedText(new Response("abc", { headers: { "content-length": "100" } }), 4), /limit/);
    await assert.rejects(boundedText(new Response("abcde"), 4), /limit/);
    assert.equal(await boundedText(new Response("abc"), 4), "abc");
});
test("OpenAI malformed inventory fails closed and null dates are not inferred", async () => {
    const original = globalThis.fetch;
    try {
        for (const data of [[], [{ id: "a", shutdown_date: "2026-02-30" }], [{ id: "a" }, { id: "a" }]]) {
            globalThis.fetch = async () => new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } });
            await assert.rejects(fetchOpenAILifecycle("fixture-key"));
        }
        globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ id: "a", shutdown_date: null }] }), { headers: { "content-type": "application/json" } });
        assert.equal((await fetchOpenAILifecycle("fixture-key")).models.length, 0);
    }
    finally {
        globalThis.fetch = original;
    }
});
test("official fetch refuses external redirect before contacting it", async () => {
    const original = globalThis.fetch;
    let calls = 0;
    try {
        globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: "https://example.com/login" } }); };
        await assert.rejects(fetchOfficialLifecyclePage("google"), /not approved/);
        assert.equal(calls, 1);
    }
    finally {
        globalThis.fetch = original;
    }
});
for (const scenario of ["http", "content-type", "empty", "oversize", "timeout", "loop"]) {
    test(`official fetch fails closed: ${scenario}`, async () => {
        const original = globalThis.fetch;
        try {
            globalThis.fetch = async () => {
                if (scenario === "timeout")
                    throw new DOMException("fixture timeout", "TimeoutError");
                if (scenario === "http")
                    return new Response("unavailable", { status: 503 });
                if (scenario === "loop")
                    return new Response(null, { status: 302, headers: { location: "/loop" } });
                return new Response(scenario === "empty" ? "" : "<table></table>", { headers: { "content-type": scenario === "content-type" ? "application/json" : "text/html", ...(scenario === "oversize" ? { "content-length": "12000001" } : {}) } });
            };
            await assert.rejects(fetchOfficialLifecyclePage("google"));
        }
        finally {
            globalThis.fetch = original;
        }
    });
}
test("OpenAI rejects unexpected pagination instead of importing an incomplete inventory", async () => {
    const original = globalThis.fetch;
    try {
        globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ id: "gpt-fixture", shutdown_date: "2027-01-01" }], has_more: true }), { headers: { "content-type": "application/json" } });
        await assert.rejects(fetchOpenAILifecycle("fixture-key"), /paginated/);
        globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ id: " ", shutdown_date: "2027-01-01" }] }), { headers: { "content-type": "application/json" } });
        await assert.rejects(fetchOpenAILifecycle("fixture-key"), /model ID/);
    }
    finally {
        globalThis.fetch = original;
    }
});
//# sourceMappingURL=http.test.js.map