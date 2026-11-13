import definitions from "../data/ui/walk-themes.json" with {type:"json"};
export const THEME_IDS=["sea","tuna","site","tsunosuke","miuran","farm","retro","festival","lighthouse","watermelon","forest","donburi"] as const;
export type ThemeId=typeof THEME_IDS[number];
export type MapDesign=ThemeId|"follow";
export type DesignPreferences={screen:ThemeId;map:MapDesign};
export const THEMES=definitions as {id:ThemeId;name:string;caption:string;eyebrow:string;icon:string}[];
export const DEFAULT_DESIGN:DesignPreferences={screen:"tsunosuke",map:"follow"};
export const DESIGN_KEYS={screen:"miura-walk-design-v1",map:"miura-map-design-v1"} as const;
export const isTheme=(value:unknown):value is ThemeId=>typeof value==="string"&&(THEME_IDS as readonly string[]).includes(value);
export const isMapDesign=(value:unknown):value is MapDesign=>value==="follow"||isTheme(value);
export const effectiveMapDesign=(preferences:DesignPreferences):ThemeId=>preferences.map==="follow"?preferences.screen:preferences.map;
type DesignStorage={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void};
export function readDesignPreferences(provider:()=>DesignStorage):DesignPreferences{
 const result={...DEFAULT_DESIGN};let storage:DesignStorage;try{storage=provider()}catch{return result}
 try{const screen=storage.getItem(DESIGN_KEYS.screen);if(isTheme(screen))result.screen=screen}catch{}
 try{const map=storage.getItem(DESIGN_KEYS.map);if(isMapDesign(map))result.map=map}catch{}
 return result;
}
export function saveDesignPreference(provider:()=>DesignStorage,kind:keyof DesignPreferences,value:unknown):boolean{
 if(kind==="screen"?!isTheme(value):!isMapDesign(value))return false;
 try{provider().setItem(DESIGN_KEYS[kind],value as string);return true}catch{return false}
}
