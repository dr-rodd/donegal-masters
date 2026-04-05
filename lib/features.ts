// Feature flags — time-based, keyed to trip start
// All features go live at 12:00 Irish Summer Time on 16 April 2026 (UTC+1 = 11:00 UTC)

const LAUNCH = new Date("2026-04-16T12:00:00+01:00")

// Temporary override: all features enabled until 2026-04-06T21:50:23Z
const OVERRIDE_UNTIL = new Date("2026-04-06T21:50:23Z")

function isLive(): boolean {
  if (Date.now() < OVERRIDE_UNTIL.getTime()) return true
  return Date.now() >= LAUNCH.getTime()
}

export const features = {
  birdieEmojis:    isLive,
  matchplay:       isLive,
  scorecardViewer: isLive,
}
