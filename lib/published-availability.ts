export type PublishedAvailability="ready"|"withdrawn"|"missing"|"unavailable";
export async function checkPublishedCourse(rally:{id:string;revision:string},signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<PublishedAvailability>{
 try{
  const response=await fetcher("/api/rallies/"+encodeURIComponent(rally.id)+"/availability",{cache:"no-store",signal}),value:unknown=await response.json();
  const data=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
  if(response.status===410&&data?.status==="withdrawn")return "withdrawn";
  if(response.status===404&&data?.status==="missing")return "missing";
  return response.ok&&data?.status==="published"&&data.revision===rally.revision?"ready":"unavailable";
 }catch{return "unavailable"}
}
