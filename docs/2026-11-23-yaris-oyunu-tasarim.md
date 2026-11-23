# Yarış Oyunu: Tasarım Belgesi

*23 Kasım 2026. Çalışma adı: **Kupa Avcıları** (benim seçimim, kalıcı ad sonra verilecek).*
*Kaynaklar: `Fikir/cars-racing-masters-analiz.md`, bu oturumdaki kararlar, `Fikir/istanbul-taksi` kod tabanı.*

Belgede **[Karar]** kullanıcının verdiği kararları, **[Önerim]** benim kararımı gösteriyor. Önerilerimin hepsi kullanıcıya sunuldu ve itiraz gelmedi, ama sonradan değiştirilebilirler.

---

## 1. Özet

Poki için tarayıcıda çalışan, 3D, stilize çizgi film görünümlü bir yarış oyunu. Örnek aldığımız oyun Cars Racing Masters. Onun döngüsünü koruyoruz: kısa yarış, her yarıştan para, yükseltme, yeni araba, boss.

Üstüne üç şey ekliyoruz:

1. **Üç kupa türü.** Her biri ayrı bir dünyada geçiyor ve her birinin kendine özgü, zekice bir mekaniği var:
   - **Dönüşüm Kupası (Uçan Adalar):** Araba pistin zeminine göre tekneye, planöre ya da tırmanıcıya dönüşür.
   - **Kurgu Kupası (Dev Ev):** Oyuncak boyutundaki araba, yarış sırasında topladığı parçalarla kurulur.
   - **Kaos Kupası (Neon Şehir):** Çarp, dağıt, yık. Her şey ışık saçarak parçalanır.
2. **Gerçek oyuncuların hayaletleri.** Rakipler, başka oyuncuların kaydedilmiş sürüşleri.
3. **Ortak bir garaj ve koleksiyon.** Bir arabaya yaklaşık 30 modifiye takılabiliyor. Her parça altınla ya da ödüllü video izleyerek alınabiliyor.

Başarı iki sayıyla ölçülür: **oyuncu başına oynama süresi** ve **oyuncu başına izlenen ödüllü video**.

---

## 2. Amaç ve neden

- **İş amacı:** Poki'de reklam geliri. Poki gelirini reklamdan paylaşıyor ve oyunları oynama süresine göre öne çıkarıyor. Bu yüzden oynama süresi hem doğrudan geliri hem de vitrindeki yeri belirliyor.
- **Neden bu tür:** Cars Racing Masters (Kasım 2026) Poki Türkiye'de "Yükselişte #1" sırasında, 4.5 puanla. Mobildeki karşılığı Race Master 3D 100M+ indirme yaptı ve 100 milyon dolardan fazla kazandı. Yani talep kanıtlanmış.
- **Neden daha iyisini yapabiliriz:** Rakibin zayıf noktaları belli:
  - Rakipler sahte bot.
  - Beceri gerekmiyor, gaza basmak yetiyor.
  - Yükseltmeler sadece rakam, araba değişmiyor.
  - Tek bir tema var.
  - Sosyal bir katman yok.
- **Kullanıcının istediği:** Daha kaliteli, daha detaylı, daha zekice, daha yaratıcı, insanları daha çok etkileyen bir oyun. Oyun içinde daha çok video izlenmesi ve daha çok zaman geçirilmesi.
- **Önceki derslerden** (kullanıcının daha önce reddettiği prototiplerden çıkanlar):
  - His önce gelir. İlk 5 saniyede kural okumadan eğlenceli olmalı.
  - Ekranda gösteri olmalı.
  - 3D, çocukları etkileyen ve tek bir zekice mekanik üstüne kurulu olmalı.

---

## 3. Hedefler, hedef olmayanlar, kesinlikle olmaması gerekenler

### Hedefler

