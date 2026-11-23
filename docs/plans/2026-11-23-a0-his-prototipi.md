# A0 His Prototipi: Yapım Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uçan Adalar'da tek bir pistte, 5 hayalete karşı oynanabilen ve kullanıcının "his" onayına sunulacak bir Dönüşüm Kupası yarışı yapmak. Yarışta manuel ya da otomatik gaz, direksiyon, 4 form, mükemmel dönüşüm turbosu ve komboları, rampadan uçuş, boşluktan süzülme, tırmanış, efektler ve ses olacak.

**Architecture:**
- **Pist:** Kontrol noktalarından üretilen bir eğri. Araba fiziği bu eğrinin **kendi koordinatlarında** çalışır: `s` pist boyunca mesafe, `d` yanal sapma, `y` pist yüzeyinden yükseklik.
- **Hayaletler ve rakipler:** Aynı saf `sim/` fiziği hem oyuncuyu hem de Node'da hayalet üreten bot sürücüyü çalıştırır. Bu yüzden hayaletler gerçekçi olur.
- **Katmanlar:** `sim/` saf ve testli, Three.js içermez. `game/` görüntü, `ui/` DOM arayüz. Bu, Taksi'deki düzenin aynısı.

**Tech Stack:** TypeScript 7, Three.js 0.187, Vite 8, Vitest 5 (Taksi ile aynı sürümler).

**Spec:** `Fikir/yaris-oyunu/docs/2026-11-23-yaris-oyunu-tasarim.md` (onaylı). Bu plan A0'ı kapsıyor (§18). Sonraki aşamaların taslağı en altta.

## Global Constraints

- Gaz: W / ↑ basılı tut. Ayarlarda "Otomatik gaz". Dokunmatikte sol yarıya parmak değdiği sürece gaz, aynı parmak sağa-sola sürüklenince direksiyon (spec §7).
- Form tuşları: klavyede 1 araba, 2 tekne, 3 planör, 4 tırmanıcı. Dokunmatikte sağ altta yay şeklinde 4 tuş (spec §7, §9.1).
- Mükemmel dönüşüm: zemin değişmeden **önceki 0,3 sn** içinde doğru forma geçmek **1 sn turbo** verir. 3 mükemmel üst üste gelince alev görünümü (spec §9.1).
- Hız okları: 1,5 sn boyunca +%30 (spec §8.3).
- Yarış: 6 araç (oyuncu ve 5 hayalet), tek tur, 90-150 sn (spec §8.1).
- Hayaletler oyuncunun arabasıyla çarpışmaz. Çok yaklaşınca şeffaflaşır (spec §12.2).
- Hazır hayaletler "Kupa Pilotları" adıyla ve rozetle gösterilir, gerçek oyuncu gibi gösterilmez (spec §12.5).
- Düşen araba 1 sn içinde son güvenli noktaya geri konur ve hız kaybeder (spec §8.1).
- Kamera: rampada ve dönüşümde ağır çekim en fazla 0,4 sn, 0,5 kat hız (spec §8.2).
- Performans: masaüstünde 60 FPS. Ucuz telefonda düşük kalitede ≥ 30 FPS. Yarışta ≤ 150 çizim çağrısı. Bloom yalnızca yüksek kalitede (spec §15.2).
- Görünüm: stilize çizgi film, `docs/konsept/ucan-adalar.png` (spec §15.1).
- Tüm asset yolları göreli (`base: './'`). Dışarıya istek yok.
- Kopya yok: ad, pist ve arayüz özgün (spec §3).
- Arayüz metinleri Türkçe ve simge öncelikli.
- Geliştirme sürümünde `window.__race` test kancası olur (spec §16.3).

## Review Focus

