function PageList(storage, key) {
    this._storage = storage;
    this._key = key;
    this._pageIndexes = null;
    this._pageSize = 2000;
}

PageList.prototype = {

    _indexesKey: function () {
        return "pis_" + this._key;
    },

    _dataKey: function (index) {
        return "pd_" + this._key + "_" + index;
    },

    _lastIndex: function () {
        let indexes = this.getPageIndexes();
        if (indexes.length > 0) {
            return indexes[indexes.length - 1];
        }
        return null;
    },

    _addIndex: function (index) {
        this.getPageIndexes().push(index);
        this._saveIndexes();
    },

    _saveIndexes: function () {
        this._storage.put(this._indexesKey(), this.getPageIndexes());
    },

    getPageIndexes: function () {
        if (!this._pageIndexes) {
            this._pageIndexes = this._storage.get(this._indexesKey());
        }
        if (!this._pageIndexes) {
            this._pageIndexes = [];
        }
        return this._pageIndexes;
    },

    getPageData: function (index) {
        let r = this._storage.get(this._dataKey(index));
        if (!r) {
            r = [];
        }
        return r;
    },

    add: function (obj) {
        let index = this._lastIndex();
        let i = 0;
        if (index) {
            i = index.i;
            if (index.l >= this._pageSize) {
                i += 1;
                index = null;
            }
        }
        if (!index) {
            index = {i: i, l: 0};
            this._addIndex(index);
        }
        let d = this.getPageData(index.i);
        d.push(obj);
        index.l += 1;
        this._saveIndexes();
        this._storage.put(this._dataKey(index.i), d);
    },

    del: function (fn) {
        let indexes = this.getPageIndexes();
        if (indexes) {
            for (let i = 0; i < indexes.length; ++i) {
                let ds = this.getPageData(indexes[i].i);
                if (ds) {
                    let r = [];
                    for (let j = 0; j < ds.length; ++j) {
                        if (!fn(ds[j])) {
                            r.push(ds[j]);
                        }
                    }
                    if (r.length !== ds.length) {
                        this._storage.put(this._dataKey(indexes[i].i), r);
                    }
                }
            }
        }
    },

    addPage: function (page) {
        let i = 0;
        let index = this._lastIndex();
        if (index) {
            i = index.i + 1;
        }
        index = {i: i, l: page.length};
        this._addIndex(index);
        this._storage.put(this._dataKey(index.i), page);
    }
};


function NrDataSource() {
    this._contractName = "NrDataSource";
    LocalContractStorage.defineProperties(this, {
        _managers: null
    });
    LocalContractStorage.defineMapProperty(this, "_storage", null);
    this._cycleList = new PageList(this._storage, "cycle_list");
}

NrDataSource.prototype = {

    _verifyAddress: function (address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw ("Address error");
        }
    },

    _verifyManager: function () {
        if (this._managers.indexOf(Blockchain.transaction.from) < 0) {
            throw ("No permission");
        }
    },

    _key: function (startBlock, endBlock) {
        return startBlock + "_" + endBlock;
    },

    _getAddresses: function (startBlock, endBlock) {
        return this._storage.get(this._key(startBlock, endBlock));
    },

    init: function (managers) {
        if (!managers || managers.length === 0) {
            throw ("Need at least one administrator");
        }
        for (let i = 0; i < managers.length; ++i) {
            this._verifyAddress(managers[i]);
        }
        this._managers = managers;
    },

    // {startBlock:1, endBlock:500, addresses:["",...]}
    upload: function (data) {
        this._verifyManager();
        let key = this._key(data.startBlock, data.endBlock);
        if (!this._storage.get(key)) {
            this._cycleList.add({sb: data.startBlock, eb: data.endBlock});
        }
        this._storage.put(this._key(data.startBlock, data.endBlock), data.addresses);
    },

    remove: function (startBlock, endBlock) {
        this._verifyManager();
        this._cycleList.del(function (c) {
            return c.sb === startBlock && c.eb === endBlock;
        });
        this._storage.del(this._key(startBlock, endBlock));
    },

    getData: function (returnCycleIndexes, returnCycleListInfo, returnAddressesInfo) {
        let indexes = null;
        if (returnCycleIndexes) {
            indexes = this._cycleList.getPageIndexes();
        }

        let cycleList = null;
        if (returnCycleListInfo) {
            let d = this._cycleList.getPageData(returnCycleListInfo.index);
            cycleList = [];
            for (let i = 0; i < d.length; ++i) {
                let as = this._getAddresses(d[i].s, d[i].e);
                if (as && as.length > 0) {
                    cycleList.push(d[i]);
                }
            }
        }

        let addresses = null;
        if (returnAddressesInfo) {
            if (returnAddressesInfo.returnLast) {
                if (!indexes) {
                    indexes = this._cycleList.getPageIndexes();
                }
                if (indexes.length > 0) {
                    let index = indexes[indexes.length - 1].i;
                    let list = null;
                    if (returnCycleListInfo && returnCycleListInfo.index === index) {
                        list = cycleList;
                    } else {
                        list = this._cycleList.getPageData(index);
                    }
                    if (list.length > 0) {
                        let info = list[list.length - 1];
                        addresses = {
                            startBlock: info.s,
                            endBlock: info.e,
                            data: this._getAddresses(info.s, info.e)
                        };
                    }
                }
            } else {
                addresses = {
                    startBlock: returnAddressesInfo.startBlock,
                    endBlock: returnAddressesInfo.endBlock,
                    data: this._getAddresses(returnAddressesInfo.startBlock, returnAddressesInfo.endBlock)
                };
            }
        }

        return {cycleIndexes: indexes, cycleList: cycleList, addresses: addresses};
    },
};

module.exports = NrDataSource;
