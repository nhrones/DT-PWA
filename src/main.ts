/// <reference lib="dom" />
import { initDOM, KvCache } from "./deps.ts"
import type { AppContext } from "./deps.ts"

const LOCAL = false
/** 
 * Shared app context -> dependency injected 
 */
const appContext: AppContext = {
   BYPASS_PIN: LOCAL, // bypass user PIN input?
   DEV: LOCAL, // enable logging
   LOCAL_DB: LOCAL, // run from local dataService
   LocalDbURL: "http://localhost:9099/",
   RemoteDbURL: "https://dt-kv-rpc.deno.dev/", //"https://kv-dt-rpc.deno.dev/",
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
 * Initiate async data loading and data provider
 * We pass in a context for the service
 */
const kvCache = new KvCache(appContext)

/**
 * Initialize our Custom DataTable UI
 * We pass it a KvCache instance (data provider)
 */
initDOM(kvCache)

