# 3D model siparişleri (Nano Banana 2.1 → Tripo3D)

*23 Kasım 2026. Tasarım belgesindeki §15.3.1 akışının uygulanmış hâli.*

## İşleyen akış

1. **Referans sayfası:** Google AI Studio'da **Nano Banana 2.1**, çözünürlük **2K**.
   - İstem kalıbı: *"clean 3D-modeling reference sheet (orthographic turnaround) of ONE …, 2x2 grid: FRONT (top-left), BACK (top-right), LEFT (bottom-left), RIGHT (bottom-right), same scale, plain white background, no text, no shadow … chunky toy-like shapes, large flat color areas, Pixar-like stylized cartoon"*.
   - Geçici sohbet kaydedilmiyor, görseli hemen indir.
2. **Kesme:** Sayfa dört kareye bölünür ve beyaz zeminle kareye tamamlanır.
   - Dosyalar: `assets/ref/<ad>-front|back|left|right.png`.
3. **Tripo3D Agentic Canvas:** Dört görsel tek mesajla eklenir. Görünümler adlarıyla söylenir: front = ön, back = arka, left = sol, right = sağ.
   - İstenecekler: düşük poligon, hedef üçgen sayısı, 1024 piksel doku, GLB.
   - Mod: **Otomatik**. Kontrol modunda her adımda onay ister.
   - Ajanın uyguladığı adımlar: Smart Mesh → yeniden topoloji → Smart UV → doku → PBR. Kredi düşüşü yaklaşık 150 (3.180 → 3.030).
4. **Dışa aktarma:** PBR düğümü → "Dışa Aktar" → GLB, **doku 1k**. Varsayılan 4k, mutlaka değiştir.
   - Çıktı yaklaşık 600 KB: tek mesh, 3 JPEG doku (renk, metal/pürüz, normal).
5. **Oyuna alma:** `public/models/<ad>.glb`.
   - Tripo modelleri yaklaşık 1 m'ye normalize gelir, burnu +Z yönünde. Oyunda ölçeklenir: `heroModel()`, `main.ts`.

**Teknik not:** Yerleşik tarayıcı dosya seçme penceresini ve yerel sunucuya erişimi engelliyor. Bu yüzden kesilmiş görseller Magnific hesabına (gizli) yüklenip CORS'a açık CDN adresinden Tripo sayfasına aktarılıyor. Adresler: `assets/ref/cdn-urls.json`.

## Durum

| Model | Referans | Tripo | Oyunda |
|---|---|---|---|
| Kahraman araba (sarı, pembe şeritli) | `assets/ref/car-hero-sheet.jpg` | ✅ 6.124 üçgen, 617 KB | ✅ `public/models/hero.glb`, oyuncunun arabası |
| Şeker adası (lolipoplu, uçan) | `assets/ref/island-candy-sheet.jpg` | ⏳ üretiliyor | — |

## Sıradaki siparişler (A1 için)

| # | Model | Hedef üçgen | İstem notu |
|---|---|---|---|
| 1 | Rakip araba: mavi buggy | 4.000 | Açık tekerlekli, büyük arka tekerlekler, mavi ve beyaz. Kahraman arabayla aynı tombul oyuncak dili. |
| 2 | Rakip araba: mor roket kupa | 4.000 | Uzun burun, yan egzozlar, mor ve turkuaz. |
| 3 | Rakip araba: turuncu kamyonet | 4.000 | Kısa, kare, büyük tamponlu, turuncu ve krem. |
| 4 | Buz adası (kristal kule) | 8.000 | Kar kapaklı uçan kaya, buz kristali kümeleri, küçük buz şatosu. |
| 5 | Volkan adası | 8.000 | Koyu kaya koni, parlayan turuncu lav dereleri, bulut tabanı. |
| 6 | Şelale adası | 8.000 | Kenarından şelale dökülen yeşil ada, nehir yatağı. |
| 7 | Balina boss | 10.000 | Sevimli, iri gözlü, açık mavi çizgi film balinası, ağzı açık, su sıçratan. |
| 8 | Tekne / planör / palet parçaları | 800'er | Şimdilik koddan üretiliyor. Tripo'ya ancak kod versiyonu yetersiz kalırsa. |

**Stil kuralı:** Her yeni dünya için önce bir stil örneği üretilir ve kullanıcı onaylar, sonra toplu üretime geçilir. Şeker adası, Uçan Adalar'ın stil örneği.
