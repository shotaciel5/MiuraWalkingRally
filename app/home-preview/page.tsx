import type {Metadata} from "next";
import HomeComparison from "./comparison";
export const metadata:Metadata={title:"ホームの比較",robots:{index:false,follow:false}};
export default function HomeComparisonPage(){return <HomeComparison/>}
