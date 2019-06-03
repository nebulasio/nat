const STATE_WORK = 0;
const STATE_PAUSED = 1;
const HEIGHT_INTERVAL = 40320; // 30
const PAGE_SIZE = 200;

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
        if (end > Blockchain.block.height) {
            throw new Error("Pledge period exceeds the current height.");
        }
        let page = this._pledge_page;
        let section = {
            period: this._pledge_period,
            startHeight: start,
            endHeight: end,
            page: page
        };
        let pledgeData = pledge.call("getPledge", start, end, page);
        // if current pledge has no data, update period
        if (pledgeData === null) {
            this._pledge_period = this._pledge_period + 1;
            this._pledge_height = end + 1;
            this._pledge_page = 0;
            pledge.call("setPledgeResult", start, end, null);
            return {hasNext: false, section: section, data: null};
        }

        let data = new Array();
        let y = new BigNumber(0.997).pow(this._pledge_period); 
        for (let key in pledgeData.data) {
            let item = pledgeData.data[key];
            // 5 * 12.663 * x / (1 + sqrt(200/x)) * 0.997^i
            let gx = new BigNumber(12.663).times(item.value);
            let zx = new BigNumber(200).div(item.value).sqrt().plus(1).pow(-1);
            let value = new BigNumber(5).times(gx).times(zx).times(y);
            item.nat = value.toString(10);
            data.push(item);
        }
        pledge.call("setPledgeResult", start, end, data);
        this._trigger_event(section, data);
        if (pledgeData.hasNext) {
            this._pledge_page = page + 1;
        } else {
            this._pledge_period = this._pledge_period + 1;
            this._pledge_height = end + 1;
            this._pledge_page = 0;
        }
        return {hasNext: pledgeData.hasNext, section: section, data: data};
    },
    _trigger_event: function(section, data) {
        Event.Trigger("pledge", {
                period: section.period,
                start_height: section.startHeight,
                end_height: section.endHeight,
                page: section.page,
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
        if (nrData === null) {
            throw new Error("No NR Data Found.");
        }

        let section = nrData.section;
        section.period = this._nr_period;
        section.page = page;

        let data = new Array();
        let y = new BigNumber(0.997).pow(this._nr_period);
        for (let key in nrData.data) {
            let item = nrData.data[key];
            let value = new BigNumber(12.663).times(item.score);
            value = value.times(y);
            item.nat = value.toString(10);
            data.push(item);
        }
        this._trigger_event(section, data);
        if (nrData.hasNext) {
            this._nr_page = page + 1;
        } else {
            this._nr_period = this._nr_period + 1;
            this._nr_height = section.endHeight;
            this._nr_page = 0;
        }
        return {hasNext: nrData.hasNext, section: section, data: data};
    },
    _trigger_event: function(section, data) {
        Event.Trigger("nr", {
                period: section.period,
                page: section.page,
                start_height: section.startHeight,
                end_height: section.endHeight,
                data: data
            });
    },
    getNRByAddress: function(addr) {
        let nr = new Blockchain.Contract(this._nr_contract);
        let score = nr.call("getNRByAddress", Blockchain.block.height, addr);
        if (score === null) {
            throw new Error("NR not found.");
        }
        return score;
    }
};

function DVote() {
    LocalContractStorage.defineProperties(this, {
        _vote_contracts: null,
        _vote_tax_addr: null,
        _vote_addr_count: null
    });

    // vote nr data record
    // key:addr
    // value: period:value
    LocalContractStorage.defineMapProperties(this, {
        _vote_nr_data: null,
        _vote_nr_addrs: null
    });
};

DVote.prototype = {
    update_contract: function(contract, taxAddr) {
        this._vote_contracts = contract;
        this._vote_tax_addr = taxAddr;
    },
    _verifyPermission: function() {
        if (this._vote_contracts.indexOf(Blockchain.transaction.from) < 0) {
            throw new Error("No permission for vote.");
        }
    },
    // vote rule:
    // 3% give to the designated tax address
    // reward 10 * min{Nv, Nnr}
    calculate: function(context, addr, value) {
        this._verifyPermission();

        let data = new Array();
        let tax = new BigNumber(value).times(0.03);
        data.push({addr: this._vote_tax_addr, nat: tax.toString(10)});

        let nrData = this._vote_nr_data.get(addr);
        let period = context._nr._nr_period;
        if (period > 0) {
            period = period - 1;
        }
        let y = new BigNumber(0.997).pow(period);
        if (nrData === null || nrData.period !== period) {
            if (nrData === null) {
                let count = this._vote_addr_count;
                this._vote_nr_addrs.set(count, addr);
                this._vote_addr_count = count + 1;
            }

            let score = context._nr.getNRByAddress(addr);
            if (new BigNumber(score).gt(0)) {
                // 12.663 * 0.997^i * x
                let scoreReward = new BigNumber(12.663).times(score);
                let nrReward = scoreReward.times(y);
                nrData = {
                    period: period,
                    reward: nrReward.toString(10)
                }
            } else {
                nrData = {
                    period: period,
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
        this._vote_nr_data.set(addr, nrData);

        if (reward.gt(0)) {
            reward = reward.times(10);
        }
        let  rewardStr = reward.toString(10);
        // burning = (1 − 3%) * 0.997^period * value
        let burning = new BigNumber(value).times(0.97).times(y);
        value = reward.minus(burning);

        data.push({addr: addr, nat: value.toString(10)});
        // vote reward
        this._trigger_event(period, rewardStr, data);
        return data;
    },
    _trigger_event: function(period, reward, data) {
        Event.Trigger("vote", {
            period: period,
            reward: reward,
            data: data
        });
    },
    upload: function(data) {
        if (data instanceof Array) {
            for (let key in data) {
                const item = data[key];
                let nrData = this._vote_nr_data.get(item.addr);
                if (nrData === null) {
                    let count  = this._vote_addr_count;
                    this._vote_nr_addrs.set(count,item.addr);
                    this._vote_addr_count = count + 1;
                }   
                nrData = {
                    period: item.period,
                    reward: item.reward
                }
                this._vote_nr_data.set(item.addr, nrData);
            }
        } else {
            throw new Error("Data format error.");
        }
    },
    getData: function(start, size) {
        let data = new Array();
        let count = start + size;
        let hasNext = true;
        if (count >= this._vote_addr_count) {
            hasNext = false;
            count = this._vote_addr_count;
        }
        for (let index = start; index < count; index++) {
            let addr = this._vote_nr_addrs.get(index);
            let nrData = this._vote_nr_data.get(addr);
            nrData.addr = addr;
            data.push(nrData);
        }
        return {hasNext: hasNext, data: data};
    }
};

function Distribute() {
    this._contractName = "Distribute";
    LocalContractStorage.defineProperties(this, {
        _state: null,
        _config: null,
        _blacklist: null,
        _admin: null,
        _natProducers: null
    });

    LocalContractStorage.defineMapProperties(this, {
        _natProducePages: null
    });

    this._pledge = new DPledge();
    this._nr = new DNR();
    this._vote = new DVote();
};

Distribute.prototype = {
    init: function (pledgeSection, nrSection, multiSig, admin, producers) {
        this._state = STATE_WORK;
        this._pledge._pledge_period = pledgeSection.period;
        this._pledge._pledge_page = pledgeSection.page;
        this._pledge._pledge_height = pledgeSection.height;
        this._nr._nr_period = nrSection.period;
        this._nr._nr_page = nrSection.page;
        this._nr._nr_height = nrSection.height;
        this._vote._vote_contracts = [];
        this._vote._vote_addr_count = 0;

        let config = {multiSig: multiSig};
        this._config = config;
        this._blacklist = [];
        this._admin = admin;
        this._natProducers = producers;
    },
    _verifyAdmin: function () {
        if (this._admin !== Blockchain.transaction.from) {
            throw new Error("Admin Permission Denied!");
        }
    },
    _verifyPermission: function () {
        if (this._config.multiSig !== Blockchain.transaction.from) {
            throw new Error("Permission Denied!");
        }
    },
    _verifyManager: function () {
        if (this._config.distributeManager !== Blockchain.transaction.from) {
            throw new Error("Distribute Manager Permission Denied!");
        }
    },
    _verifyNATProducer: function (producer) {
        this._verifyAddress(producer);
        if (this._natProducers.indexOf(producer) < 0) {
            throw new Error("NAT Producer Permission Denied!");
        }
    },
    _verifyStatus: function() {
        if (this._state === STATE_PAUSED) {
            throw new Error("Distribute paused.");
        }
    },
    _verifyBlacklist: function(addr) {
        if (this._blacklist.indexOf(addr) >= 0) {
            throw new Error("Address is not allowed for distribute.");
        }
    },
    _verifyAddress: function (address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw new Error("Address format error, address=" + address);
        }
    },
    _produceNat: function(data) {
        if (data !== null && data instanceof Array && data.length > 0) {
            let nat = new Blockchain.Contract(this._config.natNRC20);
            let natData = new Array();
            for (let key in data) {
                let item = data[key];
                let value = new BigNumber(10).pow(18).times(item.nat).floor();
                natData.push({addr: item.addr, value: value.toString(10)});
            }
            nat.call("produce", natData);
        }
    },
    _balanceOf: function(address) {
        let nat = new Blockchain.Contract(this._config.natNRC20);
        return nat.call("balanceOf", address);
    },
    // for mulisig.js
    updateStatus: function(state) {
        this._verifyPermission();
        this._state = state;
    },
    setConfig: function(natConfig) {
        this._verifyPermission();
        this._config = natConfig;
        this._pledge.update_contract(natConfig.pledge);
        this._vote.update_contract(natConfig.vote, natConfig.distributeVoteTaxAddr);
        this._nr.update_contract(natConfig.nrData);
    },
    getAdmin: function() {
        return this._admin;
    },
    setAdmin: function(admin) {
        this._verifyAdmin();

        this._admin = admin;
    },
    getProducers: function() {
        return this._natProducers;
    },
    setProducers: function(producers) {
        this._verifyAdmin();

        for(let idx in producers) {
            let addr = producers[idx];
            this._verifyAddress(addr);
        }
        this._natProducers = producers;
    },
    getConfig: function () {
        return this._config;
    },
    // update blacklist
    setBlacklist: function(addrList) {
        this._verifyPermission();
        this._blacklist = addrList;
    }, 

    // trigger pledge reward
    triggerPledge: function() {
        this._verifyManager();
        this._verifyStatus();

        let pledge = this._pledge.calculate();
        this._produceNat(pledge.data);
        return {needTrigger: pledge.hasNext, section: pledge.section};
    },
    getPledgeSection: function() {
        this._verifyManager();

        let section = {
            period: this._pledge._pledge_period,
            page: this._pledge._pledge_page,
            height: this._pledge._pledge_height
        }
        return section;
    },
    // trigger nr reward
    triggerNR: function() {
        this._verifyManager();
        this._verifyStatus();

        let nr = this._nr.calculate();
        this._produceNat(nr.data);
        return {needTrigger: nr.hasNext, section: nr.section};
    },
    getNRSection: function() {
        this._verifyManager();

        let section = {
            period: this._nr._nr_period,
            page: this._nr._nr_page,
            height: this._nr._nr_height
        }
        return section;
    },
    triggerNAT: function(datasource) {
        this._verifyManager();
        this._verifyStatus();
        this._verifyNATProducer(datasource);

        let producePage = this._getNATPage(datasource);
        let producer = new Blockchain.Contract(datasource);
        let result = producer.call("getNATData", producePage, PAGE_SIZE);
        this._produceNat(result.data);

        producePage = result.hasNext ? producePage + 1 : 0;
        this._natProducePages.set(datasource, producePage);

        return {datasource: datasource, needTrigger: result.hasNext, section: result.section};
    },
    _getNATPage: function(datasource) {
        let producePage = this._natProducePages.get(datasource);
        if (producePage === null) {
            producePage = 0;
        }
        return producePage;
    },
    getNATPage: function(datasource) {
        this._verifyManager();
        this._verifyNATProducer(datasource);

        return this._getNATPage(datasource);
    },
    // trigger vote reward
    vote: function(address, value) {
        this._verifyStatus();
        this._verifyAddress(address);
        this._verifyBlacklist(address);

        let balance = this._balanceOf(address);
        if (new BigNumber(value).gt(balance)) {
            throw new Error("Insufficient balance.");
        }

        let data = this._vote.calculate(this, address, value);
        this._produceNat(data);
        let nat = "0";
        for (let key in data) {
            if (data[key].addr === address) {
                nat = data[key].nat;
                break;
            }
        }
        return nat;
    },
    // uploadVoteData: function(data) {
    //     this._verifyManager();

    //     this._vote.upload(data);
    // },
    getVoteData: function(start, size) {
        this._verifyManager();

        let voteData = this._vote.getData(start, size);
        return {index: start, hasNext: voteData.hasNext, data: voteData.data};
    }
};

module.exports = Distribute;
