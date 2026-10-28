// สลับแอปบน iPad/iPhone (ข้อ 59b): hidden → visible → แตะ → ctx.resume() ถูกเรียกและเพลงเล่นต่อ · resume ไม่ขึ้น/ถูก close → สร้าง context ใหม่ต่อกราฟใหม่แล้วเพลงเล่นต่อ
// ข้อ 61a: เพลงเป็นสตรีม HTMLAudioElement ต่อผ่าน MediaElementSource: preload ตอนโหลด · play() ในเหตุการณ์แตะแรกแบบซิงก์ · fade in 1.5 วินาที · ซ่อน → pause, กลับมา → play() (ถูกปฏิเสธ = เล่นตอนแตะครั้งถัดไป)
import { describe, it, expect, vi, beforeAll } from 'vitest'

const made = []
class MockParam {
  constructor(v = 0) { this.value = v; this.ramps = [] }
  setValueAtTime(v) { this.value = v }
  linearRampToValueAtTime(v, t) { this.value = v; this.ramps.push([v, t]) }
  exponentialRampToValueAtTime(v) { this.value = v }
  setTargetAtTime(v) { this.value = v }
  cancelScheduledValues() {}
}
class MockNode {
  connect(n) { return n ?? this }
  disconnect() {}
}
class MockGain extends MockNode { gain = new MockParam(1) }
const audios = []
class MockAudio {
  static reject = false
  constructor() { this.paused = true; this.currentTime = 0; this.playCalls = 0; this.loadCalls = 0; this.loop = false; this.preload = ''; audios.push(this) }
  load() { this.loadCalls++ }
  play() {
    this.playCalls++
    if (MockAudio.reject) return Promise.reject(new Error('NotAllowedError'))
    this.paused = false
    return Promise.resolve()
  }
  pause() { this.paused = true }
}
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
    this.media = [] // element ที่ต่อ MediaElementSource
    this.gains = []
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
  createGain() { const g = new MockGain(); this.gains.push(g); return g }
  createMediaElementSource(el) { this.media.push(el); return new MockNode() }
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
  globalThis.Audio = MockAudio
  globalThis.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  soundMod = await import('./sound')
  musicMod = await import('./music')
  soundMod.attachSound()
  musicMod.attachMusic()
})

const musicSources = (ctx) => ctx.media.filter((el) => !el.paused) // เพลงที่กำลังเล่นบน context นั้น

describe('เพลงสตรีม (ข้อ 61a)', () => {
  it('เริ่มโหลดตั้งแต่หน้าโหลด (ก่อนแตะ): element วนซ้ำ preload=auto เรียก load() แต่ยังไม่เล่น และยังไม่มี AudioContext', () => {
    expect(made).toHaveLength(0)
    expect(soundMod.audioState.value).toBe('idle')
    expect(audios).toHaveLength(1)
    expect(audios[0]).toMatchObject({ preload: 'auto', loop: true, loadCalls: 1, playCalls: 0, paused: true })
  })
  it('แตะครั้งแรก → play() ถูกเรียกทันทีภายในเหตุการณ์นั้น (ซิงก์ ไม่รอ await) และใช้ element ที่โหลดไว้แล้ว', () => {
    tap()
    expect(audios).toHaveLength(1)
    expect(audios[0].playCalls).toBe(1)
    expect(audios[0].paused).toBe(false)
  })
  it('fade in ประมาณ 1.5 วินาที: gain ของเพลงเริ่ม 0 แล้วไล่ขึ้น 1 ภายใน 1.5 s', () => {
    const gain = made[0].gains.at(-1).gain
    expect(musicMod.FADE_IN_MS).toBe(1500)
    expect(gain.ramps[0]).toEqual([1, 1.5])
  })
})

describe('สลับแอปแล้วเสียงกลับมา', () => {
  it('แตะครั้งแรก → สร้าง context และเพลงเริ่ม', async () => {
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
    expect(audios[0].paused).toBe(true) // ซ่อนหน้า → หยุดสตรีม
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
    expect(ctx.media).toHaveLength(1)
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
    expect(fresh.media[0]).not.toBe(old.media[0]) // element ใหม่ (element เดิมต่อ context เก่าไปแล้ว)
    expect(old.media[0].paused).toBe(true)
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

  it('กลับมาแล้ว play() ถูกปฏิเสธ (ไม่มี gesture) → รอแตะ แล้ว play() ในเหตุการณ์นั้นแบบซิงก์', async () => {
    const el = made[2].media[0]
    setHidden(true)
    expect(el.paused).toBe(true)
    MockAudio.reject = true
    setHidden(false)
    await flush()
    expect(el.paused).toBe(true)
    MockAudio.reject = false
    const n = el.playCalls
    tap('touchend')
    expect(el.playCalls).toBe(n + 1)
    expect(el.paused).toBe(false)
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
