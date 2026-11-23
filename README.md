# Palma Verde

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/irfanirawan1108-spec/gta6-01-entry-r2/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/irfanirawan1108-spec/gta6-01-entry-r2/reward.svg)](https://make.fun/bounty/gta6-01)

A GTA-style open-world crime game built from scratch for make.fun's
"Make GTA 6" bounty. You are Milo Vane, new in Palma Verde with $40 and
no car. Steal cars, lose the cops, run eight story jobs for Delia and
Rico, drive taxi fares, hunt fifteen hidden packages, and survive a
four-star manhunt with a helicopter overhead — all in one sun-soaked
coastal city that fits in a browser tab.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — the game plays with keyboard and mouse,
no network request, no build step. `game/index.html` is the whole game.

## Play

- **WASD / arrows** — walk and drive
- **E** — get in a car (or out of one), start missions at Delia's Garage, use shops
- **F** — start a taxi fare (in a taxi) or a vigilante chase (in a police cruiser)
- **SPACE** — punch (on foot) / handbrake (driving)
- **SHIFT** — run · **1 / 2** — fists / pistol · **R** — radio · **H** — horn · **M** — mute
- **ESC** — pause

Steal a car in front of a witness and the wanted level rises; break line
of sight and stay quiet to lose the heat. Get caught on foot and you are
BUSTED; run out of health and you are WASTED — either way the city takes
10% of your cash. Progress saves automatically.

## What is in the city

- A 10×8-block coastal city: downtown towers, a colourful old town, a
  central park with a pond, a plaza with a fountain, a marina with docks,
  and a palm-lined beach with animated waves
- Traffic that follows the road grid and stops at red lights, pedestrians
  on the sidewalks who flee from gunfire, parked cars to steal
- Six car types with different speed and handling, plus police cruisers,
  roadblocks at 3+ stars and a helicopter with a searchlight at 4–5 stars
- A five-star wanted system with heat that decays when you break line of
  sight, Pay N Spray to clear the heat, busted and wasted
- Eight story missions with dialogue: car theft, taxi rush, a timed hot
  delivery, a repo chase, a bank vault hold, a three-hit ram job, a
  four-star escape, and the last run to the airport
- Side work: taxi fares, vigilante chases, stunt jumps, fifteen hidden
  packages, a car showroom, Ammu-Nation, a hospital and a safehouse
- A full day/night cycle — golden sunset, lit windows and headlights at
  night — with three synth radio stations and a live minimap HUD

## Files

- `game/src/` — one file per system: city, render, player, vehicles,
  pedestrians, police, missions, audio, hud, save, input, particles,
  shots, state, config, random, main
- `game/index.html` — the page; `main.ts` — the entrypoint that writes
  `/output` (game + screenshots + dossier.json); `serve.ts` — local server
- `screenshots/` — four renders of the game itself (cover chase at golden
  hour, midday street drive, mission dialogue, night with headlights)

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
