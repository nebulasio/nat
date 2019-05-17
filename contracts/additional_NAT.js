function Additional() {
    this._contractName = "Additional";
    LocalContractStorage.defineProperties(this, {
        _data: null,
        _manager: null,
        _config: null
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
        if (!(data instanceof Array)) {
            throw ("Data format error.");
        }
        this._data = data;
    },

    getConfig: function () {
        return this._config;
    },

    setConfig: function (config) {
        this._config = config;
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
