import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {seedDemoData} from "../lib/demo/seed.ts";
try{process.loadEnvFile(".env.local")}catch{}
export function seedCommand(){const report=seedDemoData();console.log(JSON.stringify(report,null,2));return report}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length>2){console.error("引数は不要です。保存先はSPOT_DB_PATHで設定してください。");process.exitCode=1}
 else try{seedCommand()}catch{console.error("初期データを登録できませんでした。保存先・既存コースのID・データ形式を確認してください。秘密情報や保存内容は表示しません。");process.exitCode=1}
}
