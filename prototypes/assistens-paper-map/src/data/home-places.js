// Places a child can pick as "where I live" in the find-your-way-home game, and where a walk can start: well-known
// spots a child would recognise (their school, a church, a park, a bakery, the big playground). Each is a spot on the
// pavement, chosen with the game's own map so the walker can stand there (tests/round.test.mjs checks they all can,
// and that each can be walked to from the others).
// Positions are longitude and latitude (src/core/geo.js puts them in the frame). Picking one of these keeps a real
// home address out of the game altogether.
//   kind: school | church | park | bakery | playground (for the picker's icon)
export const HOME_PLACES = [
  { id: 'norrebro-park-skole', name: 'Ved Nørrebro Park Skole', en: 'by Nørrebro Park Skole', kind: 'school', lonLat: [12.54565, 55.690221] },
  { id: 'blaagaards-skole', name: 'Ved Blågårds Skole', en: 'by Blågårds Skole', kind: 'school', lonLat: [12.551291, 55.688159] },
  { id: 'stenurten', name: 'Ved børnehaven Stenurten', en: 'by Stenurten kindergarten', kind: 'school', lonLat: [12.545347, 55.687734] },
  { id: 'hellig-kors', name: 'Ved Hellig Kors Kirke', en: 'by Hellig Kors church', kind: 'church', lonLat: [12.551549, 55.687407] },
  { id: 'simeons', name: 'Ved Simeons Kirke', en: 'by Simeons church', kind: 'church', lonLat: [12.552981, 55.693502] },
  { id: 'brorsons', name: 'Ved Brorsons Kirke', en: 'by Brorsons church', kind: 'church', lonLat: [12.546142, 55.687352] },
  { id: 'runddel', name: 'Ved Nørrebros Runddel', en: 'by Nørrebros Runddel', kind: 'park', lonLat: [12.549135, 55.69434] },
  { id: 'folkets-park', name: 'Ved Folkets Park', en: 'by Folkets Park', kind: 'park', lonLat: [12.554577, 55.687656] },
  { id: 'hans-tavsens', name: 'Ved Hans Tavsens Park', en: 'by Hans Tavsens Park', kind: 'park', lonLat: [12.547167, 55.68923] },
  { id: 'lagkagehuset', name: 'Ved Lagkagehuset', en: 'by the Lagkagehuset bakery', kind: 'bakery', lonLat: [12.549314, 55.694146] },
  { id: 'meyers', name: 'Ved Meyers Bageri', en: 'by the Meyers bakery', kind: 'bakery', lonLat: [12.545041, 55.691848] },
  { id: 'andersen', name: 'Ved Andersen & Maillard', en: 'by the Andersen & Maillard bakery', kind: 'bakery', lonLat: [12.554894, 55.69044] },
  { id: 'legepladsen', name: 'Ved den store legeplads', en: 'by the big playground', kind: 'playground', lonLat: [12.55358, 55.692601] },
  { id: 'kirkegaarden', name: 'Ved Assistens Kirkegårds port', en: 'by the cemetery gate', kind: 'park', lonLat: [12.552744, 55.688809] },
];
