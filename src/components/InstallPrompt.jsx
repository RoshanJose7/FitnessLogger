import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'

const DISMISSED_KEY = 'pwa-install-dismissed'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIOSHint, setShowIOSHint] = useState(false)

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return

    if (isIOS()) {
      setShowIOSHint(true)
      return
    }

    function handleBeforeInstall(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDeferredPrompt(null)
    setShowIOSHint(false)
  }

  async function install() {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  if (!deferredPrompt && !showIOSHint) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:w-72 bg-white border border-black p-4 z-50 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Add to Home Screen</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {showIOSHint
              ? 'Tap the Share button then "Add to Home Screen"'
              : 'Install for a faster, app-like experience'}
          </p>
        </div>
        <button onClick={dismiss} className="text-gray-400 hover:text-black transition-colors shrink-0">
          <X size={16} />
        </button>
      </div>
      {deferredPrompt && (
        <button
          onClick={install}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-black text-white text-sm py-2 font-medium hover:bg-gray-800 transition-colors"
        >
          <Download size={14} />
          Install
        </button>
      )}
    </div>
  )
}
