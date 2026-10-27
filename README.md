# Berkshire Division

A 3D steam railway simulator that runs in the browser, phone or desktop. Drive a Lima-built 2-8-4 Berkshire over a 13.8-mile Nickel Plate–style division.

**Play:** https://abarber206.github.io/berkshire-division/

## The locomotives

- **NKP 765** (S-2, Lima 1944) and **PM 1225** (N-1, Lima 1941)
- Built to published dimensions: 69 in drivers, 36 in lead truck, 36/43 in trailing truck, 25 × 34 in cylinders, 245 psi boiler, 100 ft 8¾ in over couplers, 15 ft 8 in tall
- Working Walschaerts valve gear driven by the reverser, side and main rods, crossheads
- 22,000-gallon tender on six-wheel trucks

## The railroad

- Two 7,200 m (4.5 mi) tangents joined by spiral-eased 1,200 m curves with superelevation
- Bellevue Yard: four-track ladder and an engine terminal with water tower, coaling tower, sand house and engine house
- Fostoria and Kenton passing sidings, an elevator spur, and a quarry branch with a runaround
- 18 switches with moving points, frogs, guard rails and rotating switch-stand targets
- Kenton Hill (0.9% grade), a two-span through-truss bridge over the Sandusky River
- Color-light signals that follow the switch they protect, mileposts, whistle posts, grade crossings, a pole line

## The simulation

- Steam: throttle and cutoff, steam chest pressure, boiler pressure and water level, firing, injector, blower, safety valves
- Adhesion and wheel slip, sand
- Automatic air brake with brake-pipe propagation along the train, independent engine brake, main reservoir and compressor
- Train resistance, grades, curve drag, turnout speed limits, derailments
- Synthesized sound: exhaust beats tied to the drivers, multi-chime whistle with Doppler, bell, air pump, rail joints
- Cameras: chase, cab, trackside, overhead, rear car
- Time of day (morning, midday, golden hour, night) and weather (clear, overcast, snow)

## Controls

On a phone, use the levers and buttons on screen. Tap a switch stand, the switch card's **Throw** button, or a switch on the map to throw it.

| Key | Action |
| --- | --- |
| W / S | Throttle open / close |
| ↑ / ↓ | Reverser forward / back |
| Q / E | Train brake release / apply |
| Z / C | Engine brake release / apply |
| Space | Whistle (hold) |
| T | Throw the next switch ahead |
| B, X, K, H | Bell, sand, cylinder cocks, headlight |
| I, F, L | Injector, stoker, blower |
| 1–5 | Cameras |
| M / P | Map / pause |

## Building

The game is one file, `index.html`. The source lives in `src/`; run `./build.sh` to rebuild `index.html` after editing it. Three.js r128 loads from cdnjs.
