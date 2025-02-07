// deno-lint-ignore-file
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../shared/signals.ts
function buildEventBus() {
  const eventSubscriptions = /* @__PURE__ */ new Map();
  const newEventBus = {
    /**
     * on - registers a handler function to be executed when an event is fired
     * @param {key} eventName - event name (one of `TypedEvents` only)!
     * @param {string} id - id of a target element (may be an empty string)
     * @param {Handler} handler - event handler callback function
     */
    on(eventName, id, handler) {
      const keyName = eventName + "-" + id;
      if (eventSubscriptions.has(keyName)) {
        const handlers = eventSubscriptions.get(keyName);
        handlers.push(handler);
      } else {
        eventSubscriptions.set(keyName, [handler]);
      }
    },
    /** 
     * Publish an event
     * executes all registered handlers for a named event
     * @param {key} eventName - event name - one of `TypedEvents` only!
     * @param {string} id - id of a target element (may be an empty string)
     * @param {TypedEvents[key]} data - data payload, typed for this category of event
     */
    fire(eventName, id, data) {
      const keyName = eventName + "-" + id;
      const handlers = eventSubscriptions.get(keyName);
      if (handlers) {
        for (const handler of handlers) {
          handler(data);
        }
      }
    },
    /** xor encryption */
    xorEncrypt(text) {
      let result = "";
      const key = "ndhg";
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    }
  };
  return newEventBus;
}
__name(buildEventBus, "buildEventBus");
var signals = buildEventBus();

// ../KvDataService/kvClient.ts
var KvClient = class {
  static {
    __name(this, "KvClient");
  }
  DEV = false;
  nextMsgID = 0;
  querySet = [];
  transactions = /* @__PURE__ */ new Map();
  currentPage = 1;
  focusedRow = null;
  kvCache;
  CTX;
  ServiceURL;
  RegistrationURL;
  /** ctor */
  constructor(cache, ctx) {
    this.CTX = ctx;
    this.DEV = ctx.DEV;
    this.ServiceURL = ctx.LOCAL_DB ? ctx.LocalDbURL : ctx.RemoteDbURL;
    this.RegistrationURL = this.ServiceURL + ctx.RpcURL;
    this.kvCache = cache;
    this.transactions = /* @__PURE__ */ new Map();
  }
  /** initialize our EventSource and fetch some data */
  init() {
    const eventSource = new EventSource(this.RegistrationURL);
    console.log("CONNECTING");
    eventSource.addEventListener("open", () => {
      this.callProcedure(this.ServiceURL, "GET", { key: ["PIN"] }).then((result) => {
        if (this.DEV) console.log("GET PIN ", result.value);
        const pin = signals.xorEncrypt(result.value);
        if (this.DEV) console.log("GET PIN ", pin);
        this.CTX.PIN = result.value;
        this.fetchQuerySet();
      });
    });
    eventSource.addEventListener("error", (_e) => {
      switch (eventSource.readyState) {
        case EventSource.OPEN:
          console.log("CONNECTED");
          break;
        case EventSource.CONNECTING:
          console.log("CONNECTING");
          break;
        case EventSource.CLOSED:
          console.log("DISCONNECTED");
          break;
      }
    });
    eventSource.addEventListener("message", (evt) => {
      const parsed = JSON.parse(evt.data);
      const { txID, error, result } = parsed;
      if (txID === -1) {
        this.handleMutation(result);
      }
      if (!this.transactions.has(txID)) return;
      const transaction = this.transactions.get(txID);
      this.transactions.delete(txID);
      if (transaction) transaction(error, result);
    });
  }
  /**
   * handle Mutation Event
   * @param {{ rowID: any; type: any; }} result
   */
  handleMutation(result) {
  }
  /** set Kv Pin */
  async setKvPin(rawpin) {
    const pin = signals.xorEncrypt(rawpin);
    await this.callProcedure(this.ServiceURL, "SET", { key: ["PIN"], value: pin }).then((_result) => {
      if (this.DEV) console.log(`Set PIN ${rawpin} to: `, pin);
    });
  }
  /** fetch a querySet */
  async fetchQuerySet() {
    await this.callProcedure(
      this.ServiceURL,
      "GET",
      { key: [this.CTX.dbOptions.schema.dbKey] }
    ).then((result) => {
      this.kvCache.restoreCache(signals.xorEncrypt(result.value));
    });
  }
  /** get row from key */
  get(key) {
    for (let index = 0; index < this.querySet.length; index++) {
      const element = this.querySet[index];
      if (element.id === key) return element;
    }
  }
  /** The `set` method mutates - will call the `persist` method. */
  set(value) {
    try {
      this.callProcedure(
        this.ServiceURL,
        "SET",
        {
          key: [this.CTX.dbOptions.schema.dbKey],
          value
        }
      ).then((result) => {
        this.querySet = result.querySet;
        return this.querySet;
      });
    } catch (e) {
      return { Error: e };
    }
  }
  /** 
   * Make an Asynchronous Remote Proceedure Call
   *  
   * @param {any} procedure - the name of the remote procedure to be called
   * @param {any} params - appropriately typed parameters for this procedure
   * 
   * @returns {Promise<any>} - Promise object has a transaction that is stored by ID    
   *   in a transactions Set.   
   *   When this promise resolves or rejects, the transaction is retrieves by ID    
   *   and executed by the promise. 
   */
  callProcedure(dbServiceURL, procedure, params) {
    const txID = this.nextMsgID++;
    return new Promise((resolve, reject) => {
      this.transactions.set(txID, (error, result) => {
        if (error)
          return reject(new Error(error));
        resolve(result);
      });
      fetch(dbServiceURL, {
        method: "POST",
        mode: "cors",
        body: JSON.stringify({ txID, procedure, params })
      });
    });
  }
};

