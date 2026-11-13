// Shortest augmenting path assignment, with SciPy 1.16 tie ordering.
// Adapted from PM Larsen's rectangular_lsap.cpp; see SCIPY-LICENSE.txt.
export function linearAssignment(input:number[][]):[number,number][]{
 const originalRows=input.length,originalCols=input[0]?.length??0;
 if(!originalRows||!originalCols)return [];
 if(input.some(r=>r.length!==originalCols||r.some(x=>!Number.isFinite(x))))throw Error("Invalid assignment matrix");
 const transpose=originalRows>originalCols,cost=transpose?Array.from({length:originalCols},(_,j)=>input.map(r=>r[j])):input;
 const nr=cost.length,nc=cost[0].length,u=Array(nr).fill(0),v=Array(nc).fill(0),col4row=Array(nr).fill(-1),row4col=Array(nc).fill(-1),path=Array(nc).fill(-1);
 for(let current=0;current<nr;current++){
  const remaining=Array.from({length:nc},(_,i)=>nc-i-1),seenRows=Array(nr).fill(false),seenCols=Array(nc).fill(false),distance=Array(nc).fill(Infinity);
  let count=nc,row=current,value=0,sink=-1;
  while(sink<0){
   seenRows[row]=true;let index=-1,lowest=Infinity;
   for(let k=0;k<count;k++){
    const col=remaining[k],candidate=value+cost[row][col]-u[row]-v[col];
    if(candidate<distance[col]){path[col]=row;distance[col]=candidate}
    if(distance[col]<lowest||distance[col]===lowest&&row4col[col]===-1){lowest=distance[col];index=k}
   }
   value=lowest;if(!Number.isFinite(value)||index<0)throw Error("Infeasible assignment");
   const col=remaining[index];if(row4col[col]<0)sink=col;else row=row4col[col];
   seenCols[col]=true;remaining[index]=remaining[--count];
  }
  u[current]+=value;
  for(let i=0;i<nr;i++)if(seenRows[i]&&i!==current)u[i]+=value-distance[col4row[i]];
  for(let j=0;j<nc;j++)if(seenCols[j])v[j]-=value-distance[j];
  let col=sink;
  while(true){const r=path[col];row4col[col]=r;const old=col4row[r];col4row[r]=col;col=old;if(r===current)break}
 }
 return transpose?col4row.map((r,c)=>[r,c] as [number,number]).sort((a,b)=>a[0]-b[0]):col4row.map((c,r)=>[r,c]);
}
