/// <reference types="vite/client" />
import type { Api, DrawResult, UpdateInfo, UpdateProgress } from '@shared/types'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare global {
  interface Window {
    api: Api
    extra: {
      onUpdate(cb: (info: UpdateInfo) => void): () => void
      onUpdateProgress(cb: (p: UpdateProgress) => void): () => void
      onUpdateDownloaded(cb: (p: { path: string; latest: string }) => void): () => void
      onUpdateDownloadFailed(cb: (p: { reason: string }) => void): () => void
      onOpenSettings(cb: () => void): () => void
      onMetrics(cb: (m: { width: number; height: number; scaleFactor: number }) => void): () => void
      ballMove(dx: number, dy: number): void
      ballSettle(): void
      ballAction(action: 'show' | 'draw' | 'roll' | 'settings' | 'hide'): void
      onBallState(cb: (s: { expanded: boolean; side: 'left' | 'right' }) => void): () => void
      flush(): void
    }
  }
}

export type { DrawResult }
