'use strict';

const STATUS_CANCELED = 0;
const STATUS_PLEDGED = 1;

const STATE_WORK = 0;
const STATE_PAUSED = 1;

let _isString = function(obj) {
    return typeof obj === 'string' && obj.constructor === String;
};

// data format:
// {
//     "candidate1": {
//         "value": "1000",
//         "status": 1
//     },
//     "candidate2": {
//         "value": "10000",
//         "status": 0
//     }
// }
function CPledge(value) {
    this.pledges = {};
    if (value !== null) {
        if (_isString(value)) {
            value = JSON.parse(value);
        }
        this.parse(value);
    }
};

CPledge.prototype = {
    parse: function(obj) {
        for (let key in obj) {
            this.pledges[key] = obj[key];
        }
    },
    stringify: function() {
        return JSON.stringify(this.pledges);
    },
    get: function(candidate) {
        return this.pledges[candidate];
    },
    set: function(candidate, data) {
        this.pledges[candidate] = data;
    }
};

// data format:
// {
//     "total": "0",
//     "addrs": ["addr1", "addr2"]
// }
function CPledgeList(value) {
    this.total = new BigNumber(0);
    this.addrs = new Array();
    if (value !== null) {
        if (_isString(value)) {
            value = JSON.parse(value);
        }
        this.parse(value);
    }
};

