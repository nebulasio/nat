function PledgeProxy() {
    this._contractName = "PledgeProxy";
    LocalContractStorage.defineProperties(this, {
        _allowPledge: null, // whether allow to pledge
        _allowFundManager: null, // whether fund manager can transfer the money
        _config: null,
    });
    this._pledge = null;
}

PledgeProxy.prototype = {

    init: function (multiSignAddr) {
        // make sure this address is valid
        this._verifyAddress(multiSignAddr);
        // initial the status
        this._allowPledge = true;
        this._allowFundManager = false;
        this._config = {multiSign: multiSignAddr};
    },

    _verifyAddress: function (address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw ("Address error");
        }
    },

    _allowControl: function () {
        return this._config.multiSign === Blockchain.transaction.from;
    },

    _allowTransferFund: function () {
        if (this._allowControl()) {
            return true;
        }
        return (this._allowFundManager && this._config.fundManager === Blockchain.transaction.from);
    },

    _verifyConfig: function (config) {
        this._verifyAddress(config.multiSign);
        this._verifyAddress(config.pledge);
        if (config.fundManager) {
            this._verifyAddress(config.fundManager);
        }
    },

    get pledgeContract() {
        if (!this._pledge) {
            if (!this._config.pledge) {
                throw ("Pledge not found.");
            }
            this._pledge = new Blockchain.Contract(this._config.pledge);
        }
        return this._pledge;
    },

    // Get config address
    getConfig: function () {
        return this._config;
    },

    // Update config address
    // For multisig only
    setConfig: function (config) {
        if (!this._allowControl()) {
            throw ("permission denied!");
        }
        this._verifyConfig(config);
        this._config = config;
    },

    // for mlultisig only
    closePledge: function () {
        if (!this._allowControl()) {
            throw ("permission denied!");
        }
        this._allowPledge = false;
    },

    // for multisig only
    openPledge: function () {
        if (!this._allowControl()) {
            throw ("permission denied!");
        }
        this._allowPledge = true;
    },

    getStatus: function (statusName) {
        if (statusName === "allowPledge") {
            return this._allowPledge;
        }
        if (statusName === "allowFundManager") {
            return this._allowFundManager;
        }
    },

    pledge: function () {
        if (!this._allowPledge) {
            throw ("This contract no longer accept new pledges.");
        }
        let value = Blockchain.transaction.value;
        let from = Blockchain.transaction.from;
        this.pledgeContract.call('pledge', from, value);
        Event.Trigger("pledgeRedirect", {
            Transfer: {
                from: from,
                to: Blockchain.transaction.to,
                value: value,
            }
        });
    },

    // proxy redirect to pledge.js
    cancelPledge: function () {
        if (!this._allowPledge) {
            throw ("This contract no longer accept new pledges. ");
        }
        // Call pledge.js cancelPledge function to check plege status and update the data
        // it will return a value with bigNumber, please see pledge.js
        // if cancel failed or the address not pledge, it will fail in this step
        let value = this.pledgeContract.call('cancelPledge', Blockchain.transaction.from);
        // transfer the fund if cancel pledge data updated success
        let r = Blockchain.transfer(Blockchain.transaction.from, value);
        if (r) {
            Event.Trigger("cancelPledge", {
                Transfer: {
                    from: Blockchain.transaction.to,
                    to: Blockchain.transaction.from,
                    value: value
                }
            });
        }
    },

    // for multisig and fund manager
    transferFund: function (newAddr) {
        if (!this._allowTransferFund()) {
            throw ("Permission denied!");
        }
        let c = new Blockchain.Contract(newAddr);
        let b = Blockchain.getAccountState(Blockchain.transaction.to).balance;
        let r = c.value(new BigNumber(b)).call('acceptFund');
        if (r) {
            Event.Trigger("transferFund", {
                Transfer: {
                    from: Blockchain.transaction.to,
                    to: newAddr,
                    value: b,
                }
            });
        } else {
            throw("Transfer Amount failed");
        }
        return r;
    },

    // accept fund when necessary
    acceptFund: function () {
        let value = Blockchain.transaction.value;
        let from = Blockchain.transaction.from;

        Event.Trigger("Accept fund from outsource", {
            Transfer: {
                from: from,
                to: Blockchain.transaction.to,
                value: value,
            }
        });
    },

    // proxy redirect to pledge.js
    getAddressIndexes: function () {
        let result = this.pledgeContract.call('getAddressIndexes');
        return result != null ? result : "No data found";
    },

    // proxy redirect to pledge.js
    getAddresses: function (index) {
        let result = this.pledgeContract.call('getAddresses', index);
        return result != null ? result : "No data found";
    },

    // proxy redirect to pledge.js
    getCurrentPledges: function (address) {
        let result = this.pledgeContract.call('getCurrentPleges', address);
        return result != null ? result : "No data found";
    },

    // proxy redirect to pledge.js
    getHistoryPledgeIndexes: function (address) {
        let result = this.pledgeContract.call('getHistoryPledgeIndexes', address);
        return result != null ? result : "No data found";
    },

    // proxy redirect to pledge.js
    getHistoryPledges: function (address, index) {
        let result = this.pledgeContract.call('getHistoryPledges', address, index);
        return result != null ? result : "No data found";
    },

    // proxy redirect to pledge.js
    getTotalDistribute: function (address) {
        let result = this.pledgeContract.call('getTotalDistribute', address);
        return result != null ? result : "No data found";
    },

    // proxy redirect to pledge.js
    getDistributeIndexes: function (address) {
        let result = this.pledgeContract.call('getDistributeIndexes', address);
        return result != null ? result : "No data found";
    },

    // proxy redirect to pledge.js
    getDistributes: function (address, index) {
        let result = this.pledgeContract.call('getDistributes', address, index);
        return result != null ? result : "No data found";
    },
};

module.exports = PledgeProxy;
