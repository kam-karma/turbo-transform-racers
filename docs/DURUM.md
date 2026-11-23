# Turbo Transform Racers: durum

*23 Kasım 2026 sabahı. Tasarım: `docs/2026-11-23-yaris-oyunu-tasarim.md`. Tam oyun sözleşmesi: `docs/plans/B-tam-oyun-sozlesmesi.md`. A0 notları: `docs/A0-durum.md`.*

## Nasıl açılır

```powershell
npm --prefix C:\Companies\Cmd.Ai\Fikir\yaris-oyunu run dev
```

Tarayıcıda http://localhost:5185 adresini aç. Poki için paket: `npm run build` → `dist/` klasörü (göreli yollar, Poki SDK `index.html` içinde).

## Oyunun akışı

1. **Yükleme ekranı** → ilk kez açan oyuncu doğrudan ilk yarışa girer (kontroller ekranda gösterilir), sonra ana sayfa.
2. **Ana sayfa:** dönen 3D vitrin (seçili araba), logo, büyük **YARIŞ** düğmesi (sıradaki yarışı açar), üç dünya kartı (kilit durumu ve yıldızlar), günlük sandık, 3 günlük görev, altın ve yıldız sayaçları, garaj, ayarlar, "az kaldı" hedefi.
3. **Kupa haritası:** her dünyada Bronz / Gümüş / Altın kupa; her kupada 5 yarış + boss. Varyantlar: normal, ters, gece, ayna.
4. **Yarış öncesi kart:** pistin adı, en iyi süre, o yarışın **gerçek 3 yıldız hedefi**, "Roketle başla" (ödüllü video).
5. **Yarış** → **Sonuçlar:** sıralama, yıldızlar, altın, "ödülü x2 yap" videosu, tekrar / harita / garaj / sonraki.
6. **Garaj:** 12 araba; Altın Kartal dışındaki 11'inin kendi 3D modeli ve kart resmi var. Performans yükseltmeleri, görünüm modları (boya, jant, rüzgârlık, neon, çıkartma, iz efekti, korna). Altınla ya da videoyla açılır; "tek yarış dene" videosu var.

## Üç kupa

