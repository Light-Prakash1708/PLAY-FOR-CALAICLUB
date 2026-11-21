// Translates abstract input into flight commands for the player aircraft.
// Kept separate from Player so an autopilot (victory fly-by, QA bot) can
// drive the same aircraft.
export class PlayerController {
  constructor(input) { this.input = input; this.autopilot = null; }
  /** Returns { steer: boolean, angle, throttle 0..1 }. */
  read(player, dt) {
    if (this.autopilot) return this.autopilot(player, dt);
    const { mx, my } = this.input;
    const m = Math.hypot(mx, my);
    if (m < 0.01) return { steer: false, angle: player.a, throttle: 0.4 };
    return { steer: true, angle: Math.atan2(my, mx), throttle: m };
  }
}
