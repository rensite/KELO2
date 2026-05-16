import { useToast } from './useToast.js'

const toast = useToast()

async function writeText(text) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Скопировано')
    return true
  } catch {
    // Legacy fallback
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy'); toast.success('Скопировано'); return true }
    catch { toast.error('Не удалось скопировать'); return false }
    finally { document.body.removeChild(ta) }
  }
}

function blockToText(block) {
  if (!block) return ''
  if (block.type === 'text') return block.text || ''
  if (block.type === 'image') return `[image] ${block.name || ''} ${block.url || ''}`.trim()
  if (block.type === 'video') return `[video] ${block.name || ''} ${block.url || ''}`.trim()
  if (block.type === 'audio') return `[audio] ${block.name || ''}`
  if (block.type === 'file') return `[file] ${block.name || ''}`
  return block.text || block.name || ''
}

function taskToText(task) {
  if (!task) return ''
  const lines = []
  lines.push(task.text || '')
  if (task.notes) lines.push('', task.notes)
  if (task.blocks?.length) {
    lines.push('')
    for (const b of task.blocks) {
      const t = blockToText(b)
      if (!t) continue
      if (b.type === 'text' && typeof b.completed === 'boolean') {
        lines.push(`${b.completed ? '[x]' : '[ ]'} ${t}`)
      } else {
        lines.push(`• ${t}`)
      }
    }
  }
  return lines.join('\n').trim()
}

function taskToMarkdown(task) {
  if (!task) return ''
  const lines = []
  lines.push(`# ${task.text || ''}`)
  if (task.tags?.length) lines.push(task.tags.map(t => `#${t}`).join(' '))
  if (task.dueDate) lines.push(`*due: ${new Date(task.dueDate).toISOString().slice(0,10)}*`)
  if (task.notes) lines.push('', task.notes)
  if (task.blocks?.length) {
    lines.push('')
    for (const b of task.blocks) {
      if (b.type === 'text') {
        if (typeof b.completed === 'boolean') lines.push(`- [${b.completed ? 'x' : ' '}] ${b.text || ''}`)
        else lines.push(b.text || '')
      } else if (b.type === 'image' && b.url) {
        lines.push(`![${b.name || ''}](${b.url})`)
      } else if (b.url) {
        lines.push(`[${b.name || b.type}](${b.url})`)
      }
    }
  }
  return lines.join('\n').trim()
}

export function useClipboard() {
  return {
    copyText: writeText,
    copyBlock: (block) => writeText(blockToText(block)),
    copyTask: (task) => writeText(taskToText(task)),
    copyTaskMarkdown: (task) => writeText(taskToMarkdown(task)),
    blockToText,
    taskToText,
    taskToMarkdown,
  }
}
