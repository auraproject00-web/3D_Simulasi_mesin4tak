# Simulasi 3D Mesin Bebek 4-Tak

Mesin bebek satu silinder 4-tak 109,1 cc di meja uji, berjalan di browser. Semuanya dibuat dari kode dengan three.js r169: tidak ada file model 3D, gambar, atau rekaman suara.

## Yang disimulasikan

**Tata letak mesin bebek asli.** Silinder rebah 80° ke depan, karburator di atas kepala silinder, knalpot keluar dari bawah lalu lewat kolong ke peredam di kanan. Transmisi di belakang kruk as, magnet (ACG) di kiri, kopling sentrifugal dan tutup kopling di kanan, selah dan tuas pemindah gigi.

**Termodinamika per derajat engkol.** Volume silinder dari posisi seher, kompresi dan ekspansi politropik, pembakaran kurva Wiebe dengan durasi yang bergantung putaran, gas sisa, dan campuran, lalu torsi = tekanan × luas seher × lengan engkol.

**Karburator.** Tekanan intake dihitung dari aliran kompresibel melewati skep yang sama dengan aliran yang dihisap silinder. Lambda ditentukan jet stasioner, jarum, dan pengayaan gas penuh. Choke memperkaya campuran.

**Suhu mesin.** Kepala silinder memanas dari bensin yang terbakar dan gesekan, didinginkan kipas meja uji. Saat dingin, bensin mengembun di dinding sehingga campuran kurus: tanpa choke mesin tersendat atau mati, dengan choke saat panas campuran terlalu kaya dan asap menghitam. Pemanasan dipercepat 6×.

**Penggerak.** Kopling sentrifugal (gaya sepatu ∝ ω², mulai menggigit ±1.800 rpm), gigi primer 69/17, transmisi 4 percepatan rotari N-1-2-3-4, rantai 14/37 ke dinamo arus eddy. Kecepatan setara dihitung dari ban 80/90-17.

**Variasi siklus.** Pembakaran berbeda sedikit tiap siklus, lebih besar saat stasioner dan dingin, jadi stasionernya tidak mulus seperti mesin aslinya. Salah pengapian bisa memicu letupan di knalpot.

**Suara Web Audio.** Dentuman knalpot dijadwalkan dari saat klep buang membuka, dilewatkan resonator pipa dan peredam. Ditambah ketukan klep, motor starter, dengung gigi dan rantai, kipas, dan dinamo.

## Angka

| | Dipublikasikan (kelas 110 cc) | Model |
|---|---|---|
| Diameter × langkah | 50 × 55,6 mm, 109,1 cc | sama |
| Rasio kompresi | 9,0 : 1 | sama |
| Tenaga maksimum | 6,22 kW @ 7.500 rpm | 6,21 kW @ 7.500 rpm |
| Torsi maksimum | 8,59 N·m @ 5.500 rpm | 8,66 N·m @ 5.500 rpm |
| Reduksi primer / akhir | 4,059 / 2,642 | sama |
| Gigi 1-4 | 2,615 / 1,550 / 1,136 / 0,916 | sama |
| Putaran stasioner | – | ± 1.400 rpm (hangat) |

Bukaan klep, kurva pengapian CDI, efisiensi volumetrik, gesekan, kopling, dan pendinginan adalah model yang dikalibrasi ke angka publikasi.

## Menjalankan

```bash
python3 -m http.server 8000
```

lalu buka http://localhost:8000/. Modul ES tidak jalan dari `file://`.

GitHub Pages: Settings → Pages → Deploy from a branch → `main`, folder `/ (root)`.

`dist/mesin-bebek.html` adalah versi satu file (three.js dari CDN) yang bisa dibagikan sendiri.

## Kontrol

| Aksi | Tombol |
|---|---|
| Hidup / mati | `Spasi` |
| Gas | `↑` `↓` |
| Gigi turun / naik | `Q` `E` |
| Choke | `C` |
| Tampilan Utuh / Potong / Tembus | `1` `2` `3` |
| Lambat 1/20 | `S` |
| Lihat busi / transmisi | `B` / `T` |

## Struktur

| Berkas | Isi |
|---|---|
| `src/sim/engine.js` | Geometri engkol, bukaan klep, karbu, VE, pengapian, campuran |
| `src/sim/bench.js` | Siklus per derajat, kopling, transmisi, dinamo, suhu, event |
| `src/model/engine3d.js` | Bak mesin, silinder, kepala, katup, kopling, transmisi, karbu, knalpot |
| `src/model/plug.js` | Busi, loncatan listrik, bunga api, nyala api |
| `src/model/bench3d.js` | Rangka dudukan, dinamo, rantai, kipas, tangki, koil |
| `src/kit.js` | Material (butiran cor, arsiran potongan) dan pembuat geometri |
| `src/audio.js` | Suara |
| `src/ui/instruments.js` | Takometer, roda siklus, diagram P–V |
| `src/main.js` | Kamera, mode tampilan, panel, loop |
| `src/page.html` | Tata letak dan gaya halaman |
| `tools/build.py` | Membuat `index.html` dan `dist/mesin-bebek.html` |
| `tools/tour.cjs`, `tools/shoot.cjs` | Tangkapan layar headless (Playwright) untuk cek visual |
| `tests/*.mjs` | Kalibrasi, dinamika penggerak, kestabilan stasioner |

Setelah mengubah `src/`, jalankan `python3 tools/build.py`, lalu `node tests/calibrate.mjs` dan `node tests/dynamics.mjs`.

Studi independen, tidak berafiliasi dengan pabrikan motor mana pun. Dibuat dengan Claude Opus 5.5.
