/// <reference lib="dom" />
import { initDOM, KvCache } from "./deps.ts"
import type { AppContext } from "./deps.ts"

//const BOOL = false
/** 
 * Shared app context -> dependency injected 
 */
const appContext: AppContext = {
   BYPASS_PIN: false, // bypass user PIN input?
   DEV: false, // enable logging
   LOCAL_DB: false, // run from local dataService
   LocalDbURL: "http://localhost:9099/",
   RemoteDbURL: "https://kv-dt-rpc.deno.dev/",
   RpcURL: "SSERPC/kvRegistration",
   PIN: '', // Encrypted PIN from KvDB
   dbOptions: {
      schema: {
         dbKey: "PWA",
         sample: {
            host: "Z",
            login: "",
            pw: "",
            remarks: ""
         }
      }
   }
}

/**
 * Initialize our Custom DataTable UI
 * This will initiate async data loading
 * We pass in a new KvCache with a context
 */
//@ts-ignore ?
initDOM(new KvCache(appContext))

