import type {SpotCategory} from "./initial-catalog.ts";

/** Fixed SVG paths only; names and other user input never enter this markup. */
export const SPOT_SYMBOL_PATHS:Record<SpotCategory,string>={
 market:"M3 7h18M5 7l2-4h10l2 4M5 7v13h14V7M9 20v-7h6v7M3 7v3a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 2-2",
 food:"M5 3v7M8 3v7M11 3v7M5 7h6M8 10v11M18 3c-4 4-4 8 0 8h1M19 3v18",
 cafe:"M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM16 9h2a3 3 0 0 1 0 6h-2M7 3v2M11 2v3M3 22h16",
 sweets:"M4 20h16V10l-4-4-4 4-4-4-4 4v10ZM4 13h16M8 3v3M16 3v3",
 souvenir:"M3 9h18v4H3V9ZM5 13v8h14v-8M12 9v12M12 8C4 9 5 1 9 4l3 4ZM12 8c8 1 7-7 3-4l-3 4Z",
 shopping:"M5 8h14l2 13H3L5 8ZM8 8V6a4 4 0 0 1 8 0v2",
 scenery:"M2 18l6-10 5 7 3-5 6 8M2 21h20M17 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
 park:"M12 2 6 9h3l-5 7h6v6h4v-6h6l-5-7h3l-6-7ZM4 22h16",
 history:"M5 21V9h14v12M8 9V4h8v5M3 21h18M9 12h6M9 16h6",
 religious:"M2 8l10-5 10 5M3 9h18M5 11h14M7 11v10M17 11v10M4 21h16M10 14h4v7",
 attraction:"M3 10l9-7 9 7M5 11v10h14V11M9 21v-7h6v7",
 activity:"M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM4 9h16M12 8v6M12 14l-5 7M12 14l5 7",
 stay:"M3 21V6M3 16h18v5M3 10h7v6M10 12h8a3 3 0 0 1 3 3v1M6 8h1",
 information:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v1M12 11v6"
};
export function spotSymbolMarkup(category:SpotCategory){
 return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+SPOT_SYMBOL_PATHS[category]+'"/></svg>';
}
