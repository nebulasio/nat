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
        multiSig: addr, // multisig address
        distribute: addr, // distribute.js address
        distributeVoteTaxAddr: addr, // distribute Vote Tax to a particular address
        natProducers: [addr1, addr2], // allow trigger to get data from a particular producer (it is a list)
        distributeManager: addr, // distribute.js manager(can be empty)
        pledgeProxy: addr, // pledge proxy address
        pledgeProxyManager: addr, //pledge proxy fund manager(can be empty)
        pledge: addr, //pledge contract address
        nrData: addr, //nr data contract address
        nrDataManager: addr,
        natNRC20: addr, // NAT NRC 20 contract address
        vote: [addr]
    },
    switches: {
        allowPledge: true,
        allowUploadNRScore: true,
    },
    contractList:
    {
        distribute: addr1, // distribute.js
        pledge_proxy: addr2, // pledge_proxy.js
        pledge: addr3, // pledge.js
        nr_data: addr4, // nr_data.js
        nat_nrc20: addr5 // nat_nrc20.js
        vote: [addr6],    // vote.js
    }
    */
    this._canEmptyConfig = ["distributeManager", "pledgeProxyManager"];
    this._allConfigNames = [
        "multiSig",
        "distribute",
        "distributeVoteTaxAddr",
        "distributeManager",
        "pledgeProxy",
        "pledgeProxyManager",
        "pledge",
        "nrData",
        "nrDataManager",
        "natNRC20",
        "vote",
    ];
    this._allContractNames = [
        "distribute",
        "pledge_proxy",
        "pledge",
        "nr_data",
        "nat_nrc20",
        "vote",
    ];
    this._switches = [
        "allowPledge",
        "allowUploadNRScore"
    ];
    LocalContractStorage.defineProperties(this, {
        _coSigners: null, // List of coSigner Addr
        _config: null, // all the smart contract configration
        _blacklist: null // blacklist
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
            console.log(new Error().stack);
            throw ("Address format error, address=" + address);
        }
    },

    _verifyCosigner: function () {
        if (this._coSigners.indexOf(Blockchain.transaction.from) < 0) {
            throw ("Permission Denied!");
        }
    },

    _verifyProperties: function (obj, propertyNames) {
        for (let i = 0; i < propertyNames.length; ++i) {
            if (!obj[propertyNames[i]]) {
                throw (propertyNames[i] + " not found.");
            }
        }
    },

    _verifyConfigItem: function (name, value) {
        if ("vote" !== name) {
            this._verifyAddress(value);
        } else {
            for (let j = 0; j < value.length; ++j) {
                this._verifyAddress(value[j]);
            }
        }
    },

    // verify config
    _verifyConfig: function (config) {
        this._verifyProperties(config, ["natConfig", "contractList", "switches"]);
        this._verifyProperties(config.natConfig, this._allConfigNames);
        this._verifyProperties(config.contractList, this._allContractNames);

        this._verifySwitches(config.switches);

        for (let n in config.natConfig) {
            let v = config.natConfig[n];
            if (!v && this._canEmptyConfig.indexOf(n) >= 0) {
                continue;
            }
            this._verifyConfigItem(n, v);
        }

        for (let n in config.contractList) {
            this._verifyConfigItem(n, config.contractList[n]);
        }

        let e = config.natConfig.vote.length === config.contractList.vote.length;
        if (e) {
            for (let i = 0; i < config.natConfig.vote.length; ++i) {
                let v = config.natConfig.vote[i];
                if (config.contractList.vote.indexOf(v) < 0) {
                    e = false;
                    break;
                }
            }
        }
        if (!e) {
            throw ("The vote of natConfig and the vote of the contractList are not the same.");
        }
    },

    _verifySwitches: function (switches) {
        for (let i = 0; i < this._switches.length; ++i) {
            let s = this._switches[i];
            let v = switches[s];
            if (v == null) {
                throw (s + " not found.");
            }
            if (typeof v !== "boolean") {
                throw (s + " is not a boolean type.");
            }
        }
    },

    _setSwitches: function (switches) {
        let allowPledge = switches["allowPledge"];
        let allowUploadNRScore = switches["allowUploadNRScore"];
        new Blockchain.Contract(this._config.natConfig.pledgeProxy).call(allowPledge ? "openPledge" : "closePledge");
        new Blockchain.Contract(this._config.natConfig.nrData).call("setAllowUploadNRScore", allowUploadNRScore);
    },

    // Get config address
    getConfig: function () {
        return this._config;
    },

    // Set Config
    setConfig: function (config) {
        this._verifyCosigner();
        this._verifyConfig(config);
        // update the config to other smart contract
        let natConfig = config.natConfig;
        let contractList = config.contractList;

        for (let contractName in contractList) {
            let v = contractList[contractName];
            if (contractName !== "vote") {
                let contractObj = new Blockchain.Contract(v);
                contractObj.call("setConfig", natConfig);
            } else {
                for (let i = 0; i < v.length; ++i) {
                    new Blockchain.Contract(v[i]).call("setConfig", natConfig);
                }
            }
        }
        // update current config
        this._config = config;
        this._setSwitches(config.switches);
    },

    // for distribute.js
    getBlacklist: function () {
        this._verifyCosigner();
        return this._blacklist;
    },

    // for distribute.js
    setBlacklist: function (addrList) {
        this._verifyCosigner();
        for (let i = 0; i < addrList.length; ++i) {
            this._verifyAddress(addrList[i]);
        }
        // update to distribute contract
        let distributeContract = this._config.natConfig.distribute;
        let distContractObj = new Blockchain.Contract(distributeContract);
        distContractObj.call("setBlacklist", addrList);

        // update to NAT contract
        let natContract = this._config.natConfig.natNRC20;
        let natContractObj = new Blockchain.Contract(natContract);
        natContractObj.call("setBlacklist", addrList);

        this._blacklist = addrList;
    },


    closeContracts: function () {
        this._verifyCosigner();
        // const STATE_WORK = 0;
        // const STATE_PAUSED = 1;
        new Blockchain.Contract(this._config.natConfig.distribute).call("updateStatus", 1);
        new Blockchain.Contract(this._config.natConfig.pledgeProxy).call("closePledge");
    },

    openContracts: function () {
        this._verifyCosigner();
        // const STATE_WORK = 0;
        // const STATE_PAUSED = 1;
        new Blockchain.Contract(this._config.natConfig.distribute).call("updateStatus", 0);
        new Blockchain.Contract(this._config.natConfig.pledgeProxy).call("openPledge");
    },

    transferFund: function (newAddr) {
        this._verifyCosigner();
        new Blockchain.Contract(this._config.natConfig.pledgeProxy).call("transferFund", newAddr);
    },

    // Get coSigner
    getCosigners: function () {
        this._verifyCosigner();
        return this._coSigners
    },

    // Set coSigner
    setCosigners: function (coSigners) {
        // Check whether it is from cosigner
        this._verifyCosigner();
        for (let i = 0; i < coSigners.length; ++i) {
            this._verifyAddress(coSigner[i]);
        }
        this._coSigners = coSigners;
    },
};

module.exports = MultiSig;
