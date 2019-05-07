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
        return this._storage.get(this._pledgeDataKey(address));
    },

    _setPledge: function (address, pledge) {
        this._storage.put(this._pledgeDataKey(address), pledge);
    },

    receivePledgeData: function (data) {
        for (let i = 0; i < data.length; ++i) {
            let a = data[i].a;
            let p = data[i].p;
            p.r = false;
            if (p.c) {
                continue;
            }
            this._pledgeAddressList.add(a);
            this._setPledge(a, {b: null, h: p.b, v: p.v, r: false, n: null});
        }
    },

    pledge: function () {
        let unit = new BigNumber(10).pow(18);
        if (unit.gt(Blockchain.transaction.value)) {
            throw ("The amount cannot be less than 1 NAS");
        }
        let b = new BigNumber(Blockchain.getAccountState(a).balance).div(unit).toString(10);
        let a = Blockchain.transaction.from;
        let h = Blockchain.block.height;
        let v = new BigNumber(Blockchain.transaction.value).div(unit).toString(10);
        let p = this._getPledge(a);
        if (!p) {
            this._addAddress(Blockchain.transaction.from);
        }
        p = {b: b, h: h, v: v, r: false, n: null};
        this._setPledge(a, p);
    },

    checkAndReturn: function (v) {
        // TODO:
    },

    getAddressIndexes: function () {
        return this._pledgeAddressList.getPageIndexes();
    },

    getAddresses: function (index) {
        return this._pledgeAddressList.getPageData(index);
    },

    getCurrentPledge: function (address) {
        return this._getPledge(address);
    },

    getAllPledges: function (address) {
        // TODO
    }
};

Pledge.instance = null;
