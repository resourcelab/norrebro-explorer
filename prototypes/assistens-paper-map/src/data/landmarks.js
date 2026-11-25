// Landmarks in and around the walkable area: what you steer by. Hand-picked; positions from OpenStreetMap.
//   kind 'church'  a church on its mapped footprint (`building`: its OSM way id in the world tiles), with a spire
//   kind 'flag'    a tall paper flag on a pole at `lonLat` [longitude, latitude]: parks, squares
//   kind 'far'     a place beyond the walkable area: fingerposts point to it and the minimap shows it at its edge.
//                  `lonLat` is a point in it; a `water` name instead takes the nearest shore of that lake.
// Positions are longitude and latitude so they can be checked against any map; src/core/geo.js puts them in the frame.
// Texts: the name only, for now. The fact-checked kid and adult texts come with the landmarks task.
export const LANDMARKS = [
  { id: 'hellig-kors', kind: 'church', name: 'Hellig Kors Kirke', building: 'w100717650' },
  { id: 'simeons', kind: 'church', name: 'Simeons Kirke', building: 'w108368332' },
  { id: 'brorsons', kind: 'church', name: 'Brorsons Kirke', building: 'w102861628' },
  { id: 'anna', kind: 'church', name: 'Anna Kirke', building: 'w96963560' },
  { id: 'runddel', kind: 'flag', name: 'Nørrebros Runddel', lonLat: [12.548936, 55.69434], color: '#c4523a' }, // where Nørrebrogade crosses Jagtvej
  { id: 'folkets-park', kind: 'flag', name: 'Folkets Park', lonLat: [12.554577, 55.687656], color: '#5f9a48' },
  { id: 'hans-tavsens', kind: 'flag', name: 'Hans Tavsens Park', lonLat: [12.547167, 55.68923], color: '#5f9a48' },
  // beyond the walkable area
  { id: 'lakes', kind: 'far', name: 'Søerne', en: 'the lakes', water: 'Peblinge Sø' },
  { id: 'superkilen', kind: 'far', name: 'Superkilen', lonLat: [12.543995, 55.699992] },
];

// Places OpenStreetMap maps as a point where the game wants an area. Hans Tavsens Park's playground is a point at the
// park's south end; the game draws a sandpit round it (an ellipse, radii in metres).
export const PLAYGROUND_POINTS = [
  { name: 'Hans Tavsens Park', lonLat: [12.547748, 55.687584], rx: 23, rz: 18 },
];
