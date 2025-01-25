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
      if (this.DEV) console.log("setting pin");
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
    console.info(`Mutation event:`, result.type);
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
    signals.on("restoreCache", "", (result) => {
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
      signals.fire("buildDataTable", "", this);
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
    signals.fire("buildDataTable", "", this);
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

// ../CustomDataTable/mutableTableRow.ts
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
function makeEditableRow(kvCache) {
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
      if (target.attributes.getNamedItem("read-only")) {
        return;
      }
      focusedCell = e.target;
      focusedCell.setAttribute("contenteditable", "");
      focusedCell.className = "editable ";
      focusedCell.onblur = () => {
        let key = focusedRow.dataset.cache_key;
        const col = focusedCell.dataset.column_id || 0;
        const columnIndex = focusedCell.dataset.column_index || 0;
        console.log(`focusedCell.onblur key: ${key} col: ${col}, columnIndex ${columnIndex}`);
        console.info("kvCache", kvCache.dbMap);
        const rowObj = kvCache.get(key);
        const currentValue = rowObj[col];
        const thisValue = focusedCell.textContent;
        if (currentValue !== thisValue) {
          rowObj[col] = thisValue;
          if (columnIndex === 0) {
            console.log("FIXING KEY");
            const newKey = thisValue;
            if (key !== newKey) {
              kvCache.delete(key);
              key = thisValue;
              kvCache.set(key, rowObj);
            }
          }
        } else {
          kvCache.set(key, rowObj);
        }
      };
    };
  }
  focusedCell?.focus();
}
__name(makeEditableRow, "makeEditableRow");

// ../CustomDataTable/customDataTable.ts
var tablehead = document.getElementById("table-head");
var tableBody;
function buildTableHead(kvCache) {
  const tr = `
<tr class="headerRow">
`;
  let th = "";
  for (let i = 0; i < kvCache.columns.length; i++) {
    if (i === 1) {
      th += `    <th id="header${i + 1}" 
   data-index=${i} value=1> ${kvCache.columns[i].name} 
</th>
`;
    } else {
      th += `    <th id="header${i + 1}" 
   data-index=${i} value=1> ${kvCache.columns[i].name} 
</th>
`;
    }
  }
  tablehead.innerHTML += tr + th;
  tablehead.innerHTML += `</tr>`;
}
__name(buildTableHead, "buildTableHead");
function buildDataTable(kvCache) {
  if (!tableBody) {
    tableBody = document.getElementById("table-body");
  }
  const querySet = kvCache.querySet;
  tableBody.innerHTML = "";
  if (querySet) {
    for (let i = 0; i < querySet.length; i++) {
      const obj = querySet[i];
      let row = `<tr data-cache_key="${obj[kvCache.columns[0].name]}">
        `;
      for (let i2 = 0; i2 < kvCache.columns.length; i2++) {
        const ro = kvCache.columns[i2].readOnly ? " read-only" : "";
        row += `<td data-column_index=${i2} data-column_id="${kvCache.columns[i2].name}"${ro}>${obj[kvCache.columns[i2].name]}</td>
            `;
      }
      row += "</tr>";
      tableBody.innerHTML += row;
    }
  }
  for (let i = 0; i < kvCache.columns.length; i++) {
    const el = document.getElementById(`header${i + 1}`);
    el.onclick = (_e) => {
      resetFocusedRow();
      buildDataTable(kvCache);
    };
  }
  resetFocusedRow();
  buildFooter(kvCache);
  makeEditableRow(kvCache);
}
__name(buildDataTable, "buildDataTable");
var addBtn2 = document.getElementById("addbtn");
var deleteBtn2 = document.getElementById("deletebtn");
var table = document.getElementById("table");
function buildFooter(kvCache) {
  addBtn2.onclick = (_e) => {
    const newRow = Object.assign({}, kvCache.schema.sample);
    const firstColName = Object.keys(newRow)[0];
    kvCache.set(newRow[firstColName], newRow);
    buildDataTable(kvCache);
    const lastRow = table.rows[table.rows.length - 1];
    lastRow.scrollIntoView({ behavior: "smooth" });
  };
  deleteBtn2.onclick = (_e) => {
    const id = focusedRow.dataset.cache_key;
    kvCache.delete(id);
    buildDataTable(kvCache);
  };
}
__name(buildFooter, "buildFooter");
signals.on("buildDataTable", "", (cache) => {
  buildDataTable(cache);
});

// ../CustomDataTable/dom.ts
var $ = /* @__PURE__ */ __name((id) => document.getElementById(id), "$");
var on = /* @__PURE__ */ __name((elem, event, listener) => {
  return elem.addEventListener(event, listener);
}, "on");
var popupDialog = $("popupDialog");
var pinDialog = $("myDialog");
var pinInput = $("pin");
var popupText = $("popup_text");
var pinTryCount = 0;
var pinOK = false;
function initDOM(kvCache) {
  buildTableHead(kvCache);
  document.addEventListener("keydown", function(event) {
    if (event.ctrlKey && event.key === "b") {
      event.preventDefault();
      if (kvCache.CTX.DEV) console.log("Ctrl + B backup data");
      backupData(kvCache);
    }
    if (event.ctrlKey && event.key === "r") {
      event.preventDefault();
      if (kvCache.CTX.DEV) console.log("Ctrl + R restore data");
      restoreData();
    }
  });
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
    if (event.key === "Enter" || ecriptedPin === kvCache.CTX.PIN) {
      pinTryCount += 1;
      if (ecriptedPin === kvCache.CTX.PIN) {
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
  if (kvCache.CTX.BYPASS_PIN) {
    pinOK = true;
  } else {
    pinDialog.showModal();
    pinInput.focus({ focusVisible: true });
  }
}
__name(initDOM, "initDOM");
function backupData(kvCache) {
  const jsonData = JSON.stringify(Array.from(kvCache.dbMap.entries()));
  const link = document.createElement("a");
  const file = new Blob([jsonData], { type: "application/json" });
  link.href = URL.createObjectURL(file);
  link.download = "backup.json";
  link.click();
  URL.revokeObjectURL(link.href);
}
__name(backupData, "backupData");
function restoreData() {
  const fileload = document.getElementById("fileload");
  fileload?.click();
  fileload?.addEventListener("change", function() {
    const reader = new FileReader();
    reader.onload = function() {
      signals.fire("restoreCache", "", reader.result);
      globalThis.location.reload();
    };
    reader.readAsText(fileload.files[0]);
  });
}
__name(restoreData, "restoreData");

// ../shared/signals.ts
function buildEventBus2() {
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
__name(buildEventBus2, "buildEventBus");
var signals2 = buildEventBus2();

// src/main.ts
var BOOL = false;
var appContext = {
  BYPASS_PIN: BOOL,
  // bypass user PIN input?
  DEV: BOOL,
  // enable logging
  LOCAL_DB: BOOL,
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
initDOM(new KvCache(appContext));
