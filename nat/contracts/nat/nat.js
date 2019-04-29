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
        "configData": null
    });

    this._token = new Token(this.tokenData, this.balance, this.allowed);
    this._config = new Config(this.configData);
}

NAT.prototype = {
    init: function (data) {
        let cfg = data.config;
        this._config.initialize(
            cfg.multiSignAddress,
            cfg.nrDataAddress,
            cfg.voteDataAddresses
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
    }


    // CONFIG ----------------------------------------------------------------------------------------------------------


    // PLEDGE ----------------------------------------------------------------------------------------------------------


    // AIRDROP ---------------------------------------------------------------------------------------------------------


    // VOTE ------------------------------------------------------------------------------------------------------------

};

module.exports = NAT;
