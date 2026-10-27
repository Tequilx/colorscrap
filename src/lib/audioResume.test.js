// สลับแอปบน iPad/iPhone (ข้อ 59b): hidden → visible → แตะ → ctx.resume() ถูกเรียกและเพลงเล่นต่อ · resume ไม่ขึ้น/ถูก close → สร้าง context ใหม่ต่อกราฟใหม่แล้วเพลงเล่นต่อ
import { describe, it, expect, vi, beforeAll } from 'vitest'

const made = []
class MockParam {
  constructor(v = 0) { this.value = v }
  setValueAtTime(v) { this.value = v }
  linearRampToValueAtTime(v) { this.value = v }
  exponentialRampToValueAtTime(v) { this.value = v }
  setTargetAtTime(v) { this.value = v }
  cancelScheduledValues() {}
}
class MockNode {
  connect(n) { return n ?? this }
  disconnect() {}
}
class MockGain extends MockNode { gain = new MockParam(1) }
class MockSource extends MockNode {
  constructor() { super(); this.started = false; this.playbackRate = new MockParam(1) }
  start() { this.started = true }
  stop() { this.stopped = true }
}
class MockAudioContext extends EventTarget {
  constructor() {
    super()
    this.state = 'running'
    this.currentTime = 0
    this.sampleRate = 44100
    this.destination = new MockNode()
    this.resumeCalls = 0
    this.sources = []
    this.resumeMode = 'ok' // ok | stuck (promise ค้าง เหมือน iOS interrupted)
    made.push(this)
  }
  setState(s) { this.state = s; this.dispatchEvent(new Event('statechange')) }
  resume() {
    this.resumeCalls++
    if (this.resumeMode === 'stuck') return new Promise(() => {})
    this.setState('running')
    return Promise.resolve()
  }
  suspend() { this.setState('suspended'); return Promise.resolve() }
  close() { this.setState('closed'); return Promise.resolve() }
  createGain() { return new MockGain() }
  createDynamicsCompressor() { return Object.assign(new MockNode(), { threshold: new MockParam(), knee: new MockParam(), ratio: new MockParam(), attack: new MockParam(), release: new MockParam() }) }
  createWaveShaper() { return new MockNode() }
  createBuffer(ch, len) { return { length: len, duration: len / 44100, getChannelData: () => new Float32Array(len) } }
  createBufferSource() { const s = new MockSource(); this.sources.push(s); return s }
  decodeAudioData() { return Promise.resolve({ duration: 4, numberOfChannels: 1, sampleRate: 44100, getChannelData: () => new Float32Array(44100 * 4).fill(0.5) }) }
}

const flush = () => new Promise((r) => setTimeout(r, 0))
const tap = (type = 'pointerdown') => window.dispatchEvent(new Event(type))
const setHidden = (hidden) => {
  document.hidden = hidden
  document.dispatchEvent(new Event('visibilitychange'))
}

let soundMod
let musicMod

beforeAll(async () => {
  await import('vue') // โหลดก่อนมี document จำลอง ไม่งั้น runtime-dom หยิบ document ปลอมไปใช้
  globalThis.window = new EventTarget()
  globalThis.document = Object.assign(new EventTarget(), { hidden: false })
  globalThis.AudioContext = MockAudioContext
  globalThis.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  soundMod = await import('./sound')
  musicMod = await import('./music')
  soundMod.attachSound()
  musicMod.attachMusic()
})

const musicSources = (ctx) => ctx.sources.filter((s) => s.loop)

