import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')

const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('backend form exposes sub2api authorization/checkin/channel fields and new-api cookie fields', () => {
  const form = read('components/backends/BackendForm.vue')

  assert.match(form, /v-model="formData\.backend_type"/)
  assert.match(form, /<option value="new-api">new-api<\/option>/)
  assert.match(form, /<option value="sub2api">sub2api<\/option>/)
  assert.match(form, /v-model="formData\.console_authorization"/)
  assert.match(form, /v-model="formData\.console_checkin_path"/)
  assert.match(form, /v-model="formData\.channel_url"/)
  assert.match(form, /v-model="formData\.console_cookie"/)
  assert.match(form, /v-model="formData\.console_user_id"/)
  assert.match(form, /const isNewAPIBackendType = computed\(\(\) => formData\.value\.backend_type === 'new-api'\)/)
  assert.match(form, /const isSub2APIBackendType = computed\(\(\) => formData\.value\.backend_type === 'sub2api'\)/)
  assert.match(form, /backend_type: 'new-api'/)
  assert.match(form, /console_authorization: ''/)
  assert.match(form, /console_checkin_path: ''/)
  assert.match(form, /channel_url: ''/)
  assert.match(form, /console_cookie: ''/)
  assert.match(form, /backend_type: formData\.value\.backend_type/)
  assert.match(form, /console_authorization: formData\.value\.backend_type === 'sub2api' \? formData\.value\.console_authorization\.trim\(\) : ''/)
  assert.match(form, /console_checkin_path: formData\.value\.backend_type === 'sub2api' \? formData\.value\.console_checkin_path\.trim\(\) : ''/)
  assert.match(form, /channel_url: formData\.value\.backend_type === 'sub2api' \? formData\.value\.channel_url\.trim\(\) : ''/)
  assert.match(form, /console_cookie: formData\.value\.backend_type === 'new-api' \? formData\.value\.console_cookie\.trim\(\) : ''/)
  assert.match(form, /console_user_id: formData\.value\.backend_type === 'new-api' \? formData\.value\.console_user_id\.trim\(\) : ''/)
  assert.match(form, /console_checkin_path: backend\.console_checkin_path \|\| ''/)
  assert.match(form, /channel_url: backend\.channel_url \|\| ''/)
})

test('backend list exposes a single console sync button', () => {
  const list = read('components/backends/BackendList.vue')

  assert.match(list, /@click="\$emit\('sync-console', backend\)"/)
  assert.match(list, /const canSyncConsole = \(backend: Backend\) => backend\.backend_type === 'new-api' \|\| backend\.backend_type === 'sub2api'/)
  assert.doesNotMatch(list, /@click="\$emit\('checkin', backend\)"/)
  assert.doesNotMatch(list, /@click="\$emit\('pricing', backend\)"/)
  assert.doesNotMatch(list, /title="签到"/)
  assert.doesNotMatch(list, /title="模型广场"/)
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
  assert.match(page, /const response = await backendsApi\.syncConsoleStream\(backend\.id/)
  assert.match(page, /:running-console-sync-ids="runningConsoleSyncIds"/)
  assert.match(list, /runningConsoleSyncIds\?: Set<number>/)
  assert.match(list, /isConsoleSyncRunning\(backend\.id\)/)
  assert.match(list, /:disabled="isConsoleSyncDisabled\(backend\)"/)
})

test('backends page exposes a toolbar batch sync button and batch sync helper usage', () => {
  const page = read('pages/Backends.vue')
  const helper = read('pages/backendsBatchSync.ts')

  assert.match(page, />\s*同步\s*<\/Button>/)
  assert.match(page, /:loading="syncingAllBackends"/)
  assert.match(page, /:disabled="!syncableBackends\.length"/)
  assert.match(page, /@click="handleSyncAllBackends"/)
  assert.match(page, /const syncableBackends = computed\(\(\) => backends\.value\.filter\(canSyncBackendConsole\)\)/)
  assert.match(page, /await runBackendConsoleSyncBatch\(/)
  assert.match(helper, /export const canSyncBackendConsole = \(backend: Backend\) => backend\.backend_type === 'new-api' \|\| backend\.backend_type === 'sub2api'/)
  assert.match(helper, /for \(const backend of syncableBackends\)/)
  assert.match(helper, /continue/)
})

test('frontend API and store call the unified backend console sync endpoint', () => {
  const api = read('api/backends.ts')
  const store = read('stores/backends.ts')
  const page = read('pages/Backends.vue')

  assert.match(api, /syncConsole\(id: number\)/)
  assert.match(api, /`\/backends\/\$\{id\}\/console\/sync`/)
  assert.doesNotMatch(api, /console\/checkin/)
  assert.doesNotMatch(api, /console\/pricing/)
  assert.match(store, /syncBackendConsole/)
  assert.match(page, /@sync-console="handleConsoleSync"/)
  assert.doesNotMatch(page, /@checkin="handleCheckin"/)
  assert.doesNotMatch(page, /@pricing="handlePricing"/)
})

test('frontend backend types include console state and pricing json fields', () => {
  const types = read('api/types.ts')

  assert.match(types, /backend_type\?: '' \| 'new-api' \| 'sub2api'/)
  assert.match(types, /console_authorization\?: string/)
  assert.match(types, /console_checkin_path\?: string/)
  assert.match(types, /channel_url\?: string/)
  assert.match(types, /console_cookie\?: string/)
  assert.match(types, /console_account_json\?: string/)
  assert.match(types, /console_pricing_json\?: string/)
  assert.match(types, /BackendConsoleRequestLog/)
  assert.match(types, /requests\?: BackendConsoleRequestLog\[\]/)
})

test('backend form lets backend type be cleared and submitted as empty', () => {
  const form = read('components/backends/BackendForm.vue')

  assert.match(form, /<option value="">通用<\/option>/)
  assert.match(form, /backend_type: '' \| 'new-api' \| 'sub2api'/)
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
  assert.match(form, /<label for="notes">备注<\/label>/)
  assert.match(form, /id="notes"/)
  assert.match(form, /v-model="formData\.notes"/)
  assert.match(form, /notes: formData\.value\.notes\.trim\(\)/)
})

test('backend form and types no longer expose endpoint configuration', () => {
  const form = read('components/backends/BackendForm.vue')
  const types = read('api/types.ts')

  assert.doesNotMatch(form, /formData\.endpoints/)
  assert.doesNotMatch(form, /endpoints: formData\.value\.endpoints/)
  assert.doesNotMatch(form, /backend\.endpoints/)
  assert.doesNotMatch(types, /endpoints\??: string\[\]/)
  assert.doesNotMatch(types, /endpoint_count\?: number/)
})

test('backend expanded details render console self and pricing model summaries', () => {
  const list = read('components/backends/BackendList.vue')
  const helper = read('components/backends/backendConsoleDisplay.ts')

  assert.match(list, /用户信息/)
  assert.match(list, /consoleAccountSummary\(backend\.console_account_json\)/)
  assert.match(list, /可用模型/)
  assert.match(list, /pricingModelRows\(backend\.console_pricing_json,\s*focusModelPatterns,\s*backend\.console_account_json\)/)
  assert.match(list, /:key="`\$\{row\.model\}-\$\{row\.group\}-\$\{row\.price\}`"/)
  assert.match(helper, /Last Check-in/)
  assert.match(helper, /Email/)
  assert.match(helper, /Balance/)
  assert.doesNotMatch(helper, /Quota Remaining/)
  assert.match(list, /Model/)
  assert.match(list, /Price/)
  assert.match(list, /Group/)
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
