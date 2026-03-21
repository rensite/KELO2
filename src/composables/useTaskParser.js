export function parseTaskInput(text) {
  let taskText = text.trim()
  const result = {
    text: '',
    priority: 'none',
    tags: [],
    links: [],
    dueDate: null,
    recurrence: null,
  }

  // Extract URLs (must be done early, before other parsing might mangle them)
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'`,;)}\]]+/gi
  let urlMatch
  while ((urlMatch = urlRegex.exec(taskText)) !== null) {
    let url = urlMatch[0]
    if (url.startsWith('www.')) url = 'https://' + url
    url = url.replace(/[.,;:!?)]+$/, '')
    result.links.push(url)
  }
  taskText = taskText.replace(urlRegex, '').trim()

  // Extract tags (#tag)
  const tagRegex = /#(\w[\w-]*)/g
  let match
  while ((match = tagRegex.exec(taskText)) !== null) {
    result.tags.push(match[1].toLowerCase())
  }
  taskText = taskText.replace(tagRegex, '').trim()

  // Extract priority (!high, !med, !low)
  const priorityMatch = taskText.match(/!(high|med|medium|low|urgent|important)/i)
  if (priorityMatch) {
    const p = priorityMatch[1].toLowerCase()
    if (p === 'high' || p === 'urgent' || p === 'important') result.priority = 'high'
    else if (p === 'med' || p === 'medium') result.priority = 'medium'
    else if (p === 'low') result.priority = 'low'
    taskText = taskText.replace(priorityMatch[0], '').trim()
  }

  // Extract recurrence
  const recurrencePatterns = [
    { regex: /\bevery\s*day\b/i, value: 'daily' },
    { regex: /\bdaily\b/i, value: 'daily' },
    { regex: /\bweekdays?\b/i, value: 'weekdays' },
    { regex: /\bevery\s*(mon|tue|wed|thu|fri|sat|sun)\w*\b/i, value: 'weekly' },
    { regex: /\bweekly\b/i, value: 'weekly' },
    { regex: /\bbiweekly\b/i, value: 'biweekly' },
    { regex: /\bmonthly\b/i, value: 'monthly' },
    { regex: /\bevery\s*month\b/i, value: 'monthly' },
  ]
  for (const pattern of recurrencePatterns) {
    const m = taskText.match(pattern.regex)
    if (m) {
      result.recurrence = pattern.value
      taskText = taskText.replace(m[0], '').trim()
      break
    }
  }

  // Extract due date
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const datePatterns = [
    {
      regex: /\btoday\b/i,
      resolver: () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d },
    },
    {
      regex: /\btomorrow\b/i,
      resolver: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(23, 59, 0, 0); return d },
    },
    {
      regex: /\bnext\s+week\b/i,
      resolver: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0); return d },
    },
    {
      regex: /\bin\s+(\d+)\s+days?\b/i,
      resolver: (m) => { const d = new Date(); d.setDate(d.getDate() + parseInt(m[1])); d.setHours(23, 59, 0, 0); return d },
    },
    {
      regex: /\bin\s+(\d+)\s+weeks?\b/i,
      resolver: (m) => { const d = new Date(); d.setDate(d.getDate() + parseInt(m[1]) * 7); d.setHours(23, 59, 0, 0); return d },
    },
    {
      regex: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      resolver: (m) => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const target = days.indexOf(m[1].toLowerCase())
        const d = new Date()
        const current = d.getDay()
        let diff = target - current
        if (diff <= 0) diff += 7
        d.setDate(d.getDate() + diff)
        d.setHours(23, 59, 0, 0)
        return d
      },
    },
    {
      regex: /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/,
      resolver: (m) => {
        const month = parseInt(m[1]) - 1
        const day = parseInt(m[2])
        const year = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : new Date().getFullYear()
        const d = new Date(year, month, day, 23, 59, 0, 0)
        return d
      },
    },
  ]

  for (const pattern of datePatterns) {
    const m = taskText.match(pattern.regex)
    if (m) {
      result.dueDate = pattern.resolver(m).toISOString()
      taskText = taskText.replace(m[0], '').trim()
      break
    }
  }

  // Clean up extra whitespace
  result.text = taskText.replace(/\s+/g, ' ').trim()

  return result
}

// Utility: extract display hostname from a URL
export function getUrlHostname(url) {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Utility: get a favicon URL for a domain
export function getFaviconUrl(url) {
  try {
    const u = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=16`
  } catch {
    return null
  }
}
