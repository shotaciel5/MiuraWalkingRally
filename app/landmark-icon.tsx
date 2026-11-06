import type {LandmarkSymbol} from "../lib/route/context";

export default function LandmarkIcon({symbol,size=22,x,y}:{symbol:LandmarkSymbol;size?:number;x?:number;y?:number}){
  let shape;
  switch(symbol){
    case "signal":shape=<><path d="M12 14v8" stroke="#4c5d54" strokeWidth="2"/><rect x="1" y="5" width="22" height="10" rx="4" fill="#344a40"/><circle cx="5.5" cy="10" r="2.5" fill="#36a081"/><circle cx="12" cy="10" r="2.5" fill="#f2c04e"/><circle cx="18.5" cy="10" r="2.5" fill="#df6262"/></>;break;
    case "stop-sign":shape=<><path d="M1 3H23L12 23Z" fill="#c3383a" stroke="white" strokeWidth="1.4"/><text x="12" y="11" textAnchor="middle" fill="white" fontSize="5.3" fontWeight="700">止まれ</text></>;break;
    case "stop-control":shape=<><path d="M2 3H22L12 22Z" fill="white" stroke="#b23f40" strokeWidth="1.6" strokeDasharray="3 2"/><text x="12" y="12" textAnchor="middle" fill="#a23133" fontSize="8" fontWeight="700">停</text></>;break;
    case "give-way-control":shape=<><rect x="2" y="2" width="20" height="20" rx="4" fill="white" stroke="#9f6832" strokeDasharray="3 2"/><text x="12" y="17" textAnchor="middle" fontSize="13" fill="#805025">譲</text></>;break;
    case "crossing":shape=<><rect x="1" y="1" width="22" height="22" rx="3" fill="#376f9f"/><circle cx="13" cy="6" r="2" fill="white"/><path d="M13 9l-3 5 4 3 1 5M11 12l-5 1M12 11l5 3M10 15l-4 6" stroke="white" strokeWidth="2" fill="none"/></>;break;
    case "bus":shape=<><rect x="4" y="2" width="16" height="18" rx="4" fill="#376f9f"/><rect x="6.5" y="5" width="11" height="7" rx="1" fill="white"/><path d="M7 21v2m10-2v2" stroke="#376f9f" strokeWidth="3"/><circle cx="8" cy="16" r="1.3" fill="white"/><circle cx="16" cy="16" r="1.3" fill="white"/></>;break;
    case "shrine":shape=<g stroke="#79551d" strokeWidth="2.5" fill="none"><path d="M1 4q11 4 22 0M3 9h18M7 5L6 23M17 5l1 18M12 6v3"/></g>;break;
    case "temple":shape=<text x="12" y="21" textAnchor="middle" fontSize="23" fill="#5a5140">卍</text>;break;
    case "parking":case "toilet":shape=<><rect x="1" y="1" width="22" height="22" rx="4" fill="#376f9f"/><text x="12" y={symbol==="parking"?19:16} textAnchor="middle" fontSize={symbol==="parking"?20:10} fill="white" fontWeight="700">{symbol==="parking"?"P":"WC"}</text></>;break;
    case "water":shape=<path d="M12 1C9 7 4 12 4 16a8 8 0 0016 0C20 12 15 7 12 1Z" fill="#388a9e" stroke="white"/>;break;
    case "shop":case "food":shape=<><path d="M3 10h18v12H3Z" fill="#fff8e8" stroke="#8b692d" strokeWidth="1.5"/><path d="M2 10l3-7h14l3 7Z" fill="#b58143"/>{symbol==="shop"?<path d="M9 22V14h6v8" fill="none" stroke="#8b692d" strokeWidth="2"/>:<text x="12" y="20" textAnchor="middle" fontSize="11" fill="#63491e">食</text>}</>;break;
    case "tourism":shape=<><circle cx="12" cy="12" r="11" fill="#376f9f"/><text x="12" y="20" textAnchor="middle" fontSize="22" fontWeight="700" fill="white">i</text></>;break;
    case "historic":shape=<g stroke="#79551d" fill="#f2e7cc" strokeWidth="1.5"><path d="M2 7l10-5 10 5ZM3 21h18M5 7v14m7-14v14m7-14v14"/></g>;break;
    case "sign":shape=<><rect x="2" y="1" width="20" height="17" rx="3" fill="#f4f4ee" stroke="#596a61"/><path d="M12 18v6" stroke="#596a61" strokeWidth="2"/><text x="12" y="13" textAnchor="middle" fontSize="12" fill="#47584e">標</text></>;break;
    default:shape=<g stroke="#79551d" strokeWidth="1.5" fill="#fff8e8"><path d="M3 22V7l9-5 9 5v15ZM9 22v-7h6v7"/><path d="M7 9h2m6 0h2" fill="none"/></g>;
  }
  return <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="landmark-icon" data-landmark-icon={symbol}>{shape}</svg>;
}
