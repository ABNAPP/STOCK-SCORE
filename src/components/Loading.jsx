import React from 'react'
import './Loading.css'

export default function Loading({ t }) {
  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>{t.loading}</p>
    </div>
  )
}