// ../KvDataService/kvCache.ts
var KvCache = class {
  static {
    __name(this, "KvCache");
  }
  dbKey = "";
  schema;
  nextMsgID = 0;
  querySet = [];
  callbacks;
  columns = [];
  kvClient;
  dbMap;
  raw = [];
  CTX;
  DEV;
  /** ctor */
  constructor(ctx) {
    this.dbKey = `${ctx.dbOptions.schema.dbKey}`;
    this.schema = ctx.dbOptions.schema;
    this.CTX = ctx;
    this.DEV = this.CTX.DEV;
    this.callbacks = /* @__PURE__ */ new Map();
    this.dbMap = /* @__PURE__ */ new Map();
    this.columns = this.buildColumnSchema(this.schema.sample);
    this.kvClient = new KvClient(this, ctx);
    this.kvClient.init();
    signals.on("restoreCacheEV", "", (result) => {
      this.restoreCache(result);
    });
  }
  /** 
   * restores our cache from a json string 
   */
  restoreCache(records) {
    const pwaObj = JSON.parse(records);
    this.dbMap = new Map(pwaObj);
    this.persist();
    const result = this.hydrate();
    if (result == "ok") {
      signals.fire("buildDataTableEV", "", this);
    }
  }
  /**
   * extract a set of column-schema from the DB.schema object
   */
  buildColumnSchema(obj) {
    const columns = [];
    for (const [key, value] of Object.entries(obj)) {
      let read_only = false;
      if (typeof value === "number" && value === -1 || typeof value === "string" && value === "READONLY") {
        read_only = true;
      }
      columns.push({
        name: `${key}`,
        type: `${typeof value}`,
        readOnly: read_only,
        order: "ASC"
      });
    }
    return columns;
  }
  /**
   * Persist the current dbMap to Kv   
   * This is called for any mutation of the dbMap (set/delete)
   */
  persist(order = true) {
    if (this.DEV) console.log("Persisting -> sorted? ", order);
    if (order) {
      this.dbMap = new Map([...this.dbMap.entries()].sort());
    }
    const mapString = JSON.stringify(Array.from(this.dbMap.entries()));
    const encrypted = signals.xorEncrypt(mapString);
    this.kvClient.set(encrypted);
  }
  /** hydrate a dataset from a single raw record stored in kvDB */
  hydrate() {
    this.raw = [...this.dbMap.values()];
    this.querySet = [...this.raw];
    signals.fire("buildDataTableEV", "", this);
    return this.raw.length > 2 ? "ok" : "Not found";
  }
  /** resest the working querySet to original DB values */
  resetData() {
    this.querySet = [...this.raw];
  }
  clean(what = null) {
    const cleanMap = /* @__PURE__ */ new Map();
    const keys = [...this.dbMap.keys()];
    keys.forEach((value) => {
      if (value !== what) {
        cleanMap.set(value, this.dbMap.get(value));
      }
    });
    this.dbMap = cleanMap;
    this.persist(true);
  }
  /** The `set` method mutates - will call the `persist` method. */
  set(key, value) {
    try {
      this.dbMap.set(key, value);
      this.persist(true);
      this.hydrate();
      return key;
    } catch (e) {
      console.error("error setting ");
      return "Error " + e;
    }
  }
  /** The `get` method will not mutate records */
  get(key) {
    try {
      const result = this.dbMap.get(key);
      return result;
    } catch (e) {
      return "Error " + e;
    }
  }
  /** The `delete` method mutates - will call the `persist` method. */
  delete(key) {
    try {
      const result = this.dbMap.delete(key);
      if (result === true) this.persist(true);
      this.hydrate();
      return result;
    } catch (e) {
      return "Error " + e;
    }
  }
};

