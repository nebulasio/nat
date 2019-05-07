let Base = {
    _verifyAddress: function (address) {
        if(Blockchain.verifyAddress(address) === 0) {
            throw (address + " is not a valid nas address");
        }
    },

    _verifyContractAddress: function (address) {
        if(Blockchain.verifyAddress(address) !== 88) {
            throw (address + " is not a valid nas contract address");
        }
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
