'use strict';

const STATUS_INIT = 0;
const STATUS_START = 1;
const STATUS_STOP = 2;

function Activity(value) {
    this.status = 0;
    this.content = null;
    this.options = [];
    if (value !== null) {
        let obj = JSON.parse(value);
        this.parse(obj);
    }
};

Activity.prototype = {
    parse: function(obj) {
        this.status = obj.status;
        this.content = obj.content;
        this.start = obj.start;
        this.end = obj.end;
        if (obj.options instanceof Array) {
            this.options = obj.options;
        } else {
            throw new Error("Activity format error.");
        }
    },
    stringify: function() {
        let obj = {
            status: this.status,
            start: this.start,
            end: this.end,
            content: this.content,
            options: this.options
        }
        return JSON.stringify(obj);
    }
};

function Map(key, descriptor) {
    this.countProperty = "_" + key + "Count";
    LocalContractStorage.defineProperty(this, this.countProperty, null);

    this.keyProperty = "_" + key + "Keys";  
    this.dataProperty = "_" + key + "Data";
    LocalContractStorage.defineMapProperty(this, this.keyProperty, null);
    LocalContractStorage.defineMapProperty(this, this.dataProperty, descriptor);
};

Map.prototype = {
    get: function(key) {
        return this[this.dataProperty].get(key);
    },
    set: function(key, value) {
        let data = this.get(key);
        if (data === null) {
            let count = this.size();
            this[this.keyProperty].set(count+1, key);
            this[this.countProperty] = count + 1;
            data = value;
        } else {
            data.parse(value);
        }
        this[this.dataProperty].set(key, data);
    },
    size: function() {
        let count = this[this.countProperty];
        if (count === null) {
            count = 0;
        }
        return count;
    },
    keys: function() {
        let keys = new Array();
        let count = this.size();
        if (let index = 0; index < count; index++) {
            let key = this[this.keyProperty].get(index);
            keys.push(key);
        }
        return keys;
    }
};

function CouncilVote() {
    this._contractName = "CouncilVote";

    this._activities = new Map("activity", {
        parse: function (value) {
            return new Activity(value);
        },
        stringify: function (obj) {
            return obj.stringify();
        }
    });
    LocalContractStorage.defineProperties(this, {
        _manager: null,
        _natContract: null
    });
}

CouncilVote.prototype = {

    init: function (manager, nat) {
        this._manager = manager;
        this._natContract = nat;
    },
    _verifyPermission: function () {
        if (this._manager !== Blockchain.transaction.from) {
            throw new Error("Permission Denied!");
        }
    },
    _verifyAddress: function (address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw new Error("Address format error, address=" + address);
        }
    },
    // data format
    // data = {
    //     content: "activity title",
    //     start: 1000,// activity start height
    //     end: 2000, // activity end height
    //     options: [{addr: "", option: "alice"},{addr:"", option: "bob"}]
    // }
    updateActivity: function(key, data){
        this._verifyPermission();

        let act = this._activities.get(key);
        if (act !== null && act.status === STATUS_START) {
            throw new Error("Can not update the activity with start.");
        }
        if (data.options.length === 0) {
            throw new Error("The voting options must be greater than 0.");
        }
        for (let key in data.options) {
            let item = data.options[key];
            // verify option address
            this._verifyAddress(item.addr);
        }
        data.status = STATUS_INIT;
        this._activities.set(key, data);
    },
    startActivity: function(key) {
        this._verifyPermission();

        let act = this._activities.get(key);
        if (act === null) {
            throw new Error("Vote activity not found.");
        }
        if (act.status === STATUS_START) {
            throw new Error("Vote activity has started.");
        }
        act.status = STATUS_START;
        this._activities.set(key, act);
    },
    stopActivity: function(key) {
        this._verifyPermission();

        let act = this._activities.get(key);
        if (act === null) {
            throw new Error("Vote activity not found.");
        }
        if (act.status !== STATUS_START) {
            throw new Error("Vote activity not started.");
        }
        act.status = STATUS_STOP;
        this._activities.set(key, act);
    },
    // used by vote contract
    getData: function (key) {
        let act = this._activities.get(key);
        if (act === null) {
            throw new Error("Vote activity not found.");
        }
        if (act.status !== STATUS_START) {
            throw new Error("Vote activity not started.");
        }
        let options = new Array();
        for (let key in act.options) {
            let item = act.options[key];
            options.push(item.option);
        }
        let obj = {
            content: act.content,
            options: options
        }
        return obj;
    },
    getDataList: function() {
        let data = new Array();
        let keys = this._activities.keys();
        for (let idx in keys) {
            let key = keys[idx];
            let item = this._activities.get(key);
            item.key = key;
            data.push(item);
        }
        return data;
    },
    _balanceOf: function(address) {
        let nat = new Blockchain.Contract(this._natContract);
        return nat.call("balanceOf", address);
    },
    reward: function(contract, key, value) {
        this._verifyPermission();

        let act = this._activities.get(key);
        if (act === null) {
            throw new Error("Vote activity not found.");
        }
        let height = Blockchain.block.height;
        if (height < act.end) {
            throw new Error("reward must after the activity end.");
        }
        let balance = this._balanceOf(Blockchain.transaction.to);
        if (new BigNumber(balance).gte(value)) {
            let vote = new Blockchain.Contract(contract);
            let result = vote.call("getVoteResult", Blockchain.transaction.to, key);
            let total = new BigNumber(0);
            for (let key in result.result) {
                total = total.plus(result.result[key]);
            }
            for (let option in result.result) {
                let addr = null;
                for (let key in act.options) {
                    if (act.options[key].option === option) {
                        addr = act.options[key].addr;
                        break;
                    }
                }
                if (addr === null) {
                    throw new Error("Optoion not found.");
                }
                // value = percent/total*value
                value = new BigNumber(result.result[option]).div(total).times(value);
                value = new BigNumber(10).pow(18).times(value).floor();
                let nat = new Blockchain.Contract(this._natContract);
                nat.call("transfer", addr, value);
            }
        } else {
            throw new Error("Insufficient NAT balance.")
        }
    },
    withdraw: function(addr) {
        this._verifyPermission();
        this._verifyAddress(addr);

        let balance = Blockchain.getAccountState(Blockchain.transaction.to).balance;
        if (new BigNumber(balance).gt(0)) {
            let result = Blockchain.transfer(addr, balance);
            this._withdrawEvent(result, Blockchain.transaction.to, addr, balance);
            if (!result) {
                throw new Error("Withdraw failed.");
            }
        }
    },

    _withdrawEvent: function (status, from, to, value) {
        Event.Trigger(this.name(), {
            Status: status,
            Withdraw: {
                from: from,
                to: to,
                value: value
            }
        });
    }
};

module.exports = CouncilVote;
