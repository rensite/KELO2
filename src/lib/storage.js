/**
 * Supabase Storage helpers for media (private bucket).
 *
 * Path layout: `${user.id}/${uuid}.${ext}` — RLS allows only owner.
 * Signed URLs are cached in-memory for 50min (signed TTL: 1h).
 */
import { supabase, hasSupabase } from './supabase.js'

const BUCKET = 'media'
const SIGNED_TTL = 60 * 60
const CACHE_TTL = 50 * 60 * 1000
const urlCache = new Map() // path -> { url, exp }

function extFromMime(mime, name) {
  const fromName = name?.split('.').pop()
  if (fromName && fromName.length <= 5) return fromName.toLowerCase()
  const map = { 'audio/webm': 'webm', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' }
  return map[mime] || 'bin'
}

export async function uploadMedia(file, userId, blockId) {
  if (!hasSupabase || !userId) return null
  const ext = extFromMime(file.type, file.name)
  const id = blockId || (crypto.randomUUID?.() || Date.now().toString(36))
  const path = `${userId}/${id}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  })
  if (error) { console.warn('[storage] upload failed', error); return null }
  return path
}

export async function uploadBlob(blob, userId, blockId, ext = 'bin', contentType = 'application/octet-stream') {
  if (!hasSupabase || !userId) return null
  const id = blockId || (crypto.randomUUID?.() || Date.now().toString(36))
  const path = `${userId}/${id}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: '3600', upsert: true, contentType,
  })
  if (error) { console.warn('[storage] upload failed', error); return null }
  return path
}

export async function getMediaUrl(path) {
  if (!hasSupabase || !path) return null
  const cached = urlCache.get(path)
  if (cached && cached.exp > Date.now()) return cached.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL)
  if (error || !data?.signedUrl) return null
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + CACHE_TTL })
  return data.signedUrl
}

export async function deleteMedia(path) {
  if (!hasSupabase || !path) return
  await supabase.storage.from(BUCKET).remove([path])
  urlCache.delete(path)
}
