# KV-PWA
  - Pure vanilla HTML, CSS, javascript application - no frameworks
  - Local-First, Zero dependencies
  - Maintaina a local cache, and persists to a remote DenoKv

## About this Proof Of Concept demo
 - All data is persisted and hydrated as a single key-value record in KvDB.       
 - Data hydrates to an es6-Map (cache) using JSON.parse()    
 - This data-cache is persisted in a remote KvDB using JSON.stringyfy()    
 - All mutations to the cache trigger a flush of the full dataset to KvDB.    

live at https://nhrones.github.io/DT-PWA/
