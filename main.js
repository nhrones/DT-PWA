
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

const LOCAL = false

/** 
 *  Our shared app context -> dependency injected below
 */
const appContext = {
   BYPASS_PIN: LOCAL,
   DEV: LOCAL,
   LOCAL_DB: LOCAL,
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
 * We pass it an appContext (for the data provider)
 */
document.getElementById("table-component").init(appContext)