describe('สลับแอปแล้วเสียงกลับมา', () => {
  it('แตะครั้งแรก → สร้าง context และเพลงเริ่ม', async () => {
    expect(soundMod.audioState.value).toBe('idle')
    tap()
    await flush()
    await flush()
    expect(made).toHaveLength(1)
    expect(made[0].state).toBe('running')
    expect(soundMod.audioState.value).toBe('running')
    expect(musicSources(made[0])).toHaveLength(1)
  })

  it('hidden → suspend · visible → ยังไม่ resume จนกว่าจะแตะ · แตะแล้ว resume() ถูกเรียกและกลับมา running', async () => {
    const ctx = made[0]
    setHidden(true)
    await flush()
    expect(ctx.state).toBe('suspended')
    const before = ctx.resumeCalls
    // iOS: กลับมาแล้วอยู่สถานะ interrupted และ resume() เองไม่สำเร็จ
    ctx.resumeMode = 'stuck'
    setHidden(false)
    await flush()
    ctx.setState('interrupted')
    expect(soundMod.audioState.value).toBe('blocked')
    ctx.resumeMode = 'ok'
    tap('touchend')
    await flush()
    await flush()
    expect(ctx.resumeCalls).toBeGreaterThan(before)
    expect(ctx.state).toBe('running')
    expect(soundMod.audioState.value).toBe('running')
    expect(made).toHaveLength(1) // ไม่สร้าง context ใหม่เมื่อ resume ได้
    expect(musicSources(ctx)).toHaveLength(1) // เพลงเดิมเล่นต่อ ไม่ซ้อน
  })

  it('listener ปลุกเป็นแบบครั้งเดียว: แตะซ้ำตอน running ไม่เรียก resume เพิ่ม', async () => {
    const ctx = made[0]
    const n = ctx.resumeCalls
    tap()
    tap('keydown')
    await flush()
    expect(ctx.resumeCalls).toBe(n)
  })

  it('resume ค้าง (ไม่ขึ้นใน 800 ms) → สร้าง context ใหม่ ต่อกราฟใหม่ และเพลงเล่นต่อ', async () => {
    vi.useFakeTimers()
    const old = made[0]
    setHidden(true)
    old.resumeMode = 'stuck'
    setHidden(false)
    old.setState('interrupted')
    tap()
    await vi.advanceTimersByTimeAsync(soundMod.RESUME_TIMEOUT_MS + 50)
    vi.useRealTimers()
    await flush()
    await flush()
    expect(made).toHaveLength(2)
    expect(old.state).toBe('closed')
    const fresh = made[1]
    expect(fresh.state).toBe('running')
    expect(musicSources(fresh)).toHaveLength(1)
    expect(musicSources(fresh)[0].started).toBe(true)
    expect(soundMod.audioState.value).toBe('running')
  })

  it('context ถูก close โดยระบบ → แตะแล้วสร้างใหม่ เพลงเล่นต่อ', async () => {
    const old = made[1]
    old.setState('closed')
    expect(soundMod.audioState.value).toBe('blocked')
    tap('pointerdown')
    await flush()
    await flush()
    await flush()
    expect(made).toHaveLength(3)
    expect(musicSources(made[2])).toHaveLength(1)
  })

  it('ผู้ใช้ปิดเพลงไว้ → ไม่เล่นต่อหลังสร้างใหม่ และปุ่มยังเป็นปิด', async () => {
    soundMod.setMusic(false)
    const cur = made[2]
    setHidden(true)
    cur.resumeMode = 'stuck'
    setHidden(false)
    cur.setState('interrupted')
    tap()
    await new Promise((r) => setTimeout(r, soundMod.RESUME_TIMEOUT_MS + 100))
    expect(made).toHaveLength(4)
    expect(musicSources(made[3])).toHaveLength(0)
    expect(soundMod.musicOn.value).toBe(false)
  })

  it('ปิดเสียงเอฟเฟกต์ → สลับแอปกลับมาแล้วปุ่มยังเป็นปิด (ค่าที่ผู้ใช้ตั้งไม่ถูกทับ แม้ localStorage อ่านไม่ได้)', async () => {
    soundMod.setSound(false)
    setHidden(true)
    setHidden(false)
    window.dispatchEvent(new Event('pageshow'))
    await flush()
    expect(soundMod.soundOn.value).toBe(false)
    expect(soundMod.musicOn.value).toBe(false)
  })
})
