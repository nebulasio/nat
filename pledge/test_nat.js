function TestNat() {
    this._contractName = "TestNat";

    LocalContractStorage.defineMapProperty(this, "storage", {
        parse: function (text) {
            return JSON.parse(text);
        },
        stringify: function (obj) {
            return JSON.stringify(obj);
        }
    });
}

TestNat.prototype = {
    receivePledgeData: function (data) {
        console.log("onReceiveData", data);
    }
};
