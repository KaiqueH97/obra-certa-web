import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
const { outputText } = ts.transpileModule(
  readFileSync(new URL("../lib/confirmed-mutation.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
);
vm.runInNewContext(outputText, { exports });
const { createMutationRunner, MutationError, UNCONFIRMED_MESSAGE } = exports;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fixture() {
  const notices = [];
  const pending = [];
  const confirmed = [];
  const runner = createMutationRunner({
    loading(message) {
      const id = `toast-${notices.length}`;
      notices.push({ type: "loading", message, id });
      return id;
    },
    success(message, id) { notices.push({ type: "success", message, id }); },
    error(message, id) { notices.push({ type: "error", message, id }); },
  }, (keys) => pending.push([...keys]));
  const options = (request, key = "material-1") => ({
    key, request, loading: "Salvando...", success: "Salvo!",
    onConfirmed: (record) => confirmed.push(record),
  });
  return { runner, notices, pending, confirmed, options };
}

test("o registro e o total só mudam após a confirmação, usando o valor do banco", async () => {
  const f = fixture();
  const response = deferred();
  let total = 50;
  const task = f.runner.run({
    ...f.options(() => response.promise),
    onConfirmed: (record) => { total = record.preco_total; },
  });
  assert.equal(total, 50);
  assert.deepEqual(f.notices.map(n => n.type), ["loading"]);
  assert.deepEqual(f.pending.at(-1), ["material-1"]);
  const saved = { id: 1, preco_total: 125.55 };
  response.resolve({ data: saved, error: null });
  assert.equal(await task, saved);
  assert.equal(total, 125.55);
  assert.deepEqual(f.pending.at(-1), []);
  assert.equal(f.notices[0].id, f.notices[1].id);
  assert.equal(f.notices[1].type, "success");
});

const failures = [
  ["erro de RLS", { data: null, error: { code: "42501", message: "denied" } }],
  ["nenhuma linha afetada", { data: null, error: { code: "PGRST116", message: "0 rows" } }],
  ["resposta nula sem erro", { data: null, error: null }],
  ["array vazio", { data: [], error: null }],
  ["array inesperado", { data: [{ id: 1 }], error: null }],
  ["registro sem ID", { data: { preco_total: 10 }, error: null }],
  ["ID nulo", { data: { id: null }, error: null }],
  ["ID inválido", { data: { id: NaN }, error: null }],
  ["ID vazio", { data: { id: "" }, error: null }],
  ["dados acompanhados de erro", { data: { id: 1 }, error: { message: "failed" } }],
];

for (const [name, response] of failures) {
  test(`${name}: mantém registro/formulário e encerra carregamento sem sucesso`, async () => {
    const f = fixture();
    const rows = [{ id: 1, valor: 150 }];
    let form = "Valor digitado";
    const result = await f.runner.run({
      ...f.options(async () => response),
      onConfirmed: () => { rows.pop(); form = ""; },
    });
    assert.equal(result, null);
    assert.equal(rows.length, 1);
    assert.equal(form, "Valor digitado");
    assert.deepEqual(f.pending.at(-1), []);
    assert.deepEqual(f.notices.map(n => n.type), ["loading", "error"]);
    assert.equal(f.notices[0].id, f.notices[1].id);
  });
}

test("falha de rede encerra o toast e não repete a gravação automaticamente", async () => {
  const f = fixture();
  let calls = 0;
  await f.runner.run(f.options(async () => { calls++; throw new TypeError("Failed to fetch"); }));
  assert.equal(calls, 1);
  assert.equal(f.confirmed.length, 0);
  assert.equal(f.notices.at(-1).message, UNCONFIRMED_MESSAGE);
  assert.deepEqual(f.pending.at(-1), []);
});

test("sessão ausente antes da gravação resolve o carregamento com mensagem explícita", async () => {
  const f = fixture();
  await f.runner.run(f.options(() => { throw new MutationError("Entre novamente."); }));
  assert.equal(f.notices.at(-1).message, "Entre novamente.");
  assert.deepEqual(f.pending.at(-1), []);
  assert.equal(f.confirmed.length, 0);
});

test("dois cliques no mesmo registro enviam uma única requisição", async () => {
  const f = fixture();
  const response = deferred();
  let calls = 0;
  const options = f.options(() => { calls++; return response.promise; });
  const first = f.runner.run(options);
  assert.equal(await f.runner.run(options), null);
  assert.equal(calls, 1);
  response.resolve({ data: { id: 1 }, error: null });
  await first;
  assert.equal(f.confirmed.length, 1);
  assert.equal(f.notices.length, 2);
});

test("a falha libera a trava para uma tentativa posterior", async () => {
  const f = fixture();
  await f.runner.run(f.options(async () => ({ data: null, error: { message: "failed" } })));
  await f.runner.run(f.options(async () => ({ data: { id: 1 }, error: null })));
  assert.equal(f.confirmed.length, 1);
  assert.deepEqual(f.pending.at(-1), []);
});

test("gravações de registros distintos mantêm travas independentes", async () => {
  const f = fixture();
  const a = deferred();
  const b = deferred();
  const first = f.runner.run(f.options(() => a.promise, "material-1"));
  const second = f.runner.run(f.options(() => b.promise, "transacao-2"));
  assert.deepEqual(f.pending.at(-1), ["material-1", "transacao-2"]);
  b.resolve({ data: { id: 2 }, error: null });
  await second;
  assert.deepEqual(f.pending.at(-1), ["material-1"]);
  a.resolve({ data: { id: 1 }, error: null });
  await first;
  assert.deepEqual(f.pending.at(-1), []);
  assert.deepEqual(f.confirmed.map(r => r.id), [2, 1]);
});

test("resposta após desmontar a tela não altera seu estado e resolve o toast", async () => {
  const f = fixture();
  const response = deferred();
  const task = f.runner.run(f.options(() => response.promise));
  f.runner.deactivate();
  response.resolve({ data: { id: 1 }, error: null });
  await task;
  assert.equal(f.confirmed.length, 0);
  assert.equal(f.pending.length, 1);
  assert.equal(f.notices.at(-1).type, "success");
  let called = false;
  await f.runner.run(f.options(() => { called = true; }));
  assert.equal(called, false);
});
