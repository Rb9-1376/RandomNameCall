import type { ThemeName } from './types'

/** 三套主题的默认三色：切主题时自动套用，用户之后仍可单独改 */
export const THEME_PALETTE: Record<ThemeName, { background: string; buttonbg: string; nameColor: string }> = {
  light: { background: '#f6f8fc', buttonbg: '#ffffff', nameColor: '#1b2333' },
  dark: { background: '#0b1020', buttonbg: '#1c2740', nameColor: '#f4f7ff' },
  contrast: { background: '#000000', buttonbg: '#0a0a0a', nameColor: '#ffffff' }
}
