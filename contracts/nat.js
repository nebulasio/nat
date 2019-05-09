'use strict';

var Allowed = function (obj) {
    this.allowed = {};
    this.parse(obj);
}

Allowed.prototype = {
    toString: function () {
        return JSON.stringify(this.allowed);
    },

    parse: function (obj) {
        if (typeof obj != "undefined") {
            var data = JSON.parse(obj);
            for (var key in data) {
                this.allowed[key] = new BigNumber(data[key]);
            }
        }
    },

    get: function (key) {
        return this.allowed[key];
    },

    set: function (key, value) {
        this.allowed[key] = new BigNumber(value);
    }
}

var NATToken = function () {
    this._contractName = "NATToken";
    LocalContractStorage.defineProperties(this, {
        _name: null,
        _symbol: null,
        _decimals: null,
        _totalSupply: {
            parse: function (value) {
                return new BigNumber(value);
            },
            stringify: function (o) {
                return o.toString(10);
            }
        },
        _multiSig: null,
        _distribute: null,
        _config: null
    });

    LocalContractStorage.defineMapProperties(this, {
        "_balances": {
            parse: function (value) {
                return new BigNumber(value);
            },
            stringify: function (o) {
                return o.toString(10);
            }
        },
        "_allowed": {
            parse: function (value) {
                return new Allowed(value);
            },
            stringify: function (o) {
                return o.toString();
            }
        }
    });
};

NATToken.prototype = {
    init: function (name, symbol, decimals, multiSig) {
        this._name = name;
        this._symbol = symbol;
        this._decimals = decimals || 0;
        this._totalSupply = new BigNumber(0);
        this._multiSig = multiSig;
    },

     _verifyPermission: function () {
        if (this._multiSig !== Blockchain.transaction.from) {
            throw ("Permission Denied!");
        }
    },

    setConfig: function(natConfig) {
        this._verifyPermission();
        this._config = natConfig;
        this._multiSig = natConfig.multiSig;
        this._distribute = natConfig.distribute;
    },

    produce: function(data) {
        // permission check
        if (this._distribute !== Blockchain.transaction.from) {
            throw ("Permission Denied for distribute!");
        }

        let total = new BigNumber(0);
        for (let key in data) {
            let item = data[key];
            let balance = this._balances.get(item.addr) || new BigNumber(0);
            // balance + value
            total = total.plus(item.value);
            balance = balance.plus(item.value);

            if (balance.lt(0)) {
                this._produceEvent(false, this._totalSupply, data);
                throw new Error("produce failed.");
            }
            this._balances.set(item.addr, balance);
        }
        this._totalSupply = this._totalSupply.plus(total);
        this._produceEvent(true, this._totalSupply, data);
    },

    _produceEvent: function (status, total, data) {
        Event.Trigger(this.name(), {
            Status: status,
            Produce: {
                total: total,
                data: data
            }
        });
    },

    // Returns the name of the token
    name: function () {
        return this._name;
    },

    // Returns the symbol of the token
    symbol: function () {
        return this._symbol;
    },

    // Returns the number of decimals the token uses
    decimals: function () {
        return this._decimals;
    },

    totalSupply: function () {
        return this._totalSupply.toString(10);
    },

    managers: function() {
        return this._managers;
    },

    producer: function() {
        return this._producer;
    },

    balanceOf: function (owner) {
        var balance = this._balances.get(owner);

        if (balance instanceof BigNumber) {
            return balance.toString(10);
        } else {
            return "0";
        }
    },

    transfer: function (to, value) {
        value = new BigNumber(value);
        if (value.lt(0)) {
            throw new Error("invalid value.");
        }

        var from = Blockchain.transaction.from;
        var balance = this._balances.get(from) || new BigNumber(0);

        if (balance.lt(value)) {
            throw new Error("transfer failed.");
        }

        this._balances.set(from, balance.sub(value));
        var toBalance = this._balances.get(to) || new BigNumber(0);
        this._balances.set(to, toBalance.add(value));

        this._transferEvent(true, from, to, value);
    },

    transferFrom: function (from, to, value) {
        var spender = Blockchain.transaction.from;
        var balance = this._balances.get(from) || new BigNumber(0);

        var allowed = this._allowed.get(from) || new Allowed();
        var allowedValue = allowed.get(spender) || new BigNumber(0);
        value = new BigNumber(value);

        if (value.gte(0) && balance.gte(value) && allowedValue.gte(value)) {

            this._balances.set(from, balance.sub(value));

            // update allowed value
            allowed.set(spender, allowedValue.sub(value));
            this._allowed.set(from, allowed);

            var toBalance = this._balances.get(to) || new BigNumber(0);
            this._balances.set(to, toBalance.add(value));

            this._transferEvent(true, from, to, value);
        } else {
            throw new Error("transfer failed.");
        }
    },

    _transferEvent: function (status, from, to, value) {
        Event.Trigger(this.name(), {
            Status: status,
            Transfer: {
                from: from,
                to: to,
                value: value
            }
        });
    },

    approve: function (spender, currentValue, value) {
        var from = Blockchain.transaction.from;

        var oldValue = this.allowance(from, spender);
        if (oldValue != currentValue.toString()) {
            throw new Error("current approve value mistake.");
        }

        var balance = new BigNumber(this.balanceOf(from));
        var value = new BigNumber(value);

        if (value.lt(0) || balance.lt(value)) {
            throw new Error("invalid value.");
        }

        var owned = this._allowed.get(from) || new Allowed();
        owned.set(spender, value);

        this._allowed.set(from, owned);

        this._approveEvent(true, from, spender, value);
    },

    _approveEvent: function (status, from, spender, value) {
        Event.Trigger(this.name(), {
            Status: status,
            Approve: {
                owner: from,
                spender: spender,
                value: value
            }
        });
    },

    allowance: function (owner, spender) {
        var owned = this._allowed.get(owner);

        if (owned instanceof Allowed) {
            var spender = owned.get(spender);
            if (typeof spender != "undefined") {
                return spender.toString(10);
            }
        }
        return "0";
    }
};

module.exports = NATToken;
