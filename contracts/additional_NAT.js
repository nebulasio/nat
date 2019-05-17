function Additional() {
    this._contractName = "Additional";
    LocalContractStorage.defineProperties(this, {
        _data: null,
        _manager: null
    });
}

Additional.prototype = {

    _verifyAddress: function (address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw ("Address error");
        }
    },

    _verifyManager: function () {
        if (Blockchain.transaction.from !== this._manager) {
            throw ("Permission Denied!");
        }
    },

    init: function (manager) {
        this._verifyAddress(manager);
        this._manager = manager;
    },

    upload: function (data) {
        this._verifyManager();
        this._data = data;
    },

    produce: function () {
        this._verifyManager();
        if (!this._data || this._data.length === 0) {
            throw ("Data cannot be empty.");
        }
        let natContract = new Blockchain.Contract("n1mpgNi6KKdSzr7i5Ma7JsG5yPY9knf9He7");
        natContract.call("produce", this._data);
        Event.Trigger("additional", {
            data: this._data
        });
    }
};

module.exports = Additional;