1. **Çok düşük ya da düzensiz FPS (sekme arka planda, 10-20 FPS):** Fizik sabit adımda koştuğu için araba duvarlardan geçmemeli, zıplamalar aynı kalmalı. → Task 3'te `stepRacer` için "dt 0,1 ile 60 adım, sonuç dt 1/60'a yakın" testi.
2. **Oyuncu formu mükemmel pencereden önce ya da sonra değiştirir, ya da hiç değiştirmez:** Erken değişim turbo vermez ama ceza da yok. Geç ya da hiç değişmeyince yanlış form cezası uygulanır ve kombo sıfırlanır. Boşlukta yanlış formda düşüp geri konmalı, takılı kalmamalı. → Task 2 ve Task 3 testleri.
3. **Yanlış formla tırmanış:** Oyuncu sonsuza kadar takılı kalmamalı. Çok yavaş da olsa ilerler. → Task 3'te "araba formuyla tırmanış bitiyor" testi.
4. **Bariyere sürekli sürtme ya da ters yöne dönme:** Araba pistin içinde kalmalı ve ilerlemeye devam edebilmeli. Yaw ±75° ile sınırlı. → Task 3 testi.
5. **Dokunmatik çoklu parmak:** Sol yarıda gaz ve direksiyon basılıyken sağ yarıdaki form tuşu çalışmalı. Sol parmak kalkınca gaz bitmeli (otomatik gaz kapalıysa). → Task 7'de `touchMath` testi.

---

## Dosya yapısı

```
yaris-oyunu/
  package.json, tsconfig.json, vite.config.ts, index.html
  src/
    main.ts                 boot, ana döngü, sahne kurulumu
    sim/                    saf mantık (testli)
      vec.ts                küçük 3B vektör yardımcıları
      track.ts              TrackDef → TrackFrames (örnekleme, frameAt, surfaceAt, sınırlar)
      tracks/adalar1.ts     A0 pistinin verisi
      forms.ts              FormId, form-zemin uyumu, mükemmel pencere değerlendirmesi
      racer.ts              arcade araç fiziği (pist koordinatlarında)
      race.ts               geri sayım, sıralama, bitiş, sonuçlar
      ghost.ts              kayıt, kodlama/çözme, oynatma
      bot.ts                ayarlanabilir bot sürücü (hayalet üretimi)
      pilots.ts             Kupa Pilotları (ad, rozet, renk, beceri)
    game/                   görüntü
      quality.ts, postFx.ts Taksi'den kopya (küçük uyarlama)
      trackMesh.ts          yol, bariyer, su kanalı, boşluk kenarı, tırmanış duvarı, hız okları, mükemmel çizgi
      islands.ts            temalı adalar ve süsler (şeker, buz, volkan, su)
      sky.ts                gökyüzü kubbesi, bulut denizi, bulutlar
      car.ts                araba modeli ve form parçaları (tekne, kanat, palet) ile dönüşüm animasyonu
      ghosts.ts             hayalet arabaları çizme ve şeffaflık
      chaseCamera.ts        takip kamerası, FOV, sarsıntı
      fx.ts                 parçacıklar, hız çizgileri, turbo alevi, flaş
      audio.ts              sentez sesler
      timeScale.ts          ağır çekim yönetimi
    ui/
      input.ts, touchMath.ts   klavye ve dokunmatik → RaceInput
      hud.ts, hud.css          hız, sıra, ilerleme, form tuşları, kombo, geri sayım, sonuç, ayarlar
      settings.ts              otomatik gaz, kalite, ses (localStorage)
  tools/
    make-ghosts.ts          botlarla public/ghosts/adalar1.json üretir (vite-node ile)
  public/
    models/                 Taksi'den seçilen araba GLB'si
    ghosts/adalar1.json
```

`.claude/launch.json` dosyasına `"yaris-oyunu"` adıyla 5185 portu eklenir.

---

