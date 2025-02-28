/// <reference lib="dom" />

import { PinComponent } from "../../Components/PinComponent.ts";
import { FooterComponent } from "../../Components/FootComponent.ts";
import { TableComponent } from "../../Components/TableComponent.ts";

export * from "../../Components/PinComponent.ts"
export * from "../../Components/FootComponent.ts"
export * from "../../Components/TableComponent.ts"

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
   keyColumnName: "host",
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

const pinComponent = document.getElementById("pin-component") as PinComponent
pinComponent.init()
   .then((result) => {
      console.log(result)
      if (result === "ok") {
         /**
          * Get a reference to our Custom Footer UI
          * We pass in a dbSchema and an appContext
          * @returns TableComponent.KvCache
          */
         const footer = document.getElementById("footer-component") as FooterComponent

         /**
          * Get a reference to our our Custom DataTable UI
          * We pass in a dbSchema and an appContext
          * @returns a reference to a TableComponent instance
          */
         footer.init(thisSchema, appContext)

      }
   })
   .catch((er) => {
      alert(er)
   })