// ../NewDataTable/tableRow.ts
var deleteBtn = document.getElementById("deletebtn");
var addBtn = document.getElementById("addbtn");
var focusedRow;
var focusedCell;
function resetFocusedRow() {
  deleteBtn.setAttribute("hidden", "");
  addBtn.removeAttribute("hidden");
  focusedRow = null;
}
__name(resetFocusedRow, "resetFocusedRow");
function makeEditableRow(kvCache2) {
  const rows = document.querySelectorAll("tr");
  for (const row of Array.from(rows)) {
    if (row.className.startsWith("headerRow")) continue;
    row.onclick = (e) => {
      const target = e.target;
      if (focusedRow && focusedCell && e.target != focusedCell) {
        focusedCell.removeAttribute("contenteditable");
        focusedCell.className = "";
        focusedCell.oninput = null;
      }
      focusedRow?.classList.remove("selected_row");
      focusedRow = row;
      focusedRow.classList.add("selected_row");
      addBtn.setAttribute("hidden", "");
      deleteBtn.removeAttribute("hidden");
      focusedCell = e.target;
      focusedCell.setAttribute("contenteditable", "");
      focusedCell.className = "editable ";
      focusedCell.onblur = () => {
        let key = focusedRow.dataset.cache_key;
        const col = focusedCell.dataset.column_id || 0;
        const columnIndex = parseInt(focusedCell.dataset.column_index) || 0;
        console.log(`focusedCell.onblur key: ${key} col: ${col}, columnIndex ${columnIndex}`);
        console.info("kvCache", kvCache2.dbMap);
        const rowObj = kvCache2.get(key);
        const currentValue = rowObj[col];
        const thisValue = focusedCell.textContent;
        console.log(`Need change?  currentValue: ${currentValue}, thisValue: ${thisValue}`);
        if (currentValue !== thisValue) {
          rowObj[col] = thisValue;
          console.log(`Needs key change? columnIndex:${columnIndex} type${typeof columnIndex}`);
          if (columnIndex === 0) {
            console.log("FIXING KEY");
            const newKey = thisValue;
            if (key !== newKey) {
              kvCache2.delete(key);
              key = thisValue;
              kvCache2.set(key, rowObj);
            }
          } else {
            console.info(`Calling kvCache.set(${key}`, rowObj);
            kvCache2.set(key, rowObj);
          }
        }
      };
    };
  }
  focusedCell?.focus();
}
__name(makeEditableRow, "makeEditableRow");