### Task 1: Proje iskeleti

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/sim/vec.ts`, `src/sim/vec.test.ts`
- Copy: Taksi'den `src/game/quality.ts`, `src/game/lighting/postFx.ts` (→ `src/game/postFx.ts`), `public/draco/`, araba modeli
- Modify: `Fikir/.claude/launch.json`

**Interfaces:**
- Produces: `vec.ts`: `type V3 = { x: number; y: number; z: number }`, `v3()`, `add`, `sub`, `scale`, `dot`, `cross`, `len`, `norm`, `lerp`

- [ ] package.json Taksi'nin scriptleriyle aynı, port 5185. Bağımlılıklar `three`, geliştirme bağımlılıkları Taksi ile aynı, ayrıca `vite-node`.
- [ ] `vec.test.ts`: `norm({3,0,4})` sonucu `{0.6,0,0.8}`, `cross(x̂,ŷ)` sonucu `ẑ`.
- [ ] `npm test` geçer. `npm run dev` boş, gökyüzü renkli bir sahne gösterir.

### Task 2: Pist ve formlar (saf)

**Files:**
- Create: `src/sim/track.ts`, `src/sim/forms.ts`, `src/sim/tracks/adalar1.ts`, `src/sim/track.test.ts`, `src/sim/forms.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Surface = 'road' | 'ice' | 'water' | 'gap' | 'climb'
  interface TrackSection { len: number; surface: Surface; width?: number; boost?: [number, number][]; ramp?: boolean }
  interface TrackDef { id: string; name: string; points: V3[]; sections: TrackSection[]; coins: { s: number; d: number }[]; theme: ThemeZone[] }
  interface Frame { s: number; pos: V3; t: V3; up: V3; right: V3; pitch: number; curvV: number; curvH: number; width: number; surface: Surface }
  interface Track { def: TrackDef; length: number; frames: Frame[]; frameAt(s): Frame; surfaceAt(s): Surface;
                    nextBoundary(s): { s: number; surface: Surface } | null; boostAt(s): boolean; respawnS(s): number }
  function buildTrack(def: TrackDef, step = 1): Track
  type FormId = 'car' | 'boat' | 'glider' | 'climber'
  const FORM_FOR: Record<Surface, FormId>   // road, ice → car; water → boat; gap → glider; climb → climber
  function formSpeedMul(form: FormId, surface: Surface): number
  const PERFECT_WINDOW = 0.3
  type SwitchVerdict = 'perfect' | 'early' | 'late' | 'none'
  function judgeSwitch(timeToBoundary: number, newForm: FormId, nextSurface: Surface): SwitchVerdict
  ```
- **Eğri:** Kontrol noktalarından Catmull-Rom (centripetal) ile 1 m aralıklarla yeniden örneklenir. `up` vektörü dünya Y'sinden türetilir ve virajlarda `curvH` ile hafif yatırılır (en fazla 12°). `pitch` = asin(t.y). `curvV` = d(pitch)/ds.
- **`sections`:** Toplam uzunluğa ölçeklenmez. Sırayla s aralıkları verir, son bölüm pist sonuna kadar uzar.
- **`formSpeedMul` tablosu** (satır = form, sütun = zemin):

  | | road | ice | water | gap | climb |
  |---|---|---|---|---|---|
  | car | 1 | 1 | 0.30 | – | 0.25 |
  | boat | 0.40 | 0.50 | 1.05 | – | 0.25 |
  | glider | 0.55 | 0.60 | 0.30 | 1 | 0.25 |
  | climber | 0.60 | 0.60 | 0.30 | – | 1 |

  `gap` sütunu: planör dışındaki formların süzülme gücü yoktur, bu racer.ts'te ele alınır.
- **adalar1:** ~3,6 km, hedef süre ~110 sn. Bölüm sırası:
  1. road (düz başlangıç, 250 m)
  2. road + boost
  3. water kanalı (200 m)
  4. road (şeker adası virajları)
  5. ramp → gap (60 m, aşağı kavisli)
  6. road
  7. ice (buz adası, 250 m)
  8. climb (volkan duvarı, 90 m, 30° eğim)
  9. road (lav kenarı)
  10. water (şelale altı)
  11. gap (90 m)
  12. road (bitiş)

  Her bölüme tema bölgesi eklenir: `candy`, `ice`, `volcano`, `water`.
- **Testler:**
  - `buildTrack` uzunluğu, noktalar arası polyline uzunluğunun ±%1'i.
  - `frameAt(s).t` birim vektör.
  - `surfaceAt` bölüm sınırlarını doğru döndürür.
  - `nextBoundary` sonraki zemin değişimini verir.
  - `respawnS(gapİçindeBirS)`, boşluktan önceki son road bölümünün başından ≥ 10 m ilerisini verir.
  - `judgeSwitch(0.2, 'boat', 'water')` → `perfect`; `(0.31, …)` → `early`; `(-0.1, …)` → `late`; yanlış form → `none`.

### Task 3: Arcade fizik (saf)

**Files:**
- Create: `src/sim/racer.ts`, `src/sim/racer.test.ts`

**Interfaces:**
- Consumes: Task 2 `Track`, `FormId`, `formSpeedMul`, `judgeSwitch`, `FORM_FOR`
- Produces:
  ```ts
  interface RaceInput { throttle: number; brake: number; steer: number /* -1 sağ … +1 sol */; form: FormId | null /* bu karede istenen form */ }
  interface RacerParams { vmax: number; accel: number; steerRate: number; grip: number }
  const DEFAULT_PARAMS: RacerParams  // vmax 46 m/s, accel 14, steerRate 1.9, grip 1
  interface RacerState { s; d; y; vs; vy; yaw; speed; form: FormId; formT: number; turbo: number; boost: number;
                         combo: number; airborne: boolean; respawnT: number; lastSafeS: number; finished: boolean; time: number }
  type RacerEvent = { kind: 'perfect' | 'early' | 'late' | 'wrongForm' | 'boost' | 'jump' | 'land' | 'splash' | 'wall' | 'fall' | 'respawn' | 'coin' | 'finish'; value?: number }
  function newRacer(track: Track, s0: number, d0: number): RacerState
  function stepRacer(st: RacerState, inp: RaceInput, p: RacerParams, track: Track, dt: number): { st: RacerState; events: RacerEvent[] }
  const FIXED_DT = 1 / 120
  ```
- **Yöntem:**
  - `stepRacer`, dt'yi en fazla 0,1 ile sınırlar ve `FIXED_DT` alt adımlarla çalışır. Girdi state'i değiştirmez, yeni state döner.
  - Hız: `speed += (throttle·accel·(1 − speed/vEff) − brake·22 − drag − g·sin(pitch)·[form ≠ climber]) · dt`.
  - `vEff = vmax · formSpeedMul · (1 + 0.35·[turbo>0] + 0.30·[boost>0] + 0.1·min(combo,3))`.
  - Kombo 3 ve üstündeyse "alev" sayılır.
  - Yanlış formda hız yumuşakça `vEff` değerine iner (sert fren yok).
  - Hareket: `ds = speed·cos(yaw)`, `dd = speed·sin(yaw)`.
  - Yaw: direksiyonla `steerRate·steer·(0.35 + 0.65·min(1, speed/20))` hızında değişir. Direksiyon bırakılınca 2,5/s hızla 0'a döner (arcade yardım).
  - Yaw ±75° ile sınırlı. Havadayken direksiyon %30 etkili.
  - Dikey: `ay = −g·cos(pitch) − speed²·curvV` (pist eğrisi üzerindeki göreli ivme).
    - Yerdeyse ve `ay > 0` ise araba havalanır.
    - Planör havadayken `vy ≥ −2.2` ile sınırlanır ve hız kaybetmez.
    - Gap zemininde zemin yoktur.
    - `y < −14` olursa `fall`, ardından 0,6 sn sonra `respawn` olur: `respawnS` noktasına, hız %60 ve doğru form ile.
  - Su: araba, planör ve tırmanıcı suda `y` değeri −0,5'e iner (batma görünümü) ve `splash` olayı üretir.
  - Bariyer: `|d| > width/2 − 1.0` olunca d sınırlanır, `yaw *= −0.3`, `speed *= 0.92` ve `wall` olayı (değeri hız) üretilir.
  - Form değişimi: `inp.form` mevcut formdan farklıysa form değişir ve `formT = 0.25` olur (animasyon süresi). Sonra `judgeSwitch` çağrılır:
    - `perfect` → `turbo = 1`, `combo++`
    - `late` → `combo = 0`
  - Sonraki sınırdan sonra 0,1 sn hâlâ yanlış formda kalan oyuncuda `wrongForm` olayı olur ve kombo sıfırlanır (sınır başına bir kez).
  - Altın: `track.def.coins` için `|Δs| < 1.5` ve `|Δd| < 1.3` olunca `coin` olayı. Toplanan altınların indeksleri state'te tutulur.
  - Bitiş: `s ≥ length` olunca `finished` ve `finish` olayı.
- **Testler:**
  - Düz yolda tam gazla 6 sn sonra hız ≥ 0,85·vmax.
  - Su bölümünde araba formuyla hız ≤ 0,32·vmax'a iner, tekne formuyla ≥ 0,95·vmax.
  - Boşluğa araba formuyla girilince `fall` ve `respawn` gelir, s boşluktan önceye döner. Planörle girilince `land` gelir ve s boşluğun sonunu geçer.
  - Sınırdan 0,2 sn önce doğru form seçilince `perfect` gelir ve turbo > 0 olur.
  - **Review Focus 1:** Aynı girdiyle, `dt=0.1` kullanan 60 adımın sonucundaki s değeri, `dt=1/60` kullanan 360 adımın sonucuyla ±%2 içinde.
  - **Review Focus 3:** Araba formuyla tırmanış bölümüne girip tam gaz sürünce 60 sn içinde tırmanış bitiyor.
  - **Review Focus 4:** 20 sn boyunca sola tam direksiyonla |d| hep ≤ width/2 kalıyor ve s artmaya devam ediyor.
  - Rampa bölümünde 40 m/s hızla `jump` olayı geliyor.

### Task 4: Yarış, hayalet, bot, pilotlar (saf) ve hayalet üretimi

**Files:**
- Create: `src/sim/race.ts`, `src/sim/ghost.ts`, `src/sim/bot.ts`, `src/sim/pilots.ts`, ilgili `*.test.ts` dosyaları, `tools/make-ghosts.ts`, `public/ghosts/adalar1.json`

**Interfaces:**
- Consumes: Task 3 `stepRacer`, `newRacer`, `RacerState`
- Produces:
  ```ts
  interface GhostSample { t: number; s: number; d: number; y: number; yaw: number; form: FormId; fx: number /* bit: 1 turbo, 2 alev, 4 boost */ }
  interface Ghost { id: string; pilot: string; car: string; color: number; time: number; hz: 10; samples: GhostSample[] }
  class GhostRecorder { constructor(hz = 10); push(t: number, st: RacerState): void; finish(meta): Ghost }
  function encodeGhost(g: Ghost): string; function decodeGhost(s: string): Ghost   // gruplanmış Int32/Int16 → base64
  function sampleGhost(g: Ghost, t: number): GhostSample   // doğrusal ara değer, form en yakın önceki örnekten
  interface BotSkill { perfectChance: number; earlyRange: [number, number]; lateChance: number; lineNoise: number; throttleLift: number; wallChance: number }
  function botInput(st: RacerState, track: Track, skill: BotSkill, rng: () => number, mem: BotMemory): RaceInput
  function runBot(track: Track, skill: BotSkill, seed: number, params?: RacerParams): Ghost
  interface Pilot { id: string; name: string; badge: string; color: number; skill: BotSkill }
  const PILOTS: Pilot[]   // 15 pilot: "Pilot Zıpzıp", "Kaptan Volt", "Bulut Avcısı", "Minik Fırtına", ... farklı beceriler
  interface Racer { id: string; name: string; isPlayer: boolean; badge?: string }
  function standings(entries: { id: string; s: number; finishedAt: number | null }[]): string[]
  class RaceClock { phase: 'intro' | 'countdown' | 'racing' | 'finished'; t: number; countdown: number; tick(dt): void }
  ```
- **`bot.ts`:**
  - Bot bir "yarış çizgisi" izler: viraj içine doğru, `curvH` ile ölçeklenen bir d hedefi ve altınlara hafif bir çekim.
  - Hedefe giden direksiyon PD kontrolle hesaplanır. Üstüne `lineNoise` kadar yavaş gürültü eklenir.
  - Sonraki sınıra kalan süre hesaplanır. Bot `perfectChance` olasılıkla 0,05-0,28 sn kala, aksi hâlde `earlyRange` içinde erken ya da `lateChance` olasılıkla 0,1-0,4 sn geç form değiştirir.
- **`make-ghosts.ts`:** 15 pilotun her biri için 3 tohumla `runBot` çalıştırır. Hedef süre bandında kalan en iyi koşuyu seçer, böylece süreler 100-160 sn arasına yayılır. Sonuç `public/ghosts/adalar1.json` olarak yazılır (kodlanmış).
- **Testler:**
  - `encodeGhost` ve `decodeGhost` gidiş-dönüşü: s ±0,05, d ±0,01.
  - `sampleGhost` ara değeri doğru.
  - En iyi beceriyle `runBot` 160 sn altında bitiriyor. En kötü beceriyle 240 sn altında bitiriyor (takılmıyor).
  - `standings`: bitirenler bitiş zamanına göre, diğerleri s'ye göre sıralanıyor.
  - `RaceClock`: 3 sn geri sayımdan sonra `racing` oluyor.

### Task 5: Dünya ve pist görüntüsü

**Files:**
- Create: `src/game/trackMesh.ts`, `src/game/islands.ts`, `src/game/sky.ts`

**Interfaces:**
- Consumes: `Track`, `Frame`
- Produces:
  ```ts
  function buildTrackMesh(track: Track, q: Quality): { group: THREE.Group; update(timeS: number, playerS: number, playerSpeed: number): void }
  function buildIslands(track: Track, q: Quality, seed: number): THREE.Group
  function buildSky(scene: THREE.Scene): { update(camera: THREE.Camera, t: number): void }
  ```
- **Yol:**
  - Zemine göre renk: road = sıcak gri ve şeker şeritli kenarlar; ice = açık mavi, parlak; water = yarı saydam ve animasyonlu dalga (vertex shader `uTime`); climb = kaya doku deseni ve tutunma çizgileri; gap = yol yok, iki uçta parlak kenar ve iniş platformu.
  - Bariyerler pembe-beyaz şeker çubuğu desenli ve instanced.
  - Hız okları: yerde animasyonlu, yayılan malzemeli oklar.
  - **Mükemmel çizgi:** Sıradaki sınırda, sınırdan `playerSpeed·0,3` metre önce başlayıp sınırda biten parlak bir bant. Bant `update()` içinde her karede ölçeklenir ve gelen zeminin form rengini alır.
  - Altınlar instanced ve dönerek görünür.
- **Adalar:**
  - Pistin altında ve çevresinde, düşük poligonlu, alt yüzü sarkık kayalı adalar. Instanced, tema rengine göre boyanır.
  - Süsler:
    - candy: lolipop, sakız topu, kurabiye
    - ice: kristal, kardan kule
    - volcano: lav nehri (yayılan malzeme), duman billboard'ları
    - water: şelale (kayan doku)
  - Düşük kalitede yarı sayıda süs.
- **Gökyüzü:** Degrade kubbe (konseptteki mavi), aşağıda bulut denizi düzlemi, büyük ve yumuşak bulut billboard'ları.
- **Bütçe:** Toplam çizim çağrısı ≤ 120. Doğrulama `renderer.info.render.calls` ile yapılır (Task 8).

### Task 6: Araba, formlar, hayaletler, kamera, efektler, ses, ağır çekim

**Files:**
- Create: `src/game/car.ts`, `src/game/ghosts.ts`, `src/game/chaseCamera.ts`, `src/game/fx.ts`, `src/game/audio.ts`, `src/game/timeScale.ts`

**Interfaces:**
- Produces:
  ```ts
  class CarView { readonly root: THREE.Group; constructor(model: THREE.Object3D | null, color: number);
                  setForm(form: FormId, animate: boolean): void; update(st: RacerState, frame: Frame, dt: number): void }
  class GhostViews { constructor(scene, ghosts: Ghost[], pilots: Pilot[]); update(raceT: number, track: Track, playerPos: THREE.Vector3): void; positions(raceT: number): { id: string; s: number }[] }
  class ChaseCamera { constructor(cam: THREE.PerspectiveCamera); update(target: CarView, st: RacerState, dt: number): void; shake(amount: number): void }
  class Fx { constructor(scene, q: Quality); onEvent(e: RacerEvent, at: THREE.Vector3): void; update(dt, car: CarView, st: RacerState): void }
  class RaceAudio { start(): void; suspend(on: boolean): void; update(st: RacerState, throttle: number): void; onEvent(e: RacerEvent): void }
  class TimeScale { trigger(scale = 0.5, seconds = 0.4): void; step(realDt: number): number /* oyun dt */ }
  ```
- **Araba:**
  - Taksi'deki modellerden biri kullanılır (sıra: `rt40`, `r245`). Gövdesi yarış rengine boyanır, taksi lambası yok. Model yüklenemezse koddan üretilmiş tombul bir araba çıkar.
  - **Form parçaları** koddan üretilir:
    - tekne: tekerlekler yatar, altına gövde etek, arkada pervane
    - planör: yanlardan açılan kanatlar, arkada kuyruk
    - tırmanıcı: tekerleklerin yerine paletler, önde tutunma pençeleri
  - Dönüşüm 0,25 sn sürer. Ölçek "pop" etkisi ve parçaların açılma animasyonu ile oynar.
- **Hayaletler:**
  - Aynı model kullanılır. Pilot rengiyle boyanır, üstünde ad ve rozet etiketi (sprite) vardır.
  - Oyuncuya 6 m'den yakınken %40 opaklığa iner.
  - Hayaletlerin form değişimi de görünür.
- **Kamera:**
  - Arabanın 7 m arkasında, 2,6 m yukarıda, yumuşak takip.
  - FOV 62°'den başlar, hız ve turboyla 80°'ye kadar genişler.
  - Duvara çarpınca ve iniş yapınca sarsılır. Havadayken biraz uzaklaşır.
- **Efektler:**
  - hız çizgileri (ekran kenarında)
  - turbo ve alev egzozu
  - su sıçraması
  - toz ve kar
  - mükemmel dönüşümde ekran flaşı (DOM) ve halka parçacık
  - duvarda kıvılcım
  - altın toplanınca parıltı
  - Tüm parçacıklar `THREE.Points` havuzlarından ya da instanced meshlerden gelir.
- **Ses:** Sentez sesler (dosya yok):
  - motor (hıza göre perde), formlara göre tını (tekne daha derin, planörde rüzgâr)
  - dönüşüm "vınn"ı
  - mükemmel dönüşümde yükselen arpej, kombo arttıkça daha tiz
  - su sıçraması (filtrelenmiş gürültü), iniş "güm"ü, altın "tıng"ı
  - geri sayım bipleri ve bitiş fanfarı
- **Ağır çekim:** `jump` olayı 25 m/s üstünde gelirse ve ilk mükemmel dönüşümde tetiklenir. 2 sn içinde tekrar tetiklenmez.

### Task 7: Girdi, arayüz, ayarlar ve ana döngü

**Files:**
- Create: `src/ui/input.ts`, `src/ui/touchMath.ts`, `src/ui/touchMath.test.ts`, `src/ui/hud.ts`, `src/ui/hud.css`, `src/ui/settings.ts`, `src/ui/settings.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces:
  ```ts
  interface Settings { autoGas: boolean; quality: Quality; sound: boolean }
  function loadSettings(): Settings; function saveSettings(s: Settings): void
  class Input { constructor(root: HTMLElement, settings: () => Settings); read(dt: number): RaceInput; onAny(fn: () => void): void }
  function touchSteer(startX: number, x: number, width: number): number   // −1…+1, ölü bölge %2, tam dönüş genişliğin %18'i
  class Hud { showStart(); countdown(n: number); update(view: HudView); flashPerfect(combo: number); showWrongForm(); showResults(r: ResultView); onRestart(fn); onForm(fn: (f: FormId) => void); hintForm(f: FormId | null) }
  ```
