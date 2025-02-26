// deno-lint-ignore-file
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../Data/DataProvider/mod.js
var u = Object.defineProperty;
var o = /* @__PURE__ */ __name((c, t) => u(c, "name", { value: t, configurable: true }), "o");
var h = class {
  static {
    __name(this, "h");
  }
  static {
    o(this, "KvClient");
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
  constructor(t, e) {
    this.CTX = e, this.DEV = e.DEV, this.ServiceURL = e.LOCAL_DB ? e.LocalDbURL : e.RemoteDbURL, this.RegistrationURL = this.ServiceURL + e.RpcURL, this.kvCache = t, this.transactions = /* @__PURE__ */ new Map();
  }
  init() {
    let t = new EventSource(this.RegistrationURL);
    console.log("CONNECTING"), t.addEventListener("open", () => {
      this.callProcedure(this.ServiceURL, "GET", { key: ["PIN"] }).then((e) => {
        this.CTX.PIN = e.value, this.fetchQuerySet();
      });
    }), t.addEventListener("error", (e) => {
      switch (t.readyState) {
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
    }), t.addEventListener("message", (e) => {
      let s = JSON.parse(e.data), { txID: r, error: n, result: i } = s;
      if (r === -1 && this.handleMutation(i), !this.transactions.has(r)) return;
      let a2 = this.transactions.get(r);
      this.transactions.delete(r), a2 && a2(n, i);
    });
  }
  handleMutation(t) {
    console.info("Mutation event:", t);
  }
  async setKvPin(t) {
    let e = this.kvCache.encryptText(t);
    await this.callProcedure(this.ServiceURL, "SET", { key: ["PIN"], value: e }).then((s) => {
      this.DEV && console.log(`Set PIN ${t} to: `, e);
    });
  }
  addNewRecord() {
    let t = Object.assign({}, this.kvCache.schema.sampleRecord);
    for (let s in t) typeof t[s] == "object" && (t[s] = t[s][0]);
    let e = this.kvCache.schema.keyColumnName;
    this.kvCache.set(t[e], t);
  }
  async fetchQuerySet() {
    let t = this.kvCache;
    await this.callProcedure(this.ServiceURL, "GET", { key: [this.kvCache.schema.dbKey] }).then((e) => {
      e.value ? t.restoreCache(t.encryptText(e.value)) : (this.addNewRecord(), this.kvCache.UiHost.buildDataTable(t));
    });
  }
  get(t) {
    for (let e = 0; e < this.querySet.length; e++) {
      let s = this.querySet[e];
      if (s.id === t) return s;
    }
  }
  set(t) {
    try {
      this.callProcedure(this.ServiceURL, "SET", { key: [this.kvCache.schema.dbKey], value: t }).then((e) => (this.querySet = e.querySet, this.querySet));
    } catch (e) {
      return { Error: e };
    }
  }
  delete(t) {
    try {
      this.callProcedure(this.ServiceURL, "DELETE", { key: t, value: "" }).then((e) => {
        console.info("Delete result: ", e);
      });
    } catch (e) {
      return { Error: e };
    }
  }
  callProcedure(t, e, s) {
    let r = this.nextMsgID++;
    return new Promise((n, i) => {
      this.transactions.set(r, (a2, y2) => {
        if (a2) return i(new Error(a2));
        n(y2);
      }), fetch(t, { method: "POST", mode: "cors", body: JSON.stringify({ txID: r, procedure: e, params: s }) });
    });
  }
};
var l = class {
  static {
    __name(this, "l");
  }
  static {
    o(this, "KvCache");
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
  constructor(t, e, s) {
    this.UiHost = s, this.dbKey = `${t.dbKey}`, this.schema = t, this.CTX = e, this.DEV = this.CTX.DEV, this.callbacks = /* @__PURE__ */ new Map(), this.dbMap = /* @__PURE__ */ new Map(), this.columns = this.buildColumnSchema(this.schema.sampleRecord), this.kvClient = new h(this, e), this.kvClient.init();
  }
  encryptText(t) {
    let e = "", s = "ndhg";
    for (let r = 0; r < t.length; r++) e += String.fromCharCode(t.charCodeAt(r) ^ s.charCodeAt(r % s.length));
    return e;
  }
  restoreCache(t) {
    let e = JSON.parse(t);
    this.dbMap = new Map(e), this.persist(), this.hydrate() == "ok" && this.UiHost.buildDataTable(this);
  }
  buildColumnSchema(t) {
    let e = [];
    for (let [s, r] of Object.entries(t)) {
      let n = false;
      (typeof r == "number" && r === -1 || typeof r == "string" && r === "READONLY") && (n = true), e.push({ name: s, type: typeof r, defaultValue: r, readOnly: n });
    }
    return e;
  }
  persist(t = true) {
    t && (this.dbMap = new Map([...this.dbMap.entries()].sort()));
    let e = JSON.stringify(Array.from(this.dbMap.entries())), s = this.encryptText(e);
    this.kvClient.set(s);
  }
  hydrate() {
    return this.raw = [...this.dbMap.values()], this.querySet = [...this.raw], this.UiHost.buildDataTable(this), this.raw.length > 2 ? "ok" : "Not found";
  }
  resetData() {
    this.querySet = [...this.raw];
  }
  clean(t = null) {
    let e = /* @__PURE__ */ new Map();
    [...this.dbMap.keys()].forEach((r) => {
      r !== t && e.set(r, this.dbMap.get(r));
    }), this.dbMap = e, this.persist(true);
  }
  set(t, e) {
    try {
      return this.dbMap.set(t, e), this.persist(true), this.hydrate(), t;
    } catch (s) {
      return console.error("error setting "), "Error " + s;
    }
  }
  get(t) {
    try {
      return this.dbMap.get(t);
    } catch (e) {
      return "Error " + e;
    }
  }
  delete(t) {
    try {
      let e = this.dbMap.delete(t);
      return e === true && this.persist(true), this.hydrate(), e;
    } catch (e) {
      return "Error " + e;
    }
  }
};

// ../../Components/mod.js
var C = Object.defineProperty;
var d = /* @__PURE__ */ __name((h2, t) => C(h2, "name", { value: t, configurable: true }), "d");
var m = class {
  static {
    __name(this, "m");
  }
  static {
    d(this, "KvClient");
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
  constructor(t, e) {
    this.CTX = e, this.DEV = e.DEV, this.ServiceURL = e.LOCAL_DB ? e.LocalDbURL : e.RemoteDbURL, this.RegistrationURL = this.ServiceURL + e.RpcURL, this.kvCache = t, this.transactions = /* @__PURE__ */ new Map();
  }
  init() {
    let t = new EventSource(this.RegistrationURL);
    console.log("CONNECTING"), t.addEventListener("open", () => {
      this.callProcedure(this.ServiceURL, "GET", { key: ["PIN"] }).then((e) => {
        this.CTX.PIN = e.value, this.fetchQuerySet();
      });
    }), t.addEventListener("error", (e) => {
      switch (t.readyState) {
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
    }), t.addEventListener("message", (e) => {
      let s = JSON.parse(e.data), { txID: n, error: o2, result: r } = s;
      if (n === -1 && this.handleMutation(r), !this.transactions.has(n)) return;
      let i = this.transactions.get(n);
      this.transactions.delete(n), i && i(o2, r);
    });
  }
  handleMutation(t) {
    console.info("Mutation event:", t);
  }
  async setKvPin(t) {
    let e = this.kvCache.encryptText(t);
    await this.callProcedure(this.ServiceURL, "SET", { key: ["PIN"], value: e }).then((s) => {
      this.DEV && console.log(`Set PIN ${t} to: `, e);
    });
  }
  addNewRecord() {
    let t = Object.assign({}, this.kvCache.schema.sampleRecord);
    for (let s in t) typeof t[s] == "object" && (t[s] = t[s][0]);
    let e = this.kvCache.schema.keyColumnName;
    this.kvCache.set(t[e], t);
  }
  async fetchQuerySet() {
    let t = this.kvCache;
    await this.callProcedure(this.ServiceURL, "GET", { key: [this.kvCache.schema.dbKey] }).then((e) => {
      e.value ? t.restoreCache(t.encryptText(e.value)) : (this.addNewRecord(), this.kvCache.UiHost.buildDataTable(t));
    });
  }
  get(t) {
    for (let e = 0; e < this.querySet.length; e++) {
      let s = this.querySet[e];
      if (s.id === t) return s;
    }
  }
  set(t) {
    try {
      this.callProcedure(this.ServiceURL, "SET", { key: [this.kvCache.schema.dbKey], value: t }).then((e) => (this.querySet = e.querySet, this.querySet));
    } catch (e) {
      return { Error: e };
    }
  }
  delete(t) {
    try {
      this.callProcedure(this.ServiceURL, "DELETE", { key: t, value: "" }).then((e) => {
        console.info("Delete result: ", e);
      });
    } catch (e) {
      return { Error: e };
    }
  }
  callProcedure(t, e, s) {
    let n = this.nextMsgID++;
    return new Promise((o2, r) => {
      this.transactions.set(n, (i, c) => {
        if (i) return r(new Error(i));
        o2(c);
      }), fetch(t, { method: "POST", mode: "cors", body: JSON.stringify({ txID: n, procedure: e, params: s }) });
    });
  }
};
var y = class {
  static {
    __name(this, "y");
  }
  static {
    d(this, "KvCache");
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
  constructor(t, e, s) {
    this.UiHost = s, this.dbKey = `${t.dbKey}`, this.schema = t, this.CTX = e, this.DEV = this.CTX.DEV, this.callbacks = /* @__PURE__ */ new Map(), this.dbMap = /* @__PURE__ */ new Map(), this.columns = this.buildColumnSchema(this.schema.sampleRecord), this.kvClient = new m(this, e), this.kvClient.init();
  }
  encryptText(t) {
    let e = "", s = "ndhg";
    for (let n = 0; n < t.length; n++) e += String.fromCharCode(t.charCodeAt(n) ^ s.charCodeAt(n % s.length));
    return e;
  }
  restoreCache(t) {
    let e = JSON.parse(t);
    this.dbMap = new Map(e), this.persist(), this.hydrate() == "ok" && this.UiHost.buildDataTable(this);
  }
  buildColumnSchema(t) {
    let e = [];
    for (let [s, n] of Object.entries(t)) {
      let o2 = false;
      (typeof n == "number" && n === -1 || typeof n == "string" && n === "READONLY") && (o2 = true), e.push({ name: s, type: typeof n, defaultValue: n, readOnly: o2 });
    }
    return e;
  }
  persist(t = true) {
    t && (this.dbMap = new Map([...this.dbMap.entries()].sort()));
    let e = JSON.stringify(Array.from(this.dbMap.entries())), s = this.encryptText(e);
    this.kvClient.set(s);
  }
  hydrate() {
    return this.raw = [...this.dbMap.values()], this.querySet = [...this.raw], this.UiHost.buildDataTable(this), this.raw.length > 2 ? "ok" : "Not found";
  }
  resetData() {
    this.querySet = [...this.raw];
  }
  clean(t = null) {
    let e = /* @__PURE__ */ new Map();
    [...this.dbMap.keys()].forEach((n) => {
      n !== t && e.set(n, this.dbMap.get(n));
    }), this.dbMap = e, this.persist(true);
  }
  set(t, e) {
    try {
      return this.dbMap.set(t, e), this.persist(true), this.hydrate(), t;
    } catch (s) {
      return console.error("error setting "), "Error " + s;
    }
  }
  get(t) {
    try {
      return this.dbMap.get(t);
    } catch (e) {
      return "Error " + e;
    }
  }
  delete(t) {
    try {
      let e = this.dbMap.delete(t);
      return e === true && this.persist(true), this.hydrate(), e;
    } catch (e) {
      return "Error " + e;
    }
  }
};
var l2;
var p;
var a;
var b = class extends HTMLElement {
  static {
    __name(this, "b");
  }
  static {
    d(this, "TableComponent");
  }
  static register() {
    customElements.define("table-component", this);
  }
  footer;
  table;
  tablehead;
  tableBody;
  shadow;
  constructor() {
    super();
    let e = HTMLElement.prototype.hasOwnProperty("attachInternals") ? this.attachInternals() : void 0;
    if (this.shadow = e?.shadowRoot, !this.shadow) {
      this.shadow = this.attachShadow({ mode: "closed" });
      let s = document.getElementById("tableTemplate");
      this.shadow.append(s.content.cloneNode(true));
    }
  }
  init(t, e) {
    a = new y(t, e, this), this.table = this.shadow.getElementById("table"), this.tableBody = this.shadow.getElementById("table-body"), this.tableBody.addEventListener("click", this), this.tablehead = this.shadow.getElementById("table-head"), this.footer = document.getElementById("footer-component"), this.buildTableHead(), document.getElementById("pin-component").init(a);
  }
  handleEvent(t) {
    console.log(t.type), this[`handle${t.type}`](t);
  }
  handleclick(t) {
    let e = t.target;
    console.info("row click", e), console.info("row click", e.dataset), p && l2 && e !== l2 && (l2.removeAttribute("contenteditable"), l2.className = "", l2.oninput = null), p?.classList.remove("selected_row"), p = e.parentElement, p.classList.add("selected_row"), a.CTX.FocusedKey = p.dataset.cache_key, this.footer.resetButtons(false), l2 = e, l2.setAttribute("contenteditable", ""), l2.className = "editable ";
    let s = p.dataset.cache_key, n = l2.dataset.column_id, o2 = parseInt(l2.dataset.column_index) || 0, r = a.get(s);
    l2.onblur = () => {
      let i = l2.textContent;
      if (l2.tagName === "SELECT") {
        n = l2.parentElement.dataset.column_id || "", o2 = parseInt(l2.parentElement.dataset.column_index) || 0;
        let c = l2;
        i = c.options[c.selectedIndex].text;
      }
      r[n] !== i && (r[n] = i, o2 === 0 ? s !== i && (a.delete(s), s = i, a.set(s, r)) : a.set(s, r));
    };
  }
  scrollToBottom() {
    this.tableBody.rows[this.tableBody.rows.length - 1].scrollIntoView({ behavior: "smooth" });
  }
  buildTableHead() {
    let t = '<tr class="headerRow">', e = "";
    for (let s = 0; s < a.columns.length; s++) e += `   <th id="header${s + 1}" data-index=${s} value=1>${a.columns[s].name}</th>`;
    this.tablehead.innerHTML += t + e + "</tr>";
    for (let s = 0; s < a.columns.length; s++) {
      let n = this.shadow.getElementById(`header${s + 1}`);
      n.onclick = (o2) => {
        this.resetFocusedRow(), this.buildDataTable();
      };
    }
  }
  buildDataTable() {
    this.tableBody.innerHTML = "", a.querySet && this.buildRows(), this.resetFocusedRow(), l2?.focus();
  }
  buildRows() {
    let t = a.querySet;
    if (t) for (let e = 0; e < t.length; e++) {
      let s = t[e], n = `<tr data-cache_key="${s[a.columns[0].name]}">`;
      for (let o2 = 0; o2 < a.columns.length; o2++) {
        let r = a.columns[o2].name;
        switch (a.columns[o2].type) {
          case "boolean":
            let i = s[r] === "true" ? "checked" : "";
            n += `<td data-column_index=${o2} 
                  data-column_id="${r}"><input type="checkbox" ${i}></td>`;
            break;
          case "number":
            n += `<td data-column_index=${o2} 
                  data-column_id="${r}">${parseFloat(s[r])}</td>`;
            break;
          case "object":
            n += `<td data-column_index=${o2} 
                  data-column_id="${r}">${this.buildSelect(a.columns[o2].defaultValue, s[r])}</td>`;
            break;
          default:
            n += `<td data-column_index=${o2} 
                  data-column_id="${r}">${s[r]}</td>`;
            break;
        }
      }
      n += "</tr>", this.tableBody.innerHTML += n;
    }
  }
  buildSelect(t, e) {
    let s = `<select>
   `;
    return t.forEach((n) => {
      e === n ? s += `<option value="${n}" selected>${n}</option>
         ` : s += `<option value="${n}">${n}</option>
      `;
    }), s += "</select>", s;
  }
  resetFocusedRow() {
    this.footer.resetButtons(true), p = null;
  }
};
b.register();
var g = class extends HTMLElement {
  static {
    __name(this, "g");
  }
  static {
    d(this, "FooterComponent");
  }
  static register() {
    customElements.define("footer-component", this);
  }
  addBtn;
  deleteBtn;
  shadow;
  table;
  constructor() {
    super();
    let e = HTMLElement.prototype.hasOwnProperty("attachInternals") ? this.attachInternals() : void 0;
    if (this.shadow = e?.shadowRoot, !this.shadow) {
      this.shadow = this.attachShadow({ mode: "closed" });
      let s = document.getElementById("footerTemplate");
      this.shadow.append(s.content.cloneNode(true));
    }
  }
  connectedCallback() {
    this.table = document.getElementById("table-component"), this.addBtn = this.shadow.getElementById("addbtn"), this.addBtn.onclick = (e) => {
      let s = Object.assign({}, a.schema.sampleRecord);
      for (let o2 in s) typeof s[o2] == "object" && (s[o2] = s[o2][0]);
      let n = a.schema.keyColumnName;
      a.set(s[n], s), this.table.buildDataTable(), this.table.scrollToBottom();
    }, this.deleteBtn = this.shadow.getElementById("deletebtn"), this.deleteBtn.onclick = (e) => {
      a.delete(a.CTX.FocusedKey), this.table.buildDataTable();
    };
    let t = this.shadow.getElementById("fileload");
    document.addEventListener("keydown", function(e) {
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        let s = JSON.stringify(Array.from(a.dbMap.entries())), n = document.createElement("a"), o2 = new Blob([s], { type: "application/json" });
        n.href = URL.createObjectURL(o2), n.download = "backup.json", n.click(), URL.revokeObjectURL(n.href);
      }
      e.ctrlKey && e.key === "r" && (e.preventDefault(), t.click(), t.addEventListener("change", function() {
        let s = new FileReader();
        s.onload = function() {
          a.restoreCache(s.result);
        }, s.readAsText(t.files[0]);
      }));
    });
  }
  resetButtons(t) {
    t ? (this.deleteBtn.setAttribute("hidden", ""), this.addBtn.removeAttribute("hidden")) : (this.addBtn.setAttribute("hidden", ""), this.deleteBtn.removeAttribute("hidden"));
  }
};
g.register();
var f = d((h2, t, e) => h2.addEventListener(t, e), "on");
var E = class extends HTMLElement {
  static {
    __name(this, "E");
  }
  static {
    d(this, "PinComponent");
  }
  static register() {
    customElements.define("pin-component", this);
  }
  shadow;
  constructor() {
    super();
    let e = HTMLElement.prototype.hasOwnProperty("attachInternals") ? this.attachInternals() : void 0;
    if (this.shadow = e?.shadowRoot, !this.shadow) {
      this.shadow = this.attachShadow({ mode: "open" });
      let s = document.getElementById("pinTemplate");
      this.shadow.append(s.content.cloneNode(true));
    }
  }
  init(t) {
    let e = this.shadow.getElementById("popupDialog"), s = this.shadow.getElementById("pinDialog"), n = this.shadow.getElementById("pin"), o2 = this.shadow.getElementById("popup_text");
    f(e, "click", (c) => {
      c.preventDefault(), e.close();
    });
    let r = 0, i = false;
    f(e, "close", (c) => {
      c.preventDefault(), i || s.showModal();
    }), f(e, "keyup", (c) => {
      c.preventDefault(), e.close(), i || s.showModal();
    }), s?.addEventListener("keydown", (c) => {
      c.key === "Escape" && c.preventDefault();
    }), f(n, "keyup", (c) => {
      c.preventDefault();
      let u2 = n, T = s, w = t.encryptText(u2.value);
      (c.key === "Enter" || w === t.CTX.PIN) && (r += 1, w === t.CTX.PIN ? (u2.value = "", i = true, T.close()) : (T.close(), u2.value = "", i = false, o2 && (o2.textContent = r === 3 ? `Incorrect pin entered ${r} times!
       Please close this Page!` : `Incorrect pin entered ${r} times!`), r === 3 ? document.body.innerHTML = `
                     <h1>Three failed PIN attempts!</h1>
                     <h1>Please close this page!</h1>` : e.showModal()));
    }), t.CTX.BYPASS_PIN ? i = true : (s.showModal(), n.focus({ focusVisible: true }));
  }
};
E.register();
export {
  g as FooterComponent,
  l as KvCache,
  h as KvClient,
  E as PinComponent,
  b as TableComponent,
  l2 as focusedCell,
  p as focusedRow,
  a as kvCache,
  f as on
};
