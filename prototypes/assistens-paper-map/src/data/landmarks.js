// Landmarks in and around the walkable area: what you steer by. Hand-picked; positions from OpenStreetMap.
//   kind 'church'  a church on its mapped footprint (`building`: the OSM way id in surroundings.js), with a spire
//   kind 'flag'    a tall paper flag on a pole at `at` (metres from the cemetery centroid, x east, y south): parks, squares
//   kind 'far'     a place beyond the walkable area: fingerposts point to it and the minimap shows it at its edge.
//                  `at` is a point in it (metres); a `water` name instead takes the nearest shore of that lake.
// Texts: the name only, for now. The fact-checked kid and adult texts come with the landmarks task.
export const LANDMARKS = [
  { id: 'hellig-kors', kind: 'church', name: 'Hellig Kors Kirke', building: 'w100717650' },
  { id: 'simeons', kind: 'church', name: 'Simeons Kirke', building: 'w108368332' },
  { id: 'brorsons', kind: 'church', name: 'Brorsons Kirke', building: 'w102861628' },
  { id: 'anna', kind: 'church', name: 'Anna Kirke', building: 'w96963560' },
  { id: 'runddel', kind: 'flag', name: 'Nørrebros Runddel', at: [-100, -394], color: '#c4523a' }, // where Nørrebrogade crosses Jagtvej
  { id: 'folkets-park', kind: 'flag', name: 'Folkets Park', at: [254, 345], color: '#5f9a48' },
  { id: 'hans-tavsens', kind: 'flag', name: 'Hans Tavsens Park', at: [-211, 171], color: '#5f9a48' },
  // beyond the walkable area (Superkilen: 55.7000 N, 12.5440 E)
  { id: 'lakes', kind: 'far', name: 'Søerne', en: 'the lakes', water: 'Peblinge Sø' },
  { id: 'superkilen', kind: 'far', name: 'Superkilen', at: [-410, -1019] },
];
