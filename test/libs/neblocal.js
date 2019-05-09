let nebulas = require("nebulas");
let NebAccount = nebulas.Account;
let NebUtils = nebulas.Utils;

function MapStorage(keyPrefix, serializer, deserializer) {
    this.keyPrefix = keyPrefix + "_";
    this.serializer = serializer;
    this.deserializer = deserializer;
}

MapStorage.prototype = {

    get _keyList() {
        if (!this.__keyList) {
            this.__keyList = localStorage.getItem(this._key("__key_list"));
            if (this.__keyList) {
                this.__keyList = JSON.parse(this.__keyList);
            }
        }
        if (!this.__keyList) {
            this.__keyList = [];
        }
        return this.__keyList;
    },

    set _keyList(list) {
        this.__keyList = list;
        localStorage.setItem(this._key("__key_list"), JSON.stringify(list));
    },

    _addKey: function (key) {
        if (this._keyList.indexOf(key) >= 0) {
            return;
        }
        this._keyList.push(key);
        this._keyList = this._keyList;
    },

    _clear: function () {
        for (let i = 0; i < this._keyList.length; ++i) {
            this.del(this._keyList[i]);
        }
        this._keyList = null;
    },

    _key: function (key) {
        return this.keyPrefix + key;
    },

    get: function (key) {
        return this.deserializer(localStorage.getItem(this._key(key)));
    },

    set: function (key, value) {
        localStorage.setItem(this._key(key), this.serializer(value));
        this._addKey(key);
    },

    put: function (key, value) {
        this.set(key, value);
    },

    del: function (key) {
        localStorage.removeItem(this._key(key));
    },
};


let NasBalance = new MapStorage("__NEBULAS_BALANCE", function (val) {
    if (val.toString) {
        return val.toString(10);
    } else {
        return "" + val;
    }
}, function (val) {
    if (!val) {
        return new BigNumber(0);
    }
    return new BigNumber(val);
});


let BlockchainTool = {

    _contracts: null,

    _addNas: function (address, val) {
        let b = NasBalance.get(address);
        b = b.plus(val);
        NasBalance.set(address, b);
    },

    get contracts() {
        if (!this._contracts) {
            this._contracts = {};
        }
        return this._contracts;
    },

    _getContract: function (address) {
        let c = this.contracts[address];
        if (!c) {
            throw ("Did not find contract " + address);
        }
        return c;
    },

    _transactions: [],

    _pushTransaction: function (tx) {
        this._transactions.push(tx);
    },

    _popTransaction: function () {
        if (this._transactions.length <= 0) {
            throw ("no transactions");
        }
        let tx = this._transactions[this._transactions.length - 1];
        this._transactions = this._transactions.slice(0, this._transactions.length - 1);
        return tx;
    },

    _newTransaction(from, to, value) {
        return {
            from: from,
            to: to,
            value: new BigNumber(value)
        };
    },

    registerContract: function (address, clz) {
        this.contracts[address] = clz;
    },

    transfer: function (from, to, val) {
        val = new BigNumber(val);
        if (from) {
            let b = NasBalance.get(from);
            if (val.gt(b)) {
                throw ("Insufficient balance");
            }
            b = b.sub(val);
            NasBalance.set(from, b);
        }
        this._addNas(to, val);
    },

    getBalance: function (address) {
        return NasBalance.get(address);
    },

    callContract: function (from, contract, value, func, args) {
        this._pushTransaction(this._newTransaction(from, contract, value));
        this.transfer(from, contract, value);
        try {
            let c = new BlockContract(contract).contract;
            let r = c[func].apply(c, args);
            return r;
        } catch (e) {
            this.transfer(contract, from, value);
            throw e;
        } finally {
            this._popTransaction();
        }
    },

    resetNr: function () {
        __nrStorage._clear();
    },

    set blockHeight(height) {
        localStorage.setItem("__block", height + "");
    },

    get blockHeight() {
        if (!this._blockHeight) {
            let h = localStorage.getItem("__block");
            if (h) {
                this._blockHeight = parseInt(h);
            } else {
                this._blockHeight = 0;
            }
        }
        return this._blockHeight;
    }
};


function BlockContract(address) {
    this.address = address;
    this.amount = new BigNumber(0);
    let clz = BlockchainTool._getContract(address);
    if (!clz) {
        throw ("contract " + address + " not found.");
    }
    this.contract = new clz();
}

