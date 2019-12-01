const indexedDB = window.indexedDB;

module.exports = IndexedDBUtils;

var TX_MODE_READONLY = 'readonly',
	TX_MODE_READWRITE = 'readwrite';

var BLOCK_RETRY_TIMES = 3,
	BLOCK_RETRY_INTERVAL = 2000;

function IndexedDBUtils(opts){
	this.opts = opts || {};

	this.replaceStoreList = [];
	this.deleteStoreList = [];
}

IndexedDBUtils.prototype._updateDB = function(db){
	var self = this,
		s;

	self.replaceStoreList = self.replaceStoreList || [];
	self.deleteStoreList = self.deleteStoreList || [];

	while(self.deleteStoreList.length){
		s = self.deleteStoreList.pop();

		if(contains(db.objectStoreNames, s.name)){
			db.deleteObjectStore(s.name);
		}
	}

	while(self.replaceStoreList.length){
		s = self.replaceStoreList.pop();

		if(contains(db.objectStoreNames, s.name)){
			db.deleteObjectStore(s.name);
		}

		var store = db.createObjectStore(s.name, s.opts);

		s.indexes.forEach(function(i){
			store.createIndex(i.name, i.key, i.opts);
		});
	}
};

IndexedDBUtils.prototype.open = function(dbName, version, persistent){
	var self = this,
		triedTimes = 0;

	dbName = dbName || self.opts.dbName;
	version = version || self.opts.version || undefined;
	persistent = !!persistent || !!self.opts.persistent;

	if(!dbName){
		return Promise.reject('No database name specified!');
	}

	return new Promise(function executor(resolve, reject){

		self.checkPersistent(persistent).then(function(persisted){
			if(persistent && !persisted){
				reject('Persistent storage not allowed!');
				return;
			}

			var req = indexedDB.open(dbName, version);

			req.onsuccess = function(evt){
				var db = this.result;

				self.name = db.name;
				self.version = db.version;
				self.persistent = persistent;

				resolve(db);
			};

			req.onblocked = function(evt){
				if(triedTimes > BLOCK_RETRY_TIMES){
					reject('On blocked try over '+BLOCK_RETRY_TIMES+' times.');
					return;
				}
				triedTimes ++;
				setTimeout(function(){
					executor(resolve, reject);
				},BLOCK_RETRY_INTERVAL);
			};

			req.onerror = function(evt){
				console.error(evt);
				reject(evt);
			};

			req.onupgradeneeded = function(evt){
				var db = evt.currentTarget.result;

				self._updateDB(db);

				self.name = db.name;
				self.version = db.version;
				self.persistent = persistent;

				resolve(db);
			};
		});
	});
};

IndexedDBUtils.prototype.checkPersistent = function(requestIfNot){
	if(navigator.storage && navigator.storage.persist){
		return new Promise(function(resolve, reject){
			navigator.storage.persisted().then(function(persistent){
				if(!persistent && requestIfNot){
					navigator.storage.persist().then(function(granted){
						resolve(granted);
					});
				}else{
					resolve(persistent);
				}
			});
		});
	}else{
		return Promise.resolve(false);
	}
};

IndexedDBUtils.prototype.close = function(db){
	if(!db || typeof db.close != 'function'){
		return Promise.resolve();
	}
	db.close();
	return Promise.resolve();
};

IndexedDBUtils.prototype.getObjectStore = function(name, mode, whatIfNotExists){
	var self = this,
		db;

	mode = [TX_MODE_READWRITE, TX_MODE_READONLY].indexOf(mode) >= 0?mode:TX_MODE_READONLY;

	return self.open().then(function(db){
		db = db;
		if(contains(db.objectStoreNames, name)){
			var tx = db.transaction(name, mode);
			return tx.objectStore(name);
		}else{
			return false;
		}
	}).then(function(objectStore){
		if(objectStore){
			return objectStore;
		}
		if(typeof whatIfNotExists != 'function'){
			return false;
		}

		return self.close(db)
			.then(whatIfNotExists)
			.then(self.open(self.name, self.version + 1, self.persist))
			.then(function(db){
				if(!db){
					return false;
				}
				if(contains(db.objectStoreNames, name)){
					var tx = db.transaction(name, mode);
					return tx.objectStore(name);
				}else{
					return false;
				}
			});

	}).catch(function(e){
		console.error(e);
	});
};

