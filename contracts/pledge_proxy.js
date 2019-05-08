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
        if (this._verifyAddress(multisigAddr) === 0) {
            throw ("The multisig address is invalid");
        }
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
            if (this._verifyAddress(fundManagerAddr) === )) {
                throw ("Invalid Address");
            }
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

    closePledge: function() {
        if (!this._allowControl()) {
            throw ("permission denied!");
        }
        this._allowPledge = false; 
    },

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
        let value = Blockchain.transcation.value;
        let from = Blockchain.transcation.from;
        let c = new Blockchain.Contract(targetAddr);
        // TODO add try catch
        c.value(value).call('pledge', from, value);
        Event.Trigger("pledgeRedirect", {
            Transfer: {
                from: from,
                to: targetAddr,
                value: value,
            }
        });
    },

    cancelPledge: function () {
        if (!this._allowPledge) {
            throw ("This contract no longer accept new pledges. ");
        }
        let targetAddr = this._pledgeContractAddr;
        let value = Blockchain.transcation.value;
        let from = Blockchain.transcation.from;
        let c = new Blockchain.Contract(targetAddr);
        // TODO add try catch
        let r = c.call('cancelPledge', from);
        if (r.pledged) {
            let v = new BigNumber(r.v).mul(this._unit);
            let rr = Blockchain.transfer(from, v); 
            if (rr) {
                Event.Trigger("transferCancelPledge", {
                    Transfer: {
                        from: Blockchain.transaction.from,
                    }
                });
            } else {
                throw ("Cancel pledge failed");
            }
            Event.Trigger("transferCancelPledge", {
                Transfer: {
                    from: Blockchain.transaction.from,
                    value: v,
                }
            });
        } else {
            throw ("Can not cancel, this address is not pledged yet!");
        }
    },

    stopPledge: function () {
        this._verifyManager();
        this._canPledge = false;
    },

    transferFund: function (newAddr) {
        if (!_allowTransferFund()) {
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

    acceptFund: function() {
        let value = Blockchain.transcation.value;
        let from = Blockchain.transcation.from;

        Event.Trigger("Accept fund from outsource", { 
            Transfer: {
                from: from,
                value: value,
            }
        });
    }

    getPledgeIndexes: function () {
        let targetAddr = this._pledgeContractAddr;
        let c = new Blockchain.Contract(targetAddr);
        let r = c.call('getAddressIndexes');
        if (r.result) {
            Event.Trigger("getAddressIndexes", { 
                Transfer: {
                    from: Blockchain.transaction.from,
                }
            });
            return r.data;
        } else {
            throw ("No data found");
        }
    },

    getPledgeHistoryByAddr: function(searchAddr) {
        let targetAddr = this._pledgeContractAddr;
        let c = new Blockchain.Contract(targetAddr);
        let r = c.call('getPledgeHistoryByAddr', searchAddr);
        if (r.result) {
            Event.Trigger("getPledgeHistoryByAddr", { 
                Transfer: {
                    from: Blockchain.transaction.from,
                    searchAddr: searchAddr,
                }
            });
            return r.data;
        } else {
            throw ("No data found");
        }
    },
};

module.exports = PledgeProxy;
