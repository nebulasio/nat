let nebulas = require("nebulas");
let NebAccount = nebulas.Account;
let NebUtils = nebulas.Utils;

function MapStorage(keyPrefix, serializer, deserializer) {
    this.keyPrefix = keyPrefix + "_";
    this.serializer = serializer;
    this.deserializer = deserializer;
}

MapStorage.prototype = {

    _key: function (key) {
        return this.keyPrefix + key;
    },

    get: function (key) {
        return this.deserializer(localStorage.getItem(this._key(key)));
    },

    set: function (key, value) {
        localStorage.setItem(this._key(key), this.serializer(value));
    },

    put: function (key, value) {
        this.set(key, value);
    },

    del: function (key) {
        localStorage.removeItem(this._key(key));
    }
};


let NasBalance = new MapStorage("__NEBULAS_BALANCE", function (val) {
    if (val.toString) {
        return val.toString(10);
    } else {
        return "" + val;
    }
}, function (val) {
    if (!val) {
        return NebUtils.toBigNumber(0);
    }
    return NebUtils.toBigNumber(val);
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
            value: NebUtils.toBigNumber(value)
        };
    },

    registerContract: function (address, clz) {
        this.contracts[address] = clz;
    },

    transfer: function (from, to, val) {
        val = NebUtils.toBigNumber(val);
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

    callContract: function (from, contract, value, func, args) {
        this._pushTransaction(this._newTransaction(from, contract, value));
        try {
            let c = new BlockContract(contract).contract;
            let r = c[func].apply(c, args);
            this.transfer(from, contract, value);
            return r;
        } finally {
            this._popTransaction();
        }
    }
};


function BlockContract(address) {
    this.address = address;
    this.amount = NebUtils.toBigNumber(0);
    let clz = BlockchainTool._getContract(address);
    if (!clz) {
        throw ("contract " + address + " not found.");
    }
    this.contract = new clz();
}

BlockContract.prototype = {
    value: function (amount) {
        this.amount = NebUtils.toBigNumber(amount);
    },
    call: function () {
        let tx = BlockchainTool._newTransaction(Blockchain.transaction.to, this.address, this.amount);
        BlockchainTool._pushTransaction(tx);
        try {
            let a = Array.from(arguments);
            this.contract[a[0]].apply(this.contract, a.slice(1, a.length));
            BlockchainTool.transfer(Blockchain.transaction.to, this.address, this.amount);
        } finally {
            BlockchainTool._popTransaction();
        }
    }
};


/******************************************************************************
 *
 *
 */


let LocalContractStorage = {

    defineProperties: function (obj, properties) {
        for (let n in properties) {
            let v = properties[n];
            let key = obj._contractName + "_" + n;
            Object.defineProperty(obj, n, {
                get: function () {
                    let r = localStorage.getItem(key);
                    if (v.parse) {
                        r = v.parse(localStorage.getItem(key));
                    }
                    return r;
                },
                set: function (val) {
                    if (v.stringify) {
                        val = v.stringify(val);
                    }
                    localStorage.setItem(key, val);
                },
                configurable: true
            });
        }
    },

    defineMapProperty: function (obj, n, p) {
        obj[n] = new MapStorage(obj._contractName, p.stringify, p.parse);
    },

    defineMapProperties: function (obj, mapProperties) {
        for (let n in mapProperties) {
            this.defineMapProperty(obj, n, mapProperties[n]);
        }
    }
};


let Blockchain = {

    Contract: BlockContract,

    get transaction() {
        if (BlockchainTool._transactions.length === 0) {
            throw ("no transactions");
        }
        return BlockchainTool._transactions[BlockchainTool._transactions.length - 1];
    },

    get block() {
        let r = localStorage.getItem("__block");
        if (!r) {
            return {height: 0}
        }
        return JSON.parse(r)
    },
    set block(height) {
        localStorage.setItem("__block", JSON.stringify({height: height}));
    },

    transfer: function (address, val) {
        BlockchainTool.transfer(Blockchain.transaction.to, address, val);
    },

    verifyAddress: function (address) {
        return NebAccount.isValidAddress(address, null);
    },

    getAccountState: function (address) {
        return {
            balance: NasBalance.get(address),
            nonce: 0
        }
    }
};


let Event = {
    Trigger: function (n, o) {
    }
};
