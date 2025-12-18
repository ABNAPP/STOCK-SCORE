import React, { useState } from 'react'
import './Error.css'

export default function Error({ error, t, onClose }) {
  const [showHelp, setShowHelp] = useState(error === 'CORS_ERROR')

  return (
    <div className="error-container">
      <div className="error-card">
        <h3>{t.error}</h3>
        <p>{error === 'CORS_ERROR' ? t.errorCors : t.errorLoadingData}</p>
        
        {showHelp && (
          <div className="error-help">
            <h4>{t.helpTitle}</h4>
            <p>{t.helpText}</p>
            <ol>
              <li>{t.helpStep1}</li>
              <li>{t.helpStep2}</li>
              <li>{t.helpStep3}</li>
              <li>{t.helpStep4}</li>
              <li>{t.helpStep5}</li>
            </ol>
          </div>
        )}
        
        {onClose && (
          <button className="error-close" onClick={onClose}>
            {t.close}
          </button>
        )}
      </div>
    </div>
  )
}

