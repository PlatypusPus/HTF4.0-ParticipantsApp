/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

const TYPE_STYLES = {
  success: 'bg-primary-container text-on-primary-container border-black',
  error:   'bg-error-container text-on-error-container border-error',
  info:    'bg-surface-container text-on-surface border-black',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-3), { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const toast = {
    success: msg => push(msg, 'success'),
    error:   msg => push(msg, 'error'),
    info:    msg => push(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 inset-x-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`${TYPE_STYLES[t.type]} border-4 px-5 py-3 font-body font-bold text-sm drop-block rounded-2xl max-w-sm w-full text-center`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
