# Turbo Transform Racers

A 3D cartoon racing game for kids (Poki, browser, mobile) with three cups:

- **Dönüşüm (Uçan Adalar):** the car turns into a boat, a glider and a climber; switch at the right moment for a perfect boost. Boss: the giant whale wave.
- **Kurgu (Dev Ev):** a toy car builds itself from parts picked up in a giant house. Boss: the robot vacuum.
- **Kaos (Neon Şehir):** smash the neon city, fill the Shock meter, bump rivals. Boss: the hologram dragon.

Garage with 12 cars, performance upgrades and visual mods (paint, rims, spoilers, neon, decals, trails, horns), daily chest and tasks, rewarded videos through the Poki SDK.

## Run

```
npm install
npm run dev      # http://localhost:5185
npm test         # vitest
npm run build    # dist/ for Poki
```

Built with Three.js, TypeScript and Vite. Status and details (in Turkish): `docs/DURUM.md`. Asset tools: `tools/` (Blender scripts for garage parts and the podium, icon and thumbnail cutters, ghost generator). Credits: `CREDITS.md`.
