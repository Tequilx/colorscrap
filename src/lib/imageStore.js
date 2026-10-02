// IndexedDB ของเครื่อง (เขียนเองสั้น ๆ ไม่ใช้ไลบรารี)
// โหมดจริง: เก็บเฉพาะ entry ที่ยังอัปโหลดขึ้น Supabase ไม่สำเร็จ (มี user_id ของเจ้าของ) ลบเมื่อสำเร็จ (SPEC §6.6)
// โหมดจำลอง: เก็บ entries ที่บันทึกไว้ถาวรเหมือนช่วงก่อนขั้นที่ 7 (ไม่มี user_id) record แบบนี้ในโหมดจริงคือภาพเก่าที่เสนอให้ย้ายขึ้น
// ทุกฟังก์ชันไม่โยน error: ถ้า IndexedDB ใช้ไม่ได้ (private mode, โควตาเต็ม) แอปยังทำงานต่อได้แต่ข้อมูลหายเมื่อรีเฟรช
const DB_NAME = 'colorscrap'
const STORE = 'entries'

let dbPromise = null

const openDb = () => {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

const run = async (mode, work) => {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const result = work(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(result.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// record = entry แบบ plain (ไม่ใช่ reactive proxy) ที่มี Blob image/thumb ได้
export const saveRecord = async (record) => {
  try {
    await run('readwrite', (store) => store.put(record))
    return true
  } catch (error) {
    console.error('บันทึกลง IndexedDB ไม่สำเร็จ:', error)
    return false
  }
}

export const loadRecords = async () => {
  try {
    return await run('readonly', (store) => store.getAll())
  } catch (error) {
    console.error('อ่านจาก IndexedDB ไม่สำเร็จ:', error)
    return []
  }
}

export const deleteRecord = async (id) => {
  try {
    await run('readwrite', (store) => store.delete(id))
    return true
  } catch (error) {
    console.error('ลบจาก IndexedDB ไม่สำเร็จ:', error)
    return false
  }
}
