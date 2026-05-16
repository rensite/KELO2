/**
 * Supabase sync plugin for Pinia stores.
 *
 * Strategy:
 *  - Local-first: localStorage persist plugin still owns reads/writes for offline.
 *  - When signed in, we pull from Supabase, merge into stores, then mirror local
 *    mutations to Supabase with debounced diffs (insert/update/delete by id).
 *  - Granularity: per-task and per-block — editing one task never overwrites others.
 *  - Conflicts: last-write-wins by updated_at. Realtime push from server -> store.
 *
 * Usage:
 *   import { startCloudSync } from './stores/plugins/syncSupabase.js'
 *   startCloudSync({ pinia, auth })
 */

import { supabase, hasSupabase } from '../../lib/supabase.js'
import { useAuthStore } from '../auth.js'
import { useTaskStore } from '../tasks.js'
import { useTemplateStore } from '../templates.js'
import { useSettingsStore } from '../settings.js'
import { uploadBlob } from '../../lib/storage.js'
import { loadMedia, deleteMedia as deleteIDBMedia } from '../mediaDB.js'

let started = false
let unsubFns = []
let pushTimer = null
let suppressPush = false
let lastSnapshot = null
let realtimeChannel = null

// ----- field mappers -----
const taskToRow = (t, userId) => ({
  id: t.id,
  user_id: userId,
  category_id: t.categoryId ?? null,
  text: t.text ?? '',
  notes: t.notes ?? null,
  completed: !!t.completed,
  completed_at: t.completedAt ?? null,
  priority: t.priority ?? 'none',
  status: t.status ?? 'todo',
  due_date: t.dueDate ?? null,
  recurrence: t.recurrence ?? null,
  tags: t.tags ?? [],
  links: t.links ?? [],
  is_urgent: !!t.isUrgent,
  focus_time: t.focusTime ?? 0,
  pomodoro_count: t.pomodoroCount ?? 0,
  sort: t.order ?? 0,
  created_at: t.createdAt ?? new Date().toISOString(),
  updated_at: t.updatedAt ?? new Date().toISOString(),
})

const rowToTask = (r, blocks) => ({
  id: r.id,
  text: r.text || '',
  notes: r.notes || '',
  completed: !!r.completed,
  completedAt: r.completed_at,
  priority: r.priority || 'none',
  status: r.status || 'todo',
  dueDate: r.due_date,
  recurrence: r.recurrence,
  tags: r.tags || [],
  links: r.links || [],
  categoryId: r.category_id,
  isUrgent: !!r.is_urgent,
  focusTime: r.focus_time || 0,
  pomodoroCount: r.pomodoro_count || 0,
  order: r.sort || 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  blocks: blocks || [],
})

const blockToRow = (b, taskId, userId, idx) => ({
  id: b.id,
  task_id: taskId,
  user_id: userId,
  type: b.type || 'text',
  content: b.text ?? b.content ?? null,
  meta: stripMeta(b),
  media_path: b.mediaPath ?? null,
  completed: typeof b.completed === 'boolean' ? b.completed : null,
  sort: typeof b.sort === 'number' ? b.sort : idx,
  created_at: b.createdAt ?? new Date().toISOString(),
  updated_at: b.updatedAt ?? new Date().toISOString(),
})

function stripMeta(b) {
  const { id, type, text, content, mediaPath, completed, sort, createdAt, updatedAt, ...rest } = b
  return rest
}

