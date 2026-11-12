// The game's display face (same as the demo). Put `theCodeFont.variable` on a wrapper.
import { Secular_One } from 'next/font/google';

export const theCodeFont = Secular_One({ subsets: ['hebrew', 'latin'], weight: '400', variable: '--tc-font-display' });