- **Girdi:**
  - Klavye: W/↑ gaz, S/↓ fren, A/D ve ←/→ direksiyon, 1-4 form, R yeniden başla, Esc duraklat. Tuşlar Taksi'deki gibi yumuşatılır.
  - Dokunmatik: Sol yarıda parmağın ilk değdiği x merkez kabul edilir. `touchSteer` ile direksiyon hesaplanır, parmak değdiği sürece gaz verilir. Sağ yarıda 4 form tuşu (DOM butonları, `pointerdown`) ve küçük fren tuşu.
  - Otomatik gaz açıksa gaz hep 1'dir (fren basılıyken 0).
- **Arayüz** (simge öncelikli, büyük dokunma alanları, konsepte uygun canlı renkler):
  - Başlangıç ekranı: "Başlamak için dokun / bir tuşa bas".
  - Sağ üstte ayarlar: otomatik gaz, kalite, ses.
  - Yarış sırasında:
    - üstte ilerleme çubuğu ve üzerinde 6 araç noktası
    - sol üstte sıra (örn. "3/6")
    - altta hız
    - mükemmel dönüşüm ve kombo yazısı ("MÜKEMMEL! ×2")
    - yanlış formda kısa uyarı
    - **form ipucu:** Sıradaki sınırda gereken form tuşu, sınıra 2,5 sn kala yanıp söner. İlk yarışta her zaman, sonrakilerde yalnızca ayarlardan açılırsa.
  - Sonuç ekranı: sıralama tablosu (pilot rozetleriyle), süre, mükemmel sayısı, en uzun kombo, toplanan altın, "Tekrar" ve "Kendi hayaletinle yarış" butonları.
