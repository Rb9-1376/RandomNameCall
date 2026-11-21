import { randomInt } from 'node:crypto'
import type { DrawResult } from '@shared/types'

export interface EngineDeps {
  cumulativeOf(name: string): number
  bumpCumulative(name: string, delta: number): number
  onTick(name: string): void
  onResult(r: DrawResult): void
  onToast(text: string, kind?: 'ok' | 'warn' | 'err'): void
}

interface LastDraw {
  name: string
  poolIndex: number
  recordId: string
  mode: 'draw' | 'roll'
}

/**
 * 抽签状态机：权威来源是同花顺式的内存池，磁盘只负责持久化。
 * - 不重复点名时 pool 会收缩，抽完自动重置
 * - 权重 = 1 + 累计 "+1" 次数，抽中概率与权重成正比
 */
export class RollEngine {
  private names: string[] = []
  private pool: string[] = []
  private havenames: string[] = []
  private weights = new Map<string, number>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private cursor = 0
  private last: LastDraw | null = null
  private noRepeat = false
  private speed = 60
  private startedAt = 0

  rolling = false

  constructor(private deps: EngineDeps) {}

  load(names: string[], havenames: string[], noRepeat: boolean, speed: number): void {
    this.stopTimer()
    this.rolling = false
    this.names = names.slice()
    this.noRepeat = noRepeat
    this.speed = Math.max(30, speed)
    this.havenames = havenames.filter((n) => names.includes(n))
    this.pool = this.names.filter((n) => !this.havenames.includes(n))
    for (const key of this.weights.keys()) {
      if (!names.includes(key)) this.weights.delete(key)
    }
    this.cursor = 0
  }

  setNoRepeat(v: boolean): void {
    this.noRepeat = v
    this.pool = this.names.filter((n) => !this.havenames.includes(n))
  }

  setSpeed(v: number): void {
    this.speed = Math.max(30, v)
  }

  get size(): number {
    return this.names.length
  }

  get remaining(): number {
    return this.noRepeat ? this.pool.length : this.names.length
  }

  get drawnCount(): number {
    return this.havenames.length
  }

  get namesList(): string[] {
    return this.names.slice()
  }

  get havenamesList(): string[] {
    return this.havenames.slice()
  }

  pooledNames(): string[] {
    return this.available().slice()
  }

  weightOf(name: string): number {
    return this.weights.get(name) ?? 1
  }

  bump(name: string): number {
    if (!this.names.includes(name)) return this.weightOf(name)
    const next = this.weightOf(name) + 1
    this.weights.set(name, next)
    return next
  }

  clearWeights(): void {
    this.weights.clear()
  }

  private available(): string[] {
    return this.noRepeat ? this.pool : this.names
  }

  /** 权重抽签：均匀随机数落在累积区间，避免浮点偏差 */
  private pick(): { name: string; index: number } {
    const list = this.available()
    if (!list.length) return { name: '', index: -1 }
    let total = 0
    for (const n of list) total += this.weightOf(n)
    const r = (randomInt(0, 0x100000000) / 0x100000000) * total
    let acc = 0
    for (let i = 0; i < list.length; i++) {
      acc += this.weightOf(list[i])
      if (r < acc) return { name: list[i], index: i }
    }
    return { name: list[list.length - 1], index: list.length - 1 }
  }

  private makeRecord(name: string, mode: 'draw' | 'roll'): DrawResult {
    const recordId = `${Date.now()}-${randomInt(0, 1e6)}`
    const at = Date.now()
    const total = this.names.length

    let poolIndex = -1
    if (this.noRepeat) {
      poolIndex = this.pool.indexOf(name)
      if (poolIndex >= 0) this.pool.splice(poolIndex, 1)
      if (!this.pool.length) this.deps.onToast('本轮已全部抽完，下次点名自动重置', 'ok')
    }
    if (!this.havenames.includes(name)) this.havenames.push(name)

    const cumulative = this.deps.bumpCumulative(name, 1)
    const result: DrawResult = {
      id: recordId,
      name,
      poolLeft: this.remaining,
      total,
      cumulative,
      at,
      mode
    }
    this.last = { name, poolIndex, recordId, mode }
    return result
  }

  private refillPool(): void {
    this.pool = this.names.slice()
    // 新一轮：已抽记录清空，"剩余 x/y" 与重启后的还原都以本 round 为准
    this.havenames = []
    this.cursor = 0
    if (this.names.length > 0) {
      this.deps.onToast('已开始新一轮点名', 'ok')
    }
  }

  draw(): DrawResult | null {
    if (!this.names.length) {
      this.deps.onToast('名单是空的，先导入姓名', 'warn')
      return null
    }
    if (this.noRepeat && !this.pool.length) this.refillPool()
    const { name } = this.pick()
    if (!name) return null
    const result = this.makeRecord(name, 'draw')
    this.deps.onResult(result)
    return result
  }

  start(): boolean {
    if (this.rolling) return false
    if (!this.names.length) {
      this.deps.onToast('名单是空的，先导入姓名', 'warn')
      return false
    }
    if (this.noRepeat && !this.pool.length) this.refillPool()
    this.rolling = true
    this.startedAt = Date.now()
    const tick = (): void => {
      if (!this.rolling) return
      const list = this.available()
      if (!list.length) {
        this.stop()
        return
      }
      this.cursor = (this.cursor + randomInt(1, 3)) % list.length
      this.deps.onTick(list[this.cursor])
      const elapsed = Date.now() - this.startedAt
      const eased = Math.min(1, elapsed / 800)
      const wait = Math.round(this.speed + (260 - this.speed) * (1 - eased) ** 2)
      this.timer = setTimeout(tick, wait)
    }
    tick()
    return true
  }

  stop(): DrawResult | null {
    if (!this.rolling) return null
    this.stopTimer()
    this.rolling = false
    const list = this.available()
    if (!list.length) return null
    const name = list[Math.min(this.cursor, list.length - 1)]
    const result = this.makeRecord(name, 'roll')
    this.deps.onResult(result)
    return result
  }

  private stopTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  undo(): DrawResult | null {
    if (this.rolling) return null
    const last = this.last
    if (!last) return null
    this.last = null
    if (this.noRepeat && !this.pool.includes(last.name)) {
      const at = Math.max(0, Math.min(last.poolIndex, this.pool.length))
      this.pool.splice(at, 0, last.name)
    }
    this.havenames = this.havenames.filter((n) => n !== last.name)
    const cumulative = this.deps.bumpCumulative(last.name, -1)
    const result: DrawResult = {
      id: last.recordId,
      name: last.name,
      poolLeft: this.remaining,
      total: this.names.length,
      cumulative,
      at: Date.now(),
      mode: last.mode
    }
    return result
  }

  canUndo(): boolean {
    return this.last !== null
  }

  dispose(): void {
    this.stopTimer()
    this.rolling = false
  }
}
