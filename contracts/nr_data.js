function NrDataList(storage, key, pageSize) {
    this._storage = storage;
    this._key = key;
    this._pageIndexes = null;
    this._pageSize = pageSize;
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
        this._pageIndexes = null;
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
            let score = "0";
            try {
                score = Blockchain.getLatestNebulasRank(data[i]);
            } catch (e) {
                // if the address nr not found, give a default value "0"
                score = "0";
                console.log("NR not found for address:", data[i]);
            }
            r.push({
                addr: data[i],
                score: score
            });
        }
        return r;
    },

    _saveData: function (data, isFullData) {
        let indexes = this._indexes;
        indexes.push({startIndex: data.startIndex, length: data.data.length});
        this._indexes = indexes;
        this._setPageData(data.startIndex, isFullData ? data.data : this._getNrData(data.data));
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
        if (c > this._info.count) {
            this._clear();
            throw ("Wrong data length");
        }
        return c === this._info.count;
    },

    /**
     * {
     *     startHeight:1,
     *     endHeight:500,
     *     count:1001
     *     startIndex:0,
     *     data:["n1xxx"] | [{"addr":"n1xxx", "score":"123"}]
     * }
     */
    receive: function (data, isFullData) {
        let name = _cycleName(data.startHeight, data.endHeight);
        if (this._name !== name) {
            this._clear();
            this._info = {
                startHeight: data.startHeight,
                endHeight: data.endHeight,
                count: parseInt(data.count),
            };
        }
        this._saveData(data, isFullData);
        try {
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
        } catch (e) {
            return {
                error: e
            }
        }
    },
};


function CycleData(storage, cycle) {
    this._storage = storage;
    let name = _cycleName(cycle.startHeight, cycle.endHeight);
    this._pageList = new NrDataList(storage, name, 200);
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
        let n = Math.ceil(data.length / parseFloat("" + this._pageList._pageSize));
        for (let i = 0; i < n; ++i) {
            let d = [];
            for (let j = i * this._pageList._pageSize; j < (i + 1) * this._pageList._pageSize; ++j) {
                if (j >= data.length) {
                    break;
                }
                d.push(data[j]);
            }
            this._pageList.addPage(d);
        }
        this.count = data.length;
    },

    getPageIndexes: function () {
        return this._pageList.getPageIndexes();
    },

    getPageData: function (index) {
        if (index > this.pageCount - 1) {
            throw ("index out of range.");
        }
        return this._pageList.getPageData(index);
    },

    getNRByAddress: function (address) {
        let indexes = this._pageList.getPageIndexes();
        for (let i = 0; i < indexes.length; ++i) {
            let index = indexes[i];
            let data = this._pageList.getPageData(index.i);
            for (let j = 0; j < data.length; ++j) {
                if (data[j].addr === address) {
                    return data[j].score;
                }
            }
        }
        return "0";
    }
};


function CycleManager(storage) {
    this._storage = storage;
    this._pageList = new NrDataList(storage, "cycle_list", 1000);
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

    getPrevCycle: function (block) {
        let indexes = this._pageList.getPageIndexes();
        for (let i = indexes.length - 1; i >= 0; --i) {
            let ds = this._pageList.getPageData(indexes[i].i);
            for (let j = ds.length - 1; j >= 0; --j) {
                let d = ds[j];
                if (d.endHeight < block) {
                    return d
                }
            }
        }
        return null;
    },

    getNextCycle: function (block) {
        let indexes = this._pageList.getPageIndexes();
        let r = null;
        for (let i = indexes.length - 1; i >= 0; --i) {
            let ds = this._pageList.getPageData(indexes[i].i);
            for (let j = ds.length - 1; j >= 0; --j) {
                let d = ds[j];
                if (d.startHeight > block) {
                    r = d;
                } else {
                    break;
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
        _config: null,
        _allowUploadNRScore: null
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
        this._allowUploadNRScore = true;
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
        let r = this._receiver.receive(data, false);
        if (r.error) {
            return r;
        }
        if (r.completed) {
            this._didReceiveData(r.info, r.data);
        }
        return {data: true};
    },

    setAllowUploadNRScore(allowed) {
        this._verifyFromMultisig();
        this._allowUploadNRScore = allowed;
    },

    uploadNRScore: function (data) {
        if (!this._allowUploadNRScore) {
            throw ("Uploading score is not allowed.");
        }
        this._verifyFromManager();
        let r = this._receiver.receive(data, true);
        if (r.error) {
            return r;
        }
        if (r.completed) {
            this._didReceiveData(r.info, r.data);
        }
        return {data: true};
    },

    getNR: function (block, pageIndex) {
        let c = this._cycleManager.getNextCycle(block);
        if (c != null) {
            let cd = new CycleData(this._storage, c);
            return {
                section: c,
                hasNext: pageIndex < cd.pageCount - 1,
                data: cd.getPageData(pageIndex)
            }
        }
        return null;
    },

    getNRByAddress: function (block, address) {
        let c = this._cycleManager.getPrevCycle(block);
        if (c != null) {
            let cd = new CycleData(this._storage, c);
            return cd.getNRByAddress(address);
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
