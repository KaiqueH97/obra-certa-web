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
vm.runInNewContext(outputText, { exports, AbortController });
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
    dismiss(id) { notices.push({ type: "dismiss", id }); },
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
  ["contrato sem error", { data: { id: 1 } }],
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

test("desmontagem encerra espera local e dispensa toast sem aguardar servidor", { timeout: 1000 }, async () => {
  const f = fixture();
  const response = deferred();
  const task = f.runner.run(f.options(() => response.promise));
  f.runner.deactivate();
  assert.equal(await task, null);
  response.resolve({ data: { id: 1 }, error: null });
  await Promise.resolve();
  assert.equal(f.confirmed.length, 0);
  assert.equal(f.pending.length, 1);
  assert.equal(f.notices.at(-1).type, "dismiss");
  assert.equal(f.notices.at(-1).id, f.notices[0].id);
  let called = false;
  await f.runner.run(f.options(() => { called = true; }));
  assert.equal(called, false);
});

test("erro tardio após sair não cria aviso na tela seguinte", async () => {
  const f = fixture(), response = deferred();
  const task = f.runner.run(f.options(() => response.promise));
  f.runner.deactivate();
  await task;
  response.reject(new Error("offline"));
  await Promise.resolve();
  assert.deepEqual(f.notices.map(n => n.type), ["loading", "dismiss"]);
});

test("reativação não permite que resposta anterior limpe a trava da nova operação", async () => {
  const f = fixture(), old = deferred(), next = deferred();
  const first = f.runner.run(f.options(() => old.promise));
  f.runner.deactivate();
  f.runner.activate();
  const second = f.runner.run(f.options(() => next.promise));
  await first;
  old.resolve({ data: { id: "antigo" }, error: null });
  await Promise.resolve();
  assert.deepEqual(f.pending.at(-1), ["material-1"]);
  assert.equal(f.confirmed.length, 0);
  let duplicated = false;
  await f.runner.run(f.options(() => { duplicated = true; }));
  assert.equal(duplicated, false);
  next.resolve({ data: { id: "novo" }, error: null });
  await second;
  assert.deepEqual(f.confirmed.map(row => row.id), ["novo"]);
  assert.deepEqual(f.pending.at(-1), []);
  assert.deepEqual(f.notices.map(n => n.type), ["loading", "dismiss", "loading", "success"]);
});

test("cleanup sinaliza cancelamento e não deixa validação atrasada iniciar gravação", async () => {
  const f = fixture(), auth = deferred();
  let sent = false, receivedSignal;
  const task = f.runner.run(f.options(async signal => {
    receivedSignal = signal;
    await auth.promise;
    signal.throwIfAborted();
    sent = true;
    return { data: { id: 1 }, error: null };
  }));
  f.runner.deactivate();
  await task;
  assert.equal(receivedSignal.aborted, true);
  auth.resolve();
  await Promise.resolve();
  assert.equal(sent, false);
});

test("sair encerra todas as esperas e dispensa apenas os avisos da instância", async () => {
  const f = fixture(), other = fixture();
  const a = f.runner.run(f.options(() => new Promise(() => {}), "a"));
  const b = f.runner.run(f.options(() => new Promise(() => {}), "b"));
  await other.runner.run(other.options(async () => ({ data: { id: 3 }, error: null })));
  f.runner.deactivate();
  assert.deepEqual(await Promise.all([a, b]), [null, null]);
  assert.equal(f.notices.filter(n => n.type === "dismiss").length, 2);
  assert.deepEqual(other.notices.map(n => n.type), ["loading", "success"]);
  const count = f.notices.length;
  f.runner.deactivate();
  assert.equal(f.notices.length, count);
});

test("avisos de resultado da própria tela também são dispensados ao sair", async () => {
  const f = fixture();
  await f.runner.run(f.options(async () => ({ data: { id: 1 }, error: null })));
  f.runner.deactivate();
  assert.deepEqual(f.notices.map(n => n.type), ["loading", "success", "dismiss"]);
  assert.equal(f.notices[2].id, f.notices[0].id);
});

test("restaura campo após sucesso ou erro somente enquanto a operação pertence à tela", async () => {
  for (const response of [{ data: { id: 1 }, error: null }, { data: null, error: { message: "failed" } }]) {
    const f = fixture();
    let restored = 0;
    await f.runner.run({ ...f.options(async () => response), onSettled: () => { restored++; } });
    assert.equal(restored, 1);
  }
  const f = fixture(), delayed = deferred();
  let restored = 0;
  const task = f.runner.run({ ...f.options(() => delayed.promise), onSettled: () => { restored++; } });
  f.runner.deactivate();
  f.runner.activate();
  await task;
  delayed.resolve({ data: { id: 1 }, error: null });
  await Promise.resolve();
  assert.equal(restored, 0);
});
