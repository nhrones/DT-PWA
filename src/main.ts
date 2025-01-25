/// <reference lib="dom" />
import { initDOM } from "./deps.ts"
import { KvCache } from "./deps.ts"
import { AppContext } from "../../types.ts"

const BOOL = false
/** 
 * Shared app context -> dependency injected 
 */
const appContext: AppContext = {
   BYPASS_PIN: BOOL, // bypass user PIN input?
   DEV: BOOL, // enable logging
   LOCAL_DB: BOOL, // run from local dataService
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
initDOM(new KvCache(appContext))

