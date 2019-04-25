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
    this._managers = ["n1Y46QgEgdpK7hygMmtWtwikJ7kNaC6Dfuh"];
    this._keyAddresses = "addresses";
    this._keyCanPledge = "can_pledge";
    this._addressList = new PageList(this.storage, "addresses");
}

Pledge.prototype = {

    init: function () {

    },

    _getAddresses: function (index) {
        return this._addressList.getPageData(index);
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
        if (NebUtils.toBigNumber(0).gte(Blockchain.transaction.value)) {
            throw ("The amount must be greater than 0");
        }
        let a = Blockchain.transaction.from;
        let b = Blockchain.block.height;
        let v = NebUtils.toBigNumber(Blockchain.transaction.value);
        let p = this._getPledge(a);
        if (p.length === 0) {
            this._addAddress(Blockchain.transaction.from);
        }
        p.push({a: a, b: b, v: v, n: n});
        this._setPledge(a, p);
    },

    stopAndExportDataToNat: function (natContractAddress) {
        if (this._managers.indexOf(Blockchain.transaction.from) < 0) {
            throw ("No permission");
        }

        let nat = new Blockchain.Contract(natContractAddress);

        let indexes = this.getPledgesIndexes();
        for (let i = 0; i < indexes.length; ++i) {
            let index = indexes[i];
            let ps = this.getPledges(index.i);
            nat.call("receivePledgeData", ps);
        }

        let b = Blockchain.getAccountState(Blockchain.transaction.to).balance;
        Blockchain.transfer(natContractAddress, b);
        this._stopPledge();
    },

    getPledgesIndexes: function () {
        return this._addressList.getPageIndexes();
    },

    getPledges: function (index) {
        let as = this._getAddresses(index);
        let r = [];
        for (let i = 0; i < as.length; ++i) {
            r.push(this._getPledge(as[i]));
        }
        return r;
    }
};
