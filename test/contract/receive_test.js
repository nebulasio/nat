function ReceiveTest() {
    this._contractName = "ReceiveTest";
}

ReceiveTest.prototype = {
    init: function () {
    },
    acceptFund: function () {
        return true;
    }
};

module.exports = ReceiveTest;
