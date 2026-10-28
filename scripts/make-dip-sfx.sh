#!/usr/bin/env bash
# เตรียมเสียงจุ่มพู่กันจากต้นฉบับ docs/design/audio-src/: ตัดเงียบหัว ยาว ≤ 600 ms fade out 100 ms ตัด < 120 Hz (2 ชั้น) mono แล้วปรับยอด −6 dBFS → mp3 96 kbps
# ใช้: scripts/make-dip-sfx.sh   (สร้างเฉพาะ src/assets/sfx/dip-1.mp3 จาก docs/design/audio-src/dip-b.mp3)
#      scripts/make-dip-sfx.sh <ต้นฉบับ> <ปลายทาง> สำหรับไฟล์อื่น
set -euo pipefail
in="${1:-docs/design/audio-src/dip-b.mp3}"; out="${2:-src/assets/sfx/dip-1.mp3}"
chain="silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.004,highpass=f=120,highpass=f=120,atrim=0:0.6,asetpts=N/SR/TB"
peak=$(ffmpeg -hide_banner -i "$in" -ac 1 -af "$chain,volumedetect" -f null - 2>&1 | sed -n 's/.*max_volume: \(-\{0,1\}[0-9.]*\) dB.*/\1/p')
gain=$(python3 -c "print(round(-6 - ($peak), 2))")
len=$(ffmpeg -hide_banner -i "$in" -ac 1 -af "$chain" -f null - 2>&1 | grep -o 'time=[0-9:.]*' | tail -1 | cut -d= -f2 | awk -F: '{print $1*3600+$2*60+$3}')
st=$(python3 -c "print(max(0, round($len - 0.1, 3)))")
ffmpeg -v error -y -i "$in" -ac 1 -af "$chain,volume=${gain}dB,afade=t=out:st=${st}:d=0.1" -c:a libmp3lame -b:a 96k "$out"
# วัดซ้ำหลังเข้ารหัส mp3 แล้วชดเชยส่วนต่าง (ยอดหลังเข้ารหัส/fade ไม่ตรงกับที่วัดก่อน)
got=$(ffmpeg -hide_banner -i "$out" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-\{0,1\}[0-9.]*\) dB.*/\1/p')
fix=$(python3 -c "print(round(-6 - ($got), 2))")
ffmpeg -v error -y -i "$in" -ac 1 -af "$chain,volume=$(python3 -c "print(round($gain + $fix, 2))")dB,afade=t=out:st=${st}:d=0.1" -c:a libmp3lame -b:a 96k "$out"
echo "$out: peak ${peak} dB -> gain ${gain} dB, length ${len}s"
