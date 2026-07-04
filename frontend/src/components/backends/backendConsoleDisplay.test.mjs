import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const source = resolve(__dirname, 'backendConsoleDisplay.ts')

async function loadModule() {
  const transpiled = ts.transpileModule(readFileSync(source, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`)
}

test('matches focus model patterns with star wildcards', async () => {
  const { modelNameMatchesFocusPatterns } = await loadModule()

  assert.equal(modelNameMatchesFocusPatterns('gpt-5.4', 'gpt-5.*'), true)
  assert.equal(modelNameMatchesFocusPatterns('gpt5-4', 'gpt-5.*'), false)
  assert.equal(modelNameMatchesFocusPatterns('claude-3-7-sonnet', 'gpt-5.*, claude-*'), true)
  assert.equal(modelNameMatchesFocusPatterns('gpt-4o', ''), true)
})

test('filters pricing model rows by configured focus model patterns', async () => {
  const { pricingModelRows } = await loadModule()
  const pricing = JSON.stringify({
    success: true,
    data: {
      'gpt-5.4': { model_ratio: 2, completion_ratio: 3 },
      'gpt5-4': { model_ratio: 4, completion_ratio: 5 },
      'claude-3-7-sonnet': { model_ratio: 6, completion_ratio: 7 },
    },
  })

  assert.deepEqual(
    pricingModelRows(pricing, 'gpt-5.*').map((row) => row.model),
    ['gpt-5.4']
  )
})

test('formats console quota fields using custom currency metadata', async () => {
  const { consoleAccountRows } = await loadModule()
  const account = JSON.stringify({
    quota: 248540,
    used_quota: 3250000,
    custom_currency_exchange_rate: 10,
    quota_per_unit: 500000,
    custom_currency_symbol: '硬币',
  })

  const rows = Object.fromEntries(consoleAccountRows(account).map((row) => [row.label, row.value]))

  assert.equal(rows.Quota, '4.9708 硬币')
  assert.equal(rows['Used Quota'], '65 硬币')
  assert.equal(rows['Quota Remaining'], undefined)
})