- **Ana döngü (`main.ts`):**
  - Yükleme, sahne, kalite profili ve FPS koruması.
  - Akış: başlangıç ekranı → `RaceClock` geri sayımı → yarış.
  - Her karede: `TimeScale` → `stepRacer` → `GhostViews` → `standings` → görüntü güncelleme.
  - Bitişte oyuncunun hayaleti `localStorage`'a yazılır (en iyi süreyse). Sonraki yarışta en yavaş pilotun yerine "Senin en iyin" hayaleti gelir.
- **`window.__race`** (yalnızca geliştirme sürümünde): `{ state, track, setS(s), forceForm(f), finish(), fps }`.
- **Testler:**
  - `touchSteer` ölü bölge ve sınırlar.
  - **Review Focus 5:** Çoklu parmak senaryosu `touchMath` içindeki saf `TouchTracker` ile test edilir. Sol parmak kalkınca gaz 0 olur, sağ parmak sol parmağı etkilemez.
  - `settings`: bozuk JSON varsayılana döner.

### Task 8: Tarayıcıda doğrulama ve ayar

- [ ] `npm run build`: tsc temiz, paket boyutu raporlanır (JS gzip ≤ 400 KB, toplam ≤ 5 MB).
- [ ] Önizleme (`yaris-oyunu`): konsol hatası yok. `__race` ile pist başı, su, boşluk, tırmanış ve bitiş noktalarına atlanıp ekran görüntüsü alınır.
- [ ] `renderer.info.render.calls ≤ 150`. Düşük kalite profili ve mobil görünüm (375×812) kontrol edilir.
- [ ] Bir tam yarış otomatik oynatılır (`__race` + bot girdisi). Bitiş ekranı doğrulanır.
- [ ] Hissiyat ayarları (hız, kamera, efekt yoğunluğu) ekran görüntülerinde konsepte göre ayarlanır.

