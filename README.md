# KV-PWA
  - Pure vanilla HTML, CSS, javascript application - no frameworks
  - Local-First, Zero dependencies
  - Maintains a local cache, and persists it to a remote DenoKv

## About this Proof Of Concept demo
 - All data is persisted and hydrated as a single key-value record in KvDB.       
 - Data hydrates to an es6-Map (cache) using JSON.parse()    
 - This data-cache is persisted in a remote KvDB using JSON.stringyfy()    
 - All mutations to the cache trigger a flush of the full dataset to KvDB.    

## Run live at https://nhrones.github.io/DT-PWA/

NOTE: The two files `index.html` and `bundle.js` come from `/Apps/Base/`.    
These are common shared assets, and the build/bundle process only happens there. 
There are no other dependencies here!   
Only the `main.js` file is unique in this app folder.