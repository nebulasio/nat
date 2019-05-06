//BASE
//PAGE_LIST
//CONFIG
//DATA_MANAGER
//TOKEN
//PLEDGE
//AIRDROP
//VOTE

function NAT() {
    this._contractName = "NAT";
    LocalContractStorage.defineMapProperties(this, {
        "balances": {
            parse: function (value) {
                return new BigNumber(value);
            },
            stringify: function (o) {
                return o.toString(10);
            }
        },
        "allowed": {
            parse: function (value) {
                return value;
            },
            stringify: function (o) {
                return o + "";
            }
        },
        "tokenData": null,
        "configData": null,
        "nrData": null,
        "exchangeAddressData": null,
        "pledgeData": null,
        "voteData": null
    });

    this._exchangeAddressManager = ExchangeAddressManager.instance = new ExchangeAddressManager(this.exchangeAddressData);
    this._config = Config.instance = new Config(this.configData);
    this._nrDataManager = NrDataManager.instance = new NrDataManager(this.nrData);
    this._token = Token.instance = new Token(this.tokenData, this.balance, this.allowed);
    this._pledge = Pledge.instance = new Pledge(this.pledgeData);
    this._airdrop = Airdrop.instance = new Airdrop();
    this._vote = Vote.instance = new Vote(this.voteData);
}

NAT.prototype = {
    init: function (data) {
        let cfg = data.config;
        this._config.initialize(
            cfg.multiSignAddress,
            cfg.nrDataAddress,
            cfg.voteDataAddresses,
            cfg.pledgeDataAddress
        );
        let token = data.token;
        this._token.initialize(
            token.name,
            token.symbol,
            token.decimals,
            token.totalSupply
        );
    },

    accept: function () {
        Event.Trigger("transfer", {
            Transfer: {
                from: Blockchain.transaction.from,
                to: Blockchain.transaction.to,
                value: Blockchain.transaction.value,
            }
        });
    },


    // TOKEN -----------------------------------------------------------------------------------------------------------

    name: function () {
        return this._token.name;
    },

    symbol: function () {
        return this._token.symbol;
    },

    decimals: function () {
        return this._token.decimals;
    },

    totalSupply: function () {
        return this._token.totalSupply.toString(10);
    },

    balanceOf: function (owner) {
        return this._token.balanceOf(owner);
    },

    transfer: function (to, value) {
        this._token.transfer(to, value);
    },

    transferFrom: function (from, to, value) {
        this._token.transferFrom(from, to, value);
    },

    approve: function (spender, currentValue, value) {
        this._token.approve(spender, currentValue, value);
    },

    allowance: function (owner, spender) {
        return this._token.allowance(owner, spender);
    },


    // CONFIG ----------------------------------------------------------------------------------------------------------

    _verifyFromMultisign: function () {
        if (!this._config.isFromMultiSign) {
            throw ("No permission.");
        }
    },

    updateMultiSignAddress: function (address) {
        this._verifyFromMultisign();
        this._config.multiSignAddress = address;
    },

    updateNrDataAddress: function (address) {
        this._verifyFromMultisign();
        this._config.nrDataAddress = address;
    },

    updateVoteDataAddresses: function (addresses) {
        this._verifyFromMultisign();
        this._config.nrDataAddress = address;
    },


    // DATA ------------------------------------------------------------------------------------------------------------

    syncNrData: function () {
        this._nrDataManager.sync();
    },

    addExchangeAddresses: function (addresses) {
        this._exchangeAddressManager.addAddresses(addresses);
    },

    removeExchangeAddresses: function (addresses) {
        this._exchangeAddressManager.removeAddresses(addresses);
    },

    existsExchangeAddress: function (address) {
        return this._exchangeAddressManager.existsAddress(address);
    },


    // PLEDGE ----------------------------------------------------------------------------------------------------------

    receivePledgeData: function (data) {
        if (!Config.instance.isFromPledgeDataAddress) {
            throw ("No permission.");
        }
        this._pledge.receivePledgeData(data);
    },

    pledge: function () {
        this._pledge.pledge();
    },

    getPledgeAddressIndexes: function () {
        return this._pledge.getAddressIndexes();
    },

    getPledgeAddresses: function (index) {
        return this._pledge.getAddresses(index);
    },

    getCurrentPledge: function (address) {
        return this._pledge.getCurrentPledge(address);
    },

    getAllPledge: function (address) {
        return this._pledge.getAllPledges(address);
    },


    // AIRDROP ---------------------------------------------------------------------------------------------------------

    aridrop: function () {
        this._airdrop.airdrop();
    },


    // VOTE ------------------------------------------------------------------------------------------------------------

    vote: function (dataSource, hash, value, weight) {
        this._vote.vote(dataSource, hash, value, weight);
    },

    getVoteResult: function (dataSource, hash) {
        return this._vote.getVoteResult(dataSource, hash);
    },
};

module.exports = NAT;
