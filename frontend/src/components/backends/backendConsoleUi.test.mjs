import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')

const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('backend form exposes new-api type and editable console cookie fields', () => {
  const form = read('components/backends/BackendForm.vue')

  assert.match(form, /v-model="formData\.backend_type"/)
  assert.match(form, /<option value="new-api">new-api<\/option>/)
  assert.match(form, /v-model="formData\.console_cookie"/)
  assert.match(form, /backend_type: 'new-api'/)
  assert.match(form, /console_cookie: ''/)
  assert.match(form, /backend_type: formData\.value\.backend_type/)
  assert.match(form, /console_cookie: formData\.value\.console_cookie\.trim\(\)/)
})

test('backend list exposes only checkin and model plaza manual console buttons', () => {
  const list = read('components/backends/BackendList.vue')

  assert.match(list, /@click="\$emit\('checkin', backend\)"/)
  assert.match(list, /title="签到"/)
  assert.match(list, /'签到'/)
  assert.match(list, /@click="\$emit\('pricing', backend\)"/)
  assert.match(list, /title="模型广场"/)
  assert.match(list, /'模型广场'/)
  assert.doesNotMatch(list, /console-login/)
  assert.doesNotMatch(list, /console-self/)
  assert.doesNotMatch(list, /user-models/)
  assert.doesNotMatch(list, /\/api\/models/)
})

test('backend console actions open a request-log modal with expandable response bodies and running button state', () => {
  const page = read('pages/Backends.vue')
  const list = read('components/backends/BackendList.vue')

  assert.match(page, /:show="showConsoleActionLogModal"/)
  assert.match(page, /title="Console Request Log"/)
  assert.match(page, /consoleRequestLogRows/)
  assert.match(page, /<th>Time<\/th>/)
  assert.match(page, /<th>Path<\/th>/)
  assert.match(page, /<th>HTTP Status<\/th>/)
  assert.match(page, /<th>Response Body<\/th>/)
  assert.match(page, /toggleConsoleLogRow\(row\.id\)/)
  assert.match(page, /formatConsoleLogBody\(row\.body\)/)
  assert.match(page, /extractConsoleRequestLogs\(response\.requests/)
  assert.match(page, /const response = await backendsApi\.checkin\(backend\.id\)/)
  assert.match(page, /const response = await backendsApi\.pricing\(backend\.id\)/)
  assert.match(page, /:running-checkin-ids="runningCheckinIds"/)
  assert.match(page, /:running-pricing-ids="runningPricingIds"/)
  assert.match(list, /runningCheckinIds\?: Set<number>/)
  assert.match(list, /runningPricingIds\?: Set<number>/)
  assert.match(list, /isBackendActionRunning\(backend\.id\)/)
  assert.match(list, /isCheckinRunning\(backend\.id\) \? '签到中' : '签到'/)
  assert.match(list, /isPricingRunning\(backend\.id\) \? '同步中' : '模型广场'/)
  assert.match(list, /:disabled="isBackendActionRunning\(backend\.id\)"/)
})

test('frontend API and store call the new backend console endpoints', () => {
  const api = read('api/backends.ts')
  const store = read('stores/backends.ts')
  const page = read('pages/Backends.vue')

  assert.match(api, /checkin\(id: number\)/)
  assert.match(api, /`\/backends\/\$\{id\}\/console\/checkin`/)
  assert.match(api, /pricing\(id: number\)/)
  assert.match(api, /`\/backends\/\$\{id\}\/console\/pricing`/)
  assert.match(store, /checkinBackend/)
  assert.match(store, /syncBackendPricing/)
  assert.match(page, /@checkin="handleCheckin"/)
  assert.match(page, /@pricing="handlePricing"/)
})

test('frontend backend types include console state and pricing json fields', () => {
  const types = read('api/types.ts')

  assert.match(types, /backend_type\?: '' \| 'new-api'/)
  assert.match(types, /console_cookie\?: string/)
  assert.match(types, /console_account_json\?: string/)
  assert.match(types, /console_pricing_json\?: string/)
  assert.match(types, /BackendConsoleRequestLog/)
  assert.match(types, /requests\?: BackendConsoleRequestLog\[\]/)
})

test('backend form lets backend type be cleared and submitted as empty', () => {
  const form = read('components/backends/BackendForm.vue')

  assert.match(form, /<option value="">None<\/option>/)
  assert.match(form, /backend_type: '' \| 'new-api'/)
  assert.match(form, /backend_type: formData\.value\.backend_type/)
  assert.match(form, /backend_type: backend\.backend_type \?\? 'new-api'/)
})

test('backend form exposes dual protocol plus tags and description fields', () => {
  const form = read('components/backends/BackendForm.vue')
  const types = read('api/types.ts')

  assert.match(types, /protocol: 'openai' \| 'anthropic' \| 'both'/)
  assert.match(form, /<option value="both">OpenAI \+ Anthropic<\/option>/)
  assert.match(form, /v-model="formData\.tags"/)
  assert.match(form, /parseBackendTagInput\(formData\.value\.tags\)/)
  assert.match(form, /<label class="form-label" for="description">Description<\/label>/)
  assert.match(form, /id="description"/)
  assert.match(form, /v-model="formData\.notes"/)
  assert.match(form, /notes: formData\.value\.notes\.trim\(\)/)
})

test('backend expanded details render console self and pricing model summaries', () => {
  const list = read('components/backends/BackendList.vue')
  const helper = read('components/backends/backendConsoleDisplay.ts')

  assert.match(list, /Console Account/)
  assert.match(list, /consoleAccountSummary\(backend\.console_account_json\)/)
  assert.match(list, /Model Pricing/)
  assert.match(list, /pricingModelRows\(backend\.console_pricing_json,\s*focusModelPatterns\)/)
  assert.match(helper, /Last Check-in/)
  assert.match(helper, /Quota Remaining/)
  assert.match(list, /Model/)
  assert.match(list, /Prompt/)
  assert.match(list, /Completion/)
})

test('settings and backend list expose console UA and focus model configuration', () => {
  const settings = read('pages/Settings.vue')
  const backendsPage = read('pages/Backends.vue')
  const backendList = read('components/backends/BackendList.vue')
  const types = read('api/types.ts')

  assert.match(settings, /v-model="formData\.backend_console_user_agent"/)
  assert.match(settings, /v-model="formData\.focus_models"/)
  assert.match(types, /backend_console_user_agent\?: string/)
  assert.match(types, /focus_models\?: string/)
  assert.match(backendsPage, /:focus-model-patterns="focusModelPatterns"/)
  assert.match(backendList, /focusModelPatterns\?: string/)
})
