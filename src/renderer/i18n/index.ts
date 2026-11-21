// 轻量 i18n：无依赖，响应式切换，zh 兜底。
// 体积优化：除中文外的 12 种语言按需懒加载（切到该语言才请求对应 chunk），首屏只带中文。
import { ref } from 'vue'
import { zh, type Dict } from './locales'

export interface LanguageMeta {
  code: string
  label: string
  dir: 'ltr' | 'rtl'
}

export const LANGUAGES: LanguageMeta[] = [
  { code: 'zh', label: '简体中文', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'ko', label: '한국어', dir: 'ltr' },
  { code: 'ja', label: '日本語', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'hi', label: 'हिन्दी', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'bo', label: 'བོད་ཡིག', dir: 'ltr' },
  { code: 'ug', label: 'ئۇيغۇرچە', dir: 'rtl' },
  { code: 'mn', label: 'ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ', dir: 'ltr' },
  { code: 'ii', label: 'ꆈꌠꉙ', dir: 'ltr' }
]

const dicts: Record<string, Dict> = { zh }
const current = ref('zh')

// 静态 loader 表：保证 Vite 把每种语言切成独立 chunk（首屏只含中文）
const loaders: Record<string, () => Promise<{ default: Dict }>> = {
  en: () => import('./locales/en'),
  ru: () => import('./locales/ru'),
  ko: () => import('./locales/ko'),
  ja: () => import('./locales/ja'),
  ar: () => import('./locales/ar'),
  es: () => import('./locales/es'),
  hi: () => import('./locales/hi'),
  fr: () => import('./locales/fr'),
  bo: () => import('./locales/bo'),
  ug: () => import('./locales/ug'),
  mn: () => import('./locales/mn'),
  ii: () => import('./locales/ii')
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = dicts[current.value] ?? zh
  let s: string = (dict as Record<string, string>)[key] ?? (zh as Record<string, string>)[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}

export function currentLang(): string {
  return current.value
}

/** 切换语言：未加载的语言包按需动态 import（首屏零负担） */
export async function setLang(code: string): Promise<void> {
  if (!isValidLang(code)) return
  if (!dicts[code] && loaders[code]) {
    const mod = await loaders[code]()
    dicts[code] = mod.default
  }
  current.value = code
}

export function dirOf(code: string): 'ltr' | 'rtl' {
  return LANGUAGES.find((l) => l.code === code)?.dir ?? 'ltr'
}

export function isValidLang(code: string): boolean {
  return LANGUAGES.some((l) => l.code === code)
}
