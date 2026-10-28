#!/bin/sh
# เตรียมไฟล์เพลงคลอจากต้นฉบับใน docs/design/audio-src/music-<day|night>-src.mp3 → src/assets/audio/music-<day|night>.mp3
#  - ตัดความเงียบหัว/ท้าย (head/end วัดด้วย silencedetect -50 dB) · เพลงต้องมีเสียงภายใน 0.3 วินาทีแรก
#  - ทำ loop ให้ต่อกันเนียน: ท้ายไฟล์ = crossfade (equal power, X วินาที) ของช่วงท้าย → ช่วงหัวของไฟล์ แล้วไฟล์เริ่มที่ S วินาที (ข้ามช่วงนำเข้าที่เบาเกินไป)
#    ดังนั้นตอน <audio loop> วนจากท้ายกลับหัว เนื้อเพลงต่อกันพอดี ไม่มีช่องเงียบ ไม่มีรอยตัด
#  - เข้ารหัส stereo mp3 112 kbps (LAME ใส่ header gapless ให้) ไฟล์ใน src/assets จะถูก Vite ใส่ hash ในชื่อ → cache ยาวได้ (vercel.json / public/_headers)
# ใช้: sh scripts/make-music.sh   (ต้องมี ffmpeg)
set -e
cd "$(dirname "$0")/.."
X=4
calc() { awk "BEGIN { printf \"%.3f\", $1 }"; } # bc พิมพ์ .8 ไม่มี 0 นำหน้า ffmpeg อ่านไม่ได้
make() { # ชื่อ headSeconds endSeconds startSeconds (S = จุดที่ไฟล์เริ่ม/จุดวนกลับ นับจากหลังตัดหัว ต้องเป็นช่วงที่ได้ยินชัด ≥ X)
  name=$1; H=$2; E=$3; S=$4
  L=$(calc "$E - $H")
  B=$(calc "$L - $X")
  ffmpeg -v error -y -i "docs/design/audio-src/music-$name-src.mp3" -filter_complex "
    [0:a]atrim=start=$H:end=$E,asetpts=PTS-STARTPTS,asplit=3[a][b][c];
    [a]atrim=start=$S:end=$B,asetpts=PTS-STARTPTS[body];
    [b]atrim=start=$B:end=$L,asetpts=PTS-STARTPTS[tail];
    [c]atrim=start=$(calc "$S - $X"):end=$S,asetpts=PTS-STARTPTS[head];
    [tail][head]acrossfade=d=$X:c1=qsin:c2=qsin[cross];
    [body][cross]concat=n=2:v=0:a=1[out]" -map "[out]" -ar 44100 -ac 2 -c:a libmp3lame -b:a 112k "src/assets/audio/music-$name.mp3"
}
make day 0 136.0 4
make night 3.19 268.85 4.8
ls -l src/assets/audio
