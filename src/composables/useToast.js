import { ref } from 'vue'

const toasts = ref([])
let toastId = 0

export function useToast() {
  function show(message, type = 'info', duration = 4000, action = null) {
    const id = ++toastId
    toasts.value.push({ id, message, type, action, visible: true })

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }

    return id
  }

  function dismiss(id) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      toasts.value[idx].visible = false
      setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id)
      }, 300)
    }
  }

  function success(message, duration) { return show(message, 'success', duration) }
  function error(message, duration) { return show(message, 'error', duration) }
  function warning(message, duration) { return show(message, 'warning', duration) }
  function info(message, duration) { return show(message, 'info', duration) }

  function undoToast(message, onUndo) {
    return show(message, 'info', 5000, { label: 'Undo', callback: onUndo })
  }

  return { toasts, show, dismiss, success, error, warning, info, undoToast }
}
