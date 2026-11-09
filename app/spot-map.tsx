"use client";
import {useEffect,useRef,useState} from "react";
import type * as Leaflet from "leaflet";
import type {} from "leaflet.markercluster";
import {INITIAL_SPOT_BOUNDS,within} from "../lib/spots/initial-catalog";
import type {ManagedSpot} from "../lib/spots/editing";
import {groupFor,SPOT_GROUPS} from "../lib/spots/browser-view";
import {connectionMatchesSpot,type RoadConnection} from "../lib/route/road-connection";
type Engine={L:typeof Leaflet;map:Leaflet.Map;group:Leaflet.MarkerClusterGroup;tiles:Leaflet.TileLayer;markers:Map<string,Leaflet.Marker>;alive:boolean};
let library:Promise<typeof Leaflet>|undefined;
function loadLibrary(){
  return library??=(async()=>{
    const L={...await import("leaflet")};
    (window as unknown as {L:typeof Leaflet}).L=L;
    await import("leaflet.markercluster");
    return L;
  })().catch(error=>{library=undefined;throw error});
}
export default function SpotMap({spots,selectedId,onSelect,draftPosition,onPosition,connection,positionLabel}:{spots:ManagedSpot[];selectedId:string|null;onSelect:(id:string)=>void;draftPosition?:{lat:number;lon:number}|null;onPosition?:((position:{lat:number;lon:number})=>void)|null;connection?:RoadConnection|null;positionLabel?:string}){
  const container=useRef<HTMLDivElement>(null),select=useRef(onSelect),selection=useRef(selectedId);
  select.current=onSelect;selection.current=selectedId;
  const positionInput=useRef(onPosition);positionInput.current=onPosition;
  const [engine,setEngine]=useState<Engine|null>(null),[attempt,setAttempt]=useState(0);
  const [state,setState]=useState("loading"),[tilesState,setTilesState]=useState("loading");
  useEffect(()=>{
    let cancelled=false,instance:Leaflet.Map|undefined,observer:ResizeObserver|undefined,current:Engine|undefined;
    setEngine(null);setState("loading");
    loadLibrary().then(L=>{
      if(cancelled||!container.current)return;
      instance=L.map(container.current,{center:[35.141,139.622],zoom:14,minZoom:12,maxZoom:18,scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,
        maxBounds:[[35.115,139.595],[35.168,139.65]],maxBoundsViscosity:1});
      const connectionsPane=instance.createPane("spot-connections");connectionsPane.style.zIndex="625";connectionsPane.style.pointerEvents="none";
      instance.on("click",(event:Leaflet.LeafletMouseEvent)=>positionInput.current?.({lat:event.latlng.lat,lon:event.latlng.lng}));
      let tileFailed=false;
      const tiles=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
        maxZoom:18,keepBuffer:1,updateWhenIdle:true,referrerPolicy:"strict-origin-when-cross-origin",
        attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      });
      tiles.on("loading",()=>{tileFailed=false;if(!cancelled)setTilesState("loading")});
      tiles.on("tileerror",()=>{tileFailed=true;if(!cancelled)setTilesState("unavailable")});
      tiles.on("load",()=>{if(!cancelled)setTilesState(tileFailed?"unavailable":"ready")});
      tiles.addTo(instance);
      const group=L.markerClusterGroup({maxClusterRadius:40,showCoverageOnHover:false,animate:false,spiderfyOnMaxZoom:true,
        iconCreateFunction:cluster=>L.divIcon({className:"spot-cluster",html:"<span>"+cluster.getChildCount()+"</span>",iconSize:[40,40]}),
      }).addTo(instance);
      group.on("clusterclick",event=>{
        const element=(event.layer as Leaflet.MarkerCluster).getElement();element?.setAttribute("aria-label","近くのスポットを拡大");
      });
      observer=new ResizeObserver(()=>{if(!cancelled)instance?.invalidateSize({pan:false})});observer.observe(container.current);
      current={L,map:instance,tiles,group,markers:new Map(),alive:true};setEngine(current);setState("ready");
    }).catch(error=>{if(!cancelled){console.error("Spot map initialization failed",error);setState("unavailable")}});
    return()=>{cancelled=true;observer?.disconnect();if(current){current.alive=false;current.map.stop();current.group.clearLayers();current.markers.clear()}instance?.remove()};
  },[attempt]);
  function icon(L:typeof Leaflet,spot:ManagedSpot,active:boolean){
    const group=SPOT_GROUPS[groupFor(spot.category)];
    return L.divIcon({className:"spot-map-marker"+(active?" is-selected":""),iconSize:[34,34],iconAnchor:[17,17],
      html:'<span style="--spot-color:'+group.color+'">'+group.glyph+'</span>'});
  }
  useEffect(()=>{
    if(!engine?.alive)return;
    const {L,map,group,markers}=engine;group.clearLayers();markers.clear();
    for(const spot of spots){
      const label=document.createElement("span");label.textContent=spot.name;
      const marker=L.marker([spot.position.lat,spot.position.lon],{icon:icon(L,spot,false),title:spot.name,keyboard:true,riseOnHover:true})
        .bindTooltip(label,{direction:"top",offset:[0,-16]});
      marker.on("click",()=>{if(positionInput.current)positionInput.current({lat:spot.position.lat,lon:spot.position.lon});else select.current(spot.id)});
      marker.on("keydown",event=>{
        const key=(event as Leaflet.LeafletKeyboardEvent).originalEvent;
        if(key.key==="Enter"||key.key===" "){L.DomEvent.stop(key);if(positionInput.current)positionInput.current({lat:spot.position.lat,lon:spot.position.lon});else select.current(spot.id)}
      });
      marker.on("add",()=>{
        const el=marker.getElement();if(!el)return;
        el.dataset.spotMarker=spot.id;el.setAttribute("aria-label",spot.name+"・"+SPOT_GROUPS[groupFor(spot.category)].label);
        el.setAttribute("role","button");el.setAttribute("aria-pressed",spot.id===selection.current?"true":"false");
      });
      markers.set(spot.id,marker);group.addLayer(marker);
    }
    if(spots.length)map.fitBounds(L.latLngBounds(spots.map(s=>[s.position.lat,s.position.lon] as [number,number])),{padding:[35,35],maxZoom:16,animate:false});
    return()=>{if(engine.alive){group.clearLayers();markers.clear()}};
    // Selection is updated separately to keep the current marker and its keyboard focus.
  },[engine,spots]);
  useEffect(()=>{
    if(!engine?.alive)return;
    for(const spot of spots){
      const marker=engine.markers.get(spot.id);if(!marker)continue;
      if(spot.id!==selectedId)marker.closeTooltip();
      marker.setIcon(icon(engine.L,spot,spot.id===selectedId));marker.setZIndexOffset(spot.id===selectedId?1000:0);
      marker.getElement()?.setAttribute("aria-pressed",spot.id===selection.current?"true":"false");
    }
    const chosen=selectedId?engine.markers.get(selectedId):null;
    if(chosen){
      // Synchronous public map methods avoid callbacks retaining markers after a filter/unmount.
      engine.map.stop();engine.map.setView(chosen.getLatLng(),18,{animate:false});
      const parent=engine.group.getVisibleParent(chosen);
      if(parent instanceof engine.L.MarkerCluster)parent.spiderfy();
      chosen.openTooltip();
    }
  },[engine,selectedId,spots]);
  useEffect(()=>{
    if(!engine?.alive||!draftPosition||!Number.isFinite(draftPosition.lat)||!Number.isFinite(draftPosition.lon)||!within(draftPosition,INITIAL_SPOT_BOUNDS))return;
    const marker=engine.L.circleMarker([draftPosition.lat,draftPosition.lon],{radius:12,color:"#c4752f",weight:4,fillColor:"#f8d8b2",fillOpacity:.65,className:"spot-draft-marker",interactive:false}).addTo(engine.map);
    if(!engine.map.getBounds().contains(marker.getLatLng()))engine.map.panTo(marker.getLatLng(),{animate:false});
    return()=>{if(engine.alive)marker.remove()};
  },[engine,draftPosition?.lat,draftPosition?.lon]);
  useEffect(()=>{
    const spot=spots.find(s=>s.id===selectedId)??null;
    if(!engine?.alive||draftPosition||!connectionMatchesSpot(connection??null,spot))return;
    const value=connection!,{L,map}=engine,segment=value.segment;
    const layers=L.layerGroup([
      L.polyline([[segment.from.lat,segment.from.lon],[segment.to.lat,segment.to.lon]],{pane:"spot-connections",color:"#1f659c",weight:6,interactive:false,className:"spot-road-segment"}),
      L.polyline([[value.facility.lat,value.facility.lon],[value.point.lat,value.point.lon]],{pane:"spot-connections",color:"#1f659c",weight:2,dashArray:"5 7",interactive:false,className:"spot-road-reference"}),
      L.circleMarker([value.point.lat,value.point.lon],{pane:"spot-connections",radius:7,color:"#1f659c",weight:3,fillColor:"#fff",fillOpacity:1,interactive:false,className:"spot-road-point"})
    ]).addTo(map);
    const bounds=L.latLngBounds([[value.facility.lat,value.facility.lon],[value.point.lat,value.point.lon]]);
    if(!map.getBounds().contains(bounds))map.fitBounds(bounds,{padding:[40,40],maxZoom:18,animate:false});
    return()=>{if(engine.alive)layers.remove()};
  },[engine,connection,selectedId,spots,draftPosition]);
  function fit(){
    if(engine?.alive&&spots.length){engine.map.stop();engine.map.fitBounds(engine.L.latLngBounds(spots.map(s=>[s.position.lat,s.position.lon] as [number,number])),{padding:[35,35],maxZoom:16,animate:false})}
  }
  return <section className="spot-map-panel" aria-label="スポットの位置図" data-spot-map-state={state} data-tile-state={tilesState}>
    <div className="spot-map-toolbar"><span><strong>地図から探す</strong><small>{onPosition?(positionLabel??"地図をクリックして施設位置を指定"):"ピンを選ぶと詳細を表示"}</small></span><button type="button" onClick={fit} disabled={!engine||!spots.length} data-map-fit>表示中の範囲へ</button></div>
    <div className="spot-map-canvas" ref={container} aria-label="スポットの背景地図"/>
    {state==="loading"&&<p className="spot-map-feedback" role="status">地図を準備しています…</p>}
    {state==="unavailable"&&<div className="spot-map-feedback" role="alert"><p>地図を準備できませんでした。一覧からスポットを確認できます。</p><button type="button" onClick={()=>setAttempt(v=>v+1)} data-map-retry>地図を再試行</button></div>}
    {state==="ready"&&tilesState==="unavailable"&&<div className="spot-tile-feedback" role="status" data-tile-error><span>背景地図を読み込めません。一覧・詳細は引き続き使えます。</span><button type="button" onClick={()=>engine?.tiles.redraw()} data-tile-retry>背景を再読込み</button></div>}
    <p className="spot-map-source">スポット・背景地図 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL 1.0</a></p>
  </section>;
}
