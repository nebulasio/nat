const STATE_WORK = 0;
const STATE_PAUSED = 1;
const HEIGHT_INTERVAL = 100; // 40320

function DPledge() {
    LocalContractStorage.defineProperties(this, {
        _pledge_period: null,
        _pledge_page: null,
        _pledge_height: null,
        _pledge_contract: null
    });
};

DPledge.prototype = {
    update_contract: function(contract) {
        this._pledge_contract = contract;
    },
    calculate: function() {
        let pledge = new Blockchain.Contract(this._pledge_contract);
        let start = this._pledge_height;
        let end = this._pledge_height + HEIGHT_INTERVAL - 1;
        let page = this._pledge_page;
        let pledgeData = pledge.call("getPledge", start, end, page);
        let data = new Array();
        for (let key in pledgeData.data) {
            let item = pledgeData.data[key];
            // 5 * 12.663 * x / (1 + sqrt(200/x)) * 0.997^i
            let gx = new BigNumber(12.663).times(item.value);
            let zx = new BigNumber(200).div(item.value).sqrt().plus(1).pow(-1);
            let y = new BigNumber(0.997).pow(this._pledge_period);
            let value = new BigNumber(5).times(gx).times(zx).times(y);
            item.nat = value.toString(10);
            data.push(item);
        }
        pledge.call("setPledgeResult", start, end, data);
        this._trigger_event(start, end, data);
        if (pledgeData.hasNext) {
            this._pledge_page = page + 1;
        } else {
            this._pledge_period = this._pledge_period + 1;
            this._pledge_height = end + 1;
            this._pledge_page = 0;
        }
        return {hasNext: pledgeData.hasNext, data: data};
    },
    _trigger_event: function(start, end, page, data) {
        Event.Trigger("pledge", {
                period: this._pledge_period,
                start_height: start,
                end_height: end,
                page: page,
                data: data
        });
    }
};

function DNR() {
    LocalContractStorage.defineProperties(this, {
        _nr_period: null,
        _nr_page: null,
        _nr_height: null,
        _nr_contract: null
    });
};

DNR.prototype = {
    update_contract: function(contract) {
        this._nr_contract = contract;
    },
    calculate: function() {
        let nr = new Blockchain.Contract(this._nr_contract);
        let page = this._nr_page;
        let nrData = nr.call("getNR", this._nr_height, this._nr_page);
        let data = new Array();
        for (let key in nrData.data) {
            let item = nrData.data[key];
            // 12.663 * 0.997^i * x
            let value = new BigNumber(12.663).times(item.score);
            let y = new BigNumber(0.997).pow(this._nr_period);
            value = value.times(y);
            item.nat = value.toString(10);
            data.push(item);
        }
        this._trigger_event(nrData.section, page, data);
        if (nrData.hasNext) {
            this._nr_page = page + 1;
        } else {
            this._nr_period = this._nr_period + 1;
            this._nr_height = nrData.section.endHeight;
            this._nr_page = 0;
        }
        return {hasNext: nrData.hasNext, data: data};
    },
    _trigger_event: function(section, page, data) {
        Event.Trigger("nr", {
                period: this._nr_period,
                page: page,
                start_height: section.startHeight,
                end_height: section.endHeight,
                data: data
            });
    }
};

function DVote() {
    LocalContractStorage.defineProperties(this, {
        _vote_contract: null,
        _vote_tax_addr: null
    });

    // vote nr data record
    // key:addr
    // value: period:value
    LocalContractStorage.defineMapProperties(this, {
        _vote_nr_data: null
    });
};

