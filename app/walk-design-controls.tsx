"use client";
import {useEffect,useState} from "react";
import {THEMES,DEFAULT_DESIGN,readDesignPreferences,saveDesignPreference,effectiveMapDesign,type DesignPreferences,type ThemeId,type MapDesign} from "../lib/participant-design";
import {ThemeIcon} from "./walk-theme-art";
const storage=()=>window.localStorage;
export function useWalkDesign(){
 const [preferences,setPreferences]=useState<DesignPreferences>(DEFAULT_DESIGN),[hydrated,setHydrated]=useState(false),[persistent,setPersistent]=useState(true);
 useEffect(()=>{setPreferences(readDesignPreferences(storage));setHydrated(true)},[]);
 function screen(value:ThemeId){setPreferences(p=>({...p,screen:value}));setPersistent(saveDesignPreference(storage,"screen",value))}
 function map(value:MapDesign){setPreferences(p=>({...p,map:value}));setPersistent(saveDesignPreference(storage,"map",value))}
 return {preferences,effective:effectiveMapDesign(preferences),hydrated,persistent,screen,map};
}
function MapPreview(){return <svg viewBox="0 0 100 76" aria-hidden="true"><rect className="map-preview-building" x="18" y="10" width="19" height="17" rx="1"/><rect className="map-preview-building" x="64" y="48" width="21" height="15" rx="1"/><path className="map-preview-road" d="M48 68V35H9m39 0h43M48 35V5"/><path className="map-preview-route" d="M48 65V35H19"/><path className="map-preview-arrow" d="m21 30-10 5 10 5Z"/><circle className="map-preview-dot" cx="48" cy="65" r="3"/><rect className="map-preview-label" x="57" y="12" width="34" height="16" rx="3"/><path className="map-preview-symbol" d="M62 16h7m-6 3h5m-4-3v9m3-9v9"/><path className="map-preview-name" d="M74 18h11m-11 5h7"/></svg>}
export default function WalkDesignControls({value,onScreen,onMap,persistent}:{value:DesignPreferences;onScreen:(v:ThemeId)=>void;onMap:(v:MapDesign)=>void;persistent:boolean}){
 return <>{(["screen","map"] as const).map(kind=><fieldset className={"walk-design-selector"+(kind==="map"?" map-design-selector":"")} key={kind}><legend>{kind==="screen"?"画面のデザイン":"地図のデザイン"}</legend><p className="walk-design-intro">{kind==="screen"?"今日の気分で、歩く画面を着替えよう。":"背景・道路・目印の見た目を選べます。道の形や進む方向は変わりません。"}</p>
 {kind==="map"&&<label className="map-design-follow"><input type="radio" name="map-design" value="follow" checked={value.map==="follow"} data-map-design-option="follow" onChange={()=>onMap("follow")}/>画面のデザインに合わせる</label>}
 <div className="walk-design-options">{THEMES.map(theme=><label className={"walk-design-option design-"+theme.id} key={theme.id}><input type="radio" name={kind==="screen"?"walk-design":"map-design"} value={theme.id} checked={value[kind]===theme.id} data-walk-design-option={kind==="screen"?theme.id:undefined} data-map-design-option={kind==="map"?theme.id:undefined} onChange={()=>kind==="screen"?onScreen(theme.id):onMap(theme.id)}/>
 <span className={"walk-design-preview"+(kind==="map"?" map-design-preview":"")} aria-hidden="true">{kind==="map"?<><MapPreview/>{!["sea","tuna","site"].includes(theme.id)&&<span className="map-preview-character"><ThemeIcon kind={theme.icon}/></span>}</>:<><span>{theme.eyebrow}</span><ThemeIcon kind={theme.icon}/><span className="walk-design-mini-button"/></>}</span><span className="walk-design-copy"><strong>{theme.name}</strong><span>{theme.caption}</span></span><span className="walk-design-check" aria-hidden="true">✓</span></label>)}</div>
 <p className="walk-design-current" role="status">{kind==="screen"?"選択中：":"地図："}{value[kind]==="follow"?"画面のデザインに合わせる":THEMES.find(t=>t.id===value[kind])?.name}</p></fieldset>)}
 {!persistent&&<p role="status" data-design-not-saved>デザイン設定を保存できないため、この画面だけに反映しています。</p>}
 <p className="walk-character-credit">キャラクター画像：<a href="https://www.miura-cci.com/promotion/item-000405.html" target="_blank" rel="noreferrer">三浦ツナ之介</a>・<a href="https://www.miura-cci.com/promotion/item-000404.html" target="_blank" rel="noreferrer">みうらん</a>（三浦商工会議所）</p></>;
}
