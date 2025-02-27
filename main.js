
/** 
 * A unique schema object 
 * Note that the data-provider and the UI both use
 * this object for auto-configuration.
 * 
 * In the schema-sample, a boolean value will produce a checkbox,
 * and a string array will be auto-configured as a select element.
 */
const thisSchema = {
   dbKey: "PWA",
   keyColumnName:"host",
   sampleRecord: {
      host: "Z",
      login: "",
      pw: "",
      remarks: ""
   }
}

// set the title to the dbKey value
document.title = thisSchema.dbKey

/** 
 *  Our shared app context -> dependency injected below
 */
const appContext = {
   DEV: false,
   LOCAL_DB: false,
   LocalDbURL: "http://localhost:9099/",
   RemoteDbURL: "https://dt-kv-rpc.deno.dev/",
   RpcURL: "SSERPC/kvRegistration",
   PIN: '',
   FocusedKey: "",
   dbOptions: { schema: thisSchema }
}

// set the title to the dbKey value
document.title = thisSchema.dbKey

/**
 * Initialize our Custom DataTable UI
 * We pass in a dbSchema and an appContext
 * @returns TableComponent.KvCache
 */
// const table = document.getElementById("table-component").init(thisSchema, appContext)

// const REQUIRE_PIN = true

// if (REQUIRE_PIN) {
//    document.getElementById("pin-component").init(table.kvCache)
// }

const footer = document.getElementById("footer-component")
const table = footer.init(thisSchema, appContext)

const REQUIRE_PIN = true

if (REQUIRE_PIN) {
   document.getElementById("pin-component").init(table.kvCache.CTX)
}


//TODO Do a clean separation of Data-Provider and Web-Components
//TODO Separate PIN-UI from the Table-UI --> use PIN only for KV-RPC

// PIN-UI --> Cache --> Table-UI