/**
 * Grupperar data efter score-trösklar
 */
export function groupByScore(data, highThreshold = 70, mediumThreshold = 50) {
  const high = []
  const medium = []
  const low = []

  for (const item of data) {
    const score = typeof item.score === 'number' ? item.score : 0
    
    if (score >= highThreshold) {
      high.push(item)
    } else if (score >= mediumThreshold) {
      medium.push(item)
    } else {
      low.push(item)
    }
  }

  // Sortera fallande efter score
  const sortByScore = (a, b) => {
    const scoreA = typeof a.score === 'number' ? a.score : 0
    const scoreB = typeof b.score === 'number' ? b.score : 0
    return scoreB - scoreA
  }

  high.sort(sortByScore)
  medium.sort(sortByScore)
  low.sort(sortByScore)

  return { high, medium, low }
}

/**
 * Beräknar distribution (procent + antal)
 */
export function calculateDistribution(groups, total) {
  if (total === 0) {
    return {
      high: { count: 0, percent: 0 },
      medium: { count: 0, percent: 0 },
      low: { count: 0, percent: 0 },
      total: { count: 0, percent: 100 }
    }
  }

  return {
    high: {
      count: groups.high.length,
      percent: Math.round((groups.high.length / total) * 100)
    },
    medium: {
      count: groups.medium.length,
      percent: Math.round((groups.medium.length / total) * 100)
    },
    low: {
      count: groups.low.length,
      percent: Math.round((groups.low.length / total) * 100)
    },
    total: {
      count: total,
      percent: 100
    }
  }
}

