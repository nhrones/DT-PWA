/// <reference lib="dom" />
import { type AppContext, KvCache, TableContainer } from "./deps.ts"
import thisSchema from "./schema.json" with { type: "json" };

const LOCAL = false
/** 
 * Shared app context -> dependency injected 
 */
const appContext: AppContext = {
   BYPASS_PIN: LOCAL, // bypass user PIN input?
   DEV: LOCAL, // enable logging
   LOCAL_DB: LOCAL, // run from local dataService
   LocalDbURL: "http://localhost:9099/",
   RemoteDbURL: "https://dt-kv-rpc.deno.dev/",
   RpcURL: "SSERPC/kvRegistration",
   PIN: '', // Encrypted PIN from KvDB
   FocusedRowKey: "",
   dbOptions: { schema: thisSchema }
}

/**
 * Initiate async data loading and data provider
 * We pass in theabove context for the service
 */
const kvCache = new KvCache(appContext) as KvCache

/**
 * Initialize our Custom DataTable UI
 * We pass it a KvCache instance (data provider)
 */
(document.getElementById("table-container") as TableContainer).init(kvCache)

