import bseBuilding from '../assets/images/bse-building.jpg';
import dalalStreetSign from '../assets/images/dalal-street-sign.jpg';
import bseTower2006 from '../assets/images/bse-tower-2006.jpg';
import bombayFort1936 from '../assets/images/bombay-fort-1936.jpg';
import bombay1758Map from '../assets/images/bombay-1758-map.jpg';

/** Every photograph on the site, by name. Credits live in src/data/photo-credits.json. */
export const IMAGES = {
  'bse-building': bseBuilding,
  'dalal-street-sign': dalalStreetSign,
  'bse-tower-2006': bseTower2006,
  'bombay-fort-1936': bombayFort1936,
  'bombay-1758-map': bombay1758Map,
} as const;
export type ImageName = keyof typeof IMAGES;
