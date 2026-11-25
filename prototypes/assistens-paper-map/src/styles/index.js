/**
 * The styles: each draws the same game its own way. Pick one with ?style=<name> (default: DEFAULT_STYLE in
 * config.js). To add a style, write src/styles/<name>/index.js exporting a factory that implements the interface in
 * ./README.md, and list it here.
 */
import { DEFAULT_STYLE } from '../config.js';
import { createPapercraftStyle } from './papercraft/index.js';
import { createFlatStyle } from './flat/index.js';

export const STYLES = {
  papercraft: { create: createPapercraftStyle, label: 'Papercraft' },
  flat: { create: createFlatStyle, label: 'Flat map' },
};

/** The style named in the URL (?style=flat), or the default. */
export function chooseStyle(search = location.search) {
  const name = new URLSearchParams(search).get('style');
  return STYLES[name] ? name : DEFAULT_STYLE;
}
