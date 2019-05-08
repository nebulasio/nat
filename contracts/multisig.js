/*
    This is a simple multisig smart contract, any cosigner in the list will be able to get through the function call
    @author: Zhuoer Wang, Ping Guo, Qiyuan Wang
*/
function MultiSig() {
    this._contractName = "MultiSig";
    LocalContractStorage.defineProperties(this, {
        _coSigners: null, // List of coSigner Addr
    });
}

MultiSig.prototype = {
    init: function (coSigners) {
        if (!coSigners || coSigners.length === 0) {
            throw ("Need at least one co-signers");
        }
        for (let i = 0; i < coSigners.length; ++i) {
            this._verifyAddress(coSigners[i]);
        }   
        this._coSigners = coSigners;
    },

    _verifyAddress: function (address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw ("Address format error");
        }
    },

    _verifyCosigner: function () {
        if (this._coSigners.indexOf(Blockchain.transaction.from) < 0) {
            throw ("Permission Denied!");
        }   
    }, 

    // Get config address
    getConfig: function() {
        this._verifyCosigner();
        let config = {cosigners: this._cosigner,
                     };
        return config;
    },

    // Update config address - multisig only
    updateConfig: function(config) {
        // Check whether it is from cosigner 
        this._verifyCosigner();
        for ("coSigners" in config) {
            this.coSigner = config.coSigners; 
        }
        // Update others 
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
};

module.exports = MultiSig;
