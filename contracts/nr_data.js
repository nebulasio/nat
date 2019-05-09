let PAGE_SIZE = 400;

function NrDataList(storage, key) {
    this._storage = storage;
    this._key = key;
    this._pageIndexes = null;
    this._pageSize = 400;
}

NrDataList.prototype = {

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

    addPage: function (page) {
        let i = 0;
        let index = this._lastIndex();
        if (index) {
            i = index.i + 1;
        }
        index = {i: i, l: page.length};
        this._addIndex(index);
        this._storage.put(this._dataKey(index.i), page);
    },

    clear: function () {
        let indexes = this.getPageIndexes();
        for (let i = 0; i < indexes.length; ++i) {
            this._storage.del(this._dataKey(indexes[i].i));
        }
        this._storage.del(this._indexesKey());
    },
};

function _cycleName(startHeight, endHeight) {
    return startHeight + "_" + endHeight;
}


function DataReceiver(storage) {
    this._storage = storage;

    this._infoKey = "dr_info";
    this._indexesKey = "dr_indexes";
}

DataReceiver.prototype = {

    get _name() {
        if (!this._info) {
            return null;
        }
        return _cycleName(this._info.startHeight, this._info.endHeight);
    },

    get _info() {
        if (!this.__info) {
            this.__info = this._storage.get(this._infoKey);
        }
        return this.__info;
    },

    set _info(info) {
        this.__info = info;
        this._storage.put(this._infoKey, info);
    },

    get _allData() {
        let r = [];
        for (let i = 0; i < this._indexes.length; ++i) {
            let d = this._pageData(this._indexes[i].startIndex);
            for (let j = 0; j < d.length; ++j) {
                r.push(d[j]);
            }
        }
        return r;
    },

    get _indexes() {
        if (!this.__indexes) {
            this.__indexes = this._storage.get(this._indexesKey);
        }
        if (!this.__indexes) {
            this.__indexes = [];
        }
        return this.__indexes;
    },

    set _indexes(indexes) {
        this.__indexes = indexes;
        this._storage.put(this._indexesKey, indexes);
    },

    _pageKey: function (index) {
        return "dr_p_" + index;
    },

    _setPageData: function (index, data) {
        this._storage.put(this._pageKey(index), data);
    },

    _pageData: function (index) {
        let r = this._storage.get(this._pageKey(index));
        if (!r) {
            r = [];
        }
        return r;
    },

    _getNrData: function (data) {
        let r = [];
        for (let i = 0; i < data.length; ++i) {
            r.push({
                addr: data[i],
                score: Blockchain.getLatestNebulasRank(data[i])
            });
        }
        return r;
    },

    _saveData: function (data) {
        let indexes = this._indexes;
        indexes.push({startIndex: data.startIndex, length: data.data.length});
        this._indexes = indexes;
        this._setPageData(data.startIndex, this._getNrData(data.data));
    },

    _clear: function () {
        this._info = null;
        let indexes = Array.from(this._indexes);
        this._indexes = null;
        for (let i = 0; i < indexes.length; ++i) {
            this._storage.del(this._pageKey(indexes[i].startIndex));
        }
    },

    _isComplete: function () {
        let c = 0;
        for (let i = 0; i < this._indexes.length; ++i) {
            c += this._indexes[i].length;
        }
        return c === this._info.count;
    },

    /**
     * {
     *     startHeight:1,
     *     endHeight:500,
     *     count:1001
     *     startIndex:0,
     *     data:["n1xxx"]
     * }
     */
    receive: function (data) {
        let name = _cycleName(data.startHeight, data.endHeight);
        if (this._name !== name) {
            this._clear();
            this._info = {
                startHeight: data.startHeight,
                endHeight: data.endHeight,
                count: parseInt(data.count),
            };
        }
        this._saveData(data);
        let c = this._isComplete();
        if (c) {
            let r = {
                completed: c,
                info: this._info,
                data: this._allData
            };
            this._clear();
            return r;
        }
        return {
            completed: false,
        };
    }
};


function CycleData(storage, cycle) {
    this._storage = storage;
    let name = _cycleName(cycle.startHeight, cycle.endHeight);
    this._pageList = new NrDataList(storage, name);
    this._countKey = name + "_count";
}

