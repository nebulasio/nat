function ExchangeAddressManager(storage) {
    this._storage = storage;
    this._keyPrefix = "exchange_";
}

ExchangeAddressManager.prototype = Object.assign({

    _key: function (address) {
        return this._keyPrefix + address;
    },

    addAddresses: function (addresses) {
        let n = 0;
        for (let i = 0; i < addresses.length; ++i) {
            let a = addresses[i];
            if (this._storage.get(this._key(a))) {
                continue;
            }
            if (!this._verifyAddress(a)) {
                continue;
            }
            this._storage.put(this._key(a), "");
            n++;
        }
        return n;
    },

    removeAddresses: function (addresses) {
        let n = 0;
        for (let i = 0; i < addresses.length; ++i) {
            let a = addresses[i];
            if (this._storage.get(this._key(a))) {
                this._storage.del(this._key(a));
                n++;
            }
        }
        return n;
    }
}, Base);
