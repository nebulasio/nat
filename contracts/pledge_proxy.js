function PledgeProxy() {
    this._contractName = "PledgeProxy";
    LocalContractStorage.defineProperties(this, {
        _allowPledge: null, // whether allow to pledge
        _allowFundManager: null, // whether fund manager can transfer the money
        _multisigAddr: null, // multisig controller address
        _fundManagerAddr:null,  // who is able to move the fund
        _pledgeContractAddr: null // pledge contract
    });
    // Constant value
    this._unit = new BigNumber(10).pow(18);
}

PledgeProxy.prototype = {

    init: function (multisigAddr) {
        // make sure there is a multisig contract address exist when deploy
        if (!multisigAddr || multisigAddr.length === 0) {
            throw ("Need to define the multisig address");
        }
        // make sure this address is valid
        this._verifyAddress(multisigAddr);
        // initial the status
        this._allowPledge = true;
        this._allowFundManager = false;
        this._multisigAddr = multisigAddr;
    },

    _verifyAddress: function (address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw ("Address error");
        }
    },

    _allowControl: function () {
        return this.multisigAddr === Blockchain.transaction.from;
    },

    _allowTransferFund: function () {
        if (this._allowControl) {
            return true;
        } 
        if (this._allowFundManager && this._fundManagerAddr === Blockchain.transaction.from) {
            return true;
        }
        return false;
    },

    // Get config address
    getConfig: function(configName) {
        if (configName === "multisigAddress") {
            return this._multisigAddr;
        }
        if (configName === "fundManager") {
            return this._fundManagers;
        }
    },

    // Update config address
    // For multisig only
    updateConfig: function(configName, addr) {
        if (!this._allowControl()) {
            throw ("permission denied!");
        }

        // Update multisigAddr
        if (configName === "multisigAddr") {
            this.multisigAddr = Blockchain.transaction.from;
            return true;
        }

        // Update fund manager
        if (configName === "fundManager") {
            let fundManagerAddr = addr;
            this._verifyAddress(fundManagerAddr);
            this._fundManagers = fundManagerAddr;
            return true;
        }

        // Update pledge smart contract
        if (configName === "pledgeContractAddr") {
            let pledgeContractAddr = addr; 
            this._pledgeContractAddr = pledgeContractAddr;
            return true;
        }
    },

    // for mlultisig only
    closePledge: function() {
        if (!this._allowControl()) {
            throw ("permission denied!");
        }
        this._allowPledge = false; 
    },

    // for multisig only
    openPledge: function() {
         if (!this._allowControl()) {
            throw ("permission denied!");
        }
        this._allowPledge = true; 
    },

    getStatus: function(statusName) {
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
        let targetAddr = this._pledgeContractAddr;
        let value = Blockchain.transaction.value;
        let from = Blockchain.transaction.from;
        let c = new Blockchain.Contract(targetAddr);
        c.value(value).call('pledge', from, value);
        Event.Trigger("pledgeRedirect", {
            Transfer: {
                from: from,
                to: targetAddr,
                value: value,
            }
        });
    },

    // proxy redirect to pledge.js
    cancelPledge: function () {
        if (!this._allowPledge) {
            throw ("This contract no longer accept new pledges. ");
        }
        let targetContractAddr = this._pledgeContractAddr;
        let c = new Blockchain.Contract(targetContractAddr);

        let targetAddr = Blockchain.transaction.from;
        // Call pledge.js cancelPledge function to check plege status and update the data
        // it will return a value with bigNumber, please see pledge.js
        // if cancel failed or the address not pledge, it will fail in this step
        let value = c.call('cancelPledge', targetAddr);
        // transfer the fund if cancel pledge data updated success
        let r = Blockchain.transfer(targetAddr, value); 
        if (r) {
            Event.Trigger("cancelPledge", {
                Transfer: {
                    from: targetAddr,
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
        r = c.value(new BigNumber(b)).call('acceptFund');
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
    acceptFund: function() {
        let value = Blockchain.transaction.value;
        let from = Blockchain.transaction.from;

        Event.Trigger("Accept fund from outsource", { 
            Transfer: {
                from: from,
                value: value,
            }
        });
    }

    // proxy redirect to pledge.js
    getAddressIndexes: function () {
        let targetAddr = this._pledgeContractAddr;
        let c = new Blockchain.Contract(targetAddr);
        let result = c.call('getAddressIndexes');
        if (result) {
            Event.Trigger("getAddressIndexes", { 
                Transfer: {
                    from: Blockchain.transaction.from,
                }
            });
            return result;
        } else {
            throw ("No data found");
        }
    },  

    // proxy redirect to pledge.js
    getAddresses: function (index) {
        let targetAddr = this._pledgeContractAddr;
        let c = new Blockchain.Contract(targetAddr);
        let result = c.call('getAddresses', index);
        if (result) {
            Event.Trigger("getAddresses", { 
                Transfer: {
                    from: Blockchain.transaction.from,
                    index: index
                }
            });
            return result;
        } else {
            throw ("No data found");
        }
    },  

    // proxy redirect to pledge.js
    getCurrentPledges: function (address) {
        let targetAddr = this._pledgeContractAddr;
        let c = new Blockchain.Contract(targetAddr);
        let result = c.call('getCurrentPleges', address);
        if (result) {
            Event.Trigger("getCurrentPleges", { 
                Transfer: {
                    from: Blockchain.transaction.from,
                    addr: address
                }
            });
            return result;
        } else {
            throw ("No data found");
        }
    },  

    // proxy redirect to pledge.js
    getHistoryPledgeIndexes: function (address) {
        let targetAddr = this._pledgeContractAddr;
        let c = new Blockchain.Contract(targetAddr);
        let result = c.call('getHistoryPledgeIndexes', address);
        if (result) {
            Event.Trigger("getHistoryPledgeIndexes", { 
                Transfer: {
                    from: Blockchain.transaction.from,
                    addr: address
                }
            });
            return result;
        } else {
            throw ("No data found");
        }
    },  

    // proxy redirect to pledge.js
    getHistoryPledges: function (address, index) {
        let targetAddr = this._pledgeContractAddr;
        let c = new Blockchain.Contract(targetAddr);
        let result = c.call('getHistoryPledges', address, index);
        if (result) {
            Event.Trigger("getHistoryPledges", { 
                Transfer: {
                    from: Blockchain.transaction.from,
                    addr: address
                }
            });
            return result;
        } else {
            throw ("No data found");
        }
    },  

    // proxy redirect to pledge.js
    getTotalDistribute: function (address) {
        let targetAddr = this._pledgeContractAddr;
        let c = new Blockchain.Contract(targetAddr);
        let result = c.call('getTotalDistribute', address);
        if (result) {
            Event.Trigger("getTotalDistribute", { 
                Transfer: {
                    from: Blockchain.transaction.from,
                    addr: address
                }
            });
            return result;
        } else {
            throw ("No data found");
        }
    },  

    // proxy redirect to pledge.js
    getDistributeIndexes: function (address) {
        let targetAddr = this._pledgeContractAddr;
        let c = new Blockchain.Contract(targetAddr);
        let result = c.call('getDistributeIndexes', address);
        if (result) {
            Event.Trigger("getDistributeIndexes", { 
                Transfer: {
                    from: Blockchain.transaction.from,
                    addr: address
                }
            });
            return result;
        } else {
            throw ("No data found");
        }
    },  

    // proxy redirect to pledge.js
    getDistributes: function (address, index) {
        let targetAddr = this._pledgeContractAddr;
        let c = new Blockchain.Contract(targetAddr);
        let result = c.call('getDistributes', address, index);
        if (result) {
            Event.Trigger("getDistributes", { 
                Transfer: {
                    from: Blockchain.transaction.from,
                    addr: address,
                    index:index
                }
            });
            return result;
        } else {
            throw ("No data found");
        }
    }, 
};

module.exports = PledgeProxy;
