# 🚕 Pujo Night Rush: Save the Last Yellow Taxi

**Calcutta AI Club · Vibe Coders Hackathon Ed. 3 (21 Nov 2026) · Problem statement: _Play_**

It's Durga Puja in Kolkata. Flashy app cabs ("ZipCab") are taking over the city. You drive one of the last yellow Ambassador taxis. **Earn the malik's (owner's) rent by dawn, or your taxi gets scrapped.**

- ✅ **No sign-up.** Open the page and play. Progress saves in the browser (LocalStorage).
- ✅ **Learn it in 30 seconds.** Steer, pick up people who are waving, drive into your glowing pandal gate.
- ✅ **One round is under 3 minutes.** Each night lasts 75 s. A Showdown round lasts 60 s.

## What's new in v2
- **2.5D cinematic world:** stacked-slab 3D vehicles (a real Ambassador face: chrome bumpers, round headlights, blue stripe), GTA2-style leaning buildings with green shutters and Bengali shop signs, trees, street lamps, headlight cones, night-to-dawn lighting, vignette, an intro camera fly-in, and slow-motion on big hits.
- **Learn Kolkata as you drive:** each night follows a real route past 4 landmarks (Shyambazar, Kumartuli, College Street, Esplanade, Victoria Memorial, Kalighat, **Howrah Bridge**: night 1 opens on it, crossing from Howrah into the city under the steel truss and towers, and it's also the menu backdrop, Babughat…). A fact card pops up for each one, a **minimap** tracks your route, and a **Kolkata map** screen collects everything you've found.
- **Pujo 2026 pandals:** College Square (Albert Hall Museum), Chorebagan ("Beyond Sound"), Tala Prattoy, Yuba Sangha's pond, Rajdanga's "Shodhan", and the Hawa Mahal replica with 953 windows.
- **3 hearts:** bumps cost ½ a heart, buses and trams a full one. মিষ্টি (mishti) boxes heal you. Lose them all and you're towed.
- **Kolkata Traffic Police:** crash into traffic or ram your rival and white-uniform sergeants on bikes (and a police jeep at 3★) chase you. Lead them into traffic or wait them out.
- **Side missions:** 2 per night, plus the 🪁 **Bhokatta!** rooftop kite fight at dawn (also playable from the menu).
- **Voices:** passengers, conductors, police and the malik speak through the browser's speech engine, in Bengali script when the device has a Bengali voice.

## Fits any screen
The view adapts to the screen instead of letterboxing. On laptops and wide screens it gets **wider**, showing more of the city, with a big live **Kolkata map** on the left and **tonight's route** with landmark facts on the right. On phones in portrait it gets **taller**, so you see more road. Nothing is cropped, and it adjusts live when you rotate or resize. The camera follows your steering, so the 3D buildings shift as you drive.

## Modes
| Mode | What happens |
|---|---|
| **Story (1P)** | 5 nights: Panchami → Saptami → Ashtami → Navami → Dashami. Pay rising rent at each dawn. 3 strikes = scrapped. Spend savings in the garage (repair, engine, bumper, horn). The ZipCab KING boss appears on Dashami. |
| **Showdown (2P, same screen)** | 60-second rounds, most money wins, first to 2 rounds. **Ram your rival from the side to steal their passenger.** Honk to shove them. |

## Controls
| | Player 1 / solo | Player 2 |
|---|---|---|
| Steer | `A` `D` (or arrows in solo) | `←` `→` |
| Speed up / slow down | `W` `S` | `↑` `↓` |
| Honk | `Space` | `Enter` |
| Pause | `Esc` / `P` / ⏸ button | |
| Phone | On-screen ◀ ▶ BOOST HONK (2P: left cluster = P1, right = P2) | |

## Kolkata elements
Yellow Ambassador taxis, trams on tracks, hand-pulled rickshaws, private buses with conductors yelling *"Aste ladies, kole bachha!"*, stray cows, potholes, Pujo crowds, pandal gates with lights, light strings across the street, a dhak drum loop that speeds up as dawn gets closer, Bengali night names, and passengers like Thakuma, the Kumartuli artisan, the Howrah Uncle (*"Dada, Howrah jaben?"*) and the phuchka-wala.

## Run it
It's one file with no build step.
```bash
# any static server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000
```
Or just double-click `index.html`.

**Deploy:** drag the folder onto Netlify Drop (https://app.netlify.com/drop), or turn on GitHub Pages (Settings → Pages → Branch: main / root).

## Challenge links
After a run, type your name and press **Copy challenge link**. Friends who open it see *"Sona earned ₹1200. Can you beat it?"* (`?beat=1200&from=Sona`). No server needed.

## Credits
Built by our team at the hackathon with Claude. Engine patterns come from our earlier games (Sky Strike, Sporulation, Xenos Breach). All art and sound are generated in code, with no external assets.