// ../NewDataTable/footer.ts
var addBtn2 = document.getElementById("addbtn");
var deleteBtn2 = document.getElementById("deletebtn");
var table = document.getElementById("table");
function buildFooter(kvCache2) {
  addBtn2.onclick = (_e) => {
    const newRow = Object.assign({}, kvCache2.schema.sample);
    const firstColName = Object.keys(newRow)[0];
    kvCache2.set(newRow[firstColName], newRow);
    buildDataTable(kvCache2);
    const lastRow = table.rows[table.rows.length - 1];
    lastRow.scrollIntoView({ behavior: "smooth" });
  };
  deleteBtn2.onclick = (_e) => {
    const id = focusedRow.dataset.cache_key;
    kvCache2.delete(id);
    buildDataTable(kvCache2);
  };
}
__name(buildFooter, "buildFooter");

// ../Shared/utils.ts
var $ = /* @__PURE__ */ __name((id) => document.getElementById(id), "$");
var on = /* @__PURE__ */ __name((elem, event, listener) => {
  return elem.addEventListener(event, listener);
}, "on");

// ../NewDataTable/customDataTable.ts
var tableBody;
function buildDataTable(kvCache2) {
  if (!tableBody) {
    tableBody = document.getElementById("table-body");
  }
  const querySet = kvCache2.querySet;
  tableBody.innerHTML = "";
  if (querySet) {
    for (let i = 0; i < querySet.length; i++) {
      const obj = querySet[i];
      let row = `<tr data-cache_key="${obj[kvCache2.columns[0].name]}">
        `;
      for (let i2 = 0; i2 < kvCache2.columns.length; i2++) {
        row += `<td data-column_index=${i2} data-column_id="${kvCache2.columns[i2].name}">${obj[kvCache2.columns[i2].name]}</td>
            `;
      }
      row += "</tr>";
      tableBody.innerHTML += row;
    }
  }
  for (let i = 0; i < kvCache2.columns.length; i++) {
    const el = document.getElementById(`header${i + 1}`);
    el.onclick = (_e) => {
      resetFocusedRow();
      buildDataTable(kvCache2);
    };
  }
  resetFocusedRow();
  buildFooter(kvCache2);
  makeEditableRow(kvCache2);
}
__name(buildDataTable, "buildDataTable");
signals.on("buildDataTableEV", "", (cache) => {
  buildDataTable(cache);
});

// ../NewDataTable/tableHead.ts
var tablehead = document.getElementById("table-head");
function buildTableHead(kvCache2) {
  const tr = '<tr class="headerRow">';
  let th = "";
  for (let i = 0; i < kvCache2.columns.length; i++) {
    th += `   <th id="header${i + 1}" data-index=${i} value=1>${kvCache2.columns[i].name}</th>`;
  }
  ;
  tablehead.innerHTML += tr + th;
  tablehead.innerHTML += `</tr>`;
}
__name(buildTableHead, "buildTableHead");

// ../NewDataTable/backup.ts
function initBackup(kvCache2) {
  document.addEventListener("keydown", function(event) {
    if (event.ctrlKey && event.key === "b") {
      event.preventDefault();
      if (kvCache2.CTX.DEV) console.log("Ctrl + B backup data");
      backupData(kvCache2);
    }
    if (event.ctrlKey && event.key === "r") {
      event.preventDefault();
      if (kvCache2.CTX.DEV) console.log("Ctrl + R restore data");
      restoreData();
    }
  });
}
__name(initBackup, "initBackup");
function backupData(kvCache2) {
  const jsonData = JSON.stringify(Array.from(kvCache2.dbMap.entries()));
  const link = document.createElement("a");
  const file = new Blob([jsonData], { type: "application/json" });
  link.href = URL.createObjectURL(file);
  link.download = "backup.json";
  link.click();
  URL.revokeObjectURL(link.href);
}
__name(backupData, "backupData");
function restoreData() {
  console.log("restoreData called");
  const fileload = document.getElementById("fileload");
  fileload?.click();
  fileload?.addEventListener("change", function() {
    const reader = new FileReader();
    reader.onload = function() {
      console.log("fired  restoreCacheEV");
      signals.fire("restoreCacheEV", "", reader.result);
    };
    reader.readAsText(fileload.files[0]);
  });
}
__name(restoreData, "restoreData");

