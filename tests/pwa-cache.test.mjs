import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);

function readPwaConfig() {
  let pwa;
  const exports = {};
  const source = readFileSync(new URL("next.config.ts", root), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });

  vm.runInNewContext(outputText, {
    exports,
    process: { env: { NODE_ENV: "production" } },
    require(name) {
      assert.equal(name, "@ducanh2912/next-pwa");
      return {
        default: (options) => {
          pwa = options;
          return (config) => config;
        },
      };
    },
  });

  return { pwa, next: exports.default };
}

test("requisições privadas e páginas nunca usam cache de runtime", () => {
  const { pwa } = readPwaConfig();
  assert.equal(pwa.disable, false);
  assert.equal(pwa.cacheStartUrl, false);
  assert.equal(pwa.dynamicStartUrl, false);
  assert.equal(pwa.cacheOnFrontEndNav, false);
  assert.equal(pwa.extendDefaultRuntimeCaching, false);

  const paths = [
    "https://supabase.example/auth/v1/user",
    "https://supabase.example/rest/v1/funcionarios?select=*",
    "https://supabase.example/rest/v1/financeiro_obra?projeto_id=eq.1",
    "https://app.example/",
    "https://app.example/login",
    "https://app.example/projetos/1",
    "https://app.example/projetos/1?_rsc=abc",
    "https://app.example/api/relatorio.json",
  ];

  for (const url of paths) {
    const route = pwa.workboxOptions.runtimeCaching.find((entry) =>
      entry.urlPattern.test(url),
    );
    assert.ok(route, url);
    assert.equal(route.handler, "NetworkOnly", url);
    assert.equal(route.options.fetchOptions.cache, "no-store", url);
  }
});

test("o navegador deve revalidar o service worker para receber a correção", async () => {
  const { next } = readPwaConfig();
  const rules = await next.headers();
  const worker = rules.find((rule) => rule.source === "/sw.js");
  assert.ok(worker);
  assert.match(
    worker.headers.find((header) => header.key === "Cache-Control").value,
    /no-store/,
  );
});

test("a ativação remove dados legados sem apagar o precache público", async () => {
  const privateCaches = [
    "cross-origin", "pages", "pages-rsc", "pages-rsc-prefetch",
    "apis", "start-url", "next-data", "static-data-assets",
  ];
  const preserved = ["workbox-precache-v2-public", "outra-aplicacao"];
  const stored = new Set([...privateCaches, ...preserved]);
  let activate;

  vm.runInNewContext(readFileSync(new URL("worker/index.js", root), "utf8"), {
    self: {
      addEventListener(event, listener) {
        assert.equal(event, "activate");
        activate = listener;
      },
    },
    caches: {
      keys: async () => [...stored],
      delete: async (name) => stored.delete(name),
    },
  });

  assert.equal(typeof activate, "function");
  async function runActivation() {
    let completion;
    activate({ waitUntil(promise) { completion = promise; } });
    assert.ok(completion, "a migração deve fazer parte da ativação");
    await completion;
  }

  await runActivation();
  assert.deepEqual([...stored], preserved);
  await runActivation();
  assert.deepEqual([...stored], preserved, "a migração deve ser idempotente");
});
