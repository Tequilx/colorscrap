import { describe, it, expect } from 'vitest'
import { MAX_LIKES, isLikeLocked, likesOverLimit, toggleLikeList } from './likes'

describe('ใจฟูสูงสุด 3', () => {
  it('เพิ่มได้จนครบ 3 แล้วเพิ่มอีกไม่ได้ (รายการไม่เปลี่ยน)', () => {
    let l = []
    for (const x of ['เพลง', 'แมว', 'กาแฟ', 'ทะเล']) l = toggleLikeList(l, x)
    expect(l).toEqual(['เพลง', 'แมว', 'กาแฟ'])
    expect(l.length).toBe(MAX_LIKES)
  })
  it('กดอันที่เลือกไว้เพื่อเอาออกได้เสมอ แล้วเพิ่มอันใหม่ได้', () => {
    let l = ['เพลง', 'แมว', 'กาแฟ']
    l = toggleLikeList(l, 'แมว')
    expect(l).toEqual(['เพลง', 'กาแฟ'])
    l = toggleLikeList(l, 'ทะเล')
    expect(l).toEqual(['เพลง', 'กาแฟ', 'ทะเล'])
  })
  it('isLikeLocked: ล็อกเฉพาะอันที่ยังไม่เลือกเมื่อครบแล้ว', () => {
    const l = ['เพลง', 'แมว', 'กาแฟ']
    expect(isLikeLocked(l, 'ทะเล')).toBe(true)
    expect(isLikeLocked(l, 'แมว')).toBe(false)
    expect(isLikeLocked(['เพลง'], 'ทะเล')).toBe(false)
  })
  it('โปรไฟล์เดิมเกิน 3: เอาออกได้ เพิ่มไม่ได้ และ likesOverLimit จนเหลือ ≤ 3', () => {
    let l = ['เพลง', 'แมว', 'กาแฟ', 'เกม', 'ทะเล']
    expect(likesOverLimit(l)).toBe(true)
    expect(toggleLikeList(l, 'วาดรูป')).toEqual(l)
    l = toggleLikeList(toggleLikeList(l, 'เกม'), 'ทะเล')
    expect(likesOverLimit(l)).toBe(false)
  })
})
