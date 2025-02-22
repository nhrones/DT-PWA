// deno-lint-ignore-file
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../Data/DataProvider/kvClient.ts
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
    console.info(`Mutation event:`, result);
  }
  /** set Kv Pin */
  async setKvPin(rawpin) {
    const pin = this.kvCache.encryptText(rawpin);
    await this.callProcedure(this.ServiceURL, "SET", { key: ["PIN"], value: pin }).then((_result) => {
      if (this.DEV) console.log(`Set PIN ${rawpin} to: `, pin);
    });
  }
  addNewRecord() {
    const newRow = Object.assign({}, this.kvCache.schema.sampleRecord);
    for (const property in newRow) {
      if (typeof newRow[property] === "object") {
        newRow[property] = newRow[property][0];
      }
    }
    const keyColName = this.kvCache.schema.keyColumnName;
    this.kvCache.set(newRow[keyColName], newRow);
  }
  /** fetch a querySet */
  async fetchQuerySet() {
    const cache = this.kvCache;
    await this.callProcedure(
      this.ServiceURL,
      "GET",
      { key: [this.kvCache.schema.dbKey] }
    ).then((result) => {
      if (result.value) {
        cache.restoreCache(cache.encryptText(result.value));
      } else {
        this.addNewRecord();
        this.kvCache.UiHost.buildDataTable(cache);
      }
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
          key: [this.kvCache.schema.dbKey],
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
  /** get row from key */
  delete(key) {
    try {
      this.callProcedure(
        this.ServiceURL,
        "DELETE",
        {
          key,
          value: ""
        }
      ).then((result) => {
        console.info("Delete result: ", result);
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

// ../../Data/DataProvider/kvCache.ts
var KvCache = class {
  static {
    __name(this, "KvCache");
  }
  UiHost;
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
  constructor(schema, ctx, uiHost) {
    console.info("cache.ctor ctx:", ctx);
    this.UiHost = uiHost;
    this.dbKey = `${schema.dbKey}`;
    this.schema = schema;
    this.CTX = ctx;
    this.DEV = this.CTX.DEV;
    this.callbacks = /* @__PURE__ */ new Map();
    this.dbMap = /* @__PURE__ */ new Map();
    this.columns = this.buildColumnSchema(this.schema.sampleRecord);
    this.kvClient = new KvClient(this, ctx);
    this.kvClient.init();
  }
  /** xor encryption */
  encryptText(text) {
    let result = "";
    const key = "ndhg";
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  }
  /** restore our cache from a json string */
  restoreCache(records) {
    const pwaObj = JSON.parse(records);
    this.dbMap = new Map(pwaObj);
    this.persist();
    const result = this.hydrate();
    if (result == "ok") {
      this.UiHost.buildDataTable(this);
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
        name: key,
        type: typeof value,
        defaultValue: value,
        readOnly: read_only
      });
    }
    return columns;
  }
  /**
   * Persist the current dbMap to Kv   
   * This is called for any mutation of the dbMap (set/delete)
   */
  persist(order = true) {
    if (order) {
      this.dbMap = new Map([...this.dbMap.entries()].sort());
    }
    const mapString = JSON.stringify(Array.from(this.dbMap.entries()));
    const encrypted = this.encryptText(mapString);
    this.kvClient.set(encrypted);
  }
  /** hydrate a dataset from a single raw record stored in kvDB */
  hydrate() {
    this.raw = [...this.dbMap.values()];
    this.querySet = [...this.raw];
    this.UiHost.buildDataTable(this);
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

// ../../Components/TableComponent.ts
var kvCache;
var TableComponent = class extends HTMLElement {
  static {
    __name(this, "TableComponent");
  }
  static register() {
    customElements.define("table-component", this);
  }
  footer;
  table;
  tablehead;
  tableBody;
  focusedRow;
  focusedCell;
  shadow;
  constructor() {
    super();
    const supportsDeclarative = HTMLElement.prototype.hasOwnProperty("attachInternals");
    const internals = supportsDeclarative ? this.attachInternals() : void 0;
    this.shadow = internals?.shadowRoot;
    if (!this.shadow) {
      this.shadow = this.attachShadow({ mode: "closed" });
      const TableTemplate = document.getElementById("tableTemplate");
      this.shadow.append(TableTemplate.content.cloneNode(true));
    }
  }
  init(schema, appContext) {
    kvCache = new KvCache(schema, appContext, this);
    this.table = this.shadow.getElementById("table");
    this.tableBody = this.shadow.getElementById("table-body");
    this.tablehead = this.shadow.getElementById("table-head");
    this.footer = document.getElementById("footer-component");
    this.buildTableHead();
    const pinComponent = document.getElementById("pin-component");
    pinComponent.init(kvCache);
  }
  /** scrollToBottom */
  scrollToBottom() {
    const lastRow = this.tableBody.rows[this.tableBody.rows.length - 1];
    lastRow.scrollIntoView({ behavior: "smooth" });
  }
  /** Build the Table header */
  buildTableHead() {
    const tr = '<tr class="headerRow">';
    let th = "";
    for (let i = 0; i < kvCache.columns.length; i++) {
      th += `   <th id="header${i + 1}" data-index=${i} value=1>${kvCache.columns[i].name}</th>`;
    }
    ;
    this.tablehead.innerHTML += tr + th;
    this.tablehead.innerHTML += `</tr>`;
  }
  /** build an HTML table */
  buildDataTable() {
    const querySet = kvCache.querySet;
    this.tableBody.innerHTML = "";
    if (querySet) {
      for (let i = 0; i < querySet.length; i++) {
        const obj = querySet[i];
        let row = `<tr data-cache_key="${obj[kvCache.columns[0].name]}">`;
        for (let i2 = 0; i2 < kvCache.columns.length; i2++) {
          if (kvCache.columns[i2].type === "boolean") {
            if (obj[kvCache.columns[i2].name] === "true") {
              row += `<td data-column_index=${i2} 
               data-column_id="${kvCache.columns[i2].name}"><input type="checkbox" checked></td>`;
            } else {
              row += `<td data-column_index=${i2} 
               data-column_id="${kvCache.columns[i2].name}"><input type="checkbox"></td>`;
            }
          } else if (kvCache.columns[i2].type === "object") {
            row += `<td data-column_index=${i2} 
               data-column_id="${kvCache.columns[i2].name}">${this.buildSelect(kvCache.columns[i2].defaultValue, obj[kvCache.columns[i2].name])}</td>`;
          } else {
            row += `<td data-column_index=${i2} 
               data-column_id="${kvCache.columns[i2].name}">${obj[kvCache.columns[i2].name]}</td>`;
          }
        }
        row += "</tr>";
        this.tableBody.innerHTML += row;
      }
    }
    for (let i = 0; i < kvCache.columns.length; i++) {
      const el = this.shadow.getElementById(`header${i + 1}`);
      el.onclick = (_e) => {
        this.resetFocusedRow();
        this.buildDataTable();
      };
    }
    this.resetFocusedRow();
    this.makeEditableRow(kvCache);
  }
  /** build table row event handlers for editing */
  makeEditableRow(kvCache2) {
    const rows = this.shadow.querySelectorAll("tr");
    for (const row of Array.from(rows)) {
      if (row.className.startsWith("headerRow")) continue;
      row.onclick = (e) => {
        const { target } = e;
        if (this.focusedRow && this.focusedCell && target !== this.focusedCell) {
          this.focusedCell.removeAttribute("contenteditable");
          this.focusedCell.className = "";
          this.focusedCell.oninput = null;
        }
        this.focusedRow?.classList.remove("selected_row");
        this.focusedRow = row;
        this.focusedRow.classList.add("selected_row");
        kvCache2.CTX.FocusedKey = this.focusedRow.dataset.cache_key;
        this.footer.resetButtons(false);
        this.focusedCell = target;
        this.focusedCell.setAttribute("contenteditable", "");
        this.focusedCell.className = "editable ";
        let key = this.focusedRow.dataset.cache_key;
        let columnID = this.focusedCell.dataset.column_id;
        let columnIndex = parseInt(this.focusedCell.dataset.column_index) || 0;
        let rowObj = kvCache2.get(key);
        this.focusedCell.onblur = () => {
          let thisValue = this.focusedCell.textContent;
          if (this.focusedCell.tagName === "SELECT") {
            columnID = this.focusedCell.parentElement.dataset.column_id;
            columnIndex = parseInt(this.focusedCell.parentElement.dataset.column_index) || 0;
            const theCell = this.focusedCell;
            let text = theCell.options[theCell.selectedIndex].text;
            thisValue = text;
          }
          const currentValue = rowObj[columnID];
          if (currentValue !== thisValue) {
            rowObj[columnID] = thisValue;
            if (columnIndex === 0) {
              const newKey = thisValue;
              if (key !== newKey) {
                kvCache2.delete(key);
                key = thisValue;
                kvCache2.set(key, rowObj);
              }
            } else {
              kvCache2.set(key, rowObj);
            }
          }
        };
      };
    }
    this.focusedCell?.focus();
  }
  /** Build select element */
  buildSelect(options, selected) {
    let frag = `<select>
   `;
    options.forEach((option) => {
      if (selected === option) {
        frag += `<option value="${option}" selected>${option}</option>
         `;
      } else {
        frag += `<option value="${option}">${option}</option>
      `;
      }
    });
    frag += "</select>";
    return frag;
  }
  /** reset any existing focused row */
  resetFocusedRow() {
    this.footer.resetButtons(true);
    this.focusedRow = null;
  }
};
TableComponent.register();

// ../../Components/FootComponent.ts
var FooterComponent = class extends HTMLElement {
  static {
    __name(this, "FooterComponent");
  }
  static register() {
    customElements.define("footer-component", this);
  }
  addBtn;
  deleteBtn;
  shadow;
  table;
  /** ctor */
  constructor() {
    super();
    const supportsDeclarative = HTMLElement.prototype.hasOwnProperty("attachInternals");
    const internals = supportsDeclarative ? this.attachInternals() : void 0;
    this.shadow = internals?.shadowRoot;
    if (!this.shadow) {
      this.shadow = this.attachShadow({ mode: "closed" });
      const FooterTemplate = document.getElementById("footerTemplate");
      this.shadow.append(FooterTemplate.content.cloneNode(true));
    }
  }
  /** 
   * Setup the `add` and `delete` button event handlers.
  */
  connectedCallback() {
    this.table = document.getElementById("table-component");
    this.addBtn = this.shadow.getElementById("addbtn");
    this.addBtn.onclick = (_e) => {
      const newRow = Object.assign({}, kvCache.schema.sampleRecord);
      for (const property in newRow) {
        if (typeof newRow[property] === "object") {
          newRow[property] = newRow[property][0];
        }
      }
      const keyColName = kvCache.schema.keyColumnName;
      kvCache.set(newRow[keyColName], newRow);
      this.table.buildDataTable();
      this.table.scrollToBottom();
    };
    this.deleteBtn = this.shadow.getElementById("deletebtn");
    this.deleteBtn.onclick = (_e) => {
      kvCache.delete(kvCache.CTX.FocusedKey);
      this.table.buildDataTable();
    };
    let fileLoad = this.shadow.getElementById("fileload");
    document.addEventListener("keydown", function(event) {
      if (event.ctrlKey && event.key === "b") {
        event.preventDefault();
        const jsonData = JSON.stringify(Array.from(kvCache.dbMap.entries()));
        const link = document.createElement("a");
        const file = new Blob([jsonData], { type: "application/json" });
        link.href = URL.createObjectURL(file);
        link.download = "backup.json";
        link.click();
        URL.revokeObjectURL(link.href);
      }
      if (event.ctrlKey && event.key === "r") {
        event.preventDefault();
        fileLoad.click();
        fileLoad.addEventListener("change", function() {
          const reader = new FileReader();
          reader.onload = function() {
            kvCache.restoreCache(reader.result);
          };
          reader.readAsText(fileLoad.files[0]);
        });
      }
    });
  }
  /** reset footer buttons */
  resetButtons(reset) {
    if (reset) {
      this.deleteBtn.setAttribute("hidden", "");
      this.addBtn.removeAttribute("hidden");
    } else {
      this.addBtn.setAttribute("hidden", "");
      this.deleteBtn.removeAttribute("hidden");
    }
  }
};
FooterComponent.register();

// ../../Components/PinComponent.ts
var on = /* @__PURE__ */ __name((elem, event, listener) => {
  return elem.addEventListener(event, listener);
}, "on");
var PinComponent = class extends HTMLElement {
  static {
    __name(this, "PinComponent");
  }
  static register() {
    customElements.define("pin-component", this);
  }
  shadow;
  constructor() {
    super();
    const supportsDeclarative = HTMLElement.prototype.hasOwnProperty("attachInternals");
    const internals = supportsDeclarative ? this.attachInternals() : void 0;
    this.shadow = internals?.shadowRoot;
    if (!this.shadow) {
      this.shadow = this.attachShadow({ mode: "open" });
      const PinTemplate = document.getElementById("pinTemplate");
      this.shadow.append(PinTemplate.content.cloneNode(true));
    }
  }
  init(kvCache2) {
    const popupDialog = this.shadow.getElementById("popupDialog");
    const pinDialog = this.shadow.getElementById("pinDialog");
    const pinInput = this.shadow.getElementById("pin");
    const popupText = this.shadow.getElementById("popup_text");
    on(popupDialog, "click", (event) => {
      event.preventDefault();
      popupDialog.close();
    });
    let pinTryCount = 0;
    let pinOK = false;
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
      const ecriptedPin = kvCache2.encryptText(pinIn.value);
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
};
PinComponent.register();
export {
  FooterComponent,
  KvCache,
  KvClient,
  PinComponent,
  TableComponent,
  kvCache,
  on
};