BlockContract.prototype = {
    value: function (amount) {
        this.amount = new BigNumber(amount);
        return this;
    },
    call: function () {
        let tx = BlockchainTool._newTransaction(Blockchain.transaction.to, this.address, this.amount);
        BlockchainTool._pushTransaction(tx);
        BlockchainTool.transfer(Blockchain.transaction.to, this.address, this.amount);
        try {
            let a = Array.from(arguments);
            return this.contract[a[0]].apply(this.contract, a.slice(1, a.length));
        } catch (e) {
            BlockchainTool.transfer(this.address, Blockchain.transaction.to, this.amount);
            throw e;
        } finally {
            BlockchainTool._popTransaction();
        }
    }
};

function _defaultParse(text) {
    return JSON.parse(text);
}

function _defaultStringify(o) {
    return JSON.stringify(o);
}


/******************************************************************************
 *
 *
 */

function BigNumber(n) {
    this.v = NebUtils.toBigNumber(n);
}

BigNumber.prototype = {
    plus: function (n) {
        this.v = this.v.plus(new BigNumber(n).v);
        return this;
    },
    sub: function (n) {
        this.v = this.v.sub(new BigNumber(n).v);
        return this;
    },
    times: function (n) {
        this.v = this.v.mul(new BigNumber(n).v);
        return this;
    },
    mul: function (n) {
        this.v = this.v.mul(new BigNumber(n).v);
        return this;
    },
    div: function (n) {
        this.v = this.v.div(new BigNumber(n).v);
        return this;
    },
    pow: function (n) {
        this.v = this.v.pow(new BigNumber(n).v);
        return this;
    },
    sqrt: function () {
        this.v = this.v.sqrt();
        return this;
    },
    gt: function (n) {
        return this.v.gt(new BigNumber(n).v);
    },
    gte: function (n) {
        return this.v.gte(new BigNumber(n).v);
    },
    lt: function (n) {
        return this.v.lt(new BigNumber(n).v);
    },
    lte: function (n) {
        return this.v.lte(new BigNumber(n).v);
    },
    floor: function (n) {
        this.v = this.v.floor();
        return this;
    },
    toString: function (base) {
        return this.v.toString(base);
    }
};

let LocalContractStorage = {

    defineProperties: function (obj, properties) {
        for (let n in properties) {
            let v = properties[n];
            let key = obj._contractName + "_" + n;
            Object.defineProperty(obj, n, {
                get: function () {
                    let r = localStorage.getItem(key);
                    if (v && v.parse) {
                        r = v.parse(localStorage.getItem(key));
                    } else {
                        r = _defaultParse(localStorage.getItem(key));
                    }
                    return r;
                },
                set: function (val) {
                    if (v && v.stringify) {
                        val = v.stringify(val);
                    } else {
                        val = _defaultStringify(val);
                    }
                    localStorage.setItem(key, val);
                },
                configurable: true
            });
        }
    },

    defineMapProperty: function (obj, n, p) {
        if (p) {
            obj[n] = new MapStorage(obj._contractName, p.stringify, p.parse);
        } else {
            obj[n] = new MapStorage(obj._contractName, _defaultStringify, _defaultParse);
        }
    },

    defineMapProperties: function (obj, mapProperties) {
        for (let n in mapProperties) {
            this.defineMapProperty(obj, n, mapProperties[n]);
        }
    }
};

let __nrStorage = new MapStorage("__nr_data", _defaultStringify, _defaultParse);

let Blockchain = {

    Contract: BlockContract,

    get transaction() {
        if (BlockchainTool._transactions.length === 0) {
            throw ("no transactions");
        }
        return BlockchainTool._transactions[BlockchainTool._transactions.length - 1];
    },

    get block() {
        return {
            get height() {
                return BlockchainTool.blockHeight;
            }
        }
    },

    transfer: function (address, val) {
        BlockchainTool.transfer(Blockchain.transaction.to, address, val);
    },

    verifyAddress: function (address) {
        if (NebAccount.isValidAddress(address, 87)) {
            return 87;
        }
        if (NebAccount.isValidAddress(address, 88)) {
            return 88;
        }
        return 0;
    },

    getAccountState: function (address) {
        return {
            balance: NasBalance.get(address),
            nonce: 0
        }
    },

    getLatestNebulasRank: function (address) {
        let r = __nrStorage.get(address);
        if (!r) {
            r = "" + Math.ceil(Math.random() * 100000000);
            __nrStorage.set(address, r);
        }
        return r;
    }
};


let Event = {
    Trigger: function (n, o) {
    }
};

let module = {
    exports: null
};