IndexedDBUtils.prototype.addObject = function(objectStore, item){
	var self = this,
		db = objectStore.transaction.db;

	return new Promise(function(resolve, reject){
		var req = objectStore.add(item);

		req.onsuccess = function(event){
			resolve(event);
		};

		req.onerror = function(error){
			reject(error);
		};
	}).catch(function(error){
		throw error;
	}).then(function(event){
		self.close(db);
		return event;
	});
};

IndexedDBUtils.prototype.updateObject = function(objectStore, item, pk){
	var self = this,
		db = objectStore.transaction.db;

	return new Promise(function(resolve, reject){
		var req = objectStore.put(item, pk);
		
		req.onsuccess = function(event){
			resolve(event);
		};

		req.onerror = function(error){
			reject(error);
		};
	}).catch(function(error){
		throw error;
	}).then(function(event){
		self.close(db);
		return event;
	});
};

IndexedDBUtils.prototype.delete = function(objectStore, pk){
	var self = this,
		db = objectStore.transaction.db;

	return new Promise(function(resolve, reject){
		var req = objectStore.delete(pk);
		
		req.onsuccess = function(event){
			resolve(event);
		};

		req.onerror = function(error){
			reject(error);
		};
	}).catch(function(error){
		throw error;
	}).then(function(event){
		self.close(db);
		return event;
	});
};

IndexedDBUtils.prototype.get = function(objectStore, pk){
	var self = this,
		db = objectStore.transaction.db;

	return new Promise(function(resolve, reject){
		var req = objectStore.get(pk);
		
		req.onsuccess = function(event){
			resolve(event);
		};

		req.onerror = function(error){
			reject(error);
		};
	}).catch(function(error){
		return error;
	}).then(function(event){
		self.close(db);
		return event;
	});
};

IndexedDBUtils.prototype.getBy = function(objectStore, pairs){
	var self = this,
		db = objectStore.transaction.db;

	return new Promise(function(resolve, reject){
		var curPair, keyRange, index, req,
			result = [], i;

		pairs = pairs && pairs.reverse() || [];
		
		i = 0;

		while(i < pairs.length){
			if(pairs[i].key){
				curPair = pairs[i];
				pairs.splice(i, 1);
				break;
			}
			i ++;
		}

		keyRange = curPair && curPair.key && IDBKeyRange.only(curPair.value) || undefined;
		index = curPair && curPair.key && objectStore.index(curPair.key) || undefined;

		req = (index || objectStore).openCursor(keyRange);

		function filter(item, pk){
			var i, key, value;
			for(i=0;i<pairs.length;i++){
				key = pairs[i].key;
				if(Array.isArray(pairs[i].pkIn)){
					if(pairs[i].pkIn.indexOf(pk) < 0){
						return false;
					}
				}else if(pairs[i].pkIn){
					if(!pairs[i].pkIn[pk]){
						return false;
					}
				}else if(typeof pairs[i].value == 'function'){
					if(!pairs[i].value.call(null, key?item[key]: null, pk, item, key)){
						return false;
					}
				}else if(item[key] != pairs[i].value){
					return false;
				}
			}
			return true;
		}

		req.onsuccess = function(event){
			var cursor = event.target.result;

			if(cursor){
				if(filter(cursor.value, cursor.primaryKey)){
					result.push({
						'pk': cursor.primaryKey,
						'object': cursor.value
					});
				}

				cursor.continue();
			}else{
				resolve(result);
			}
		};

		req.onerror = function(error){
			reject(error);
		};
	}).catch(function(error){
		throw error;
	}).then(function(result){
		self.close(db);
		return result;
	});
};

function contains(list, item){
	var i;
	for(i=0;i<list.length;i++){
		if(list[i] == item){
			return true;
		}
	}
	return false;
}
