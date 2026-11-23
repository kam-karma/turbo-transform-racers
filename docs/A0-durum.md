# A0 his prototipi: durum

*23 Kasım 2026 gecesi. Tasarım: `docs/2026-11-23-yaris-oyunu-tasarim.md`. Plan: `docs/plans/2026-11-23-a0-his-prototipi.md`.*

## Nasıl oynanır

```powershell
npm --prefix C:\Companies\Cmd.Ai\Fikir\yaris-oyunu run dev
```

Ardından tarayıcıda http://localhost:5185 adresini aç. Claude uygulamasının önizlemesinden de açılabilir (`.claude/launch.json` içindeki adı `yaris-oyunu`).

**Kontroller:**
- Gaz: W / ↑. Ayarlar ⚙️ menüsünden "Otomatik gaz" açılabilir.
- Direksiyon: A/D veya ←/→. Fren: S.
- Formlar: **1** araba, **2** tekne, **3** planör, **4** tırmanıcı.
- R: yarışı yeniden başlatır. Esc / P ya da ⏸: duraklatır.
- Telefonda: sol yarıya bas = gaz, aynı parmağı sürükle = direksiyon; sağ altta form tuşları var. Telefon dikey tutulunca "yan çevir" uyarısı çıkar.

## Hazır olanlar

- **Pist:** "Şeker Kanalı", Uçan Adalar'da yaklaşık 3,7 km. Sırayla şeker adası, su kanalı, rampa ve boşluk, buz adası, volkan duvarı (tırmanış), şelale, ikinci boşluk ve buz köprüsünden geçiyor.
- **Dönüşüm mekaniği:**
  - 4 form ve her formun kendi tuşu var.
  - Zemin değişmeden önceki 0,3 saniyede doğru forma geçmek: **MÜKEMMEL**, 1 saniye turbo ve kombo.
  - Kombo 3 olunca alev görünümü geliyor.
  - Yanlış formda yavaşlama, boşlukta düşme ve son güvenli noktaya geri konma var.
  - Sınırın önünde, gereken formun renginde parlayan bir "mükemmel çizgi" çıkıyor.
- **Rakipler:** 15 kişilik "Kupa Pilotları" ekibinden 5'i hayalet olarak yarışıyor. Her pilotun adı, rozeti ve rengi var; yarışlar bot sürücüyle önceden kaydedildi, süreler 80-119 saniye.
  - İlk yarışta en yavaş pilotlar biraz yavaşlatılmış olarak geliyor, ilk yarış kazanılabilsin diye.
  - Sonraki yarışlarda oyuncunun süresine yakın pilotlar seçiliyor ve oyuncunun kendi rekoru "Senin rekorun" hayaleti olarak yarışıyor.
- **His:**
  - Takip kamerası: hızla açılan görüş açısı, sarsıntı, havadayken geri çekilme.
  - İlk mükemmel dönüşümde ve büyük atlayışlarda ağır çekim.
  - Hız çizgileri, turbo ve alev egzozu, su sıçraması, kıvılcım, altın parıltısı.
  - Sentezlenmiş sesler: motor, form sesleri, mükemmel arpeji, geri sayım, bitiş.
- **Görünüm:**
  - Mavi gökyüzü, bulut denizi, temalı uçan adalar, şelaleler, lav, volkan dumanı, gökkuşağı.
  - **Tripo3D'de üretilen** kahraman araba (oyuncunun arabası) ve şeker adası simgeleri.
- **Arayüz:** başlangıç ekranı, geri sayım, sıra, süre, altın, ilerleme çubuğu, form tuşları ve form ipucu (ilk yarışta), ayarlar, sonuç tablosu.
- **Ölçümler:**
  - 76 otomatik test geçiyor.
  - Yarışta 50-56 çizim çağrısı (bütçe 150).
  - Üretim paketi 4,5 MB, ana JS 229 KB gzip.

## Oynarken bakmanı istediğim his soruları

1. Mükemmel dönüşüm hissi doyurucu mu? Pencere (0,3 sn) çocuklar için fazla dar ya da fazla geniş mi?
2. Hız iyi mi? Şu an en yüksek 151 km/s; turbo ve hız okuyla daha da çıkıyor.
3. Direksiyon nasıl? Virajlarda araba hafifçe dışa kayıyor, buzda daha çok.
4. Kamera mesafesi ve ağır çekim fazla mı, az mı?
5. Tripo arabası sana nasıl göründü? Bu tarzda devam edelim mi?

## Bağımsız inceleme

İş bitince kodu, yazanlardan bağımsız bir inceleyici baştan okudu. 3 kritik ve 5 önemli hata buldu; hepsi düzeltildi ve testlendi (toplam 86 test). Başlıcaları:
- Mükemmel geçişten hemen sonra yanlışlıkla "Yanlış form" uyarısı çıkıyor ve komboyu sıfırlıyordu.
- Bariyere yaslanan planör boşlukta asılı kalabiliyordu.
- İlk yarıştaki form ipucu çocuğu boşlukta bir düşme döngüsüne sokabiliyordu.
- İkinci yarışta rekor hayaleti oyuncuyla karışıyordu.

Ayrıca duraklatma eklendi: Esc/P, ⏸ düğmesi, ayarlar açıkken ve telefon dikey tutulurken oyun duruyor.

## Bilinen eksikler ve sonraki adımlar

- Tripo arabasının tekerlekleri gövdeyle tek parça, dönmüyorlar. Tripo'da parçalara ayırma ile düzeltilebilir.
- Rakip arabalar hâlâ Taksi'nin oyuncak arabaları; Tripo'dan 3 rakip araba sipariş listesinde.
- Poki SDK, reklamlar, garaj, ekonomi ve kayıt A1 aşamasında.
- Hayalet sunucusu yok; bütün hayaletler oyunun içinde.
- Draco çözücü pakette iki kez bulunuyor (yaklaşık 1 MB). Modeller Draco kullanmadığı için A1'de tamamen çıkarılabilir.
- Erken geçiş cezası kalkınca en iyi pilot 80 saniyeye indi. Tasarımdaki 90-150 saniye bandına oturtmak için pist uzunluğu ya da hız, his onayından sonra ayarlanacak.
- Küçük kusurlar:
  - Geç geçişte "Geç!" ve "Yanlış form!" yazıları aynı anda çıkabiliyor.
  - FPS düşünce kalite otomatik düşüyor ama gölgeler kapanmıyor.