// ../NewDataTable/dom.ts
var popupDialog = $("popupDialog");
var pinDialog = $("myDialog");
var pinInput = $("pin");
var popupText = $("popup_text");
var pinTryCount = 0;
var pinOK = false;
function initDOM(kvCache2) {
  buildTableHead(kvCache2);
  initBackup(kvCache2);
  on(popupDialog, "click", (event) => {
    event.preventDefault();
    popupDialog.close();
  });
  on(popupDialog, "close", (event) => {
    event.preventDefault();
    if (!pinOK) pinDialog.showModal();
  });
  on(popupDialog, "keyup", (event) => {
    event.preventDefault();
    popupDialog.close();
    if (!pinOK) pinDialog.showModal();
  });
  pinDialog?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
    }
  });
  on(pinInput, "keyup", (event) => {
    event.preventDefault();
    const pinIn = pinInput;
    const pinDia = pinDialog;
    const ecriptedPin = signals.xorEncrypt(pinIn.value);
    if (event.key === "Enter" || ecriptedPin === kvCache2.CTX.PIN) {
      pinTryCount += 1;
      if (ecriptedPin === kvCache2.CTX.PIN) {
        pinIn.value = "";
        pinOK = true;
        pinDia.close();
      } else {
        pinDia.close();
        pinIn.value = "";
        pinOK = false;
        if (popupText) popupText.textContent = pinTryCount === 3 ? `Incorrect pin entered ${pinTryCount} times!
 Please close this Page!` : `Incorrect pin entered ${pinTryCount} times!`;
        if (pinTryCount === 3) {
          document.body.innerHTML = `
               <h1>Three failed PIN attempts!</h1>
               <h1>Please close this page!</h1>`;
        } else {
          popupDialog.showModal();
        }
      }
    }
  });
  if (kvCache2.CTX.BYPASS_PIN) {
    pinOK = true;
  } else {
    pinDialog.showModal();
    pinInput.focus({ focusVisible: true });
  }
}
__name(initDOM, "initDOM");

// ../NewDataTable/components/Container.ts
var LayoutContainer = class extends HTMLElement {
  static {
    __name(this, "LayoutContainer");
  }
  constructor() {
    super();
    const containerTemplate = document.createElement("template");
    containerTemplate.innerHTML = `
        <slot></slot>
     `;
    const style = document.createElement("style");
    style.textContent = `
       :host {
         display: "block";
         width: 100%;
         max-width: 100%;
         margin-left: auto;
         margin-right: auto;
         background-color: "black";
       }
     `;
    const shadowRoot = this.attachShadow({ mode: "closed" });
    shadowRoot.appendChild(style);
    shadowRoot.appendChild(containerTemplate.content.cloneNode(true));
  }
};
customElements.define("layout-container", LayoutContainer);

// src/main.ts
var LOCAL = false;
var appContext = {
  BYPASS_PIN: LOCAL,
  // bypass user PIN input?
  DEV: LOCAL,
  // enable logging
  LOCAL_DB: LOCAL,
  // run from local dataService
  LocalDbURL: "http://localhost:9099/",
  RemoteDbURL: "https://kv-dt-rpc.deno.dev/",
  RpcURL: "SSERPC/kvRegistration",
  PIN: "",
  // Encrypted PIN from KvDB
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
};
var kvCache = new KvCache(appContext);
initDOM(kvCache);
