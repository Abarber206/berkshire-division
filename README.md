# Berkshire Division

A 3D railway simulator that runs in the browser, phone or desktop. Drive a Lima-built 2-8-4 Berkshire or a modern six-axle AC diesel over a 13.8-mile Nickel Plate–style division.

**Play:** https://abarber206.github.io/berkshire-division/

## The locomotives

- **NKP 765** (S-2, Lima 1944) and **PM 1225** (N-1, Lima 1941)
- Built to published dimensions: 69 in drivers, 36 in lead truck, 36/43 in trailing truck, 25 × 34 in cylinders, 245 psi boiler, 100 ft 8¾ in over couplers, 15 ft 8 in tall
- Working Walschaerts valve gear driven by the reverser, side and main rods, crossheads
- 22,000-gallon tender on six-wheel trucks
- **S&S 4401**, a modern six-axle AC freight diesel lettered for the fictional Sandusky & Scioto: 4,400 hp, C-C swivel trucks with 42 in wheels, wide safety cab with a working interior view, ditch lights, five-chime horn

## The railroad

- Two 7,200 m (4.5 mi) tangents joined by spiral-eased 1,200 m curves with superelevation
- Bellevue Yard: four-track ladder and an engine terminal with water tower, coaling tower, sand house and engine house
- Fostoria and Kenton passing sidings, an elevator spur, and a quarry branch with a runaround
- 18 switches with moving points, frogs, guard rails and rotating switch-stand targets
- Kenton Hill (0.9% grade), a two-span through-truss bridge over the Sandusky River
- Color-light signals that follow the switch they protect, mileposts, whistle posts, grade crossings, a pole line
- Ohio farm country in October: standing corn, crop rows and fall plowing drawn per pixel, roadside grass, goldenrod and asters, sumac, fenced pastures with cattle, round hay bales
- Small towns at Bellevue, Fostoria, Kenton and Delphos with a main street, houses, a church and a water tower

## The simulation

- Steam: throttle and cutoff, steam chest pressure, boiler pressure and water level, firing, injector, blower, safety valves
- Diesel: eight throttle notches, prime mover RPM and alternator loading, AC traction with wheel-slip control, extended-range dynamic brake, fuel, engine start and shutdown
- Adhesion and wheel slip, sand
- Automatic air brake with brake-pipe propagation along the train, independent engine brake, main reservoir and compressor
- Train resistance, grades, curve drag, turnout speed limits, derailments
- Synthesized sound: exhaust beats tied to the drivers, multi-chime whistle with Doppler, diesel prime mover, turbocharger and traction motors, five-chime air horn, bell, air pump, rail joints
- Cameras: chase, cab, trackside, overhead, rear car
- Time of day (morning, midday, golden hour, night) and weather (clear, overcast, snow)

## Controls

On a phone, use the levers and buttons on screen. Tap a switch stand, the switch card's **Throw** button, or a switch on the map to throw it.

| Key | Action |
| --- | --- |
| W / S | Throttle open / close (diesel: notch up / down) |
| ↑ / ↓ | Reverser forward / back |
| Q / E | Train brake release / apply |
| Z / C | Engine brake release / apply |
| A / D | Dynamic brake less / more (diesel) |
| Space | Whistle or horn (hold) |
| T | Throw the next switch ahead |
| B, X, K, H | Bell, sand, cylinder cocks (diesel: ditch lights), headlight |
| I, F, L | Injector (diesel: engine start/stop), stoker, blower |
| 1–5 | Cameras |
| M / P | Map / pause |

## Building

The game is one file, `index.html`. The source lives in `src/`; run `./build.sh` to rebuild `index.html` after editing it. Three.js r128 loads from cdnjs.
