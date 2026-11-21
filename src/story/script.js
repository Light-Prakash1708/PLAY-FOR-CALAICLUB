// OPERATION FIREBREAK - the story told over the radio.
//
// The Crimson Wing, a rogue air armada led by Warlord Kael Vex, has seized the
// skies over the Coral Coast and grounded every civilian flight. Phoenix
// Squadron is the last free fighter wing. You are its newest pilot, call sign
// EMBER, flying beside Falcon (cocky, fast) and Hawk (steady, protective),
// under Captain Rhea Sen.
//   Act I   (missions 1-4)   the rookie earns a place; Vex starts to notice.
//   Act II  (missions 5-10)  the counter-attack; Falcon is shot down; the Dreadnought falls.
//   Act III (missions 11-15) Vex escapes and regroups; the final duel over the burning front.
// Team Battle is the same war: a skirmish between Phoenix and Crimson squadrons.
//
// {name} is replaced with the player's call sign.

export const CAST = {
  sen: { name: 'CAPT. RHEA SEN', role: 'Phoenix Command', color: '#2FB8A8', initials: 'RS', voice: { gender: 'female', pitch: 1.0, rate: 1.0 } },
  falcon: { name: 'FALCON', role: 'Wingman', color: '#3D8BFF', initials: 'FA', voice: { gender: 'male', pitch: 1.2, rate: 1.1 } },
  hawk: { name: 'HAWK', role: 'Wingman', color: '#7FB3FF', initials: 'HK', voice: { gender: 'male', pitch: 0.85, rate: 0.98 } },
  vex: { name: 'WARLORD VEX', role: 'Crimson Wing', color: '#FF4B4B', initials: 'KV', voice: { gender: 'male', pitch: 0.55, rate: 0.9 } },
};

