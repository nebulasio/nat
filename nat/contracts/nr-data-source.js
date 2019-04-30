function NrDataSource() {
    this._contractName = "NrDataSource";
    LocalContractStorage.defineProperties(this, {
        _managers: null
    });
    LocalContractStorage.defineMapProperty(this, "_storage", null);
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
        this._storage.put(this._key(data.startBlock, data.endBlock), data.addresses);
    },

    getAddresses: function (startBlock, endBlock) {
        let r = this._storage.get(this._key(startBlock, endBlock));
        if (!r) {
            r = [];
        }
        return r;
    }
};

module.exports = NrDataSource;
