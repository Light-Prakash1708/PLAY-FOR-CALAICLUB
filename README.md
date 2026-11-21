# 🚕 Pujo Night Rush: Save the Last Yellow Taxi

**Calcutta AI Club · Vibe Coders Hackathon Ed. 3 (21 Nov 2026) · Problem statement: _Play_**

It's Durga Puja in Kolkata. Flashy app cabs ("ZipCab") are taking over the city. You drive one of the last yellow Ambassador taxis. **Earn the malik's (owner's) rent by dawn, or your taxi gets scrapped.**

- ✅ **No sign-up.** Open the page and play. Progress saves in the browser (LocalStorage).
- ✅ **Learn it in 30 seconds.** Steer, pick up people who are waving, drive into your glowing pandal gate.
- ✅ **One round is under 3 minutes.** Each night lasts 75 s. A Showdown round lasts 60 s.

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
