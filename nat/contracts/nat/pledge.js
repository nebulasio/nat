function Pledge(storage) {
    this._storage = storage;
    this._pledgeDataPrefix = "pledge_";
    this._pledgeAddressList = new PageList(this._storage, "pledge_address_list");
}

Pledge.prototype = {

    _pledgeDataKey: function (address) {
        return this._pledgeDataPrefix + address;
    },

    _getPledge: function (address) {
        let p = this._storage.get(this._pledgeDataKey(address));
        if (!p) {
            p = []
        }
        return p;
    },

    _setPledge: function (address, pledge) {
        this._storage.put(this._pledgeDataKey(address), pledge);
    },

    receiveData: function (data) {
        for (let i = 0; i < data.length; ++i) {
            let a = data[i].a;
            let d = data[i].d;
            let p = this._getPledge(a);
            if (p.length === 0) {
                this._pledgeAddressList.add(a);
            }
            for (let j = 0; j < d.length; ++j) {
                d[j].r = false;
                p.push(d[j]);
            }
            this._setPledge(a, p);
        }
    },

    pledge: function (n) {
        n = this._getInt(n);
        if (n < 1) {
            throw ("The pledge period cannot be less than 1");
        }
        let unit = new BigNumber(10).pow(18);
        if (unit.gt(Blockchain.transaction.value)) {
            throw ("The amount cannot be less than 1 NAS");
        }
        let a = Blockchain.transaction.from;
        let b = Blockchain.block.height;
        let v = new BigNumber(Blockchain.transaction.value).div(unit).toString(10);
        let p = this._getPledge(a);
        if (p.length === 0) {
            this._addAddress(Blockchain.transaction.from);
        }
        p.push({b: b, v: v, n: n, r: false});
        this._setPledge(a, p);
    },

    checkAndReturn: function () {
        // TODO:
    },

    getAddressIndexes: function () {
        return this._pledgeAddressList.getPageIndexes();
    },

    getAddresses: function (index) {
        return this._pledgeAddressList.getPageData(index);
    },

    getPledgeWithAddress: function (address) {
        return this._getPledge(address);
    }
};

Pledge.instance = null;
