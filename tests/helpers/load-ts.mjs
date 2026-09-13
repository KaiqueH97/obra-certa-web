import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

export function loadTs(url, dependencies = {}) {
  const exports = {}
  const { outputText } = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  })
  vm.runInNewContext(outputText, {
    exports, AbortController, setTimeout, clearTimeout,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Dependência de teste ausente: ${name}`)
      return dependencies[name]
    },
    get window() { return globalThis.window },
    get document() { return globalThis.document },
  })
  return exports
}