### Task 9: Teslim notları

- [ ] `yaris-oyunu/docs/A0-durum.md`:
  - nasıl çalıştırılır
  - neyin hazır olduğu
  - kullanıcının oynarken bakması gereken his soruları
  - bilinen eksikler
- [ ] `yaris-oyunu/docs/tripo-siparis-listesi.md`:
  - A0 ve A1 için ilk stil örneği modelleri: oyuncu arabası, 2 rakip araba, tekne, planör ve palet parçaları, şeker ve buz ada simgeleri, balina boss'u
  - her biri için prompt, referans konsept, hedef üçgen sayısı ve stil notu
  - Tripo'nun düşük poligon seçeneği önerisi

---

## Sonraki aşamalar (taslak, her biri ayrı plan)

- **A1. Dikey dilim:**
  - Dönüşüm Bronz kupası: 5 pist (adalar1 + 4 yeni + varyantlar) ve Balina boss'u (§9.4).
  - Garaj: Taksi'nin `garage/` ve `parts/` modülleri uyarlanır, performans ve 15 görsel modifiye, altın ve video ile açma.
  - Ekonomi (§11), kayıt, Poki SDK ve `adFlow`, ödüllü video yerleşimleri (§13), günlük sandık, yıldızlar.
  - Tripo stil örneği modellerinin işleme hattı (`tools/optimize-model`).
- **A2. Kurgu:** Dev Ev dünyası, parça yuvaları, kapılar, kombolar, kopma, Robot Süpürge, "garaja götür".
- **A3. İçerik ve çıkış:** Gümüş ve Altın kupalar, 12 araba, 60+ modifiye, hayalet sunucusu (Cloudflare), ezeli rakip, yerelleştirme, Poki gönderimi.
- **A4. Kaos:** Neon Şehir, çarpışan botlar, yıkım (Taksi `breakables`), Şok, Ejderha.

## Spec'ten bilinçli sapma
- Spec §16.1, Taksi'nin `sim/vehicle*` modüllerinin yeniden ayarlanmasını öneriyordu. Bu modüller 2 boyutlu bir zemin fiziği (x/z ve kaldırım). Rampa, uçuş, boşluktan süzülme ve tırmanış gerektiren bir yarış için, pist eğrisi üzerinde çalışan yeni bir arcade fizik (Task 3) daha basit ve daha sağlam. Taksi'den kalite ayarı, bloom, model yükleme, sesin yapısı ve dokunmatik mantığı alınıyor.
- Commit adımları yok, çünkü proje git deposu değil. Kullanıcı istemeden de commit yapılmıyor.