CPledgeList.prototype = {
    parse: function(obj) {
        this.total = new BigNumber(obj.total);
        if (obj.addrs !== null) {
            if (obj.addrs instanceof Array) {
                this.addrs = obj.addrs;
            } else {
                throw new Error("Pledge list format error.");
            }
        }
    },
    stringify: function() {
        let obj = {
            total: this.total.toString(10),
            addrs: this.addrs
        }
        return JSON.stringify(obj);
    },
    pledge: function(addr, value) {
        this.total = this.total.plus(value);
        if (this.addrs.indexOf(addr) < 0) {
            this.addrs.push(addr);
        }
    },
    cancelPledge: function(addr, value) {
        this.total = this.total.minus(value);
        if (this.total.lt(0)) {
            throw new Error("Pledge cancel failed.");
        }
        let index = this.addrs.indexOf(addr);
        if (index < 0) {
            throw new Error("Candidate is not pledged.");
        }
        this.addrs.splice(index, 1);
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

function CouncilPledge() {
    this._contractName = "CouncilPledge";

    // key: user_addr, value: pledge contents
    this._pledges = new Map("pledge", {
        parse: function (value) {
            return value !== null ? new CPledge(value) : null;
        },
        stringify: function (obj) {
            return obj.stringify();
        }
    });
    // key: candidate, value: pledge addr array
    this._pledgeList = new Map("pledgeList", {
        parse: function (value) {
            return value !== null ? new CPledgeList(value) : null;
        },
        stringify: function (obj) {
            return obj.stringify();
        }
    });

    LocalContractStorage.defineProperties(this, {
        _manager: null,
        _state: null
    });
};

CouncilPledge.prototype = {
    init: function(manager) {
        this._manager = manager;
        this._state = STATE_WORK;
    },
    name: function() {
        return this._contractName;
    },
    manager: function() {
        return this._manager;
    },
    _verifyPermission: function () {
        if (this._manager !== Blockchain.transaction.from) {
            throw new Error("Permission Denied!");
        }
    },
    _verifyStatus: function() {
        if (this._state === STATE_PAUSED) {
            throw new Error("Council pledge paused.");
        }
    },
    _verifyAddress: function (address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw new Error("Address format error, address=" + address);
        }
    },
    _verifyCandidate: function(candidate) {
        let data = this._pledgeList.get(candidate);
        if (data === null) {
            throw new Error("Candidate not found.");
        }
        return data;
    },
    // updateStatus: function(state) {
    //     this._verifyPermission();
    //     this._state = state;
    // },
    addCandidates: function(list) {
        this._verifyPermission();

        if (list instanceof Array) {
            for (let index = 0; index < list.length; index++) {
                let candidateKey = list[index];
                let candidate = this._pledgeList.get(candidateKey);
                if (candidate !== null) {
                    throw new Error("Candidate hash been added.");
                }
                candidate = new CPledgeList();

                this._pledgeList.set(candidateKey, candidate);
            }
        } else {
            throw new Error("Candidate list format error.");
        }
    },
    pledge: function(candidate) {
        this._verifyStatus();

        let list = this._verifyCandidate(candidate);

        let addr = Blockchain.transaction.from;
        let value = Blockchain.transaction.value;

        let pledge = this._pledges.get(addr);
        if (pledge === null) {
            pledge = new CPledge();
        }
        let data = pledge.get(candidate);
        if (data !== null && data.status === STATUS_PLEDGED) {
            throw new Error("Candidate has been Pledged.")
        }

        data = {
            value: value,
            status: STATUS_PLEDGED
        };
        pledge.set(candidate, data);
        this._pledges.set(addr, pledge);

        list.pledge(addr, value);
        this._pledgeList.set(candidate, list);

        this._pledgeEvent(addr, data);
    },
    _pledgeEvent: function(addr, data) {
        Event.Trigger(this.name(), {
            Pledge: {
                Address: addr,
                value: data.value
            }
        });
    },
    cancelPledge: function(candidate) {
        this._verifyStatus();

        let list = this._verifyCandidate(candidate);

        let pledge = this._pledges.get(addr);
        if (pledge === null) {
            throw new Error("Pledge data not found.");
        }

        let addr = Blockchain.transaction.from;
        let value = Blockchain.transaction.value;

        let data = pledge.get(candidate);
        if (data !== null && data.status !== STATUS_PLEDGED) {
            throw new Error("Candidate has not been Pledged.")
        }

        data = {
            value: value,
            status: STATUS_CANCELED
        };
        pledge.set(candidate, data);
        this._pledges.set(addr, pledge);

        list.cancelPledge(addr, value);
        this._pledgeList.set(candidate, list);

        // cancel pledge transfer
        let result = Blockchain.transfer(addr, value);
        this._cancelPledgeEvent(addr, result, data);
        if (!result) {
            throw new Error("Cancel pledge transfer failed.");
        }
    },
    _cancelPledgeEvent: function(addr, status, data) {
        Event.Trigger(this.name(), {
            Status: status,
            CancelPledge: {
                Address: addr,
                value: data.value
            }
        });
    },
    getPledge: function(addr) {
        return this._pledges.get(addr);
    },
    // get pledge addresses
    // return: [addr1,addr2...]
    getPledgeAddresses: function() {
        return this._pledges.keys();
    },
    // get candidate pledges
    // return: [{candidate: "candidate1", value:"10"}...]
    getCandidatePledges: function() {
        let candidates = this._pledgeList.keys();
        let pledges = new Array();
        for (let index = 0; index < candidates.length; index++) {
            let candidate = candidates[index];
            let item = this._pledgeList.get(candidate);
            let data = {
                candidate: candidate,
                value: item.total.toString(10)
            };
            pledges.push(data);
        }
        return pledges;
    },
    getCandidateData: function(candidate) {
        return this._pledgeList.get(candidate);
    },
    // finish the pledge
    // if candidate pledge value > 100000 NAS, pledge success
    // if candidate pledge value < 100000 NAS, withdraw to users.
    liquidation: function() {
        this._verifyPermission();
        this._verifyStatus();

        const limit = new BigNumber(10).pow(18).pow(5);
        let candidates = this._pledgeList.keys();
        let pledgeList = new Array();
        let withdrawList = new Array();
        for (let idx in candidates) {
            let candidate = candidates[idx];
            let candidateItem = this._pledgeList.get(candidate);
            if (candidateItem.total.gt(limit)) {
                for (let addrkey in candidateItem.addrs) {
                    let addr = candidateItem.addrs[addrkey];
                    let pledge = this._pledges.get(addr);
                    let data = pledge.get(candidate);
                    let event = {
                        candidate: candidate,
                        addr: addr,
                        value: data.value
                    };
                    pledgeList.push(event);
                }
            } else {
                //withdraw pledge
                for (let addrkey in candidateItem.addrs) {
                    let addr = candidateItem.addrs[addrkey];
                    let pledge = this._pledges.get(addr);
                    let data = pledge.get(candidate);
                    if (data !== null) {
                        // transfer
                        let result = Blockchain.transfer(addr, data.value);
                        if (!result) {
                            throw new Error("Liquidation pledge transfer failed.");
                        }
                        let event = {
                            candidate: candidate,
                            addr: addr,
                            value: data.value
                        };
                        withdrawList.push(event);
                    } else {
                        throw new Error("liquidation failed with addr:"+addr +",candidate:"+candidate);
                    }
                    data.status = STATUS_CANCELED;
                    pledge.set(candidate, data);
                    this._pledges.set(addr, pledge);

                    candidateItem.cancelPledge(addr, value);
                }
            }
            this._pledgeList.set(candidate, candidateItem);
        }

        this._liquidationEvent(pledgeList, withdrawList);
        this._state = STATE_PAUSED;
    },
    _liquidationEvent: function(pledges, withdraws) {
        Event.Trigger(this.name(), {
            Liquidation: {
                Pledges: pledges,
                Withdraws: withdraws
            }
        });
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

module.exports = CouncilPledge;