| Kupa | Dünya | Mekanik | Boss |
|---|---|---|---|
| Dönüşüm | Uçan Adalar (6 pist) | Araba → tekne / planör / tırmanıcı; doğru anda dönüşmek MÜKEMMEL + turbo + kombo | **Dev Balina Dalgası:** arkadan gelen dalga, kontrol noktaları, yakalanınca geri dönüş, 3 yenilgiden sonra kolay balina, Gümüş/Altın'da daha hızlı. Dalga yaklaşınca üstte **dikiz aynası** açılır. |
| Kurgu | Dev Ev (6 oda) | Oyuncak araba yolda parça toplayıp kendini kurar; parça kapıları, kombolar | **Robot Süpürge** |
| Kaos | Neon Şehir (6 tur pisti, 3'er tur) | Yıkım puanı, Şok dalgası (Boşluk / ekrandaki tuş), çarpışan canlı rakipler | **Hologram Ejderha:** blok atar, blokları geri çarpınca canı azalır |

Rakipler: 15 kişilik "Kupa Pilotları" (bot kayıtları, dürüstçe "pilot" olarak gösterilir). Uçan Adalar'ın 6 pistinin normal, ters ve ayna hâlleri için hayalet kayıtları hazır (`public/ghosts/`, `npm run ghosts`).

## Görsel ve ses

- **Tripo modelleri:** 11 oyuncu arabası (Kıvılcım, Kum Böceği, Pıtırcık, Roket, Tosbik, Nane, Fırtına, Çakal, Buzul, Şimşek, Magma), şeker adası, balina, robot süpürge, hologram ejderha. Hepsi tek parça, ~8 bin üçgen, 1k doku. Magma'nın PBR adımı kredi bittiği için yapılamadı; dokulu hâli kullanılıyor.
- **Altın Kartal'ın modeli yok:** Tripo kredisi bitti (40 kredi kaldı). Şimdilik kendi renginde boyanmış Kıvılcım modeliyle görünür. Referans çizimi hazır: `assets/ref/car-kartal-sheet.jpg`. Kredi yüklenince aynı yolla üretilip `public/models/car-kartal.glb` olarak eklenmesi yeterli; kart resmi için `python tools/icons/car_thumbs.py` çalıştırılıp `garage.ts` içindeki `CAR_THUMBS` listesine `kartal` eklenmeli.
- İkonlar, logo, dünya kartları: özel çizim. Yarış içi HUD her dünyaya göre ayrı temalı.
- **Müzik:** tarayıcıda üretilen müzik; menü için bir şarkı, her dünya için ayrı yarış şarkısı. Menü sesleri ve 7 korna sesi de üretiliyor; dosya indirilmez.
- Garajdan alınan **iz efekti** yarışta arabanın arkasında görünür.

## Reklamlar (Poki)

- Reklam yalnızca Poki SDK ile gösterilir; SDK yoksa (yerel geliştirme) yerine geçen sahte bir katman çalışır.
- `gameplayStart` / `gameplayStop` yarış başında, duraklatmada ve sonuçta çağrılır. Doğal molalarda `commercialBreak` çağrılır.
- Ödüllü video yerleri: ödülü x2 yap, roketle başla, mod açma, araba deneme, sandık. Hepsi isteğe bağlıdır.

## Testler

- `npx vitest run`: 48 dosya, 588 test, hepsi geçiyor.
- `npx tsc --noEmit`: hata yok. `npm run build`: başarılı.
- Tarayıcıda üç kupanın yarışları, Dev Balina boss yarışı, ana sayfa, garaj ve sonuç ekranı uçtan uca denendi.

## Bilinen eksikler

- Altın Kartal'ın kendi 3D modeli yok (yukarıda).
- Kaos'ta "kaldığın yerden devam" videosu yok (Kaos'ta araba parçalanma anı olmadığı için yeri yok; onun yerine roketle başlangıç Şok'u da dolduruyor).
- Düşük kalitede Uçan Adalar ve Kaos sahneleri bazı yerlerde üçgen hedefinin (120 bin) biraz üstünde; kare hızı ölçerek gerekirse kalite kendiliğinden düşer.
- Gerçek telefonda deneme yapılmadı (yalnızca dar pencere boyutuyla).

## 2. tur: garaj, kilitler, düzeltmeler

- **Kilitler açık:** Dev Ev ve Neon Şehir baştan oynanabilir. Kapatmak için `src/meta/economy.ts` içindeki `worldGatesOn` değerini `true` yapmak yeterli (kurallar ve testleri duruyor).
- **Modifiye parçaları Blender'da modellendi** (`tools/blender/make_parts.py` → `public/models/parts/`): 8 spoiler (kanat profilli, kenar plakalı, ayaklı; roket kanatta parlayan iticiler, dev kanatta çift katlı kanat) ve 10 jant + büyük lastik. Dosyalar Draco ile sıkıştırıldı (toplam ~1 MB, yalnızca takılınca yüklenir).
- **Parçalar arabaya göre yerleşiyor:** her arabanın tekerlek merkezleri, tekerlek yarıçapı, kuyruk ve bagaj noktaları Blender'da ölçüldü (`tools/blender/analyze_cars.py` → `public/models/car-fit.json`). Jantlar tam tekerlek ortasına, spoiler tavan/bagaj/rollbar üstüne oturuyor; ördek kuyruk bagaj kenarına iniyor. Nane tekerleksiz olduğu için jant takılmıyor.
- **Spoiler üst üste binmiyor:** Kıvılcım, Buzul ve Şimşek'in kendi spoiler'ı Blender'da ayrı parçaya ayrıldı (`tools/blender/stock_spoiler.py`); mod takılınca gizleniyor, çıkarılınca geri geliyor. Orijinal dosyalar `assets/models-original/` içinde.
- **Garaj platformu yeniden tasarlandı** (`tools/blender/make_podium.py`): üç basamaklı kaide, krom halkalar, dünya rengine göre yanan LED şeritler, cıvatalar, arabaya bakan 8 spot ışığı ve huzmeleri; dönen tablada dama bandı, ok ışıkları ve yıldız amblemi. Uzun arabalarda (Fırtına, Nane) kamera kendiliğinden geri çekiliyor.
- **Roketle başla düzeltildi:** geri sayımın son karesindeki bir kayan nokta hatası yüzünden roket başlangıcı hiçbir kupada çalışmıyordu (video izlenip bonus verilmiyordu). Düzeltildi ve test eklendi; Kurgu ve Kaos'ta da çalışıyor, Kaos'ta Şok barı da dolu başlıyor.
- **Kurgu "nadir parçayı garaja götür":** yarışta nadir parça bulunursa sonuç ekranında video teklifi çıkıyor; izlenirse sonraki Dev Ev yarışı o parça takılı başlıyor.

## Bu turda yapılan son düzeltmeler (bağımsız inceleme sonrası)

- Dikiz aynası artık ana görüntünün gölgelerini bozmuyor ve gökyüzünü gösteriyor.
- Ada modellerinin dokuları her yarıştan sonra serbest bırakılıyor (bellek sızıntısı giderildi).
- Garaj görünümü yalnızca arabanın gövdesine uygulanıyor; dönüşüm parçalarının parlaması korunuyor.
- Kare hızı koruması yalnızca yarış sürerken ölçüyor; otomatik kalite düşüşü ayarlara da yazılıyor, bloom belleğini ve gölgeleri kapatıyor.
- Sekme arka plandayken müzik ve sesler duruyor.
- "Tekrar" yarışı iki kez kurmuyor; roketle başlangıç her yarış için ayrı alınıyor.

## Lisans

Nunito yazı tipi SIL OFL 1.1 ile geliyor; not `CREDITS.md` içinde.
