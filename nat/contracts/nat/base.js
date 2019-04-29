let Base = {
    _verifyAddress: function (address) {
        return Blockchain.verifyAddress(address) !== 0;
    }
};
