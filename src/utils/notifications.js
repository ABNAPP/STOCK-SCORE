/**
 * Begär notisbehörighet (endast via user action)
 */
export function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return Promise.resolve(false)
  }

  if (Notification.permission === 'granted') {
    return Promise.resolve(true)
  }

  if (Notification.permission === 'denied') {
    return Promise.resolve(false)
  }

  return Notification.requestPermission().then(permission => {
    return permission === 'granted'
  })
}

/**
 * Skickar notis (endast om permission granted)
 */
export function sendNotification(title, options = {}) {
  if (!('Notification' in window)) {
    return false
  }

  if (Notification.permission !== 'granted') {
    return false
  }

  try {
    new Notification(title, {
      body: options.body || '',
      icon: options.icon || '/favicon.ico',
      tag: options.tag || 'default',
      ...options
    })
    return true
  } catch (error) {
    console.error('Failed to send notification:', error)
    return false
  }
}

/**
 * Jämför två listor och hittar nya objekt
 */
export function findNewItems(oldList, newList, getId = (item) => item.id) {
  if (!oldList || oldList.length === 0) {
    return [] // Inga nya vid första laddning
  }

  const oldIds = new Set(oldList.map(getId))
  return newList.filter(item => !oldIds.has(getId(item)))
}

