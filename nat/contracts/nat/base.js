let Base = {
    _verifyAddress: function (address) {
        return Blockchain.verifyAddress(address) !== 0;
    },
    _getInt: function (num) {
        if (!/^\d+$/.test(num + "")) {
            throw (num + " is not an integer.");
        }
        return parseInt(num);
    },
    _getFloat: function (num) {
        if (!/^\d+(\.\d+)?$/.test(num + "")) {
            throw (num + " is not a valid floating point number.");
        }
        return parseFloat(num);
    },
};
