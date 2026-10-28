# Simulasi 3D Mesin 4-Tak

Mesin motor satu silinder 4-tak 109 cc (tipe mesin bebek) yang benar-benar berputar di browser. Semuanya dibuat dari kode dengan three.js: tidak ada file model 3D, gambar, atau rekaman suara.

## Fitur

- **Model 3D prosedural**: bak mesin, blok silinder bersirip, kepala silinder, seher, stang seher, kruk as, roda gila, kem, pelatuk, klep dengan pegas, rantai keteng, karburator dengan skep yang bergerak, busi lengkap, knalpot, dan meja uji dengan dinamo rem cakram.
- **Simulasi fisika per derajat engkol**: volume silinder dari posisi seher, tekanan gas (hisap, kompresi politropik, pembakaran kurva Wiebe, buang), torsi dari tekanan × luas seher × lengan engkol, gesekan, starter, dekompresi, pembatas putaran 9.500 rpm.
- **Tiga tampilan**: Utuh, Potong (setengah rumah mesin dipotong, bidang potong diarsir), dan Tembus.
- **Mode lambat 1/20** dan tombol **Lihat busi**: kamera zoom ke busi untuk melihat loncatan listrik, bunga api, dan nyala api yang merambat di ruang bakar.
- **Suara sintesis** Web Audio yang dijadwalkan dari event klep buang di simulasi.
- **Instrumen**: takometer, roda siklus 720° dengan bukaan klep dan titik pengapian, diagram P–V, tenaga dan torsi dinamo, tekanan puncak, konsumsi bensin, suhu cakram rem.

## Menjalankan

Buka `index.html` lewat server lokal (modul ES tidak jalan dari `file://`):

```bash
python3 -m http.server 8000
```

lalu buka http://localhost:8000/.

### GitHub Pages

Settings → Pages → Source: **Deploy from a branch**, pilih branch `main` dan folder `/ (root)`. Halaman akan tersedia di `https://auraproject00-web.github.io/3D_Simulasi_mesin4tak/`.

## Struktur

| File | Isi |
|---|---|
| `index.html` | Halaman jadi (hasil build), siap dibuka |
| `src/sim.js` | Simulasi mesin: kinematika, tekanan silinder, torsi, starter, event |
| `src/app.js` | Model 3D, mode tampilan, busi dan percikan, suara, instrumen, kontrol |
| `src/page.html` | Tata letak dan gaya halaman |
| `build.py` | Menggabungkan `src/` menjadi `index.html` |
| `tests/sim_check.mjs` | Cek angka simulasi: stasioner, kurva tenaga, berhenti |
| `tests/sim_audit.mjs` | Skenario bug: mati karena beban, nyala ulang, limiter, input acak |

Setelah mengubah file di `src/`, jalankan `python3 build.py` lalu `node tests/sim_check.mjs`.

## Kontrol

| Aksi | Tombol |
|---|---|
| Hidup / mati | `Spasi` atau tombol *Hidupkan mesin* |
| Gas | `↑` `↓` atau slider |
| Tampilan Utuh / Potong / Tembus | `1` `2` `3` |
| Lambat 1/20 | `S` |
| Lihat busi | `B` |

Putar kamera dengan geser, zoom dengan cubit atau gulir.

## Hasil model

| | |
|---|---|
| Diameter × langkah | 50 × 55,6 mm (109 cc), kompresi 9,3 : 1 |
| Putaran stasioner | ± 1.350 rpm |
| Torsi puncak | 9,2 N·m @ 5.500 rpm |
| Tenaga puncak | 7,6 hp @ 6.500 rpm |

Semua angka keluar dari model ini, bukan data pabrikan mana pun.

Dibuat dengan Claude Opus 5.5.
