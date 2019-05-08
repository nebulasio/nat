/*
    This is a simple multisig smart contract, any cosigner in the list will be able to get through the function call
    @author: Zhuoer Wang, Ping Guo, Qiyuan Wang
*/
function PledgeDataList(storage, key) {
    this._storage = storage;
    this._key = key;
    this._pageIndexes = null;
    this._pageSize = 1000;
}

PledgeDataList.prototype = {

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
        let indexes = this.getPageIndexes();
        let p = null;
        for (let i = 0; i < indexes.length; ++i) {
            let index = indexes[i];
            if (index.l < this._pageSize) {
                p = index;
                break;
            }
        }

        if (p == null) {
            let i = 0;
            if (indexes.length > 0) {
                i = indexes[indexes.length - 1].i + 1;
            }
            p = {i: i, l: 0};
            this._addIndex(p);
        }

        let d = this.getPageData(p.i);
        d.push(obj);
        p.l += 1;
        this._saveIndexes();
        this._storage.put(this._dataKey(p.i), d);
    },

    del: function (ele) {
        let indexes = this.getPageIndexes();
        if (indexes) {
            for (let i = 0; i < indexes.length; ++i) {
                let index = indexes[i];
                let ds = this.getPageData(index.i);
                if (ds) {
                    for (let j = 0; j < ds.length; ++j) {
                        if (ele === ds[j]) {
                            ds.splice(j, 1);
                            index.l -= 1;
                            this._storage.put(this._dataKey(index.i), ds);
                            this._storage.put(this._indexesKey(), indexes);
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    },
};


function CurrentData(storage) {
    this._storage = storage;
    this._addressList = new PledgeDataList(storage, "address_list");

    this._keyLastBlock = "last_block";
    this._lastBlock = null;
}

CurrentData.prototype = {

    _getPledges: function (address) {
        let r = this._storage.get(address);
        if (!r) {
            r = [];
        }
        return r;
    },

    _canPledge: function (address) {
        let ps = this._getPledges(address);
        if (ps.length === 0) {
            return true;
        }
        return ps[ps.length - 1].e != null;
    },

    _canDelete: function (pledge) {
        let lastBlock = this.lastBlock;
        return lastBlock && pledge.e && lastBlock > pledge.e;
    },

    _getPledge: function (address, startBlock, endBlock) {
        let ps = this._getPledges(address);
        if (ps.length === 0) {
            return null;
        }
        for (let i = 0; i < ps.length; ++i) {
            let p = ps[i];
            if (p.s <= startBlock && (!p.e || p.e >= endBlock)) {
                return p;
            }
        }
        return null;
    },

    _checkAndDelete: function (address, deleted) {
        let ps = this._getPledges(address);
        if (ps.length === 0) {
            return;
        }
        let newPs = [];
        for (let i = 0; i < ps.length; ++i) {
            let p = ps[i];
            if (!this._canDelete(p)) {
                newPs.push(p);
            } else {
                deleted.push({a: address, p: p});
            }
        }
        if (newPs.length > 0 && newPs.length !== ps.length) {
            this._storage.put(address, newPs);
        } else if (newPs.length === 0) {
            this._storage.del(address);
            this._addressList.del(address);
        }
    },

    get lastBlock() {
        if (!this._lastBlock) {
            this._lastBlock = this._storage.get(this._keyLastBlock);
        }
        return this._lastBlock;
    },

    set lastBlock(block) {
        this._lastBlock = block;
        this._storage.put(this._keyLastBlock, block);
    },

    checkAndDelete: function () {
        let deleted = [];
        let indexes = Array.from(this._addressList.getPageIndexes());
        for (let i = 0; i < indexes.length; ++i) {
            let index = indexes[i];
            let as = Array.from(this._addressList.getPageData(index.i));
            for (let j = 0; j < as.length; ++j) {
                let a = as[j];
                this._checkAndDelete(a, deleted);
            }
        }
        return deleted;
    },

    getDistributePledges: function (startBlock, endBlock) {
        let r = [];
        let indexes = this._addressList.getPageIndexes();
        for (let i = 0; i < indexes.length; ++i) {
            let index = indexes[i];
            let as = this._addressList.getPageData(index.i);
            for (let j = 0; j < as.length; ++j) {
                let a = as[j];
                let p = this._getPledge(a, startBlock, endBlock);
                if (p != null) {
                    r.push({addr: a, value: p.v});
                }
            }
        }
        return r;
    },

    addPledge: function (address, pledge) {
        if (!this._canPledge(address)) {
            throw ("You already have a pledge.");
        }
        let ps = this._getPledges(address);
        if (ps.length === 0) {
            this._addressList.add(address);
        }
        ps.push(pledge);
        this._storage.put(address, ps);
    },

    cancelPledge: function (address) {
        if (this._canPledge(address)) {
            throw ("No pledges that can be cancelled.");
        }
        let ps = this._getPledges(address);
        let p = ps[ps.length - 1];
        p.e = Blockchain.block.height;
        this._storage.put(address, ps);
        return new BigNumber(p.v).mul(new BigNumber(10).pow(18));
    },

    getCurrentPledges: function (address) {
        return this._storage.get(address);
    }
};


function HistoryData(storage) {
    this._storage = storage;
    this._addressList = new PledgeDataList(storage, "address_list");
}

HistoryData.prototype = {

    _addressHistoryData: function (address) {
        return new PledgeDataList(this._storage, "h_" + address);
    },

    addPledge: function (address, pledge) {
        let ad = this._addressHistoryData(address);
        if (ad.getPageIndexes().length === 0) {
            this._addressList.add(address);
        }
        ad.add(pledge);
    },

    getHistoryPledgeIndexes: function (address) {
        return this._addressHistoryData(address).getPageIndexes();
    },

    getHistoryPledges: function (address, index) {
        return this._addressHistoryData(address).getPageData(index);
    },
};


function DistributeData(storage) {
    this._storage = storage;
    this._addressList = new PledgeDataList(storage, "address_list");
}

DistributeData.prototype = {

    _addressData: function (address) {
        return new PledgeDataList(this._storage, "d_" + address);
    },

    addDistribute: function (address, distribute) {
        let ad = this._addressData(address);
        if (ad.getPageIndexes().length === 0) {
            this._addressList.add(address);
        }
        ad.add(distribute);
    },

    getDistributeIndexes: function (address) {
        return this._addressData(address).getPageIndexes();
    },

    getDistributes: function (address, index) {
        return this._addressData(address).getPageData(index);
    },
};


function StatisticData(storage) {
    this._storage = storage;
    this._addressList = new PledgeDataList(storage, "address_list");
}

StatisticData.prototype = {

    addAddress: function (address) {
        let d = this._storage.get(address);
        if (!d) {
            this._addressList.add(address);
            this._storage.put(address, {nat: "0"});
        }
    },

    addNat: function (address, nat) {
        let d = this._storage.get(address);
        if (d) {
            d.nat = new BigNumber(d.nat).plus(new BigNumber(nat)).toString(10);
            this._storage.put(address, d);
        }
    },

    getNat: function (address) {
        let d = this._storage.get(address);
        if (d) {
            return d.nat;
        }
        return null;
    }
};


function Pledge() {
    this._contractName = "Pledge";
    LocalContractStorage.defineProperties(this, {
        _config: null,
    });
    LocalContractStorage.defineMapProperties(this, {
        "_storage": null,
        "_current": null,
        "_histories": null,
        "_distributes": null,
    });

    this._PREV_PLEDGE = "n1n5Fctkjx2pA7iLX8rgRyCa7VKinGFNe9H";

    this._statisticData = new StatisticData(this._storage);
    this._currentData = new CurrentData(this._current);
    this._historyData = new HistoryData(this._histories);
    this._distributeData = new DistributeData(this._distributes);

    this._addresses = new PledgeDataList(this._storage, "address_list");
    this._unit = new BigNumber(10).pow(18);
}

Pledge.prototype = {

    init: function (multiSigAddress) {
        this._verifyAddress(multiSigAddress);
        this._config = {multiSig: multiSigAddress};
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

    _verifyFromPledgeProxy: function () {
        if (this._config.pledgeProxy !== Blockchain.transaction.from) {
            throw ("Permission Denied!");
        }
    },

    _verifyFromPrevPledge: function () {
        if (this._PREV_PLEDGE !== Blockchain.transaction.from) {
            throw ("Permission Denied!");
        }
    },

    _verifyFromDistribute: function () {
        if (this._config.distribute !== Blockchain.transaction.from) {
            throw ("Permission Denied!");
        }
    },

    _verifyConfig: function (config) {
        this._verifyAddress(config.multiSig);
        this._verifyAddress(config.pledgeProxy);
        this._verifyAddress(config.distribute);
    },

    getConfig: function () {
        return this._config;
    },

    setConfig: function (config) {
        this._verifyFromMultisig();
        this._verifyConfig(config);
        this._config = {
            multiSig: config.multiSig,
            pledgeProxy: config.pledgeProxy,
            distribute: config.distribute
        };
    },

    // for pledge_proxy.js only
    pledge: function (address, value) {
        this._verifyFromPledgeProxy();
        value = new BigNumber(value);
        if (new BigNumber(5).mul(this._unit).gt(value)) {
            throw ("The amount cannot be less than 5 NAS");
        }
        let h = Blockchain.block.height;
        let v = value.div(this._unit).toString(10);
        this._currentData.addPledge(address, {s: h, v: v, e: null});
        this._statisticData.addAddress(address);
    },

    // for pledge_proxy.js only
    cancelPledge: function (address) {
        this._verifyFromPledgeProxy();
        return this._currentData.cancelPledge(address);
    },

    receivePledgeData: function (data) {
        this._verifyFromPrevPledge();
        for (let i = 0; i < data.length; ++i) {
            let a = data[i].a;
            let p = data[i].p;
            if (p.c) {
                continue;
            }
            this._currentData.addPledge(a, {s: p.b, v: p.v, e: null});
            this._statisticData.addAddress(a);
        }
    },

    // for distribute.js
    getPledge: function (startBlock, endBlock) {
        this._verifyFromDistribute();
        return this._currentData.getDistributePledges(startBlock, endBlock);
    },

    // for distribute.js
    setPledgeResult: function (startBlock, endBlock, data) {
        this._verifyFromDistribute();
        this._currentData.lastBlock = endBlock;
        let deleted = this._currentData.checkAndDelete();
        for (let i = 0; i < deleted.length; ++i) {
            let d = deleted[i];
            this._historyData.addPledge(d.a, d.p);
        }

        for (let i = 0; i < data.length; ++i) {
            let d = data[i];
            this._statisticData.addNat(d.addr, d.nat);
            this._distributeData.addDistribute(d.addr, {v: d.value, d: d.nat, s: startBlock, e: endBlock});
        }
    },

    getAddressIndexes: function () {
        return this._addresses.getPageIndexes();
    },

    getAddresses: function (index) {
        return this._addresses.getPageData(index);
    },

    getCurrentPledges: function (address) {
        return this._currentData.getCurrentPledges(address);
    },

    getHistoryPledgeIndexes: function (address) {
        return this._historyData.getHistoryPledgeIndexes(address);
    },

    getHistoryPledges: function (address, index) {
        return this._historyData.getHistoryPledges(address, index);
    },

    getTotalDistribute: function (address) {
        return this._statisticData.getNat(address);
    },

    getDistributeIndexes: function (address) {
        return this._distributeData.getDistributeIndexes(address);
    },

    getDistributes: function (address, index) {
        return this._distributeData.getDistributes(address, index);
    },
};

module.exports = Pledge;
