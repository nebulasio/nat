let Allowed = function (obj) {
    this.allowed = {};
    this.parse(obj);
};

Allowed.prototype = {
    toString: function () {
        return JSON.stringify(this.allowed);
    },

    parse: function (obj) {
        if (typeof obj != "undefined") {
            let data = JSON.parse(obj);
            for (let key in data) {
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
};


function AllowedData(data) {
    this._data = data;
}

AllowedData.prototype = {
    get: function (key) {
        return new Allowed(this._data.get(key));
    },
    set: function (key, val) {
        this._data.put(key, val.toString());
    }
};


let Token = function (tokenData, balances, allowedData) {
    this.tokenData = tokenData;
    this.balances = balances;
    this.allowed = new AllowedData(allowedData);
};

Token.prototype = {
    initialize: function (name, symbol, decimals, totalSupply) {
        this.name = name;
        this.symbol = symbol;
        this.decimals = decimals || 0;
        this.totalSupply = new BigNumber(totalSupply).mul(new BigNumber(10).pow(decimals));
        this.activeSupply = new BigNumber(0);
    },

    get name() {
        return this.tokenData.get("name");
    },

    set name(name) {
        this.tokenData.put("name", name);
    },

    get symbol() {
        return this.tokenData.get("symbol");
    },

    set symbol(symbol) {
        this.tokenData.put("symbol", symbol)
    },

    get decimals() {
        return this.tokenData.get("decimals");
    },

    set decimals(decimals) {
        this.tokenData.put("decimals", decimals);
    },

    get totalSupply() {
        return new BigNumber(this.tokenData.get("totalSupply"));
    },

    set totalSupply(totalSupply) {
        this.tokenData.put("totalSupply", totalSupply.toString(10));
    },

    get activeSupply() {
        return new BigNumber(this.tokenData.get("activeSupply"));
    },

    set activeSupply(activeSupply) {
        this.tokenData.put("activeSupply", activeSupply.toString(10));
    },

    balanceOf: function (owner) {
        let balance = this.balances.get(owner);

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

        let from = Blockchain.transaction.from;
        let balance = this.balances.get(from) || new BigNumber(0);

        if (balance.lt(value)) {
            throw new Error("transfer failed.");
        }

        this.balances.set(from, balance.sub(value));
        let toBalance = this.balances.get(to) || new BigNumber(0);
        this.balances.set(to, toBalance.add(value));

        this._transferEvent(true, from, to, value);
    },

    transferFrom: function (from, to, value) {
        let spender = Blockchain.transaction.from;
        let balance = this.balances.get(from) || new BigNumber(0);

        let allowed = this.allowed.get(from) || new Allowed();
        let allowedValue = allowed.get(spender) || new BigNumber(0);
        value = new BigNumber(value);

        if (value.gte(0) && balance.gte(value) && allowedValue.gte(value)) {

            this.balances.set(from, balance.sub(value));

            // update allowed value
            allowed.set(spender, allowedValue.sub(value));
            this.allowed.set(from, allowed);

            let toBalance = this.balances.get(to) || new BigNumber(0);
            this.balances.set(to, toBalance.add(value));

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
        let from = Blockchain.transaction.from;
        let oldValue = this.allowance(from, spender);
        if (oldValue !== currentValue.toString()) {
            throw new Error("current approve value mistake.");
        }
        let balance = new BigNumber(this.balanceOf(from));
        let value = new BigNumber(value);
        if (value.lt(0) || balance.lt(value)) {
            throw new Error("invalid value.");
        }
        let owned = this.allowed.get(from) || new Allowed();
        owned.set(spender, value);
        this.allowed.set(from, owned);
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
        let owned = this.allowed.get(owner);
        if (owned instanceof Allowed) {
            let spender = owned.get(spender);
            if (typeof spender != "undefined") {
                return spender.toString(10);
            }
        }
        return "0";
    },

    airdrop: function (to, value) {
        let b = this.balances.get(to) || new BigNumber(0);
        this.balances.set(to, b.add(value));
        this.activeSupply = this.activeSupply.plus(value);
    },

    destroy: function (from, value) {
        let b = this.balances.get(from) || new BigNumber(0);
        if (b.lt(value)) {
            throw new Error("destroy failed.");
        }
        this.balances.set(from, b.sub(value));
        this.activeSupply = this.activeSupply.sub(value);
    },

};

Token.instance = null;
