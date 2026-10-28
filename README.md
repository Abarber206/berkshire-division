# Berkshire Division

A 3D railway simulator that runs in the browser, phone or desktop. Drive a Lima-built 2-8-4 Berkshire or a modern six-axle AC diesel over a 13.8-mile Nickel Plate–style division.

**Play:** https://abarber206.github.io/berkshire-division/

## The locomotives

- **NKP 765** (S-2, Lima 1944) and **PM 1225** (N-1, Lima 1941)
- Built to published dimensions: 69 in drivers, 36 in lead truck, 36/43 in trailing truck, 25 × 34 in cylinders, 245 psi boiler, 100 ft 8¾ in over couplers, 15 ft 8 in tall
- Working Baker valve gear driven by the reverser (gear frame, reverse yoke, radius bars, gear connecting rod, bell crank), side and main rods, crossheads
- Cast slotted pilots and smokebox doors with their ring of dogs; the bell sits on top of the smokebox and the headlight in the middle of the door (PM 1225 with its round brass-rimmed lamp)
- Finish options: as delivered (graphite smokebox), excursion white trim (tire faces and running-board edges), or plain black
- 22,000-gallon tender on six-wheel trucks
- **A modern six-axle AC freight diesel** in the GE wide-cab style, 4,400 hp: sloped nose with angled corners and stacked headlights, raked windshield under a brow with number boards, one level roofline over the cab, hood and flared radiator wings, open step wells with yellow handrails, ditch lights, Hi-Ad style C-C trucks, and a cab view through the windshield
- Run **one, two or three diesels in multiple**. Every unit answers the lead cab, and the last unit runs backward so there's a cab at each end
- **Paint schemes** for five fictional railroads (Sandusky & Scioto, Fostoria & Lake Erie, Kenton & Northern, Delphos Grain Lines, Bellevue Terminal), plus custom colors and road number. Lashups can be matched or mixed, and paint changes apply live

## Multiplayer

Open the menu, type your name and tap **Create room**, then send friends the link or the five-letter code. Everyone drives their own train on the same railroad: you see each other's trains with name tags, hear their whistles and bells, share the switches, chat, and can watch another player's train. Trains that run into each other stop, or derail if they hit hard.

Rooms connect through free public MQTT relay servers (HiveMQ and EMQX), so there's nothing to install and no account. Anyone who knows a room's code can see the trains in it.

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
- Synthesized sound: exhaust beats tied to the drivers; a different whistle for each engine (765's deep six-chime, 1225's brighter three-chime) with Doppler; a five-chime air horn; V12 prime mover, turbocharger and traction motors, louder with more units; bell, air pump, rail joints
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

## Tests

`node --test tests/*.test.js` (Node 18 or newer, no install) loads the simulation source headless and checks the boiler (starting tractive effort, slipping and sand, steaming under load, low water and the fusible plug, safety valves), the air brake (charging, service and emergency propagation, release, stopping distances), grades, and coupling (speed thresholds, momentum, turned cuts, set-outs, kicks and tie-downs). GitHub Actions runs the tests and `./build.sh` on every push and pull request, and fails if the committed `index.html` doesn't match a fresh build.