DVote.prototype = {
    update_contract: function(contract, taxAddr) {
        this._vote_contract = contract;
        this._vote_tax_addr = taxAddr;
    },
    _verifyPermission: function() {
        if (this._vote_contract.indexOf(Blockchain.transaction.from) < 0) {
            throw ("No permission");
        }
    },
    // vote rule:
    // 3% give to the designated tax address
    // reward 10 * min{Nv, Nnr} * y^i
    calculate: function(context, addr, value) {
        this._verifyPermission();
        if (context._blacklist.indexOf(addr) >= 0) {
            throw ("Address is not allowed to vote");
        }

        let data = new Array();
        let tax = new BigNumber(value).times(0.03);
        data.push({addr: this._vote_tax_addr, nat:tax.toString(10)});

        let y = new BigNumber(0.997).pow(context._nr._nr_period);
        let consumption = y.times(value).times(0.97);

        let nrData = this._vote_nr_data.get(addr);
        if (nrData === null || nrData.period !== context._nr._nr_period) {
            let nr = new BigNumber(0);
            try {
                let score = Blockchain.getLatestNebulasRank(addr);
                nr = new BigNumber(score);
            } catch (e) {
                // if nr not found, use 0
            }
            if (score.gt(0)) {
                // 12.663 * 0.997^i * x
                let nrReward = new BigNumber(0.997).pow(context._nr._nr_period).times(nr).times(12.663);
                nrData = {
                    period: context._nr._nr_period,
                    reward: nrReward.toString(10)
                }
            } else {
                nrData = {
                    period: context._nr._nr_period,
                    reward: "0"
                }
            }
        }
        let reward = null;
        if (new BigNumber(nrData.reward).gt(value)) {
            nrData.reward = new BigNumber(nrData.reward).minus(value).toString(10);
            reward = new BigNumber(value);
        } else {
            reward = new BigNumber(nrData.reward);
            nrData.reward = "0";
        }
        if (reward.gt(0)) {
            reward = reward.times(10);
        }
        value = reward.minus(consumption);

        data.push({addr: addr, nat: value.toString(10)});
        // vote reward
        this._trigger_event(data);
        return data;
    },
    _trigger_event: function(data) {
        Event.Trigger("vote", data);
    }
};

function Distribute() {
    this._contractName = "Distribute";
    LocalContractStorage.defineProperties(this, {
        _state: null,
        _nat_contract: null,
        _multiSig: null,
        _distributeManager: null,
        _blacklist: null
    });

    this._pledge = new DPledge();
    this._nr = new DNR();
    this._vote = new DVote();
};

Distribute.prototype = {
    init: function (height, multiSig) {
        this._state = STATE_WORK;
        this._pledge._pledge_period = 0;
        this._pledge._pledge_page = 0;
        this._pledge._pledge_height = height;
        this._nr._nr_period = 0;
        this._nr._nr_page = 0;
        this._nr._nr_height = height;
        this._multiSig = multiSig;
        this._blacklist = [];
    },
    _verifyPermission: function () {
        if (this._multiSig !== Blockchain.transaction.from) {
            throw ("Permission Denied!");
        }
    },
    _verifyManager: function () {
        if (this._distributeManager !== Blockchain.transaction.from) {
            throw ("Distribute Manager Permission Denied!");
        }
    },
    _verifyStatus: function() {
        if (this._state === STATE_PAUSED) {
            throw ("Distribute paused");
        }
    },
    _produceNat: function(data) {
        let nat = new Blockchain.Contract(this._nat_contract);
        let natData = new Array();
        for (let key in data) {
            let item = data[key];
            let value = new BigNumber(10).pow(18).times(item.nat).floor();
            natData.push({addr: item.addr, value: value.toString(10)});
        }
        nat.call("produce", natData);
    },

    // for mulisig.js
    update_status: function(state) {
        this._verifyPermission();
        this._state = state;
    },
    setConfig: function(natConfig) {
        this._verifyPermission();
        this._config = natConfig;
        this._distributeManager = natConfig.distributeManager;
        this._multiSig = natConfig.multiSig;
        this._nat_contract = natConfig.natNRC20;
        this._pledge.update_contract(natConfig.pledge);
        this._vote.update_contract(natConfig.vote, natConfig.distributeVoteTaxAddrv);
        this._nr.update_contract(natConfig.nrData);
    },

    // update blacklist
    setBlacklist: function(addrList) {
        this._verifyPermission();
        this._blacklist = addrList
    }, 

    // trigger pledge reward
    triggerPledge: function() {
        this._verifyManager();
        this._verifyStatus();

        let pledge = this._pledge.calculate();
        this._produceNat(pledge.data);
        return {needTrigger: pledge.hasNext};
    },
    // trigger nr reward
    triggerNR: function() {
        this._verifyManager();
        this._verifyStatus();
        let nr = this._nr.calculate();
        this._produceNat(nr.data);
        return {needTrigger: nr.hasNext};
    },
    // trigger vote reward
    vote: function(address, value) {
        this._verifyManager();
        this._verifyStatus();
        let data = this._vote.calculate(this, address, value);
        this._produceNat(data);
    }
};

module.exports = Distribute;
