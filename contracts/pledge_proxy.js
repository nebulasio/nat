/*
    This is a simple multisig smart contract, any cosigner in the list will be able to get through the function call
    @author: Zhuoer Wang, Ping Guo, Qiyuan Wang
*/
function PledgeProxy() {
    this._contractName = "PledgeProxy";
    LocalContractStorage.defineProperties(this, {
        _allowPledge: null, // whether allow to pledge
        _allowFundManager: null, // whether fund manager can transfer the money
        _config: null, // contain all contract addresses
    });
    this._pledgeContractObj = null; // pledge.js contract obj
}

PledgeProxy.prototype = {

    init: function (multiSigAddr) {
        // make sure this address is valid
        this._verifyAddress(multiSigAddr);
        // initial the status
        this._allowPledge = true;
        this._allowFundManager = false;
        this._config = {multiSig: multiSigAddr};
    },

    _verifyAddress: function (address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw ("Address error");
        }
    },

    _allowControl: function () {
        return this._config.multiSig === Blockchain.transaction.from;
    },

    _allowTransferFund: function () {
        if (this._allowControl()) {
            return true;
        }
        return (this._allowFundManager && this._config.pledgeProxyManager === Blockchain.transaction.from);
    },

    get pledgeContract() {
        if (!this._pledgeContractObj) {
            if (!this._config.pledge) {
                throw ("Pledge not found.");
            }
            this._pledgeContractObj = new Blockchain.Contract(this._config.pledge);
        }
        return this._pledgeContractObj;
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
        this._config = config;
    },

    setAllowPledge: function (allowed) {
        if (!this._allowControl()) {
            throw ("permission denied!");
        }
        this._allowPledge = allowed;
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
        return this.pledgeContract.call('getAddressIndexes');
    },

    // proxy redirect to pledge.js
    getAddresses: function (index) {
        return this.pledgeContract.call('getAddresses', index);
    },

    // proxy redirect to pledge.js
    getCurrentPledge: function (address) {
        return this.pledgeContract.call('getCurrentPledge', address);
    },

    // proxy redirect to pledge.js
    getHistoryPledgeIndexes: function (address) {
        return this.pledgeContract.call('getHistoryPledgeIndexes', address);
    },

    // proxy redirect to pledge.js
    getHistoryPledges: function (address, index) {
        return this.pledgeContract.call('getHistoryPledges', address, index);
    },

    // proxy redirect to pledge.js
    getTotalDistribute: function (address) {
        return this.pledgeContract.call('getTotalDistribute', address);
    },

    // proxy redirect to pledge.js
    getDistributeIndexes: function (address) {
        return this.pledgeContract.call('getDistributeIndexes', address);
    },

    // proxy redirect to pledge.js
    getDistributes: function (address, index) {
        return this.pledgeContract.call('getDistributes', address, index);
    },
};

module.exports = PledgeProxy;