CycleData.prototype = {

    get count() {
        return this._storage.get(this._countKey);
    },

    set count(count) {
        this._storage.put(this._countKey, count);
    },

    get pageCount() {
        return this._pageList.getPageIndexes().length;
    },

    setData: function (data) {
        this._pageList.clear();
        let n = Math.ceil(data.length / parseFloat("" + PAGE_SIZE));
        for (let i = 0; i < n; ++i) {
            let d = [];
            for (let j = i * n; j < i * n + PAGE_SIZE; ++j) {
                if (j >= data.length) {
                    break;
                }
                d.push(data[j]);
            }
            this._pageList.addPage(d);
        }
        this.count = data.length;
    },

    getData: function (startPageIndex, count) {
        let r = [];
        let indexes = this._pageList.getPageIndexes();
        for (let i = 0; i < indexes.length; ++i) {
            if (i < startPageIndex) {
                continue;
            }
            if (i >= startPageIndex + count) {
                break;
            }
            let d = this._pageList.getPageData(indexes[i].i);
            for (let j = 0; j < d.length; ++j) {
                r.push(d[j]);
            }
        }
        return r;
    },

    getPageIndexes: function () {
        return this._pageList.getPageIndexes();
    },

    getPageData: function (index) {
        return this._pageList.getPageData(index);
    },
};


function CycleManager(storage) {
    this._storage = storage;
    this._pageList = new NrDataList(storage, "cycle_list");
}

CycleManager.prototype = {
    _contains: function (cycle) {
        let indexes = this._pageList.getPageIndexes();
        for (let i = indexes.length - 1; i >= 0; --i) {
            let ds = this._pageList.getPageData(indexes[i].i);
            for (let j = ds.length - 1; j >= 0; --j) {
                let d = ds[j];
                if (d.startHeight === cycle.startHeight && d.endHeight === cycle.endHeight) {
                    return true;
                }
            }
        }
        return false;
    },

    addCycle: function (cycle) {
        if (!this._contains(cycle)) {
            this._pageList.add(cycle);
        }
    },

    getCycles: function (block) {
        let r = [];
        let indexes = this._pageList.getPageIndexes();
        for (let i = indexes.length - 1; i >= 0; --i) {
            let ds = this._pageList.getPageData(indexes[i].i);
            for (let j = ds.length - 1; j >= 0; --j) {
                let d = ds[j];
                if (d.startHeight > block) {
                    r.push(d);
                }
            }
        }
        return r;
    },

    getCycleIndexes: function () {
        return this._pageList.getPageIndexes();
    },

    getCyclesWithIndex: function (index) {
        return this._pageList.getPageData(index);
    }
};


function NrDataSource() {
    this._contractName = "NrDataSource";
    LocalContractStorage.defineProperties(this, {
        _config: null
    });
    LocalContractStorage.defineMapProperty(this, "_storage", null);
    this._receiver = new DataReceiver(this._storage);
    this._cycleManager = new CycleManager(this._storage);
}

NrDataSource.prototype = {

    _verifyAddress: function (address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw ("Address error");
        }
    },

    _verifyFromMultisig: function () {
        if (this._config.multiSig !== Blockchain.transaction.from) {
            throw ("Permission Denied!");
        }
    },

    _verifyFromManager: function () {
        if (this._config.nrDataManager !== Blockchain.transaction.from) {
            throw ("Permission Denied!");
        }
    },

    _verifyConfig: function (config) {
        this._verifyAddress(config.multiSig);
        this._verifyAddress(config.nrDataManager);
    },

    _didReceiveData: function (info, data) {
        let cycle = {startHeight: info.startHeight, endHeight: info.endHeight};
        let cd = new CycleData(this._storage, cycle);
        cd.setData(data);
        this._cycleManager.addCycle(cycle);
    },

    init: function (multiSig) {
        this._verifyAddress(multiSig);
        this._config = {multiSig: multiSig};
    },

    getConfig: function () {
        return this._config;
    },

    setConfig: function (config) {
        this._verifyConfig(config);
        this._config = {
            multiSig: config.multiSig,
            nrDataManager: config.nrDataManager
        };
    },

    upload: function (data) {
        this._verifyFromManager();
        let r = this._receiver.receive(data);
        if (r.completed) {
            this._didReceiveData(r.info, r.data);
        }
    },

    getNR: function (block, startPageIndex) {
        let cycles = this._cycleManager.getCycles(block);
        if (cycles.length > 0) {
            let c = cycles[cycles.length - 1];
            let cd = new CycleData(this._storage, c);
            return {
                section: c,
                hasNext: startPageIndex < cd.pageCount - 1,
                data: cd.getData(startPageIndex, 1)
            }
        }
        return null;
    },

    getCycleIndexes: function () {
        return this._cycleManager.getCycleIndexes();
    },

    getCycles: function (index) {
        return this._cycleManager.getCyclesWithIndex(index);
    },

    getNRIndexesWithCycle: function (startHeight, endHeight) {
        let cd = new CycleData(this._storage, {startHeight: startHeight, endHeight: endHeight});
        return cd.getPageIndexes();
    },

    getNRWithCycle: function (startHeight, endHeight, index) {
        let cd = new CycleData(this._storage, {startHeight: startHeight, endHeight: endHeight});
        return cd.getPageData(index);
    },
};

module.exports = NrDataSource;
