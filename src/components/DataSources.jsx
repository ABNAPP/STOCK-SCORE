import React from 'react'
import './DataSources.css'

export default function DataSources({ sources, sourceStatuses, onToggleSource, t }) {
  return (
    <div className="data-sources-section">
      <h2>{t.dataSources}</h2>
      <div className="sources-grid">
        {sources.map(source => {
          const status = sourceStatuses[source.key] || { status: 'idle', message: '' }
          const isEnabled = source.enabled

          return (
            <div key={source.key} className={`source-card ${status.status} ${isEnabled ? 'enabled' : 'disabled'}`}>
              <div className="source-header">
                <div className="source-name-group">
                  <h3>{source.name}</h3>
                  <label className="source-toggle">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => onToggleSource(source.key)}
                    />
                    <span>{isEnabled ? t.enabled : t.disabled}</span>
                  </label>
                </div>
              </div>
              
              <div className="source-status">
                {status.status === 'loading' && (
                  <div className="status-loading">
                    <span className="status-icon">⏳</span>
                    <span>{t.loading}</span>
                  </div>
                )}
                {status.status === 'success' && (
                  <div className="status-success">
                    <span className="status-icon">✅</span>
                    <span>{t.ok} ({status.count || 0} {t.rows})</span>
                  </div>
                )}
                {status.status === 'error' && (
                  <div className="status-error">
                    <span className="status-icon">⚠️</span>
                    <span>{status.message || t.error}</span>
                  </div>
                )}
                {status.status === 'idle' && (
                  <div className="status-idle">
                    <span>{t.notLoaded}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

