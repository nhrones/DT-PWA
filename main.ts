/// <reference lib="dom" />

import { PinComponent } from "../../Components/PinComponent.ts";
import { TableComponent } from "../../Components/TableComponent.ts";
import { AppContext, DataContext } from "../../Shared/types.ts"
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
 * A number set to -1 will create an uneditable cell
 * A string set to "readonly" will also create an uneditable cell
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

/** 
 *  Our shared app context -> dependency injected below
 */
const appContext: AppContext = {
   DEV: false,
   PIN: '',
   FocusedKey: ""
}

/** 
 * Our shared data context -> dependency injected below
 */
const dataContext: DataContext = {
   DEV: false,
   LOCAL_DB: true,
   LocalDbURL: "http://localhost:9099/",
   RemoteDbURL: "https://dt-kv-rpc.deno.dev/",
   RpcURL: "SSERPC/kvRegistration",
}

/** 
 * A initialize our reference to the PIN Component 
 * This component secures a data app by requiring a PIN
 * A sucessfull PIN will result in an instantiation of 
 * a footer component that will in turn instantiate
 * a data table component
 */ 
const pinComponent = document.getElementById("pin-component") as PinComponent
pinComponent.init()
   .then((result) => {
      console.log(result)
      if (result === "ok") {
         // /** get a reference to our Custom Table UI */
         const table = document.getElementById("table-component") as TableComponent
         table!.init(thisSchema, appContext, dataContext)
      }
   })
   .catch((er) => {
      alert(er)
   })
