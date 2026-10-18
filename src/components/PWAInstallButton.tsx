import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 transition"
      >
        <Download className="w-3.5 h-3.5" />
        Instalar App
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
        >
          <Download className="w-3.5 h-3.5" />
          Instalar en iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-stone-900">
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">Instalar en iPhone / iPad</h3>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                1. Toca el botón <strong>Compartir</strong> en la barra de Safari.<br />
                2. Desplázate hacia abajo y toca <strong>Añadir al inicio</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-stone-100 py-2 text-sm font-bold text-stone-800 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
