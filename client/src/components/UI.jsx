import React from 'react'
import { useLang } from '../context/LangContext.jsx'

export function EmptyState({ icon, text }) {
  const { t } = useLang()
  return (
    <div className="empty-state">
      <div className="icon">{icon || '📭'}</div>
      <div>{text || t('noData')}</div>
    </div>
  )
}

export function Loader() {
  return (
    <div className="d-flex" style={{ justifyContent: 'center', padding: '30px' }}>
      <span className="loader" />
    </div>
  )
}

export function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  const { t } = useLang()
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title || t('confirm')}</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <p>{message || t('confirmDelete')}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>{t('cancel')}</button>
          <button className="btn btn-danger" onClick={onConfirm}>{t('delete')}</button>
        </div>
      </div>
    </div>
  )
}