const rowToBlock = (r) => ({
  id: r.id,
  type: r.type,
  text: r.content ?? '',
  ...(r.meta || {}),
  ...(r.media_path ? { mediaPath: r.media_path } : {}),
  ...(typeof r.completed === 'boolean' ? { completed: r.completed } : {}),
  sort: r.sort,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const categoryToRow = (c, userId, idx) => ({
  id: c.id,
  user_id: userId,
  name: c.name,
  icon: c.icon ?? null,
  color: c.color ?? null,
  pinned: !!c.pinned,
  sort: idx,
})

const rowToCategory = (r) => ({
  id: r.id, name: r.name, icon: r.icon, color: r.color, pinned: !!r.pinned,
})

const templateToRow = (tpl, userId, idx) => ({
  id: tpl.id,
  user_id: userId,
  name: tpl.name,
  payload: { icon: tpl.icon, task: tpl.task, builtIn: !!tpl.builtIn },
  sort: idx,
})

const rowToTemplate = (r) => ({
  id: r.id,
  name: r.name,
  icon: r.payload?.icon,
  task: r.payload?.task,
  builtIn: !!r.payload?.builtIn,
})

// ----- snapshots & diff -----
function snapshot(tasks, templates, settings) {
  return {
    tasks: Object.fromEntries(tasks.items.map(t => [t.id, JSON.stringify(t)])),
    blocks: Object.fromEntries(
      tasks.items.flatMap(t => (t.blocks || []).map(b => [b.id, JSON.stringify({ ...b, _taskId: t.id })]))
    ),
    categories: Object.fromEntries(tasks.categories.map(c => [c.id, JSON.stringify(c)])),
    templates: Object.fromEntries(templates.items.map(t => [t.id, JSON.stringify(t)])),
    settings: JSON.stringify(settings.$state),
  }
}

function diffMap(prev, next) {
  const upserts = []
  const deletes = []
  for (const id in next) {
    if (prev[id] !== next[id]) upserts.push(id)
  }
  for (const id in prev) {
    if (!(id in next)) deletes.push(id)
  }
  return { upserts, deletes }
}

// ----- push -----
async function pushNow() {
  const auth = useAuthStore()
  if (!auth.user) return
  const userId = auth.user.id
  const tasks = useTaskStore()
  const templates = useTemplateStore()
  const settings = useSettingsStore()

  const next = snapshot(tasks, templates, settings)
  const prev = lastSnapshot || { tasks: {}, blocks: {}, categories: {}, templates: {}, settings: null }

  try {
    // tasks
    const td = diffMap(prev.tasks, next.tasks)
    if (td.upserts.length) {
      const rows = td.upserts
        .map(id => tasks.items.find(t => t.id === id))
        .filter(Boolean)
        .map(t => taskToRow(t, userId))
      if (rows.length) await supabase.from('tasks').upsert(rows)
    }
    if (td.deletes.length) {
      await supabase.from('tasks').delete().in('id', td.deletes)
    }

    // blocks
    const bd = diffMap(prev.blocks, next.blocks)
    if (bd.upserts.length) {
      const rows = []
      for (const t of tasks.items) {
        ;(t.blocks || []).forEach((b, idx) => {
          if (bd.upserts.includes(b.id)) rows.push(blockToRow(b, t.id, userId, idx))
        })
      }
      if (rows.length) await supabase.from('blocks').upsert(rows)
    }
    if (bd.deletes.length) {
      await supabase.from('blocks').delete().in('id', bd.deletes)
    }

    // categories
    const cd = diffMap(prev.categories, next.categories)
    if (cd.upserts.length) {
      const rows = cd.upserts
        .map(id => tasks.categories.find(c => c.id === id))
        .filter(Boolean)
        .map((c, i) => categoryToRow(c, userId, tasks.categories.findIndex(x => x.id === c.id)))
      if (rows.length) await supabase.from('categories').upsert(rows)
    }
    if (cd.deletes.length) {
      await supabase.from('categories').delete().in('id', cd.deletes).eq('user_id', userId)
    }

    // templates (skip builtIn)
    const tplPrev = Object.fromEntries(
      Object.entries(prev.templates).filter(([_, v]) => !JSON.parse(v).builtIn)
    )
    const tplNext = Object.fromEntries(
      Object.entries(next.templates).filter(([_, v]) => !JSON.parse(v).builtIn)
    )
    const td2 = diffMap(tplPrev, tplNext)
    if ( td2.upserts.length) {
      const rows = td2.upserts
        .map(id => templates.items.find(t => t.id === id))
        .filter(t => t && !t.builtIn)
        .map((t, i) => templateToRow(t, userId, i))
      if (rows.length) await supabase.from('templates').upsert(rows)
    }
    if ( td2.deletes.length) {
      await supabase.from('templates').delete().in('id', td2.deletes)
    }

    // settings (whole jsonb)
    if (prev.settings !== next.settings) {
      await supabase.from('settings').upsert({
        user_id: userId,
        data: JSON.parse(next.settings),
        updated_at: new Date().toISOString(),
      })
    }

    lastSnapshot = next
  } catch (e) {
    console.warn('[sync] push failed', e)
  }
}

function schedulePush() {
  if (suppressPush) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(pushNow, 600)
}

// ----- pull -----
export async function pullAll() {
  const auth = useAuthStore()
  if (!auth.user) return
  const userId = auth.user.id

  const [taskRes, blockRes, catRes, tplRes, setRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', userId).order('sort', { ascending: true }),
    supabase.from('blocks').select('*').eq('user_id', userId).order('sort', { ascending: true }),
    supabase.from('categories').select('*').eq('user_id', userId).order('sort', { ascending: true }),
    supabase.from('templates').select('*').eq('user_id', userId).order('sort', { ascending: true }),
    supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
  ])

  if (taskRes.error) { console.warn('[sync] pull tasks', taskRes.error); return }

  const blocksByTask = {}
  for (const row of blockRes.data || []) {
    (blocksByTask[row.task_id] = blocksByTask[row.task_id] || []).push(rowToBlock(row))
  }

  const tasksStore = useTaskStore()
  const templatesStore = useTemplateStore()
  const settingsStore = useSettingsStore()

  suppressPush = true
  try {
    tasksStore.items = (taskRes.data || []).map(r => rowToTask(r, blocksByTask[r.id] || []))
    if (catRes.data?.length) {
      tasksStore.categories = catRes.data.map(rowToCategory)
    }
    // merge non-built-in templates from cloud, keep built-in defaults locally
    if (tplRes.data) {
      const builtIn = templatesStore.items.filter(t => t.builtIn)
      const cloud = tplRes.data.map(rowToTemplate)
      templatesStore.items = [...builtIn, ...cloud]
    }
    if (setRes.data?.data) {
      const data = setRes.data.data
      for (const k in data) {
        if (k in settingsStore.$state) settingsStore[k] = data[k]
      }
    }
  } finally {
    setTimeout(() => { suppressPush = false }, 50)
  }

  lastSnapshot = snapshot(tasksStore, templatesStore, settingsStore)
}

// ----- realtime -----
function subscribeRealtime() {
  const auth = useAuthStore()
  if (!auth.user) return
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
  realtimeChannel = supabase
    .channel('kelo-sync-' + auth.user.id)
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${auth.user.id}` },
        () => debouncedPull())
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'blocks', filter: `user_id=eq.${auth.user.id}` },
        () => debouncedPull())
    .subscribe()
}

let pullTimer = null
function debouncedPull() {
  clearTimeout(pullTimer)
  pullTimer = setTimeout(pullAll, 400)
}

// ----- smart merge (field-level LWW by updatedAt) -----
/**
 * Merge strategy:
 *  - Tasks: union by id. On conflict — pick the one with newer `updatedAt`.
 *    Blocks of the winning task come from that side.
 *    If updatedAt is equal/missing, prefer the side with more blocks (richer).
 *  - Categories: union by id. Cloud wins for `name/icon/color` on conflict
 *    (no per-row timestamp tracked locally). Local-only ones added.
 *  - Templates: union by id (built-in templates filtered out from merge).
 *  - Settings: cloud wins (single-row, no granular timestamp tracking).
 *
 *  Returns: { tasks: {added, updatedLocal, updatedCloud}, categories, templates }
 */
export async function smartMerge(localBackup) {
  const stats = {
    tasks: { added: 0, updatedLocal: 0, updatedCloud: 0 },
    categories: { added: 0 },
    templates: { added: 0 },
  }

  await pullAll()

  const tasksStore = useTaskStore()
  const templatesStore = useTemplateStore()

  // ---- tasks ----
  const cloudTasksById = new Map(tasksStore.items.map(t => [t.id, t]))
  const merged = []
  const seen = new Set()

  for (const cloudTask of tasksStore.items) {
    const localTask = localBackup.tasks.find(t => t.id === cloudTask.id)
    if (!localTask) { merged.push(cloudTask); seen.add(cloudTask.id); continue }
    const lt = new Date(localTask.updatedAt || 0).getTime()
    const ct = new Date(cloudTask.updatedAt || 0).getTime()
    if (lt > ct) {
      merged.push(localTask) // local wins → will push on next subscribe tick
      stats.tasks.updatedLocal++
    } else if (ct > lt) {
      merged.push(cloudTask)
      stats.tasks.updatedCloud++
    } else {
      // tie → prefer richer (more blocks)
      const lb = (localTask.blocks || []).length
      const cb = (cloudTask.blocks || []).length
      merged.push(lb > cb ? localTask : cloudTask)
    }
    seen.add(cloudTask.id)
  }
  for (const localTask of localBackup.tasks) {
    if (seen.has(localTask.id)) continue
    merged.push(localTask)
    stats.tasks.added++
  }

  // ---- categories ----
  const cloudCatIds = new Set(tasksStore.categories.map(c => c.id))
  const mergedCats = [...tasksStore.categories]
  for (const lc of localBackup.categories || []) {
    if (!cloudCatIds.has(lc.id)) {
      mergedCats.push(lc)
      stats.categories.added++
    }
  }

  // ---- templates (skip builtIn) ----
  const cloudTplIds = new Set(templatesStore.items.map(t => t.id))
  const mergedTpls = [...templatesStore.items]
  for (const lt of localBackup.templates || []) {
    if (lt.builtIn) continue
    if (!cloudTplIds.has(lt.id)) {
      mergedTpls.push(lt)
      stats.templates.added++
    }
  }

  // apply (suppress push during write — final state will be pushed by next $subscribe tick)
  suppressPush = true
  try {
    tasksStore.items = merged
    tasksStore.categories = mergedCats
    templatesStore.items = mergedTpls
  } finally {
    setTimeout(() => { suppressPush = false }, 50)
  }

  // Force a snapshot reset so push-diff sees the merge as the new baseline,
  // then schedule a push so local-wins items propagate to cloud.
  lastSnapshot = null
  schedulePush()

  return stats
}

// ----- one-shot media migration: IndexedDB / dataURL → Storage -----
/**
 * Walks all blocks. For any block with a media payload (legacy `mediaId`
 * pointing to IndexedDB, or inline `url` data URL) but no `mediaPath`, upload
 * it to Supabase Storage and replace.
 */
export async function migrateMediaToStorage(onProgress) {
  const auth = useAuthStore()
  if (!auth.user) return { migrated: 0, failed: 0 }
  const userId = auth.user.id
  const tasks = useTaskStore()

  let migrated = 0
  let failed = 0
  const candidates = []
  for (const task of tasks.items) {
    for (const block of task.blocks || []) {
      if (block.mediaPath) continue
      if (block.mediaId || (typeof block.url === 'string' && block.url.startsWith('data:'))) {
        candidates.push({ task, block })
      }
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    const { task, block } = candidates[i]
    try {
      let dataUrl = block.url
      if (block.mediaId && !dataUrl?.startsWith?.('data:')) {
        dataUrl = await loadMedia(block.mediaId)
      }
      if (!dataUrl) { failed++; continue }
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const ext = (block.name?.split('.').pop() || blob.type.split('/')[1] || 'bin').toLowerCase()
      const path = await uploadBlob(blob, userId, block.id, ext, blob.type || 'application/octet-stream')
      if (!path) { failed++; continue }
      // mutate block (will sync to cloud via subscribe)
      block.mediaPath = path
      delete block.url
      if (block.mediaId) { deleteIDBMedia(block.mediaId); delete block.mediaId }
      task.updatedAt = new Date().toISOString()
      migrated++
      onProgress?.(i + 1, candidates.length)
    } catch (e) {
      console.warn('[sync] media migrate failed for block', block.id, e)
      failed++
    }
  }
  if (migrated) schedulePush()
  return { migrated, failed, total: candidates.length }
}

// ----- empty-cloud check (for migration dialog) -----
export async function isCloudEmpty() {
  const auth = useAuthStore()
  if (!auth.user) return true
  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)
  return (count ?? 0) === 0
}

// ----- one-shot: push all local data, treating cloud as empty target -----
export async function pushAllLocal() {
  lastSnapshot = { tasks: {}, blocks: {}, categories: {}, templates: {}, settings: null }
  await pushNow()
}

// ----- start / stop -----
export function startCloudSync() {
  if (!hasSupabase || started) return
  started = true

  const auth = useAuthStore()
  const tasks = useTaskStore()
  const templates = useTemplateStore()
  const settings = useSettingsStore()

  // watch for sign-in / sign-out
  let prevUserId = auth.user?.id || null
  const stopAuthWatch = auth.$subscribe(async () => {
    const nowId = auth.user?.id || null
    if (nowId === prevUserId) return
    prevUserId = nowId
    if (nowId) {
      // first sign-in handled by App.vue (migration dialog flow)
    } else {
      if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null }
      lastSnapshot = null
    }
  })
  unsubFns.push(stopAuthWatch)

  // mirror local changes to cloud
  for (const s of [tasks, templates, settings]) {
    unsubFns.push(s.$subscribe(() => {
      if (!auth.user) return
      schedulePush()
    }))
  }
}

export async function startAfterSignIn() {
  if (!hasSupabase) return
  await pullAll()
  subscribeRealtime()
  // Run media migration in background — non-blocking.
  migrateMediaToStorage().then((r) => {
    if (r.migrated > 0) console.info(`[sync] migrated ${r.migrated}/${r.total} media to Storage`)
  })
}

export function stopCloudSync() {
  unsubFns.forEach(fn => fn())
  unsubFns = []
  if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null }
  started = false
}
