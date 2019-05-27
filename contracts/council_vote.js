'use strict';

const STATUS_INIT = 0;
const STATUS_START = 1;
const STATUS_STOP = 2;

const TYPE_NORMAL = 1;
const TYPE_REWARD = 2;

const _cVoteUtils = {
    isString: function(obj) {
        return typeof obj === 'string' && obj.constructor === String;
    },
    isNull: function (v) {
        return v === null || typeof v === "undefined";
    }
};

function Activity(value) {
    this.status = 0;
    this.type = TYPE_NORMAL;
    this.content = null;
    this.options = [];
    if (!_cVoteUtils.isNull(value)) {
        if (_cVoteUtils.isString(value)) {
            value = JSON.parse(value);
        }
        this.parse(value);
    }
};

Activity.prototype = {
    parse: function(obj) {
        this.status = obj.status;
        if (!_cVoteUtils.isNull(obj.type)) {
            this.type = obj.type;
        }
        this.content = obj.content;
        if (obj.options instanceof Array) {
            this.options = obj.options;
        } else {
            throw new Error("Activity format error.");
        }
    },
    stringify: function() {
        let obj = {
            status: this.status,
            type: this.type,
            content: this.content,
            options: this.options
        }
        return JSON.stringify(obj);
    },
    addOption: function(obj) {
        for (let key in this.options) {
            if (this.options[key].option === obj.option) {
                throw new Error("Option has already added:"+obj.option);
            }
        }
        this.options.push(obj);
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
            this[this.keyProperty].set(count, key);
            this[this.countProperty] = count + 1;
        }
        data = value;
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
        for (let index = 0; index < count; index++) {
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
            return value !== null ? new Activity(value) : null;
        },
        stringify: function (obj) {
            return obj.stringify();
        }
    });
    LocalContractStorage.defineProperties(this, {
        _manager: null,
        _natContract: null,
        _voteContract: null
    });
}

CouncilVote.prototype = {

    init: function (manager, nat, vote) {
        this._manager = manager;
        this._natContract = nat;
        this._voteContract = vote;
    },
    name: function() {
        return this._contractName;
    },
    manager: function() {
        return this._manager;
    },
    setManager: function(manager) {
        this._verifyPermission();

        this._manager = manager;
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
        if (data.type === TYPE_REWARD) {
            for (let key in data.options) {
                let item = data.options[key];
                // verify option address
                this._verifyAddress(item.addr);
            }
        }
        data.status = STATUS_INIT;
        act = new Activity(data);
        this._activities.set(key, act);
    },
    addOptions: function(key, options) {
        this._verifyPermission();

        let act = this._activities.get(key);
        if (act === null) {
            throw new Error("Activity not found.");
        }

        for (let key in options) {
            let item = options[key];
            if (act.type === TYPE_REWARD) {
                // verify option address
                this._verifyAddress(item.addr);
            }
            act.addOption(item);
        }
        this._activities.set(key, act);
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
    reward: function(actKey, value) {
        this._verifyPermission();

        let act = this._activities.get(actKey);
        if (act === null) {
            throw new Error("Vote activity not found.");
        }
        if (act.status !== STATUS_START) {
            throw new Error("Vote activity not start.");
        }
        if (act.type !== TYPE_REWARD) {
            throw new Error("Vote activity not the reward type.");
        }

        let balance = this._balanceOf(Blockchain.transaction.to);
        if (new BigNumber(balance).gte(value)) {
            let vote = new Blockchain.Contract(this._voteContract);
            let result = vote.call("getVoteResult", Blockchain.transaction.to, actKey);
            let total = new BigNumber(0);
            for (let key in result.result) {
                total = total.plus(result.result[key]);
            }
            let events = new Array();
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
                // reward = percent/total*value
                let reward = new BigNumber(result.result[option]).div(total).times(value).floor();
                if (reward.gt(0)) {
                    let nat = new Blockchain.Contract(this._natContract);
                    nat.call("transfer", addr, reward.toString(10));
                    let event = {
                        addr: addr,
                        value: reward.toString(10)
                    };
                    events.push(event);
                }
            }
            if (events.length > 0) {
                this._rewardEvent(actKey, value, events);
            }
        } else {
            throw new Error("Insufficient NAT balance.")
        }

        act.status = STATUS_STOP;
        this._activities.set(actKey, act);
    },
    _rewardEvent: function(key, total, data) {
        Event.Trigger(this.name(), {
            key: key,
            total: total,
            reward: data
        });
    },
    withdraw: function(addr) {
        this._verifyPermission();
        this._verifyAddress(addr);

        let balance = Blockchain.getAccountState(Blockchain.transaction.to).balance;
        balance = new BigNumber(balance);
        if (balance.gt(0)) {
            let result = Blockchain.transfer(addr, balance);
            this._withdrawEvent(result, Blockchain.transaction.to, addr, balance.toString(10));
            if (!result) {
                throw new Error("Withdraw failed.");
            }
        }

        let natBalance = this._balanceOf(Blockchain.transaction.to);
        natBalance = new BigNumber(natBalance);
        if (natBalance.gt(0)) {
            let nat = new Blockchain.Contract(this._natContract);
            nat.call("transfer", addr, natBalance.toString(10));
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
