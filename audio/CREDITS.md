# Sound credits

Every sound the game plays from `audio/` is cut from a field recording that its author released into the public domain or under CC0.
Nothing here needs attribution, but the recordists are credited all the same. `audio/tools/prepare.py` and `audio/tools/recipe.json`
show exactly which seconds of each recording became which take; the cut files keep the names of the voices in `src/09a_soundbank.js`.

| Voices | Recording | Recordist | Licence |
| --- | --- | --- | --- |
| chuff, joint | [Whistle, steam and wheels, Toddington Station, Gloucestershire, UK - Steam Train](https://archive.org/details/aporee_53147_60730) (radio aporee ::: maps, 2019-09-08) | david.j.pitt | [Public Domain Mark 1.0](http://creativecommons.org/publicdomain/mark/1.0/) |
| wh_deep6 | [Barrett Station Road, St. Louis, Missouri, USA - Big Boy No. 4014](https://archive.org/details/aporee_53885_85003) (radio aporee ::: maps, 2026-07-20) | Pierrot Desperes | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) |
| safety, blower, fire, pump_a, pump_b, cocks, bpx, injector | [1880 Train - 1880 Train Idling](https://archive.org/details/aporee_59111_67834) (radio aporee ::: maps, 2022-09-22) | Matt Todd | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) |
| wind | [Castlewood Loop, Eureka, Missouri, USA - Tall Grass](https://archive.org/details/aporee_51400_58655) (radio aporee ::: maps, 2020-10-17) | Pierrot Desperes | [Public Domain Mark 1.0](http://creativecommons.org/publicdomain/mark/1.0/) |
| birds | [Riverside Fitness Park, Bluffton, IN 46714, USA - Early morning birdsong, Riverside Fitness Park, Bluffton, IN](https://archive.org/details/aporee_43758_49812) (radio aporee ::: maps, 2019-04-13) | Kay Westhues | [Public Domain Mark 1.0](http://creativecommons.org/publicdomain/mark/1.0/) |
| night | [Turkey Cove Trail, Lost Bridge West State Recreation Area, Andrews, IN 46702, USA - Night, wind in trees, Turkey Cove Trail, Lost Bridge West State Recreation Area](https://archive.org/details/aporee_51356_58608) (radio aporee ::: maps, 2020-10-17) | Kay Westhues | [Public Domain Mark 1.0](http://creativecommons.org/publicdomain/mark/1.0/) |
| roll | [Train passing through Bluffton, IN 46714, USA](https://archive.org/details/aporee_45607_51790) (radio aporee ::: maps, 2019-07-21) | Kay Westhues | [Public Domain Mark 1.0](http://creativecommons.org/publicdomain/mark/1.0/) |
| wh_chime6 | [Grand Canyon Railway Steam Doubleheader (Legacy Minute)](https://archive.org/details/nps-video-grca-grand-canyon-railway-steam-doubleheader-legacy-minute) (Grand Canyon National Park, NPS video): the closing whistle of steam engines No. 29 and No. 4960 | NPS/M. Quinn | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) |
| wh_k5 | [AirChime K5LA.ogg](https://commons.wikimedia.org/wiki/File:AirChime_K5LA.ogg) (Wikimedia Commons) | HarveyHenkelmann | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| dz (idle), comp, purge, dump | [Freight locomotive idling, Houston](https://archive.org/details/aporee_17221_20057) (radio aporee ::: maps) | Ryan Urban | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) |
| dz (mid throttle), flange | [CSX freight at a crawl on elevated track, Indianapolis](https://archive.org/details/aporee_43818_49875) (radio aporee ::: maps) | lawrencemedia | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) |
| dz (full throttle) | [Union Pacific freight in the woods, Missouri](https://archive.org/details/aporee_51210_58444) (radio aporee ::: maps) | Pierrot Desperes | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) |
| squeal | [Train braking, rail screech, Savannah](https://archive.org/details/aporee_65489_75644) (radio aporee ::: maps) | Chrisjconrad42 | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) |
| chuff_hard | [Steam departure from Swanage](https://archive.org/details/aporee_37801_43260) (radio aporee ::: maps) | Richard Bentley | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) |
| crickets | [Late night summer insects, Meaford, Ontario](https://archive.org/details/aporee_32988_37901) (radio aporee ::: maps) | Matt Rogalsky | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) |
| bell | [An old metal level crossing bell, Braunschweig](https://archive.org/details/aporee_60444_69429) (radio aporee ::: maps), struck strokes slowed to a locomotive bell's pitch | Peter Cusack | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) |

The source recordings are kept in the project's sound library (`sound-sources/`, with `sources.json` listing each licence);
`recipe.json` names each by its path there.

Still synthesized in the browser, as no clean public-domain recording has turned up: couplers closing and slack running in,
the cut lever, the switch stand, the diesel engine cranking, and the steam engine's side-rod clank. Turbo, traction motors and
dynamic-brake fans are no longer separate voices: they are heard in the throttle takes themselves.
