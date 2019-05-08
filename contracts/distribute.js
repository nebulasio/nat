const STATE_WORK = 0;
const STATE_PAUSED = 1;

function DPledge() {
	LocalContractStorage.defineProperties(this, {
    	_pledge_period: null,
    	_pledge_height: null,
    	_pledge_contract: null
    });
};

DPledge.prototype = {
	update_contract: function(contract) {
		this._pledge_contract = contract;
	},
	calculate: function(section) {
		let pledge = new Blockchain.Contract(this._pledge_contract);
		let pledgeData = pledge.call("getPledge", section.startHeight, section.endHeight);
		let data = new Array();
		for (let key in pledgeData) {
			let item = pledgeData[key];
			// 5 * 0.0025 * x / (1 + sqrt(100/x)) * 0.997^i
			let gx = new BigNumber(0.0025).times(item.value);
			let zx = new BigNumber(100).div(item.value).pow(0.5).plus(1).pow(-1);
			let y = new BigNumber(0.997).pow(this._pledge_period);
			value = new BigNumber(5).times(gx).times(zx).times(y);
			item.nat = value.toString(10);
			data.push(item);
		}
		pledge.call("setPledgeResult", section.startHeight, section.endHeight, data);
		this._tigger_event(section, data);
		this._pledge_period = this._pledge_period + 1;
		this._pledge_height = section.endHeight;
		return data;
	},
	_tigger_event: function(section, data) {
		Event.Trigger("pledge", {
	    		period: this._pledge_period,
	    		start_height: section.startHeight,
	    		end_height: section.endHeight,
	    		data: data
            });
	}
};

function DNR() {
	LocalContractStorage.defineProperties(this, {
		_nr_period: null,
    	_nr_height: null,
    	_nr_contract: null
    });
};

DNR.prototype = {
	update_contract: function(contract) {
		this._nr_contract = contract;
	},
	summary: function(height) {
		let nr = new Blockchain.Contract(this._nr_contract);
		return nr.call("summary", height);
	},
	calculate: function() {
		let nr = new Blockchain.Contract(this._nr_contract);
		let nrList = nr.call("getNR", this._nr_height);
		let dataArray = new Array();
		for (let key in nrList) {
			let nrData = nrList[key];
			let data = new Array();
			for (let dkey in nrData.data) {
				let item = nrData.data[dkey];
				// x / (1 + sqrt(100/x)) * 0.997^i
				let zx = new BigNumber(100).div(item.value).pow(0.5).plus(1).pow(-1).times(item.value);
				let y = new BigNumber(0.997).pow(this._nr_period);
				let value = zx.times(y);
				item.nat = value.toString(10);
				data.push(item);
			}
			dataArray.push(...data);
			this._tigger_event(nrData.section, data);
			this._nr_period = this._nr_period + 1;
			this._nr_height = nrData.section.endHeight;
		}
		return dataArray;
	},
	_tigger_event: function(section, data) {
		Event.Trigger("nr", {
				period: this._nr_period,
	    		start_height: section.startHeight,
	    		end_height: section.endHeight,
	    		data: data
            });
	}
};

function DVote() {
	LocalContractStorage.defineProperties(this, {
    	_vote_contract: null
    });
};

DVote.prototype = {
	update_contract: function(contract) {
		this._vote_contract = contract;
	},
	_verifyPermission: function() {
		if (this._vote_contract.indexOf(Blockchain.transaction.from) < 0) {
            throw ("No permission");
        }
	},
	calculate: function(nr, addr, value) {
		this._verifyPermission();
		value = new BigNumber(0).minus(value);
		let score = Blockchain.getLatestNebulasRank(addr);
		score = new BigNumber(score);
		if (score.gt(0)) {
			// x / (1 + sqrt(100/x)) * 0.997^i
			let zx = new BigNumber(100).div(score).pow(0.5).plus(1).pow(-1).times(score);
			let y = new BigNumber(0.997).pow(nr._nr_period);
			value = zx.times(y).plus(value);
		}
		let data = {
			addr: addr,
			nat: value.toString(10)
		};
		// vote reward
		this._tigger_event(data);
		return new Array().push(data);
	},
	_tigger_event: function(data) {
		Event.Trigger("vote", data);
	}
};

function Distribute() {
	this._contractName = "Distribute";
    LocalContractStorage.defineProperties(this, {
    	_state: null,
        _nat_contract: null,
        _multiSig: null
    });

    this._pledge = new DPledge();
    this._nr = new DNR();
    this._vote = new DVote();
};

Distribute.prototype = {
	init: function (height, multiSig) {
		this._state = STATE_WORK;
		this._pledge._pledge_period = 0;
		this._pledge._pledge_height = height;
		this._nr._nr_period = 0;
		this._nr._nr_height = height;
		this._multiSig = multiSig;
    },
    _verifyPermission: function () {
        if (this._multiSig !== Blockchain.transaction.from) {
            throw ("Permission Denied!");
        }
	},
    _verifyStatus: function() {
    	if (this._state === STATE_PAUSED) {
        	throw ("Distribute paused");
        }
    },
    _produceNat: function(data) {
    	let nat = new Blockchain.Contract(this._nat_contract);
    	nat.call("nat_produce", data);
    },
    update_status: function(state) {
    	this._verifyPermission();
    	this._state = state;
    },
    setConfig: function(config) {
		this._verifyPermission();
		this._multiSig = config.multiSig;
    	this._nat_contract = config.nat;
    	this._pledge.update_contract(config.pledge);
    	this._vote.update_contract(config.vote);
    	this._nr.update_contract(config.nrData);
    },
    // tigger pledge reward
    tiggerPledge: function() {
    	this._verifyPermission();
    	this._verifyStatus();
    	let summary = this._nr.summary(this._pledge._pledge_height);
    	for (let key in summary) {
    		let data = this._pledge.calculate(summary[key].section);
    		this._produceNat(data);
    	}
    },
    // tigger nr reward
    tiggerNR: function() {
    	this._verifyPermission();
    	this._verifyStatus();
    	let data = this._nr.calculate();
    	this._produceNat(data);
    },
    // tigger vote reward
    vote: function(address, value) {
    	this._verifyPermission();
    	this._verifyStatus();
    	let data = this._vote.calculate(address, value);
    	this._produceNat(data);
    }
};

module.exports = Distribute;
