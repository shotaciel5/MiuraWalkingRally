type Point={lat:number;lon:number};
type Way={id:number;nodes:number[];tags?:Record<string,string>};
type Node=Point&{id:number;tags?:Record<string,string>};
type Edge={to:number;way:Way;length:number};
type Graph={nodes:Map<number,Node>;visual:Map<number,Edge[]>;adj:Map<number,Edge[]>};
type Frame={id:string;at:number;center:Point;heading:number;branches:Point[][];canOmit:boolean;label:string;retainedForStraightSignal?:boolean;checkpoints?:unknown[];incomingBranchIndex?:number};
declare const engine:{
 RULE_VERSION:string;
 graph(data:{nodes:Node[];ways:Way[]}):Graph;
 distance(a:Point,b:Point):number;
 bearing(a:Point,b:Point):number;
 traceRoad(g:Graph,id:number,neighbor:number,limit?:number):{points:Point[];end:string};
 continuation(g:Graph,ids:number[],index:number,ignoreSignals?:boolean):boolean;
 junctionSignature(frame:Frame):number[][]|null;
 similarJunctions(a:Frame,b:Frame):boolean;
 selectFrames(frames:Frame[],mode?:string,edits?:Record<string,unknown>):(Frame&{number:number;retentionTargetId?:string})[];
};
export=engine;
