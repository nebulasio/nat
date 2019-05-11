function VotePageList(storage, key) {
    this._storage = storage;
    this._key = key;
    this._pageIndexes = null;
    this._pageSize = 1000;
}

VotePageList.prototype = {

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
            if (index.l > this._pageSize) {
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
};


function AddressDataManager(voteDataManager, address, hash) {
    this._storage = voteDataManager._storage;
    this._voteDataManager = voteDataManager;
    this._address = address;
    this._hash = hash;
    this._dataKey = "ad_" + this._voteDataManager._datasource + "_" + hash + "_" + address;
}

AddressDataManager.prototype = {

    getResult: function () {
        let r = this._storage.get(this._dataKey);
        if (!r) {
            r = [];
        }
        return r;
    },

    addVoteValue: function (value, weight, distribute) {
        let r = this.getResult();
        r.push({v: value, w: weight, d: distribute});
        this._storage.put(this._dataKey, r);
        return r;
    },
};


function VoteDataManager(storage, dataSource) {
    this._storage = storage;
    this._datasource = dataSource;
    this._hashList = new VotePageList(storage, "hashs_" + dataSource);
}

VoteDataManager.prototype = {
    _resultKey: function (hash) {
        return "vh_" + this._datasource + "_" + hash;
    },

    _addressList: function (hash) {
        return new VotePageList(this._storage, "as_" + this._datasource + "_" + hash);
    },

    saveVote: function (hash, r) {
        let rk = this._resultKey(hash);
        if (!this._storage.get(rk)) {
            this._hashList.add(hash);
        }
        this._storage.put(rk, r);
    },

    getAddressIndexes: function (hash) {
        return this._addressList(hash).getPageIndexes();
    },

    getAddresses: function (hash, index) {
        return this._addressList(hash).getPageData(index);
    },

    saveAddressVote: function (address, hash, value, weight, distribute) {
        let m = new AddressDataManager(this, address, hash);
        let r = m.addVoteValue(value, weight, distribute);
        if (r.length === 1) {
            this._addressList(hash).add(address);
        }
    },

    getAddressVoteResult: function (address, hash) {
        return new AddressDataManager(this, address, hash).getResult();
    },

    getResult: function (hash) {
        return this._storage.get(this._resultKey(hash));
    },

    getHashIndexes: function () {
        return this._hashList.getPageIndexes();
    },

    getHashs: function (index) {
        return this._hashList.getPageData(index);
    },


};


function Vote(storage) {
    this._contractName = "Vote";
    LocalContractStorage.defineProperties(this, {
        _config: null,
        _voteManagers: null,
        _dataSources: null,
    });
    LocalContractStorage.defineMapProperties(this, {
        "_storage": null,
    });
}

Vote.prototype = {

    get _natContract() {
        if (!this.__natContract) {
            if (!this._config.natNRC20) {
                throw ("natNRC20 not found.");
            }
            this.__natContract = new Blockchain.Contract(this._config.natNRC20);
        }
        return this.__natContract;
    },

    get _distributeContract() {
        if (!this.__distributeContract) {
            if (!this._config.distribute) {
                throw ("distribute not found.");
            }
            this.__distributeContract = new Blockchain.Contract(this._config.distribute);
        }
        return this.__distributeContract;
    },

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

    _verifyFromManagers: function () {
        if (!this._voteManagers || this._voteManagers.indexOf(Blockchain.transaction.from) < 0) {
            throw ("Permission Denied!");
        }
    },

    _verifyDataSource: function (dataSource) {
        if (this._dataSources.indexOf(dataSource) < 0) {
            throw ("data source error.");
        }
    },

    _verifyVote: function (data, value, weight) {
        if (data.options.indexOf(value) < 0) {
            throw ("vote value error.");
        }
        if (this._balanceOf(Blockchain.transaction.from).lt(weight)) {
            throw ("Insufficient Nat balance");
        }
    },

    _getData: function (dataSource, hash) {
        let c = new Blockchain.Contract(dataSource);
        let d = c.call("getData", hash);
        if (!d) {
            throw ("data " + hash + " not found.");
        }
        return d;
    },

    _defaultResult: function (data) {
        let r = {};
        for (let i = 0; i < data.options.length; ++i) {
            r[data.options[i]] = "0";
        }
        return r;
    },

    _vote: function (voteDataManager, data, hash, value, weight) {
        let r = voteDataManager.getResult(hash);
        if (!r) {
            r = this._defaultResult(data);
        }
        let w = new BigNumber(weight).div(new BigNumber(10).pow(18));
        let v = this._distributeContract.call("vote", Blockchain.transaction.from, w);
        let rw = r[value];
        if (!rw) {
            rw = "0";
        }
        rw = new BigNumber(rw);
        r[value] = rw.plus(w).toString(10);
        voteDataManager.saveVote(hash, r);
        let d = new BigNumber(v).plus(w).toString(10);
        voteDataManager.saveAddressVote(Blockchain.transaction.from, hash, value, w, d);
    },

    _balanceOf: function (address) {
        return new BigNumber(this._natContract.call("balanceOf", address));
    },

    init: function (multiSig, voteManagers) {
        this._verifyAddress(multiSig);
        if (voteManagers.length === 0) {
            throw ("Need at least one administrator.");
        }
        for (let i = 0; i < voteManagers.length; ++i) {
            this._verifyAddress(voteManagers[i]);
        }
        this._config = {multiSig: multiSig};
        this._voteManagers = voteManagers;
    },

    getConfig: function () {
        return this._config;
    },

    setConfig: function (config) {
        this._verifyFromMultisig();
        this._config = {
            multiSig: config.multiSig,
            natNRC20: config.natNRC20,
            distribute: config.distribute
        };
    },

    getDataSources: function () {
        return this._dataSources;
    },

    setDataSources: function (dataSources) {
        this._verifyFromManagers();
        for (let i = 0; i < dataSources; ++i) {
            this._verifyAddress(dataSources[i]);
        }
        this._dataSources = dataSources;
    },

    vote: function (dataSource, hash, value, weight) {
        this._verifyDataSource(dataSource);
        let vm = new VoteDataManager(this._storage, dataSource);
        let data = this._getData(dataSource, hash);
        weight = new BigNumber(weight);
        this._verifyVote(data, value, weight);
        this._vote(vm, data, hash, value, weight);
    },

    getHashIndexes: function (dataSource) {
        this._verifyDataSource(dataSource);
        return new VoteDataManager(this._storage, dataSource).getHashIndexes();
    },

    getHashes: function (dataSource, index) {
        this._verifyDataSource(dataSource);
        return new VoteDataManager(this._storage, dataSource).getHashs(index);
    },

    getVoteResult: function (dataSource, hash) {
        this._verifyDataSource(dataSource);
        let r = new VoteDataManager(this._storage, dataSource).getResult(hash);
        let data = null;
        try {
            data = new Blockchain.Contract(dataSource).call("getData", hash);
        } catch (e) {
        }
        return {data: data, result: r};
    },

    getVoteResultByAddress: function (dataSource, hash, address) {
        return new VoteDataManager(this._storage, dataSource).getAddressVoteResult(address, hash);
    },

    getVoteAddressIndexes: function (dataSource, hash) {
        return new VoteDataManager(this._storage, dataSource).getAddressIndexes(hash);
    },

    getVoteAddresses: function (dataSource, hash, index) {
        return new VoteDataManager(this._storage, dataSource).getAddresses(hash, index);
    },
};

module.exports = Vote;
