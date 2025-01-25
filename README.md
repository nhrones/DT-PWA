# KV-Cache-PWA
  - Pure vanilla HTML, CSS, javascript application - no frameworks
  - Zero dependencies

## About this Proof Of Concept demo
 - All data is persisted and hydrated as a single key-value record in KvDB.       
 - Data hydrates to an es6-Map (cache) using JSON.parse()    
 - The cache data is persisted in KvDB using JSON.stringyfy()    
 - Any mutation to the cache triggers a flush of the full dataset to KvDB.    

live at https://nhrones.github.io/DT-PWA/

ctrl + b = backup
ctrl + r = restore