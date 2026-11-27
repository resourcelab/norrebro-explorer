// Named places on ground floors (OpenStreetMap shops, cafés, schools...): what to call each type of place, in Danish
// and English, and which places get a shopfront at all. Texts only, no logic (core/plan/shops.js reads it).

/** OpenStreetMap type (shop=*, amenity=*, craft=*...) -> how the game names it. Others are called by their group. */
export const PLACE_TYPES = {
  bakery: 'Bageri · bakery', cafe: 'Café', coffee: 'Kaffe · coffee', restaurant: 'Restaurant', fast_food: 'Take-away',
  bar: 'Bar', pub: 'Værtshus · pub', ice_cream: 'Is · ice cream', deli: 'Delikatesse · deli', butcher: 'Slagter · butcher',
  greengrocer: 'Grønthandel · greengrocer', confectionery: 'Slik · sweets', supermarket: 'Supermarked · supermarket',
  convenience: 'Købmand · corner shop', kiosk: 'Kiosk', alcohol: 'Vinhandel · wine shop', clothes: 'Tøj · clothes',
  second_hand: 'Genbrug · second-hand', shoes: 'Sko · shoes', hairdresser: 'Frisør · hairdresser', beauty: 'Skønhed · beauty',
  bicycle: 'Cykler · bikes', books: 'Bøger · books', florist: 'Blomster · flowers', jewelry: 'Smykker · jewellery',
  optician: 'Optiker · optician', pet: 'Dyr · pet shop', furniture: 'Møbler · furniture', laundry: 'Vaskeri · laundry',
  fabric: 'Stof · fabric', craft: 'Værksted · workshop', toys: 'Legetøj · toys', pharmacy: 'Apotek · pharmacy',
  library: 'Bibliotek · library', school: 'Skole · school', kindergarten: 'Børnehave · kindergarten',
  community_centre: 'Kulturhus · community centre', post_office: 'Posthus · post office', music_venue: 'Spillested · music',
  arts_centre: 'Kunst · arts centre', cinema: 'Biograf · cinema', theatre: 'Teater · theatre', museum: 'Museum',
  gallery: 'Galleri · gallery',
};

/** What each group of places is called when its type isn't in the list above. */
export const PLACE_GROUPS = { food: 'Mad · food', shop: 'Butik · shop', everyday: 'Hverdag · everyday', culture: 'Kultur · culture' };

/** Groups that stand on a ground floor (play areas, nature, history are not shops). */
export const SHOP_GROUPS = new Set(['food', 'shop', 'everyday', 'culture']);

/** Types in those groups that are not a door in a facade: taps, toilets, statues, churches (landmarks draw those). */
export const NOT_A_SHOPFRONT = new Set(['drinking_water', 'toilets', 'artwork', 'place_of_worship', 'bus_stop', 'station', 'subway_entrance', 'townhall']);
