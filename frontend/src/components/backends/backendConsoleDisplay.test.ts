import test from 'node:test'
import assert from 'node:assert/strict'

import { pricingModelRows } from './backendConsoleDisplay.ts'

test('pricingModelRows uses dollar unit when account quota display type is USD', () => {
  const rows = pricingModelRows(
    JSON.stringify({
      success: true,
      data: [
        { model_name: 'gpt-5.4', model_ratio: 2 }
      ]
    }),
    '',
    JSON.stringify({
      custom_currency_exchange_rate: 1,
      custom_currency_symbol: '硬币',
      quota_display_type: 'USD',
      quota_per_unit: 500000
    })
  )

  assert.equal(rows.length, 1)
  assert.equal(rows[0].price, 'Input: $4 / 1M')
})

test('pricingModelRows uses custom currency symbol when account quota display type is CUSTOM', () => {
  const rows = pricingModelRows(
    JSON.stringify({
      success: true,
      data: [
        { model_name: 'gpt-5.4', model_ratio: 2 }
      ]
    }),
    '',
    JSON.stringify({
      custom_currency_exchange_rate: 10,
      custom_currency_symbol: '硬币',
      quota_display_type: 'CUSTOM',
      quota_per_unit: 500000
    })
  )

  assert.equal(rows.length, 1)
  assert.equal(rows[0].price, 'Input: 40 硬币 / 1M')
})
