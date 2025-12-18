import React, { useState } from 'react'
import './Error.css'

export default function Error({ error, t, onClose }) {
  const isCorsError = error === 'CORS_ERROR' || error === 'CORS_SHEETS' || error?.includes('CORS')
  const isCorsSheets = error === 'CORS_SHEETS'
  const isInvalidUrl = error?.includes('Invalid URL') || error?.includes('Fel URL')
  const showHelp = isCorsError || isInvalidUrl

  return (
    <div className="error-container">
      <div className="error-card">
        <h3>{t.error}</h3>
        <p>
          {isCorsSheets ? t.errorCorsSheets :
           isCorsError ? t.errorCors : 
           isInvalidUrl ? t.errorInvalidUrl : 
           t.errorLoadingData}
        </p>
        
        {showHelp && (
          <div className="error-help">
            <h4>{isCorsSheets ? t.helpTitleSheets : t.helpTitle}</h4>
            <p>{isCorsSheets ? t.helpTextSheets : t.helpText}</p>
            <ol>
              <li>{t.helpStep1}</li>
              <li>{t.helpStep2}</li>
              <li>{t.helpStep3}</li>
              <li>{t.helpStep4}</li>
              <li>{t.helpStep5}</li>
              {t.helpStep6 && <li>{t.helpStep6}</li>}
            </ol>
            {t.helpNote && (
              <p className="help-note"><strong>{isCorsSheets ? t.helpNote : t.helpNoteSheets || t.helpNote}</strong></p>
            )}
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

