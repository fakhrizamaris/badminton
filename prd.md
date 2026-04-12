Nama Proyek: Apple Academy & Game Institute Badminton Split-Bill
Lokasi Utama: Axton Badminton Hall, Botania 1, Batam.
Target Platform: Cloudflare Pages (pages.dev) menggunakan SvelteKit.

1. Deskripsi Alur Pengguna (User Flow)

Halaman Utama (Landing Page): Pengguna melihat hero banner elegan, informasi lokasi Axton Botania 1 (dengan embed Google Maps), dan daftar kartu (cards) yang berisi jadwal main mingguan.

Pilih Jadwal: Pengguna mengklik salah satu jadwal (misal: "Jumat, 20 April") dan diarahkan ke rute dinamis /session/[id].

Fase RSVP (Halaman Detail): Di halaman ini, pengguna melihat detail lapangan/raket yang disewa admin. Mereka memasukkan nama, dan melihat harga "Estimasi" yang terus menyesuaikan (dynamic split-bill).

Fase Pembayaran (Locked): Setelah admin mengunci sesi, form RSVP hilang berganti dengan tagihan final dan tombol "Bayar via QRIS".

2. Struktur Rute SvelteKit
Aplikasi menggunakan sistem file-based routing milik SvelteKit:

src/routes/+page.svelte (Beranda/Home)

src/routes/session/[id]/+page.svelte (Detail Jadwal Spesifik)

src/routes/admin/+page.svelte (Dasbor Admin)

src/lib/supabase.js (Koneksi Database)

3. Aturan Kalkulasi (Tetap)
((Jumlah Lapangan x Rp 77.000) + (Jumlah Raket x Rp 20.000)) / Total Peserta RSVP pada session tersebut.

4. Panduan Visual (UI/UX)

Tema: Minimalis Apple, mobile-first.

Warna: Navy Blue (#15335E), Putih Bersih, dan Abu-abu terang untuk latar belakang kartu.

Komponen: Kartu jadwal dengan sudut membulat (rounded-2xl), shadow tipis, dan spacing yang lega.