// id -> { who, text }  (an array means: pick one at random)
export const LINES = {
  intro: { who: 'sen', text: 'This is Phoenix Command. Crimson Wing holds our skies. Every pilot, to your jets.' },
  // ---------- campaign: one beat per mission ----------
  'm1.start': { who: 'sen', text: 'Welcome to Phoenix Squadron, {name}. Scouts only today. Show me you can fly.' },
  'm1.win': { who: 'sen', text: 'Clean flying, rookie. You just earned your call sign.' },
  'm2.start': { who: 'falcon', text: 'Raiders with missiles, {name}. Pop your flares and stay on my wing.' },
  'm2.win': { who: 'falcon', text: 'Not bad for the new kid. Drinks are on you.' },
  'm3.start': { who: 'sen', text: 'Crimson bombers are heading for the coast. Nothing gets through.' },
  'm3.mid': { who: 'vex', text: 'Phoenix still flies? I will fix that.' },
  'm3.win': { who: 'sen', text: 'The coast is safe. Vex has started asking about you, {name}.' },
  'm4.start': { who: 'hawk', text: 'Interceptors. Fast, nasty, and they never fight fair. Keep turning.' },
  'm4.win': { who: 'hawk', text: 'Good kills. I have got your six, always.' },
  'm5.start': { who: 'sen', text: 'Missile carriers ahead, and something bigger behind them. Stay sharp.' },
  'm5.boss': { who: 'vex', text: 'Meet my Storm Carrier, little bird. Burn.' },
  'm5.win': { who: 'sen', text: 'The Storm Carrier is down. That is the first one they have ever lost.' },
  'm6.start': { who: 'falcon', text: 'Three full squadrons in tight formation. Let us break them up.' },
  'm6.win': { who: 'falcon', text: 'Formation? What formation?' },
  'm7.start': { who: 'sen', text: 'Vex has sent his elite pilots. They are armoured. Hit them with everything.' },
  'm7.mid': { who: 'vex', text: 'My aces have never lost. Not once.' },
  'm7.win': { who: 'hawk', text: 'They have now. Nice work, {name}.' },
  'm8.start': { who: 'hawk', text: 'Stealth jets in the dark. Watch for the shimmer, then strike.' },
  'm8.win': { who: 'sen', text: 'Night sky is ours again. Get some rest. Tomorrow is the big one.' },
  'm9.start': { who: 'sen', text: 'This is their last push on the capital. Every wave. Hold the line.' },
  'm9.mid': { who: 'falcon', text: 'I am hit, I am hit! Ejecting! {name}, make it count!' },
  'm9.win': { who: 'sen', text: 'Falcon is safe, picked up by rescue. You held the line, {name}.' },
  'm10.start': { who: 'sen', text: 'The Dreadnought commands their whole fleet. Bring it down and this war ends.' },
  'm10.boss': { who: 'vex', text: 'You will fall like the rest of your squadron.' },
  'm10.win': { who: 'sen', text: 'The Dreadnought is gone. Phoenix, the skies are free.' },
  'm11.start': { who: 'sen', text: 'Bad news. Vex survived. His jets are slipping through the mountain passes.' },
  'm11.win': { who: 'hawk', text: 'Passes are clear. He is running out of places to hide.' },
  'm12.start': { who: 'falcon', text: 'Guess who is back in the air? Bombers over the desert. Let us go.' },
  'm12.win': { who: 'falcon', text: 'Missed this. Missed you more, {name}.' },
  'm13.start': { who: 'sen', text: 'Our ground forces are pinned on the front. Keep the sky clear until relief arrives.' },
  'm13.mid': { who: 'vex', text: 'Every jet you destroy, I build two more.' },
  'm13.win': { who: 'sen', text: 'Relief has arrived. The front is holding because of you.' },
  'm14.start': { who: 'hawk', text: 'Four elite formations over the glacier. This is his last real air wing.' },
  'm14.win': { who: 'sen', text: 'We found him. Vex is leading the final assault himself.' },
  'm15.start': { who: 'sen', text: 'This is it, Phoenix. The Warlord flies the flagship. End this.' },
  'm15.boss': { who: 'vex', text: 'Ember. I knew it would be you. Come then. Finish it.' },
  'm15.win': { who: 'sen', text: 'Crimson Wing is broken. Phoenix Squadron, come home. You are heroes.' },
  'boss.warn': { who: 'sen', text: 'Big contact inbound! All jets, focus fire!' },
  'camp.lowhp': [{ who: 'hawk', text: 'You are trailing smoke, {name}! Grab a repair!' }, { who: 'sen', text: 'Your hull is failing. Break off and find a repair.' }],
  'camp.dead': [{ who: 'sen', text: 'Ember is down! Pull out, we go again.' }, { who: 'hawk', text: 'Nooo! {name}! ... Regroup. We try again.' }],
  'camp.zone': { who: 'sen', text: 'Airspace is closing around the boss. Nowhere to run now, for either of you.' },

  // ---------- Team Battle: a skirmish in the same war ----------
  'b.start': [
    { who: 'sen', text: 'Phoenix, this is Command. Crimson squadron inbound. Weapons free.' },
    { who: 'sen', text: 'All wings, the zone is collapsing on their position. Take the sky.' },
  ],
  'b.taunt': [
    { who: 'vex', text: 'Phoenix. You should have stayed on the ground.' },
    { who: 'vex', text: 'Crimson Wing, leave none of them flying.' },
  ],
  'b.kill': [
    { who: 'falcon', text: 'Splash one! Nice shot, {name}!' },
    { who: 'hawk', text: 'Good kill. Keep it up.' },
    { who: 'falcon', text: 'Ha! Did you see him spin?' },
    { who: 'sen', text: 'Confirmed kill, {name}.' },
  ],
  'b.multi': [{ who: 'falcon', text: 'Two in a row! Save some for us!' }, { who: 'sen', text: 'Outstanding, {name}. Keep that pressure on.' }],
  'b.down': [{ who: 'sen', text: '{name} is down! Respawning, hang in there.' }, { who: 'hawk', text: 'I saw who got you. I will make them pay.' }],
  'b.wingkill': [{ who: 'hawk', text: 'Splash one, Crimson down.' }, { who: 'falcon', text: 'Got one! That is my kill, {name}!' }],
  'b.lock': [{ who: 'hawk', text: 'Missile on your six! Break, break!' }, { who: 'falcon', text: 'Missile lock on you! Shield up or turn hard!' }],
  'b.zone': [{ who: 'sen', text: 'The zone is shrinking. Get inside the circle.' }, { who: 'sen', text: 'Storm wall is moving. Stay inside the safe zone.' }],
  'b.outside': { who: 'hawk', text: '{name}, you are in the storm! Get back inside!' },
  'b.final': { who: 'sen', text: 'Thirty seconds. Everything you have got, Phoenix.' },
  'b.win': [{ who: 'sen', text: 'Crimson is retreating. Outstanding work, Phoenix.' }, { who: 'falcon', text: 'Woo! That is how Phoenix flies!' }],
  'b.lose': [{ who: 'vex', text: 'The sky belongs to Crimson Wing.' }, { who: 'sen', text: 'We lost this one. Regroup, we go again.' }],
  'b.lowhp': { who: 'hawk', text: 'You are smoking, {name}! Shield up and find a repair crate!' },
};

/** The lines worth recording with real voice actors first (used by tools/voices.mjs). */
export const PRIORITY_LINES = ['intro', 'm1.start', 'm1.win', 'm3.mid', 'm5.boss', 'm9.mid', 'm10.start', 'm10.win', 'm15.boss', 'm15.win', 'b.start', 'b.taunt', 'b.kill', 'b.down', 'b.lock', 'b.zone', 'b.final', 'b.win', 'b.lose'];
