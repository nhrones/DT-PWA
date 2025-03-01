// deno-lint-ignore-file
var T=Object.defineProperty;var h=(i,t)=>T(i,"name",{value:t,configurable:!0});var y=h((i,t,e)=>i.addEventListener(t,e),"on"),v=class extends HTMLElement{static{h(this,"PinComponent")}static register(){customElements.define("pin-component",this)}shadow;constructor(){super(),this.shadow=this.attachInternals()?.shadowRoot}init(){return new Promise((t,e)=>{let n="]]YT",s=this.shadow.getElementById("popupDialog"),o=this.shadow.getElementById("pinDialog"),a=this.shadow.getElementById("pin"),r=this.shadow.getElementById("popup_text");y(s,"click",c=>{c.preventDefault(),s.close()});let d=0,m=!1;y(s,"close",c=>{c.preventDefault(),m||o.showModal()}),y(s,"keyup",c=>{c.preventDefault(),s.close(),m||o.showModal()}),o?.addEventListener("keydown",c=>{c.key==="Escape"&&c.preventDefault()}),y(a,"keyup",c=>{c.preventDefault();let k=this.encryptText(a.value);(c.key==="Enter"||k===n)&&(d+=1,k===n?(a.value="",m=!0,o.close(),t("ok")):(o.close(),a.value="",m=!1,r&&(r.textContent=d===3?`Incorrect pin entered ${d} times!
       Please close this Page!`:`Incorrect pin entered ${d} times!`),d===3?(document.body.innerHTML=`
                     <h1>Three failed PIN attempts!</h1>
                     <h1>Please close this page!</h1>`,e("Three failed PIN attempts! You are not authorized!")):s.showModal()))}),o.showModal(),a.focus({focusVisible:!0}),document.addEventListener("keydown",function(c){c.ctrlKey&&c.key==="x"&&(c.preventDefault(),m=!0,o.close())})})}encryptText(t){let e="",n="ndhg";for(let s=0;s<t.length;s++)e+=String.fromCharCode(t.charCodeAt(s)^n.charCodeAt(s%n.length));return e}};v.register();var w=!1,f=class{static{h(this,"KvClient")}nextMsgID=0;querySet=[];transactions=new Map;currentPage=1;focusedRow=null;kvCache;CTX;ServiceURL;RegistrationURL;constructor(t,e){this.CTX=e,this.ServiceURL=e.LOCAL_DB?e.LocalDbURL:e.RemoteDbURL,this.RegistrationURL=this.ServiceURL+e.RpcURL,this.kvCache=t,this.transactions=new Map}init(t){let e=new EventSource(this.RegistrationURL);console.log("CONNECTING"),e.addEventListener("open",()=>{this.callProcedure(this.ServiceURL,"GET",{key:["PIN"]}).then(n=>{t=n.value,this.fetchQuerySet()})}),e.addEventListener("error",n=>{switch(e.readyState){case EventSource.OPEN:console.log("CONNECTED");break;case EventSource.CONNECTING:console.log("CONNECTING");break;case EventSource.CLOSED:console.log("DISCONNECTED");break}}),e.addEventListener("message",n=>{let s=JSON.parse(n.data),{txID:o,error:a,result:r}=s;if(o===-1&&this.handleMutation(r),!this.transactions.has(o))return;let d=this.transactions.get(o);this.transactions.delete(o),d&&d(a,r)})}handleMutation(t){console.info("Mutation event:",t)}async setKvPin(t){let e=this.kvCache.encryptText(t);await this.callProcedure(this.ServiceURL,"SET",{key:["PIN"],value:e}).then(n=>{w&&console.log(`Set PIN ${t} to: `,e)})}addNewRecord(){let t=Object.assign({},this.kvCache.schema.sampleRecord);for(let n in t)typeof t[n]=="object"&&(t[n]=t[n][0]);let e=this.kvCache.schema.keyColumnName;this.kvCache.set(t[e],t)}async fetchQuerySet(){let t=this.kvCache;await this.callProcedure(this.ServiceURL,"GET",{key:[this.kvCache.schema.dbKey]}).then(e=>{e.value?t.restoreCache(t.encryptText(e.value)):(this.addNewRecord(),u.fire("buildDataTableEV","",this.kvCache))})}get(t){for(let e=0;e<this.querySet.length;e++){let n=this.querySet[e];if(n.id===t)return n}}set(t){try{this.callProcedure(this.ServiceURL,"SET",{key:[this.kvCache.schema.dbKey],value:t}).then(e=>(this.querySet=e.querySet,this.querySet))}catch(e){return{Error:e}}}delete(t){try{this.callProcedure(this.ServiceURL,"DELETE",{key:t,value:""}).then(e=>{console.info("Delete result: ",e)})}catch(e){return{Error:e}}}callProcedure(t,e,n){let s=this.nextMsgID++;return new Promise((o,a)=>{this.transactions.set(s,(r,d)=>{if(r)return a(new Error(r));o(d)}),fetch(t,{method:"POST",mode:"cors",body:JSON.stringify({txID:s,procedure:e,params:n})})})}};var b=class{static{h(this,"KvCache")}dbKey="";schema;nextMsgID=0;querySet=[];callbacks;columns=[];kvClient;dbMap;raw=[];constructor(t,e,n){this.dbKey=`${t.dbKey}`,this.schema=t,this.callbacks=new Map,this.dbMap=new Map,this.columns=this.buildColumnSchema(this.schema.sampleRecord),this.kvClient=new f(this,e),this.kvClient.init(n)}encryptText(t){let e="",n="ndhg";for(let s=0;s<t.length;s++)e+=String.fromCharCode(t.charCodeAt(s)^n.charCodeAt(s%n.length));return e}restoreCache(t){let e=JSON.parse(t);this.dbMap=new Map(e),this.persist(),this.hydrate()=="ok"&&u.fire("buildDataTableEV","",this)}buildColumnSchema(t){let e=[];for(let[n,s]of Object.entries(t)){let o=!1;(typeof s=="number"&&s===-1||typeof s=="string"&&s==="READONLY")&&(o=!0),e.push({name:n,type:typeof s,defaultValue:s,readOnly:o})}return e}persist(t=!0){t&&(this.dbMap=new Map([...this.dbMap.entries()].sort()));let e=JSON.stringify(Array.from(this.dbMap.entries())),n=this.encryptText(e);this.kvClient.set(n)}hydrate(){return this.raw=[...this.dbMap.values()],this.querySet=[...this.raw],u.fire("buildDataTableEV","",this),this.raw.length>2?"ok":"Not found"}resetData(){this.querySet=[...this.raw]}clean(t=null){let e=new Map;[...this.dbMap.keys()].forEach(s=>{s!==t&&e.set(s,this.dbMap.get(s))}),this.dbMap=e,this.persist(!0)}set(t,e){try{return this.dbMap.set(t,e),this.persist(!0),this.hydrate(),t}catch(n){return console.error("error setting "),"Error "+n}}get(t){try{return this.dbMap.get(t)}catch(e){return"Error "+e}}delete(t){try{let e=this.dbMap.delete(t);return e===!0&&this.persist(!0),this.hydrate(),e}catch(e){return"Error "+e}}};function L(){let i=new Map;return{on(e,n,s){let o=e+"-"+n;i.has(o)?i.get(o).push(s):i.set(o,[s])},fire(e,n,s){let o=e+"-"+n,a=i.get(o);if(a)for(let r of a)r(s)}}}h(L,"newEventBus");var u=L();var l,p,g,C=class extends HTMLElement{static{h(this,"TableComponent")}static register(){customElements.define("table-component",this)}kvCache;footer;table;tablehead;tableBody;shadow;constructor(){super(),this.shadow=this.attachInternals()?.shadowRoot}init(t,e,n){return u.on("buildDataTableEV","",()=>{this.buildDataTable()}),g=e,this.kvCache=new b(t,n),this.table=this.shadow.getElementById("table"),this.tableBody=this.shadow.getElementById("table-body"),this.tableBody.addEventListener("click",this),this.tablehead=this.shadow.getElementById("table-head"),this.footer=document.getElementById("footer-component"),this.footer.init(this,t),this.buildTableHead(),this}handleEvent(t){this[`handle${t.type}`](t)}handleclick(t){let e=t.target;console.info("row click",e),console.info("row click",e.dataset),p&&l&&e!==l&&(l.removeAttribute("contenteditable"),l.className="",l.oninput=null),p?.classList.remove("selected_row"),p=e.parentElement,p.classList.add("selected_row"),g.FocusedKey=p.dataset.cache_key,this.footer.resetButtons(!1),l=e,l.setAttribute("contenteditable",""),l.className="editable ";let n=p.dataset.cache_key,s=l.dataset.column_id,o=parseInt(l.dataset.column_index)||0,a=this.kvCache.get(n);l.onblur=()=>{let r=l.textContent;if(l.tagName==="SELECT"){s=l.parentElement.dataset.column_id||"",o=parseInt(l.parentElement.dataset.column_index)||0;let d=l;r=d.options[d.selectedIndex].text}a[s]!==r&&(a[s]=r,o===0?n!==r&&(this.kvCache.delete(n),n=r,this.kvCache.set(n,a)):this.kvCache.set(n,a))}}scrollToBottom(){this.tableBody.rows[this.tableBody.rows.length-1].scrollIntoView({behavior:"smooth"})}buildTableHead(){let t='<tr class="headerRow">',e="";for(let n=0;n<this.kvCache.columns.length;n++)e+=`   <th id="header${n+1}" data-index=${n} value=1>${this.kvCache.columns[n].name}</th>`;this.tablehead.innerHTML+=t+e+"</tr>";for(let n=0;n<this.kvCache.columns.length;n++){let s=this.shadow.getElementById(`header${n+1}`);s.onclick=o=>{this.resetFocusedRow(),this.buildDataTable()}}}buildDataTable(){this.tableBody.innerHTML="",this.kvCache.querySet&&this.buildRows(),this.resetFocusedRow(),l?.focus()}buildRows(){let t=this.kvCache.querySet;if(t)for(let e=0;e<t.length;e++){let n=t[e],s=`<tr data-cache_key="${n[this.kvCache.columns[0].name]}">`;for(let o=0;o<this.kvCache.columns.length;o++){let a=this.kvCache.columns[o].name;switch(this.kvCache.columns[o].type){case"boolean":{let r=n[a]==="true"?"checked":"";s+=`<td data-column_index=${o} 
                  data-column_id="${a}"><input type="checkbox" ${r}></td>`;break}case"number":s+=`<td data-column_index=${o} 
                  data-column_id="${a}">${parseFloat(n[a])}</td>`;break;case"object":s+=`<td data-column_index=${o} 
                  data-column_id="${a}">${this.buildSelect(this.kvCache.columns[o].defaultValue,n[a])}</td>`;break;default:s+=`<td data-column_index=${o} 
                  data-column_id="${a}">${n[a]}</td>`;break}}s+="</tr>",this.tableBody.innerHTML+=s}}buildSelect(t,e){let n=`<select>
   `;return t.forEach(s=>{e===s?n+=`<option value="${s}" selected>${s}</option>
         `:n+=`<option value="${s}">${s}</option>
      `}),n+="</select>",n}resetFocusedRow(){this.footer.resetButtons(!0),p=null}};C.register();var E=class extends HTMLElement{static{h(this,"FooterComponent")}static register(){customElements.define("footer-component",this)}addBtn;deleteBtn;shadow;constructor(){super(),this.shadow=this.attachInternals()?.shadowRoot}init(t,e){this.addBtn=this.shadow.getElementById("addbtn"),this.addBtn.onclick=s=>{let o=Object.assign({},e.sampleRecord);for(let r in o)typeof o[r]=="object"&&(o[r]=o[r][0]);let a=e.keyColumnName;t.kvCache.set(o[a],o),t.buildDataTable(),t.scrollToBottom()},this.deleteBtn=this.shadow.getElementById("deletebtn"),this.deleteBtn.onclick=s=>{t.kvCache.delete(g.FocusedKey),t.buildDataTable()};let n=this.shadow.getElementById("fileload");document.addEventListener("keydown",function(s){if(s.ctrlKey&&s.key==="b"){s.preventDefault();let o=JSON.stringify(Array.from(t.kvCache.dbMap.entries())),a=document.createElement("a"),r=new Blob([o],{type:"application/json"});a.href=URL.createObjectURL(r),a.download="backup.json",a.click(),URL.revokeObjectURL(a.href)}s.ctrlKey&&s.key==="r"&&(s.preventDefault(),n.click(),n.addEventListener("change",function(){let o=new FileReader;o.onload=function(){t.kvCache.restoreCache(o.result)},o.readAsText(n.files[0])}))})}resetButtons(t){t?(this.deleteBtn.setAttribute("hidden",""),this.addBtn.removeAttribute("hidden")):(this.addBtn.setAttribute("hidden",""),this.deleteBtn.removeAttribute("hidden"))}};E.register();var x={dbKey:"PWA",keyColumnName:"host",sampleRecord:{host:"Z",login:"",pw:"",remarks:""}},S={DEV:!1,PIN:"",FocusedKey:""},M={LOCAL_DB:!0,LocalDbURL:"http://localhost:9099/",RemoteDbURL:"https://dt-kv-rpc.deno.dev/",RpcURL:"SSERPC/kvRegistration"},R=document.getElementById("pin-component");R.init().then(i=>{console.log(i),i==="ok"&&document.getElementById("table-component").init(x,S,M)}).catch(i=>{alert(i)});export{g as APP_CTX,E as FooterComponent,v as PinComponent,C as TableComponent,l as focusedCell,p as focusedRow,y as on};
