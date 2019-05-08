/*
    This is a simple multisig smart contract, any cosigner in the list will be able to get through the function call
    Will be replaced by a real multsig in future
    @author: Zhuoer Wang, Ping Guo, Qiyuan Wang
*/

function MultiSig() {
    this._contractName = "MultiSig";
    /*
    _config format:
    natConfig:
    {
        multiSig: null, // multisig address
        distribute: null, // distribute.js address
        distributeManager: null, // distribute.js manager(can be empty)
        pledgeProxy: null, // pledge proxy address
        pledgeProxyManager: null, //pledge proxy fund manager(can be empty)
        pledge: null, //pledge contract address
        nrData: null, //nr data contract address
        natNRC20: null, // NAT NRC 20 contract address
    }
    contractList:
    {
        distribute: addr1, // distribute.js
        pledge_proxy: addr2, // pledge_proxy.js
        pledge: addr3, // pledge.js
        nr_data: addr4, // nr_data.js
        nat_nrc20: addr5 // nat_nrc20.js
        vote: addr6,    // vote.js
    }
    */
    LocalContractStorage.defineProperties(this, {
        _coSigners: null, // List of coSigner Addr
        _config: null // all the smart contract configration
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
        // Set coSigners Addresses
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

    // verify config
    _verifyConfig: function (config) {
        let natConfig = config.natConfig;
        for (let conf in natConfig) {
            this._verifyAddress(natConfig.con);
        }

        let contractList = config.contractList;
        for (let conf in natConfig) {
            this._verifyAddress(natConfig.con);
        }
    },

    // Get config address
    getConfig: function() {
        this._verifyConfig();
        return this._config;
    },

    // Set Config
    setConfig: function(config) {
        this._verifyConfig(config);
        // update the config to other smart contract
        let natConfig = config.natConfig;
        let contractList = config.contractList;

        for (contractName in contractList) {
            let contractObj = new Blockchain.Contract(contractList.contractName);
            contractObj.call("setConfig", natConfig);
        } 
        // update current config
        this_.config = config;
    },

    // Get coSigner 
    getCosigners: function() {
        this._verifyCosigner();
        return this._coSigners
    },

    // Set coSigner
    setCosigners: function(coSigners) {
        // Check whether it is from cosigner 
        this._verifyCosigner();
        for (let i = 0; i < coSigners.length; ++i) {
            this._verifyAddress(coSigner[i]);
        } 
        this._coSigners = coSigners;
    },
};

module.exports = MultiSig;
