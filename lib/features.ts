// Feature flags — time-based, keyed to trip start
// All features go live at 12:00 Irish Summer Time on 16 April 2026 (UTC+1 = 11:00 UTC)

const LAUNCH = new Date("2026-04-16T12:00:00+01:00")

function isLive(): boolean {
  return Date.now() >= LAUNCH.getTime()
}

export const features = {
  birdieEmojis:    isLive,
  matchplay:       isLive,
  scorecardViewer: isLive,
}
