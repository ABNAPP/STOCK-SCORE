import React, { useState } from 'react'
import './Settings.css'

export default function Settings({
  settings,
  onSettingsChange,
  onRequestNotificationPermission,
  t
}) {
  const [isOpen, setIsOpen] = useState(false)

  const handleChange = (key, value) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="settings-container">
      <button className="settings-toggle" onClick={() => setIsOpen(!isOpen)}>
        {t.settings} {isOpen ? '▼' : '▶'}
      </button>
      
      {isOpen && (
        <div className="settings-panel">
          <div className="settings-section">
            <label>
              <span>{t.language}:</span>
              <select
                value={settings.locale}
                onChange={(e) => handleChange('locale', e.target.value)}
              >
                <option value="sv">Svenska</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>

          <div className="settings-section">
            <label>
              <span>{t.theme}:</span>
              <select
                value={settings.theme}
                onChange={(e) => handleChange('theme', e.target.value)}
              >
                <option value="light">{t.light}</option>
                <option value="dark">{t.dark}</option>
              </select>
            </label>
          </div>

          <div className="settings-section">
            <label>
              <input
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={(e) => handleChange('autoRefresh', e.target.checked)}
              />
              <span>{t.autoRefresh}</span>
            </label>
          </div>

          {settings.autoRefresh && (
            <div className="settings-section">
              <label>
                <span>{t.refreshInterval}:</span>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={settings.refreshInterval}
                  onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value) || 30)}
                />
              </label>
            </div>
          )}

          <div className="settings-section">
            <label>
              <span>{t.thresholdHigh}:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.highThreshold}
                onChange={(e) => handleChange('highThreshold', parseInt(e.target.value) || 70)}
              />
            </label>
          </div>

          <div className="settings-section">
            <label>
              <span>{t.thresholdMedium}:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.mediumThreshold}
                onChange={(e) => handleChange('mediumThreshold', parseInt(e.target.value) || 50)}
              />
            </label>
          </div>

          <div className="settings-section">
            <div className="notification-controls">
              <label>
                <input
                  type="checkbox"
                  checked={settings.notificationsEnabled}
                  onChange={(e) => handleChange('notificationsEnabled', e.target.checked)}
                />
                <span>{t.enableNotifications}</span>
              </label>
              {settings.notificationsEnabled && (
                <button
                  className="notification-permission-btn"
                  onClick={onRequestNotificationPermission}
                >
                  {t.permissionRequest}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