| Hedef | Ölçüt (Poki panelinden) | İlk hedef değer |
|---|---|---|
| Oyuna giriş | Sayfayı açanların oynamaya başlama oranı | %65 ve üstü (Poki'nin "iyi" eşiği) |
| Oynama süresi | Oyuncu başına ortalama süre | 10 dakika ve üstü (rakip türde 5+ normal) |
| Ödüllü video | Günlük oyuncu başına ödüllü video | 1,5 ve üstü |
| Toplam reklam | Günlük oyuncu başına reklam | 1 ve üstü (Poki'nin asgari beklentisi) |
| Geri dönüş | Ertesi gün dönenler | Poki göstermiyorsa kendi sayacımızla ölçülür (bkz. §17) |
| Kalite | Poki puanı | 4.4 ve üstü |

### Hedef olmayanlar (ilk sürüm için)
- Canlı, aynı anda çok oyunculu yarış. Hayaletler yeterli **[Karar]**.
- Gerçek parayla satın alma. Poki'de yasak.
- Mobil mağaza sürümü. İleride düşünülebilir.
- Pist editörünü oyunculara açmak.
- Hesap ya da giriş sistemi. Poki'nin kendi bulut kaydı yeter (bkz. §16).

### Kesinlikle olmaması gerekenler (çalışsa bile başarısızlık sayılır)
- **Zorla izletilen reklam.** Oyuncunun seçmediği bir ödüllü video, oyunun kendi reklam zamanlayıcısı, reklam izlemeden geçilemeyen bir duvar. Bunlar hem Poki kurallarına aykırı hem oyuncuyu kaçırır.
- **İlk dakikada kural okutmak.** Oyuncu 5 saniye içinde sürmeye başlamalı.
- **Ağır yükleme.** İlk yarışa 10 saniyeden geç girmek.
- **Ucuz telefonda takılma.** Düşük kalite ayarında bile 30 FPS'nin altına düşmek.
- **Rakibin kopyası olmak.** Ad, araba, pist ve arayüz tamamen bize ait olmalı.
- **Çocuk güvenliği açığı.** Serbest metin girişi, oyuncunun kendi yazdığı isimlerin gösterilmesi, kişisel veri toplanması.
- **Satın alınabilir zafer hissi.** Ödüllü video yarışı tek başına kazandırmamalı. Avantaj verir ama beceri her zaman belirleyici kalır.

---

## 4. Kısıtlar

### Poki kuralları
- Gelir yalnızca Poki SDK reklamlarından gelir. Başka reklam ağı ve satın alma yok.
- `commercialBreak()` (yarış arası reklam): sıklığına Poki karar verir. Biz yalnızca doğal kesinti noktalarında çağırırız.
- `rewardedBreak()` (ödüllü video):
  - Yalnızca oyuncunun açık seçimiyle başlar.
  - Bir video bir ödül verir.
  - Ödül butonu **yeşil olamaz**.
  - Normal "devam" butonu, ödül butonundan küçük olamaz.
- Oyunun kendi reklam zamanlayıcısı olamaz.
- Yükleme 10 saniyenin altında olmalı. 16:9 masaüstü, telefon ve tablet desteklenmeli. Dokunmatik ve klavye kontrolü birlikte olmalı.
- Dışarıya istek kısıtlı. Hayalet sunucusu için Poki'den onay gerekecek. Onay gelmezse oyun sunucusuz da tam çalışmalı (bkz. §12).
- `gameplayStart()` ve `gameplayStop()` çağrıları doğru yerlerde yapılmalı. Taksi'deki `adFlow` bunu zaten yapıyor.

### Teknik
- Three.js + TypeScript + Vite **[Karar: Three.js]**.
- Performans bütçesi §15'te.

### Hukuki
- Tüm modeller, dokular, müzik ve sesler bize ait olmalı ya da açık lisanslı olmalı.
- Konsept görsellerdeki turuncu plastik pist bilinen bir oyuncak markasını andırıyor. Bizim pistlerimiz farklı renk ve biçimde olacak **[Önerim]**.
- Rakip oyunun adı, arabaları ve pist düzeni kullanılmaz.

### Çocuk güvenliği
- Oyuncu adları **otomatik üretilir**: "Hızlı Panda", "Neon Tilki" gibi sıfat ve hayvan birleşimleri. Oyuncu kendi adını yazamaz.
- Sohbet yok.
- Hayalet verisinde kişisel bilgi tutulmaz.

---

## 5. Yaklaşımlar

| Yol | Artısı | Eksisi | Durum |
|---|---|---|---|
| **Three.js + İstanbul Taksi altyapısı** | Hazır araba fiziği, kırılan nesneler ve saçılan parçalar, garaj ve özelleştirme (jant, spoiler, neon, çıkartma, boya), Poki reklam akışı, kayıt, günlük görevler, dokunmatik kontrol ve kalite ayarı var, hepsi testli. Oyun küçük olur ve hızlı yüklenir. | Hazır pist editörü yok, kendi eğri tabanlı pist üreticimizi yazarız. Efektler elle ayarlanır. | **Seçildi [Karar]** |
| Unity WebGL | Güçlü editör, hazır varlık mağazası. Rakip de bunu kullanıyor. | 10-30 MB boyut, yavaş yükleme, zayıf telefonlarda sorun. Mevcut kodun hepsi çöpe gider. | Elendi |
| PlayCanvas | Hafif, tarayıcı içinde editörü var. | Bizim için yeni motor, mevcut kod taşınmaz. | Elendi |

**Kodun nasıl taşınacağı [Önerim]:** `Fikir/yaris-oyunu` içinde yeni bir Vite projesi açılır. Taksi'den gereken modüller **kopyalanıp uyarlanır**, ortak bir paket kurulmaz. Taksi kendi yolunda gelişmeye devam ettiği için iki oyunu birbirine bağlamak ikisini de yavaşlatır.

---

## 6. Oyuncunun ilk 10 dakikası

İlk oturum her şeydir. Poki oyunu ilk oturumdaki davranışa göre değerlendiriyor.

| Zaman | Olan | Neden |
|---|---|---|
| 0-5 sn | Sayfa açılır, araba **doğrudan Uçan Adalar'da** pistte bekler. Ekranda tek bir yazı var: "Başlamak için dokun / bir tuşa bas". Menü yok. | Oyuna giriş oranını yükseltmek |
| 5-60 sn | **Öğretici yarış 1.** Ekranda gaz ve direksiyon gösterilir (klavye: W ve A/D, dokunmatik: sol yarıya bas ve sürükle). Oyuncu gaza basınca yarış başlar. Yol önce düz gider, sonra suya dalar. 4 form tuşundan yalnızca tekne tuşu yanıp söner, diğerleri sönüktür. Dokununca araba tekneye dönüşür (ağır çekim, su sıçraması). Sonraki öğretici adımlarda tuşlar birer birer açılır. | Ana mekaniği yazı okutmadan öğretmek |
| 60-150 sn | Uçurumda planör, rampada mükemmel dönüşüm bonusu. Oyuncu **birinci bitirecek şekilde ayarlanmıştır** (ilk hayaletler yavaştır). | İlk zafer hissi |
| 2,5 dk | Bitiş ekranı: altın, yıldızlar ve "ödülü x2 yap" teklifi (ilk ödüllü video fırsatı). | Video alışkanlığını erken kurmak |
| 3 dk | **Garaja ilk giriş.** Bir modifiye bedava verilir (spoiler). Takılınca araba görünür biçimde değişir. "Video izle, neon alt ışık kazan" teklifi gelir. | Garaj ve video döngüsünü göstermek |
| 3-10 dk | Kupa haritası açılır: Dönüşüm Kupası 1'in 5 yarışı ve sonunda boss. Ekranda kilitli Kurgu Kupası (Dev Ev) görünür: "2 yarış sonra açılır". | Merak ve "az kaldı" hissi |
| ~8-10 dk | **Kurgu Kupası açılır.** İkinci mekanik öğretilir. | Çeşitlilik, oturumu uzatmak |

**[Önerim]** Oyun Level 1'den başlar, rakibin yaptığı "Level 2'den başlatma" hilesine gerek yok. İlk kupanın ilerleme çubuğu zaten 1/6 dolu gösterilir, çünkü öğretici yarış sayılır.

---

## 7. Kontroller **[Önerim]**

| | Masaüstü | Dokunmatik |
|---|---|---|
| Gaz | **W / ↑ basılı tut [Karar].** Ayarlarda **"Otomatik gaz"** seçeneği var. Açılırsa araba hep gazdadır. | Ekranın sol yarısına **parmak değdiği sürece gaz**. Parmak kalkınca araba süzülür. Otomatik gaz seçeneği burada da geçerli. |
| Fren / yavaşla | S / ↓ | Ekranın alt ortasındaki fren tuşu (küçük) |
| Direksiyon | A / D, ← / → | Sol yarıdaki aynı parmağın sağa-sola sürüklenmesi (Taksi'deki `touchControls` uyarlanır). Tek parmak hem gaz hem direksiyon, sağ el form tuşlarında serbest kalır. |
| Kupa yeteneği | Dönüşüm: 1-2-3-4 tuşlarıyla **forma doğrudan geçiş** (1 araba, 2 tekne, 3 planör, 4 tırmanıcı). Kaos: Space ile Şok. Kurgu: yetenek tuşu yok, parçalar kendiliğinden çalışır. | Dönüşüm: sağ altta yay şeklinde dizilmiş **4 form tuşu**. Kaos: tek büyük Şok tuşu. |
| Duraklat | Esc / P | Sağ üst ⏸ |

Gerekçe: Gaz oyuncunun elinde, çünkü bırakıp süzülmek de bir beceri (dar viraj, mükemmel dönüşüm zamanlaması). Tek tuş rahatlığı isteyen oyuncu otomatik gazı açar. Direksiyon ve yetenek zamanlaması gerçek bir beceri katmanı ekliyor. Rakibin en büyük zayıflığı da bu katmanın olmamasıydı.

---

## 8. Ortak yarış çekirdeği

### 8.1 Yarış biçimi
- **6 araç:** oyuncu ve 5 rakip. Rakipler hayalettir (bkz. §12). Kaos Kupası'nda ise hayalet yolunda giden, çarpışabilen botlardır.
- **Süre:**
  - Dönüşüm ve Kurgu: 90-150 saniye, tek tur, A noktasından B noktasına.
  - Kaos: 3 kısa tur, 90-120 saniye.
- **Sıralama:** Pist eğrisi üzerindeki ilerlemeye göre canlı hesaplanır.
- **Kaybetmek yok:** Sonuncu bile altın kazanır (bkz. §11).
- **Düşmek:** Pistten düşen araba 1 saniye içinde son güvenli noktaya geri konur ve hız kaybeder. Ödüllü "kaldığın yerden devam" teklifi **yalnızca Kaos'ta araba parçalanınca** çıkar (bkz. §13). Diğer kupalarda düşmek zaten hızlı toparlanıyor, orada video teklif etmek oyuncuyu bıktırır.

### 8.2 Sürüş hissi
- Fizik "arcade" olacak: Taksi'deki `vehicle`, `vehicleDynamics` ve `vehicleSteering` daha keskin direksiyon, daha yüksek hız ve daha affedici kenar çarpışmasıyla yeniden ayarlanır.
- **Pist kenarı:**
  - Çoğu yerde yumuşak bariyer vardır, araba sekip devam eder.
  - Bariyersiz bölümler ayrıca işaretlenir.
- **Kamera:**
  - Arabanın arkasından takip eder. Hıza göre görüş açısı genişler ve kamera hafif sallanır.
  - Uçuşta ve dönüşümde kısa ağır çekim olur (en fazla 0,4 sn ve 0,5 kat hız).
- **"His" listesi** (prototipte ilk bunlar yapılır):
  - hız çizgileri, egzoz alevi, toz ve su sıçraması
  - dönüşümde parça açılma animasyonu
  - rampada ağır çekim
  - mükemmel dönüşümde ekran parlaması ve ses
  - parça takılınca "klak" sesi ve zıplama
  - geçerken ve çarpışırken titreşim (destekleyen telefonlarda)

### 8.3 Pistteki ortak öğeler
- **Hız okları:** 1,5 saniye boyunca +%30 hız.
- **Rampalar:** havada süre kazandırır, akrobasi yıldızı için kullanılır.
- **Altın paralar:** pist üstünde dizi hâlinde durur.
- **Gizli parça:** her pistte bir tane, ana yoldan sapınca bulunur. Yıldız görevidir.
- **Kısa yollar:** risklidir, örneğin dar bir köprü.

### 8.4 Pist üretimi
Pistler elle modellenmez. **Kontrol noktaları ve bölüm etiketleri** veri olarak yazılır, mesh ve çarpışma bu veriden üretilir.
- Bölüm etiketlerine örnekler: `asfalt`, `su`, `boşluk`, `buz`, `duvar`, `tırmanış`, `kırılabilir`.
- Kenar süsleri (adalar, mobilyalar, binalar) dünya temasına göre otomatik dizilir. Önemli noktalara elle yerleştirilen "sahne parçaları" eklenir.
- Geliştirme sırasında bir **pist düzenleme sayfası** olur (Taksi'deki `garage/lab.html` gibi bir yan sayfa). Bu sayfada nokta sürüklenir, etiket atanır, pist anında test edilir.
- Bir pistten **varyant** türetilir: ters yön, gece, ayna. Böylece az emekle çok içerik çıkar.

---

## 9. Üç kupa

### 9.1 Dönüşüm Kupası: Uçan Adalar **[Karar: dünya ve kupa eşlemesi]**

**Dünya:** Şeker, buz, volkan ve su adaları. Yollar adalar arasında köprü olarak uzanır. Stilize, renkli, animasyon filmi havasında (seçilen konsept B).

**Mekanik:** Arabanın 4 formu var. Pistin zemini değiştikçe doğru forma geçmek gerekiyor.

| Form | Doğru zemin | Yanlış formda olursa |
|---|---|---|
| Araba | asfalt, toprak | – |
| Tekne | su | araba suda batar ve yavaşlar, tekne karada sürünür |
| Planör | boşluk, uçurum | diğer formlar düşer ve geri konur |
| Tırmanıcı (paletli) | dik yokuş, duvar | diğer formlar kayıp geri gider |

**Form seçimi [Önerim]:** Oyuncu her forma kendi tuşuyla doğrudan geçer (§7). Beceri iki katmanlı: önce ileride hangi zeminin geldiğini okumak ve doğru formu seçmek, sonra doğru anda basmak. Yanlış form seçmek mümkün ve cezalı (tablodaki yavaşlama). Sırayla form değiştirme yöntemi yok, çünkü 0,3 saniyelik pencereye sığmaz.

**Zekice olan kısım: mükemmel dönüşüm.**
- Zemin değişmeden hemen önceki **0,3 saniyelik pencerede** dönüşen oyuncu 1 saniyelik turbo alır.
- Pencere zeminde parlayan bir çizgiyle gösterilir.
- Turbolar zincirlenince **kombo** büyür: 3 mükemmel dönüşüm üst üste gelince araba alev rengine bürünür.
- Basit bir kural, ama ustalaşınca büyük fark yaratıyor. Hayalet sistemi de "ben bunu daha iyi yaparım" duygusunu besliyor.

**Pistteki öğeler:**
- Su kanalları, buz kaydırakları (buzda direksiyon kayar), volkan atışları (lav topu engeli), şeker yağmuru (para).

**Boss: Dev Balina Dalgası.**
- Çizgi film tarzı bir balina arkadan dalga yaratır ve dalga oyuncuyu kovalar.
- Kaçış boyunca hızlı form değişimleri gerekir.
- Boss kuralları §9.4'te.

**Garajda formlar:** Her formun kendi seviyesi var: tekne motoru, planör kanadı, tırmanıcı paleti. Formların görünümü arabanın modifiyelerinden etkilenir. Örneğin neon alt ışık tekne formunda da yanar.

### 9.2 Kurgu Kupası: Dev Ev **[Karar]**

**Dünya:** Oyuncak arabalar dev bir evde yarışır. Odalar sırayla açılır: çocuk odası, mutfak, banyo (su), bahçe, garaj. Halı, yatak, masa, kitap rampaları var. Dev-minik fantezisi kupanın temeli (seçilen konsept A).

**Mekanik:** Araba yarışa **çıplak gövdeyle** başlar. Pistte, şeritlere dağılmış oyuncak parçalar durur. Oyuncu direksiyonla hangisini alacağını seçer. Her parça arabada **görünür biçimde** belirir ve davranışını değiştirir.

| Yuva | Parçalar (oyuncak teması) | Etkisi |
|---|---|---|
| Ön | Kalemtıraş matkap, silgi tampon, ataş mıknatıs | Kırılabilir duvarları deler. Çarpınca yavaşlamaz. Paraları çeker. |
| Yan | Lego kanat, kâğıt uçak kanadı | Boşlukların üstünden süzülür |
| Arka | Kalem roket, oyuncak pervane | Rampadan uçar. Suda iter. |
| Tekerlek | Makara dev tekerlek, şamandıra tekerlek, paletli | Engelleri ezer. Suda yüzer. Halıda hızlıdır. |

**Zekice olan kısım: pist kapıları ve kombinasyonlar.**
- Pistte **parça isteyen kapılar** var. Bir oyuncak duvarı matkapla delinir, yoksa uzun yoldan dolanılır. Lavabo üstündeki boşlukta kanatla süzülünür, yoksa alttan, sudan gidilir.
- Kapı her zaman yarış başında **görünür biçimde** gösterilir: "ileride duvar var". Böylece parça seçimi bir **karar** olur, şans değil.
- **Kombolar:**
  - kanat + roket = kısa uçuş
  - mıknatıs + dev tekerlek = "yuvarlanan çöp topu" (paraları süpürür)
  - Kombolar keşfedildikçe garajda "kombo albümüne" eklenir. Bu bir koleksiyon hedefi oluyor.
- **Kopma:** Sert bir çarpışmada son takılan parça kopar ve pistte zıplayarak geride kalır. Geri dönüp alınabilir. Hem fizik gösterisi hem karar.

**Yarış sonu:**
- Yarışta takılan parçalardan **nadir olanı** için "garaja götür" teklifi çıkar (ödüllü video, bkz. §13).
- Garaja götürülen parça kalıcı olur. Garajdaki **başlangıç yuvasına** takılabilir, araba sonraki yarışlara o parçayla başlar.
- Bu, oyuncuyu kalıcı olarak güçlendiren ilerlemedir. En güçlü video isteğinin de bu olmasını bekliyorum.

**Boss: Robot Süpürge.** Dev bir robot süpürge odada oyuncuyu kovalar ve yolundaki her şeyi emer. Kaçış rotasının üç kapısında doğru parça gerekir.

### 9.3 Kaos Kupası: Neon Şehir **[Karar: N-2 görünümü, çıkıştan sonra güncelleme olarak]**

**Dünya:** Gece, dark ve siber ama çizgi film tarzı:
- ışık şeritlerinden yollar
- iç içe dev neon çemberler
- kuleye sarılmış hologram ejderha
- gökyüzünü tarayan lazerler
- ıslak, yansıyan zemin
- köşeli koyu kuleler ve dev neon tabelalar

(Seçilen konsept N-2.)

**Mekanik:** Kısa, 3 turluk bir pist. Sıralama + **yıkım puanı**.
- **Yıkılabilenler:** neon bloklar, hologram tabelalar, cam bariyerler. Hepsi ışık saçarak dağılır. Taksi'deki `breakables` ve `debris` buraya taşınır.
- **Rakiplere çarpmak:** Kaos'ta rakipler, hayalet çizgisini takip eden ama **çarpışabilen botlardır**. Çarpılan bot savrulur ve sonra çizgisine döner.
- **Şok:** Yıkım ve çarpışma bir **Şok sayacını** doldurur. Sayaç dolunca Space'e basılır: çevreye halka şeklinde bir şok dalgası yayılır, yakındakiler savrulur ve ekranda gösteri olur.
- **Final puanı:** sıralama puanı + yıkım puanı. Kupa yıldızları bu ikisinin toplamına göre verilir. Böylece sonuncu bile "en çok yıkan" olarak yıldız kazanabilir.

**Boss: Hologram Ejderha.** Ejderha pistin üstünde uçar ve neon bloklar fırlatır. Bloklar sekip ejderhaya geri çarptırılınca ejderhanın canı azalır. Kazanmak: pist bitmeden ejderhanın canını bitirmek.

### 9.4 Boss kuralları (üç kupa için ortak) **[Önerim]**
- Boss yarışında **hayalet yok**. Oyuncu tek başına boss'a karşı yarışır.
- **Kazanmak:**
  - Balina ve Süpürge: bitişe yakalanmadan varmak.
  - Ejderha: canını bitirmek.
- **Yakalanmak:** Oyun kaybedilmez. Oyuncu pistteki 3 kontrol noktasından sonuncusuna geri konur ve boss biraz geride başlar.
- **Takılan çocuk için yedek yol:** Aynı boss'a 3 kez üst üste yenilen oyuncuya "kolay boss" seçeneği sunulur (boss %15 yavaş). Ödül aynıdır.
  - Ayrıca isteğe bağlı bir ödüllü video "kalkanla başla" seçeneği verir: ilk yakalanma sayılmaz.
  - Gümüş kupaya geçiş hiçbir zaman kalıcı olarak kilitli kalmaz.
- **Ödül:** 500 altın ve araba ya da büyük ödül (yalnızca ilk zaferde). Tekrar oynamada 150 altın.

---

## 10. Arabalar ve garaj

### 10.1 Araba koleksiyonu
- Hedef **yaklaşık 30 araba**. Çıkışta 12 araba olacak **[Önerim]**, kalanı güncellemelerle gelir.
- Her arabanın 3 temel değeri var: **hız, ivme, yol tutuş**. Ayrıca bir **karakteri** var. Örnekler: "Kum Böceği" (hafif, çevik), "Fırtına" (ağır, hızlı), "Pıtırcık" (minik, dönüşümleri hızlı).
- **Dünya kostümleri:** Aynı araba her dünyada o dünyanın görünümünü giyer:
  - Dev Ev'de oyuncak cilası ve vida detayları
  - Adalarda çizgi film parlaklığı
  - Neon'da ışık çizgileri
  - Kostüm, malzeme ve renk değişimi ile ek parçalardan oluşur, yeni model gerekmez.
- **Açma yolu:** altınla satın alma ya da kupa ödülü. Bazı arabalar yalnızca boss yenilince açılır.
- **"Tek yarışlık dene":** Kilitli bir araba ödüllü videoyla bir yarış boyunca denenebilir (bkz. §13).

### 10.2 Modifiyeler **[Karar: altınla ya da video izleyerek]**
Taksi'deki garaj kategori yapısı uyarlanır.

| Kategori | Örnekler | Etki |
|---|---|---|
| Boya | Düz, metalik, sedefli, gökkuşağı | Görsel |
| Çıkartma ve kaplama | Alev, yıldırım, dünya temalı kaplamalar | Görsel |
| Jant ve lastik | 10+ jant, renkli lastik | Görsel |
| Spoiler ve kanat | 8+ tip | Görsel |
| Neon alt ışık | Renk ve animasyon (nabız, gökkuşağı) | Görsel |
| İz efekti | Kıvılcım, yıldız tozu, ışık şeridi | Görsel, en çok istenecek kalem |
| Korna | Komik sesler | Görsel ve işitsel |
| **Performans** | Motor, nitro, yol tutuş (her biri 5 seviye) | Hız / ivme / yol tutuş değerlerine eklenir |
| **Form seviyeleri** | Tekne, planör, tırmanıcı (5'er seviye) | Dönüşüm Kupası |
| **Başlangıç parçası yuvası** | Kurgu'dan saklanan parça | Kurgu Kupası |

**Modifiyeler arabaya özel [Önerim]:**
- Görsel modifiyeler ve performans seviyeleri **arabaya özeldir**. Bir arabaya alınan spoiler başka arabada yoktur. Bu Taksi'deki kayıt yapısıyla aynıdır (`save.custom[araba]`).
- İstisna: **iz efekti** ve **korna** hesaba özeldir, bir kez alınır ve her arabada kullanılır.
- Gerekçe: Her yeni araba garaja yeni bir alışveriş ve video alanı açar. Arabaya bağlılık da artar. "Bir araba başına ~30 modifiye" ifadesi bu anlamdadır.

**Satın alma kuralları:**
- **Görsel modifiyeler:** Her biri ya altınla ya da video ile açılır.
  - Ucuz kalemler (fiyatı < 300 altın): **1 video**.
  - Orta kalemler: **2 video**.
  - Pahalı kalemler: **3 video**.
  - Her video ilerlemenin bir kısmını açar ve ilerleme kaydedilir: "2 / 3 video".
  - Böylece "bir video = bir ödül" kuralına uyulur: her video kendi başına bir ilerleme verir. Bu yorumun Poki'ye sorulması gerekiyor (bkz. §19).
- **Performans yükseltmeleri:** Yalnızca altınla alınır. Video, oyuncuya altın kazandırarak dolaylı yoldan yardım eder. Gerekçe: Doğrudan performans satmak "parayla kazanılan zafer" hissi yaratır.
- **Rastgele "günün modifiyesi"** **[Önerim]:** Garajda her gün bir modifiye "videoyla bedava" gösterilir.
- **Önizleme:** Modifiye takılmadan önce araba üstünde gösterilir. Taksi'deki `previewLook` bunu zaten yapıyor. Önizlemedeyken araba garajda dönerek sergilenir.

---

## 11. İlerleme ve ekonomi

**Tek para birimi: altın [Önerim, kullanıcı onayladı].** Arabalar, parçalar ve modifiyeler eşya olarak tutulur.

### 11.1 Başlangıç değerleri (oynanarak ayarlanacak)

| Kaynak | Altın |
|---|---|
| Yarış sırası | 1.: 150 · 2.: 120 · 3.: 100 · 4.: 80 · 5.: 65 · 6.: 50 |
| Pistten toplanan para | yarış başına ~20-60 |
| Her yeni yıldız | +40 (yalnızca ilk kazanılışta) |
| Boss yenme | 500 + araba ya da büyük ödül |
| Günlük görev | 3 görev × 100 |
| Günlük sandık | 100-300 + bir modifiye şansı |

| Harcama | Altın |
|---|---|
| Görsel modifiye | 150 - 2.500 |
| Performans seviyesi (araba başına) | 200 / 400 / 800 / 1.500 / 2.500 |
| Form seviyesi | 150 / 300 / 600 / 1.200 / 2.000 |
| Araba | 1.000 - 15.000 |

### 11.2 Ritim hedefi
- **Ortalama oyuncu her 2-3 yarışta bir şey açar.**
- "Sonraki araba %80" gibi bir **az kaldı göstergesi** her bitiş ekranında görünür.
- İlk 10 dakikada en az **3 açılış** olmalı: bedava spoiler, bir performans seviyesi, bir video modifiyesi.

### 11.3 Kupa yapısı
- Her dünyada **3 kupa** var: Bronz, Gümüş, Altın. Her kupada **5 yarış ve 1 boss** bulunur.
- Bir dünyada **6 temel pist** ve bunların varyantları kullanılır: ters yön, gece, ayna.
- Bir dünyada 18 yarış var. Çıkışta 2 dünya olduğu için 36 yarış eder. Yarış başına ortalama 2,5 dakika (garaj dahil) ve yıldız için tekrarlarla bu **2 saatin üstünde içerik** demek. Poki'nin önerdiği ~1 saati rahatça aşıyor.
- **Kilit açılma sırası:**
  - Dönüşüm Bronz → (2 yarış sonra) Kurgu Bronz açılır.
  - Gümüş kupa, aynı dünyanın Bronz boss'u yenilince açılır.
  - Kaos güncellemeyle gelir ve Gümüş seviyesindeki oyunculara hemen açılır.

---

## 12. Hayalet sistemi **[Karar: hayaletler]**

### 12.1 Kayıt
- Her yarışta oyuncunun sürüşü **10 Hz** hızında örneklenir. Her örnekte şunlar tutulur:
  - konum: pist eğrisi üzerindeki ilerleme, yanal sapma ve yükseklik (16 bitlik sayılar)
  - yön
  - olaylar: form değişimi, parça alma ya da kopma, Şok
- 2 dakikalık bir yarış ham ~15 KB, sıkıştırılınca ~5 KB tutar.
- Hayaletle birlikte saklananlar: araba kimliği, modifiye görünümü (Taksi'deki `Customization` yapısı), otomatik üretilmiş oyuncu adı, süre, pist ve sürüm.

### 12.2 Oynatma
- Hayaletler kayıttan yorumlanarak oynatılır. Fizik hesaplanmaz, bu yüzden ucuzdur.
- Oyuncunun arabasıyla **çarpışmaz**. Yarı saydam değil, normal görünür. Çok yaklaşınca hafif şeffaflaşır.
- Kaos Kupası'nda hayalet kaydı, bir **botun takip ettiği çizgi** olarak kullanılır. Bot çarpışabilir, savrulur ve sonra çizgiye döner.

### 12.3 Rakip seçimi
- Sunucu, oyuncunun o pistteki en iyi süresine yakın 5 hayalet döndürür: 2'si biraz daha yavaş, 2'si biraz daha hızlı, 1'i "ezeli rakip".
- Bu, hile yapmadan "hep çekişmeli yarış" hissi verir. Rakibin kullandığı lastik bant etkisine (geride kalan botların yapay hızlanması) gerek kalmaz.
- **Ezeli rakip:**
  - Oyuncuyu son yarışlarda en çok geçen hayalet ezeli rakip olarak işaretlenir.
  - Onun adı ve arabası pist başında özel olarak gösterilir.
  - Yenilince arabasının çıkartması oyuncunun garajına düşer.

### 12.4 Sunucu **[Önerim]**
- Ücretsiz katmanı olan, sunucusuz bir bulut servisi kullanılır (örnek: Cloudflare Workers ve onun depolaması).
- İki uç nokta: `POST /ghost` ve `GET /ghosts?pist=…&sure=…`.
- **Hile koruması:**
  - Süre, pistin fiziksel olarak mümkün olan en kısa süresinin altındaysa reddedilir.
  - Örnekler arasındaki hız sıçramaları kontrol edilir.
  - Aynı oturumdan gelen gönderimler sınırlanır.
- **Veri:** Pist başına en iyi ~2.000 hayalet ve her süre diliminden örnekler tutulur.

### 12.5 Sunucusuz çalışma (zorunlu)
- Oyunun içine her pist için **15-20 hazır hayalet** gömülür.
- **Nasıl üretilir [Önerim]:** Çoğunu bir **hayalet üretme aracı** üretir. Bu araç, pist eğrisini izleyen ve beceri seviyesi ayarlanabilen bir bot sürücüdür: dönüşüm zamanlaması, parça seçimi, hata oranı ve hız ayarlanabilir. Üstüne her pist için birkaç kendi sürüşümüz eklenir. Pist değişince hayaletler araçla yeniden üretilir. Bu yüzden araç A0'da yazılır.
- **Dürüstlük kuralı [Önerim]:** Hazır hayaletler gerçek oyuncu gibi gösterilmez. Onlar oyunun **"Kupa Pilotları"**: kendi adları, rozetleri ve karakterleri olan bir ekip ("Pilot Zıpzıp", "Kaptan Volt" gibi). Gerçek oyuncu hayaletleri ayrı bir rozetle gösterilir. Bu, çocuklara yalan söylememek içindir, ve karakterli pilotlar oyuna kişilik de katar.
- Ezeli rakip, sunucu yokken bir Kupa Pilotu olur.
- Sunucuya ulaşılamazsa (ya da Poki dış isteğe izin vermezse) oyun yalnızca bunlarla, hiçbir eksik hissettirmeden çalışır.
- **Çıkış günü boş pist sorununu** da bu çözer.

---

## 13. Ödüllü video yerleşimi

Hepsi isteğe bağlı. Ödül butonu yeşil değil, mor ya da turuncu ve üstünde video simgesi var. Yanında aynı boyutta normal bir "devam" butonu bulunur.

| # | Nerede | Teklif | Neden istenir | Sıklık sınırı |
|---|---|---|---|---|
| 1 | Kurgu bitiş ekranı | **Nadir parçayı garaja götür** | Kalıcı güç ve koleksiyon | Yarış başına 1 |
| 2 | Garaj | **Görsel modifiye aç (1-3 video)** | Kendi arabası olma isteği | Sınırsız |
| 3 | Garaj / yarış öncesi | **Kilitli arabayı tek yarışlığına dene** | Beğenince açmak için oynamaya devam etme | Günde 3 |
| 4 | Her bitiş ekranı | **Ödülü x2 yap** | Hızlı ilerleme | Yarış başına 1 |
| 5 | Yarış öncesi | **Roketle başla** (ilk 3 saniye turbo) | Avantaj, ama yarışı tek başına kazandırmaz | Yarış başına 1 |
| 6 | Kaos, araba parçalanınca | **Kaldığın yerden devam** | Kayıp hissini silmek | Yarış başına 1 |
| 7 | Ana ekran | **Günlük sandığı beklemeden aç** | Merak | Sandık başına 1 |
| 8 | Garaj | **Günün modifiyesi bedava** | Her gün geri gelmek | Günde 1 |

- **Yarış arası reklam (`commercialBreak`):** Bitiş ekranından garaja ya da sıradaki yarışa geçerken çağrılır. Reklamın gösterilip gösterilmeyeceğine Poki karar verir.
- **Teklif disiplini [Önerim]:** Aynı ekranda en fazla 2 ödüllü teklif bulunur. Oyuncu bir teklifi 3 kez üst üste reddederse o teklif bir süre küçültülür. Amaç oyuncuyu bıktırmamak, çünkü bıkan oyuncu oynama süresini düşürür.
- Taksi'deki `adFlow` (oyun durdurma, ödülü tek seferlik verme, sesi kapatma) olduğu gibi taşınır.

---

## 14. Oyuncuyu tutan sistemler

1. **Kupa yolu ve boss'lar** (§11.3).
2. **Yıldızlar:** Her pistte 3 yıldız:
   - birinci bitir
   - gizli parçayı bul
   - pist görevini yap: "3 mükemmel dönüşüm", "duvarı del", "20 blok yık"
   Toplam yıldız sayısı yeni kupaları ve bazı arabaları açar.
3. **Koleksiyon:** Araba listesi, parça albümü, kombo albümü, çıkartma albümü (ezeli rakiplerden).
4. **Ezeli rakip** (§12.3).
5. **Günlük:** 3 görev, günlük pist (sunucudan ya da tarihe bağlı yerel seçimle) ve günlük sandık. Taksi'deki `daily` modülü uyarlanır.
6. **Az kaldı göstergeleri:** Bitiş ekranında her zaman en yakın hedef gösterilir: araba %, boss'a kalan yarış, kupa yıldızı.
7. **Garaj gösterisi:** Her yeni modifiyeden sonra araba sahnede döner ve fotoğraf çekilir gibi kısa bir poz verir. Bu "paylaşılabilir an".

---

## 15. Görsel stil, performans ve teknik bütçe

### 15.1 Stil **[Karar]**
- Üç dünya da **stilize çizgi film**: tombul şekiller, doygun renkler, yumuşak ışık.
- **Neon Şehir** koyu ve siber ama yine çizgi film tarzında (konsept N-2).
- Konsept görselleri `docs/konsept/` altında: `dev-ev.png`, `ucan-adalar.png`, `neon-sehir-n2.png` (seçilen). `neon-sehir-n1.png` ve `hurdalik-elendi.png` yalnızca karşılaştırma için. Asılları kullanıcının Magnific hesabının Personal projesinde.
- Konseptler çizim. Oyun bunların **sadeleştirilmiş** hâli olacak: aynı renkler, ışıltı, ölçek hissi ve hologram canlılar, ama daha az detay.

### 15.2 Performans bütçesi **[Önerim]**

| | Değer |
|---|---|
| İlk indirme | ≤ 5 MB (ilk dünya ve garaj). Diğer dünyalar ihtiyaç anında yüklenir. |
| Toplam boyut | ≤ 15 MB |
| İlk yarışa giriş | Orta seviye telefonda ≤ 8 sn |
| FPS | Masaüstünde 60. Ucuz telefonda düşük kalitede ≥ 30. |
| Çizim çağrısı | Yarış sırasında ≤ 150 (instancing ve birleştirilmiş mesh ile) |
| Üçgen | Ekranda ≤ 300 bin (yüksek kalite), ≤ 120 bin (düşük kalite) |

- **Neon ışıltısı (bloom)** yalnızca orta ve yüksek kalitede açıktır. Düşük kalitede yerine sahte ışıltı kullanılır: yayılan malzeme ve parlayan kartlar.
- Taksi'deki `quality` ve `FpsGuard` olduğu gibi taşınır. FPS düşerse kalite otomatik düşer.

### 15.3 Varlıklar
- **Arabalar:** Taksi'deki araba modelleri temel alınır ve yarış stiline göre sadeleştirilir. Kullanıcı bu modellerin özgünleştirildiğini ve lisans sorunu olmadığını belirtti, bu konu kapalı. Eksik arabalar için ya yeni model üretilir ya da parça birleştirmeli bir araba kiti kurulur. Bu seçim yapıcıya bırakıldı. Koşul: lisans temiz olmalı.
- **Ortam:** Dünya başına bir parça kiti kullanılır: ada parçaları, mobilyalar, binalar ve tabelalar. Pist üretici bu kitleri dizer.

#### 15.3.1 Model üretim hattı: Tripo3D **[Karar: Tripo3D, kullanıcının üyeliği ve 3.200 kredisi var]**

**Ne Tripo ile, ne kodla yapılır:**
- **Tripo ile üretilir:** arabalar, form parçaları (tekne gövdesi, planör kanadı, palet), Kurgu'nun oyuncak parçaları, boss'lar (balina, robot süpürge, ejderha), dünya simgeleri (dev kristal kule, volkan adası, yatak ya da masa gibi büyük mobilyalar), süs objeleri.
- **Koddan üretilir:** pist yüzeyi, bariyerler, neon şeritler ve kemerler, hız okları, su, parçacıklar. Bunlar kalitede kayıp olmadan koddan daha hafif çıkar.

**Akış [Önerim]:**
1. **Sipariş listesi:** Her model için bir satır hazırlanır: ad, açıklama (prompt), referans görsel (konseptten kesit ya da Magnific ile üretilmiş tek obje görseli), hedef üçgen sayısı ve stil notu ("stilize çizgi film, tombul, düz renk"). Bu listeyi ben hazırlarım.
2. **Üretim:** Kullanıcı Tripo'da üretir. Mümkünse Tripo'nun **düşük poligon / yeniden topoloji** seçeneğinde, yüz sınırı hedefe yakın seçilerek. GLB çıktılar `assets/raw/` klasörüne bırakılır. (Tripo'nun API'si üyelikte varsa bu adım otomatikleştirilebilir, bu yapıcıya bırakıldı.)
3. **İşleme betiği:** Yeni betik `tools/optimize-model`, Taksi'deki `tools/blender` betikleri örnek alınarak yazılır. Bu betik:
   - Hedef üçgen sayısına indirir. Gerekirse Blender'ın Decimate aracıyla.
   - Ölçeği ve yönü düzeltir, pivotu yere koyar.
   - Dokuyu 512 piksele (arabalarda 1024) küçültür ve sıkıştırır (KTX2/Basis).
   - Mesh'i sıkıştırır (meshopt).
   - Kostüm için gereken parça adlarını kontrol eder: tekerlekler, gövde, spoiler yuvası.
   - Sonucu `public/models/` altına yazar.
4. **Kontrol:** Her model geliştirme sırasındaki bir model sergileme sayfasında açılır: üçgen sayısı, doku boyutu ve dosya boyutu gösterilir.

**Poligon bütçesi (üçgen):**

| Varlık | Yüksek kalite | Düşük kalite (LOD) |
|---|---|---|
| Oyuncunun arabası | ≤ 6.000 | ≤ 3.000 |
| Rakip / hayalet araba | ≤ 3.000 | ≤ 1.200 |
| Form parçası, oyuncak parça | ≤ 800 | ≤ 400 |
| Boss | ≤ 10.000 | ≤ 5.000 |
| Dünya simgesi (kule, volkan, yatak) | ≤ 8.000 | ≤ 3.000 |
| Süs objesi (tekrar eden) | ≤ 1.000 | ≤ 300, instancing ile |

Ekrandaki toplam bütçe §15.2'deki gibidir. Uzaktaki objeler için LOD ya da düz kartlar kullanılır.

**Kredi planı:**
- Çıkış için yaklaşık **110-130 model** gerekiyor: 12 araba (sonra 30), 4 form parçası, ~16 oyuncak parça, 3 boss, dünya başına ~10 simge ve ~20 süs objesi.
- Model başına kredi maliyeti A0'da ilk birkaç üretimle ölçülür. Plan o ölçüme göre güncellenir.
- Krediler **önce A0 ve A1'in ihtiyacına** harcanır, beğenilmeyen stil için toplu üretim yapılmaz.
- **Stil tutarlılığı:** Her dünya için önce bir "stil örneği" modeli üretilir ve kullanıcı onaylar. Kalan modeller aynı prompt kalıbı ve referansla üretilir.

**Lisans notu:** Tripo'nun ücretli üyeliğindeki modellerin ticari kullanım hakkı, üyelik koşullarından bir kez kontrol edilmeli (bkz. §19).
- **Ses:** Motor (devire göre perde), her form ve parça için ayrı ses, yıkım sesleri, her dünyaya bir müzik. Hepsi telifsiz ya da bizim üretimimiz olmalı.

---

## 16. Teknik mimari

### 16.1 İstanbul Taksi'den alınacaklar

| Taksi modülü | Yeni oyunda |
|---|---|
| `platform/adFlow.ts`, `ads.ts`, `poki.ts` | Olduğu gibi |
| `platform/storage.ts`, `sim/save.ts` | Kayıt yapısı yeni oyuna göre yeniden yazılır, okuma ve yazma kodu korunur. Poki'nin bulut kaydı varsa kullanılır. |
| `sim/vehicle*.ts` | Arcade yarış için yeniden ayarlanır. Taksiye özgü kısımlar (fren pedalı ayrıntıları, kaldırım) sadeleştirilir. |
| `game/breakables/*` | Kaos yıkımına uyarlanır |
| `garage/*`, `game/parts/*` | Garaj, modifiye kiti, önizleme ve sergileme. Kategoriler yeniden düzenlenir. |
| `sim/daily.ts`, `sim/economy.ts` | Görev ve ödül tipleri yarışa göre yeniden yazılır |
| `game/quality.ts`, `qualityApply.ts` | Olduğu gibi |
| `game/touchControls.ts`, `input.ts` | Direksiyon ve yetenek tuşlarına uyarlanır |
| `game/camera.ts` | Yarış kamerası için yeniden ayarlanır |

### 16.2 Yeni yazılacaklar
- **Pist sistemi:** eğri veri biçimi, mesh ve çarpışma üretimi, bölüm etiketleri, kenar süsleme, varyantlar, düzenleme sayfası.
- **Yarış yöneticisi:** başlangıç geri sayımı, sıralama, bitiş, ödül hesabı.
- **Hayalet kaydı ve oynatıcısı**, Kaos için çizgi takip eden botlar.
- **Kupa mekanikleri:** dönüşüm formları, parça yuvaları ve kombolar, Şok sayacı.
- **Boss'lar.**
- **Kupa haritası ve menüler.**
- **Hayalet sunucusu.**
- **Yerelleştirme:** Türkçe ve İngilizce. Arayüz önce simge, sonra yazı (çocuklar için).

### 16.3 Mimari kurallar **[Önerim]**
- Taksi'deki ayrım korunur:
  - **`sim/`:** saf mantık, Three.js içermez, testli.
  - **`game/`:** görüntü.
  - **`ui/`:** HTML arayüz.
- Yarış mantığı (sıralama, ödül, dönüşüm kuralları, parça etkileri) test edilebilir saf fonksiyonlar olarak yazılır.
- Geliştirme sürümünde `window.__race` test kancası olur (Taksi'deki `window.__taxi` gibi). Tarayıcı testlerinde pist atlamayı ve yarış durumu okumayı sağlar.
- Kayıt dosyasında sürüm alanı bulunur, eski kayıtlar yeni sürüme taşınır.

---

## 17. Ölçüm

- **Poki paneli:** oyuna giriş oranı, oynama süresi, reklam sayıları.
- **Kendi sayaçlarımız [Önerim, Poki onayına bağlı]:** Hayalet sunucusuna anonim ve toplu sayaçlar gönderilir:
  - hangi ödüllü teklif kaç kez gösterildi ve kaç kez kabul edildi
  - hangi yarışta oyuncular bırakıyor
  - ertesi gün geri dönüş
- Kişisel veri gönderilmez.

---

## 18. Yol haritası

His önce gelir: hiçbir sistem, kullanıcı oyunun hissini onaylamadan kurulmaz.

| Aşama | İçerik | Bitti sayılması için |
|---|---|---|
| **A0. His prototipi** | Uçan Adalar'da 1 pist: otomatik gaz, direksiyon, 4 form, mükemmel dönüşüm, kamera ve efektler, 5 yerel hayalet | **Kullanıcı oynar ve onaylar** |
| **A1. Dikey dilim** | Dönüşüm Bronz kupası (5 yarış + Balina boss), garaj (performans + 15 modifiye), ekonomi, ödüllü videolar, kayıt, Poki SDK, kalite ayarı | Baştan sona oynanabilir, Poki yerel test aracında sorunsuz |
| **A2. Kurgu** | Dev Ev, parça sistemi, kapılar, kombolar, Robot Süpürge boss, Kurgu Bronz kupası | Kullanıcı hissi onaylar |
| **A3. İçerik ve çıkış** | İki dünyada Gümüş ve Altın kupalar, 12 araba, 60+ modifiye, hayalet sunucusu, günlük sistemler, Türkçe ve İngilizce, cila, Poki gönderimi | Poki'nin yumuşak çıkışı |
| **A4. Kaos güncellemesi** | Neon Şehir, çarpışma ve yıkım, Şok, Ejderha boss, yeni arabalar | Poki'de güncelleme yayında |

---

## 19. Riskler ve açık konular

| Risk | Etkisi | Önlem |
|---|---|---|
| Üç mekanik birden kapsamı şişirir | Gecikme | Kaos çıkıştan sonraya alındı. Her kupa ayrı aşamada ve ayrı onayla ilerler. |
| Poki dış isteğe (hayalet sunucusu) izin vermez | Ezeli rakip ve gerçek hayaletler kaybolur | Gömülü hayaletlerle tam çalışma (§12.5). Poki'ye A1'de sorulur. |
| "Çok videolu modifiye" Poki kurallarına takılır | Video gelirinde düşüş | Poki'ye sorulur. Gerekirse her modifiye 1 videoya iner ya da fiyatlar yeniden ayarlanır. |
| Neon ışıltısı ucuz telefonda ağır gelir | Kasma, düşük puan | Kalite ayarı ve sahte ışıltı (§15.2) |
| 30 araba ve 3 dünyanın varlık üretimi uzun sürer | Gecikme | Tripo3D üretim hattı (§15.3.1), dünya kostümleri ve pist varyantlarıyla emeğin çoğaltılması |
| Tripo modelleri birbirine benzemez ya da fazla ağır çıkar | Kalitesiz görünüm, kasma | Dünya başına stil örneği onayı, işleme betiği ve poligon bütçesi (§15.3.1) |
| Tripo ticari kullanım koşulları | Hukuki | Üyelik koşulları A0'da bir kez kontrol edilir |
| Dönüşüm mekaniği mobildeki "shape-shifting" oyunlarına benzer | Özgünlük algısı | Bizimki gerçek bir yarış: mükemmel dönüşüm turbosu, hayaletler, garaj. Görsel dil tamamen bizim. |
| Çocuklar için zorluk dengesi | Bırakma | Hayalet seçimi oyuncunun seviyesine göre (§12.3). İlk kupada cömert pencereler. |

---

## 20. Yapıcıya bırakılanlar
- Dosya ve klasör yapısının ayrıntısı, modül bölünmesi (Taksi'deki düzene benzer olmalı).
- Ekonomideki sayıların ince ayarı. §11'deki değerler başlangıç noktası.
- Pist sayısı ve uzunluklarının ayarı (dünya başına 6 temel pist hedefi korunarak).
- Araba modellerinin nasıl üretileceği (§15.3), lisans koşuluna uyarak.
- Hayalet sunucusunun teknolojisi (sunucusuz, ücretsiz katman, §12.4 arayüzüyle).
- Ses ve müzik kaynakları (telifsiz ya da kendi üretimimiz).
- Arayüz yerleşiminin ayrıntısı. Simge öncelikli, büyük dokunma alanları.

---

## 21. Karar kaydı

| Konu | Karar | Kim |
|---|---|---|
| Tür | Cars Racing Masters türünde, daha zekice ve kaliteli yarış | Kullanıcı |
| Kupa türleri | Dönüşüm, Kurgu ve Kaos, üçü birden | Kullanıcı |
| Rakipler | Gerçek oyuncu hayaletleri | Kullanıcı |
| Dünyalar | Dev Ev, Uçan Adalar, Neon Şehir (N-2, koyu siber, çizgi film) | Kullanıcı |
| Dünya ve kupa eşlemesi | Dev Ev = Kurgu, Adalar = Dönüşüm, Neon = Kaos | Kullanıcı onayladı |
| Görsel stil | Stilize çizgi film | Kullanıcı |
| Oyuncuyu tutma ve video sistemi | §13-14 | Kullanıcı onayladı |
| Modifiyeler | Altınla ya da video izleyerek | Kullanıcı |
| Teknoloji | Three.js + İstanbul Taksi altyapısı | Kullanıcı |
| 3D model üretimi | Tripo3D (kullanıcının 3.200 kredisi), düşük poligon hedefiyle | Kullanıcı |
| Form seçimi, boss kuralları, arabaya özel modifiyeler, Kupa Pilotları (dürüst hazır hayaletler), Tripo işleme hattı ve poligon bütçesi | İnceleme sonrası benim kararım | Ben |
| Ortak garaj, tek para birimi, açılış sırası, Kaos'un güncellemeyle gelmesi | Önerildi, itiraz gelmedi | Ben |
| Gaz manuel, ayarlarda otomatik gaz | Kullanıcı | Kullanıcı |
| Kontrol yerleşimi, sayılar, performans bütçesi, mimari kurallar | Benim kararım | Ben |
| Belgenin tamamı | Onaylandı (23 Kasım 2026) | Kullanıcı |
