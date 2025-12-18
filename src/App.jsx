import React, { useState, useEffect, useRef, useCallback } from 'react'
import { translations } from './translations'
import { SOURCES, getEnabledSources, buildSourceUrl } from './config/sources'
import { fetchAppsScriptData, parseCsv, parseXlsx, parseJson } from './utils/dataFetcher'
import { identifyColumns, normalizeData } from './utils/parser'
import { groupByScore, calculateDistribution } from './utils/grouping'
import { getNumericColumns, calculateColumnStats } from './utils/stats'
import { getWatchlist, toggleWatchlist } from './utils/watchlist'
import { requestNotificationPermission, sendNotification, findNewItems } from './utils/notifications'
import { mergeAndDeduplicate } from './utils/merge'
import Loading from './components/Loading'
import Error from './components/Error'
import MarketOverview from './components/MarketOverview'
import ItemList from './components/ItemList'
import DataTable from './components/DataTable'
import Stats from './components/Stats'
import Settings from './components/Settings'
import DataSources from './components/DataSources'
import './App.css'

export default function App() {
  // State
  const [sources, setSources] = useState(() => {
    // Ladda sources från localStorage eller använd default
    const saved = localStorage.getItem('scoreAppSources')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Merge med SOURCES för att behålla alla källor
        return SOURCES.map(source => {
          const savedSource = parsed.find(s => s.key === source.key)
          return savedSource ? { ...source, enabled: savedSource.enabled } : source
        })
      } catch {
        // Fallback till default
      }
    }
    return SOURCES
  })

  const [sourceStatuses, setSourceStatuses] = useState({})
  const [normalizedData, setNormalizedData] = useState([])
  const [rawData, setRawData] = useState([])
  const [columns, setColumns] = useState({ score: null, name: null, ticker: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [watchlist, setWatchlist] = useState([])
  const [activeView, setActiveView] = useState('overview')
  const [previousTopPerformers, setPreviousTopPerformers] = useState([])

  // Settings
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('scoreAppSettings')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // Fallback to defaults
      }
    }
    return {
      locale: 'sv',
      theme: 'light',
      autoRefresh: true,
      refreshInterval: 30,
      highThreshold: 70,
      mediumThreshold: 50,
      notificationsEnabled: false,
      scriptBaseUrl: ''
    }
  })

  // Refs
  const refreshTimerRef = useRef(null)
  const previousDataRef = useRef([])

  // Translations
  const t = translations[settings.locale] || translations.sv

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('scoreAppSettings', JSON.stringify(settings))
  }, [settings])

  // Save sources to localStorage
  useEffect(() => {
    localStorage.setItem('scoreAppSources', JSON.stringify(sources))
  }, [sources])

  // Load watchlist on mount
  useEffect(() => {
    setWatchlist(getWatchlist())
  }, [])

  // Load data from all enabled sources
  const loadAllData = useCallback(async () => {
    const enabledSources = sources.filter(s => s.enabled)
    
    if (enabledSources.length === 0) {
      setError('No sources enabled')
      return
    }

    if (!settings.scriptBaseUrl) {
      setError('SCRIPT_BASE_URL is not configured. Please set it in settings.')
      return
    }

    setLoading(true)
    setError(null)

    // Reset statuses
    const newStatuses = {}
    enabledSources.forEach(source => {
      newStatuses[source.key] = { status: 'loading', message: '', count: 0 }
    })
    setSourceStatuses(newStatuses)

    try {
      // Fetch all sources in parallel
      const fetchPromises = enabledSources.map(async (source) => {
        try {
          const url = buildSourceUrl(source, settings.scriptBaseUrl)
          const result = await fetchAppsScriptData(url)
          
          let parsedData = []
          
          if (result.type === 'json') {
            parsedData = parseJson(result.data)
          } else if (result.type === 'xlsx') {
            parsedData = parseXlsx(result.data)
          } else {
            parsedData = parseCsv(result.data)
          }

          // Identify columns for this source
          const identifiedColumns = identifyColumns(parsedData)
          
          // Normalize data with source info
          const normalized = normalizeData(parsedData, identifiedColumns, source.key, source.name)

          return {
            source: source.key,
            success: true,
            data: normalized,
            rawData: parsedData,
            columns: identifiedColumns,
            count: normalized.length
          }
        } catch (err) {
          return {
            source: source.key,
            success: false,
            error: err.message,
            data: [],
            rawData: [],
            columns: { score: null, name: null, ticker: null },
            count: 0
          }
        }
      })

      const results = await Promise.allSettled(fetchPromises)

      // Update statuses and collect data
      const allNormalizedData = []
      const allRawData = []
      const updatedStatuses = { ...newStatuses }
      let hasColumns = false

      results.forEach((result, index) => {
        const source = enabledSources[index]
        
        if (result.status === 'fulfilled') {
          const data = result.value
          
          if (data.success) {
            updatedStatuses[source.key] = {
              status: 'success',
              message: '',
              count: data.count
            }
            allNormalizedData.push(...data.data)
            allRawData.push(...data.rawData)
            
            // Use columns from first successful source
            if (!hasColumns && data.columns.score) {
              setColumns(data.columns)
              hasColumns = true
            }
          } else {
            updatedStatuses[source.key] = {
              status: 'error',
              message: data.error || 'Unknown error',
              count: 0
            }
          }
        } else {
          updatedStatuses[source.key] = {
            status: 'error',
            message: result.reason?.message || 'Failed to fetch',
            count: 0
          }
        }
      })

      setSourceStatuses(updatedStatuses)

      // Merge and deduplicate
      const merged = mergeAndDeduplicate(
        enabledSources.map((source, index) => {
          const result = results[index]
          if (result.status === 'fulfilled' && result.value.success) {
            return {
              source: source.key,
              data: result.value.data
            }
          }
          return { source: source.key, data: [] }
        })
      )

      setNormalizedData(merged)
      setRawData(allRawData)

      // Check for new top performers (for notifications)
      if (previousDataRef.current.length > 0 && settings.notificationsEnabled) {
        const groups = groupByScore(merged, settings.highThreshold, settings.mediumThreshold)
        const newItems = findNewItems(previousTopPerformers, groups.high)
        
        if (newItems.length > 0 && Notification.permission === 'granted') {
          sendNotification(t.newTopPerformers, {
            body: `${newItems.length} ${t.newTopPerformers.toLowerCase()}`
          })
        }
      }

      // Update previous data
      previousDataRef.current = merged
      setPreviousTopPerformers(
        groupByScore(merged, settings.highThreshold, settings.mediumThreshold).high
      )

      // Check if any source failed
      const hasErrors = Object.values(updatedStatuses).some(s => s.status === 'error')
      if (hasErrors && merged.length === 0) {
        setError('All sources failed to load')
      }
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [sources, settings.scriptBaseUrl, settings.highThreshold, settings.mediumThreshold, settings.notificationsEnabled, t])

  // Auto-refresh
  useEffect(() => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
    }

    if (settings.autoRefresh && settings.scriptBaseUrl && !loading) {
      const interval = settings.refreshInterval * 60 * 1000 // Convert minutes to ms
      refreshTimerRef.current = setInterval(() => {
        loadAllData()
      }, interval)
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [settings.autoRefresh, settings.refreshInterval, settings.scriptBaseUrl, loadAllData, loading])

  // Handle toggle source
  const handleToggleSource = (sourceKey) => {
    setSources(prev => 
      prev.map(source => 
        source.key === sourceKey 
          ? { ...source, enabled: !source.enabled }
          : source
      )
    )
  }

  // Handle watchlist toggle
  const handleToggleWatchlist = (id) => {
    const newWatchlist = toggleWatchlist(id, watchlist)
    setWatchlist(newWatchlist)
  }

  // Handle settings change
  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings)
    // Recalculate groups if thresholds changed
    if (normalizedData.length > 0) {
      const groups = groupByScore(
        normalizedData,
        newSettings.highThreshold,
        newSettings.mediumThreshold
      )
      setPreviousTopPerformers(groups.high)
    }
  }

  // Handle notification permission request
  const handleRequestNotificationPermission = async () => {
    const granted = await requestNotificationPermission()
    if (!granted) {
      alert(t.permissionDenied)
    }
  }

  // Calculate groups and distribution
  const groups = normalizedData.length > 0
    ? groupByScore(normalizedData, settings.highThreshold, settings.mediumThreshold)
    : { high: [], medium: [], low: [] }

  const distribution = calculateDistribution(groups, normalizedData.length)

  // Filter watchlist items
  const watchlistItems = normalizedData.filter(item => watchlist.includes(item.id))

  // Calculate stats
  const stats = normalizedData.length > 0 && rawData.length > 0
    ? getNumericColumns(rawData, columns).map(col => ({
        column: col.name,
        ...calculateColumnStats(rawData, col.name)
      }))
    : []

  // Get other columns for table
  const otherColumns = rawData.length > 0 && rawData[0]
    ? Object.keys(rawData[0]).filter(
        key => key !== columns.score && key !== columns.name && key !== columns.ticker
      )
    : []

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t.appTitle}</h1>
      </header>

      <main className="app-main">
        {/* Data Sources */}
        <DataSources
          sources={sources}
          sourceStatuses={sourceStatuses}
          onToggleSource={handleToggleSource}
          t={t}
        />

        {/* Script Base URL Input */}
        <div className="script-url-section">
          <h2>{t.scriptBaseUrl}</h2>
          <div className="url-input-group">
            <input
              type="text"
              className="url-input"
              placeholder={t.scriptBaseUrlPlaceholder}
              value={settings.scriptBaseUrl}
              onChange={(e) => handleSettingsChange({ ...settings, scriptBaseUrl: e.target.value })}
            />
            <button 
              className="load-btn" 
              onClick={loadAllData} 
              disabled={loading || !settings.scriptBaseUrl.trim()}
            >
              {t.loadAllData}
            </button>
          </div>
        </div>

        {/* Settings */}
        <Settings
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onRequestNotificationPermission={handleRequestNotificationPermission}
          t={t}
        />

        {/* Loading */}
        {loading && <Loading t={t} />}

        {/* Error */}
        {error && !loading && (
          <Error error={error} t={t} onClose={() => setError(null)} />
        )}

        {/* Content */}
        {!loading && !error && normalizedData.length > 0 && (
          <>
            {/* Navigation */}
            <nav className="view-nav">
              <button
                className={activeView === 'overview' ? 'active' : ''}
                onClick={() => setActiveView('overview')}
              >
                {t.marketOverview}
              </button>
              <button
                className={activeView === 'top' ? 'active' : ''}
                onClick={() => setActiveView('top')}
              >
                {t.topPerformers}
              </button>
              <button
                className={activeView === 'strong' ? 'active' : ''}
                onClick={() => setActiveView('strong')}
              >
                {t.strong}
              </button>
              <button
                className={activeView === 'watchlist' ? 'active' : ''}
                onClick={() => setActiveView('watchlist')}
              >
                {t.watchlist}
              </button>
              <button
                className={activeView === 'all' ? 'active' : ''}
                onClick={() => setActiveView('all')}
              >
                {t.allData}
              </button>
            </nav>

            {/* Views */}
            {activeView === 'overview' && (
              <>
                <MarketOverview distribution={distribution} t={t} />
                {stats.length > 0 && <Stats stats={stats} t={t} locale={settings.locale} />}
              </>
            )}

            {activeView === 'top' && (
              <ItemList
                items={groups.high}
                title={t.topPerformers}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                t={t}
              />
            )}

            {activeView === 'strong' && (
              <ItemList
                items={groups.medium}
                title={t.strong}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                t={t}
              />
            )}

            {activeView === 'watchlist' && (
              <>
                {watchlistItems.length > 0 ? (
                  <ItemList
                    items={watchlistItems}
                    title={t.watchlist}
                    watchlist={watchlist}
                    onToggleWatchlist={handleToggleWatchlist}
                    t={t}
                  />
                ) : (
                  <div className="empty-watchlist">
                    <p>{t.emptyWatchlist}</p>
                  </div>
                )}
              </>
            )}

            {activeView === 'all' && (
              <DataTable
                data={normalizedData}
                columns={{ otherColumns }}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                t={t}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
