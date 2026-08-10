import React from 'react'
import { useLang } from '../context/LangContext.jsx'

export default function StatusBadge({ status }) {
  const { t } = useLang()
  const label = t(status) || status
  return <span className={`badge badge-${status}`}>{label}</span>
}
