function PageList(storage, key) {
    this._storage = storage;
    this._key = key;
    this._pageIndexes = null;
    this._pageSize = 1000;
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
    }
};

function Pledge() {
    this._contractName = "Pledge";
    LocalContractStorage.defineMapProperty(this, "storage", {
        parse: function (text) {
            return JSON.parse(text);
        },
        stringify: function (obj) {
            return JSON.stringify(obj);
        }
    });
    this._managers = ["n1Z6MhSZa321SnpiKfUWiybQSG3GCmRHunv"];
    this._keyAddresses = "addresses";
    this._keyCanPledge = "can_pledge";
    this._keyCanExport = "can_export";
    this._addressList = new PageList(this.storage, "addresses");
}

Pledge.prototype = {

    init: function () {

    },

    _addAddress: function (address) {
        this._addressList.add(address);
    },

    _canPledge: function () {
        let r = this.storage.get(this._keyCanPledge);
        if (r == null) {
            return true;
        }
        return r;
    },

    _stopPledge: function () {
        this.storage.put(this._keyCanPledge, false);
    },

    _canExport: function () {
        let r = this.storage.get(this._keyCanExport);
        if (r == null) {
            return true;
        }
        return r;
    },

    _setIsExported: function () {
        this.storage.put(this._keyCanExport, false);
    },

    _getPledge: function (address) {
        let p = this.storage.get(address);
        if (!p) {
            p = []
        }
        return p;
    },

    _setPledge: function (address, pledge) {
        this.storage.put(address, pledge);
    },

    pledge: function (n) {
        if (!this._canPledge()) {
            throw ("This contract no longer accepts new pledges, please use the official new contract.");
        }
        let min = new BigNumber(1).mul(new BigNumber(10).pow(18));
        if (min.gt(Blockchain.transaction.value)) {
            throw ("The amount must be greater than 1 NAS");
        }
        let a = Blockchain.transaction.from;
        let b = Blockchain.block.height;
        let v = new BigNumber(Blockchain.transaction.value).toString(10);
        let p = this._getPledge(a);
        if (p.length === 0) {
            this._addAddress(Blockchain.transaction.from);
        }
        p.push({b: b, v: v, n: n});
        this._setPledge(a, p);
    },

    stop: function () {
        if (this._managers.indexOf(Blockchain.transaction.from) < 0) {
            throw ("No permission");
        }
        this._stopPledge();
    },

    exportDataToNat: function (natContractAddress) {
        if (this._managers.indexOf(Blockchain.transaction.from) < 0) {
            throw ("No permission");
        }

        if (!this._canExport()) {
            throw ("Data has been exported.");
        }

        let nat = new Blockchain.Contract(natContractAddress);

        let indexes = this.getAddressIndexes();
        for (let i = 0; i < indexes.length; ++i) {
            let index = indexes[i];
            let as = this.getAddresses(index.i);
            nat.call("receiveAddress", as);
            for (let j = 0; j < as.length; ++j) {
                nat.call("receivePledge", as[j], this._getPledge(as[j]));
            }
        }
        let b = Blockchain.getAccountState(Blockchain.transaction.to).balance;
        Blockchain.transfer(natContractAddress, b);
        this._setIsExported();
    },

    getAddressIndexes: function () {
        return this._addressList.getPageIndexes();
    },

    getAddresses: function (index) {
        return this._addressList.getPageData(index);
    },

    getPledgeWithAddress: function (address) {
        return this._getPledge(address);
    },

    accept: function () {
        Event.Trigger("transfer", {
            Transfer: {
                from: Blockchain.transaction.from,
                to: Blockchain.transaction.to,
                value: Blockchain.transaction.value,
            }
        });
    }
};

module.exports = Pledge;
