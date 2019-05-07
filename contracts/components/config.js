function Config(storage) {
    this._storage = storage;

    this._multiSignAddress = null;
    this._nrDataAddress = null;
    this._voteDataAddresses = null;
    this._pledgeDataAddress = null;

    this._keyMultiSignAddress = "multi_sign_address";
    this._keyNrDataAddress = "nr_data_address";
    this._keyVoteDataAddresses = "vote_data_addresses";
    this._keyPledgeDataAddress = "pledge_data_address";
}

Config.prototype = Object.assign({
    _getMultiSignAddress: function () {
        if (!this._multiSignAddress) {
            this._multiSignAddress = this._storage.get(this._keyMultiSignAddress);
        }
        return this._multiSignAddress;
    },

    _getPledgeDataAddress: function () {
        if (!this._pledgeDataAddress) {
            this._pledgeDataAddress = this._storage.get(this._keyPledgeDataAddress);
        }
        return this._pledgeDataAddress;
    },

    initialize: function (multiSignAddress, nrDataAddress, voteDataAddresses, pledgeDataAddress) {
        this.multiSignAddress = multiSignAddress;
        this.nrDataAddress = nrDataAddress;
        this.voteDataAddresses = voteDataAddresses;
        this.pledgeDataAddress = pledgeDataAddress;
    },

    get isFromMultiSign() {
        return Blockchain.transaction.from === this._getMultiSignAddress();
    },

    set multiSignAddress(address) {
        this._verifyContractAddress(address);
        this._multiSignAddress = address;
        this._storage.put(this._keyMultiSignAddress, address);
    },

    get nrDataAddress() {
        if (!this._nrDataAddress) {
            this._nrDataAddress = this._storage.get(this._keyNrDataAddress);
        }
        return this._nrDataAddress;
    },

    set nrDataAddress(address) {
        this._verifyContractAddress(address);
        this._nrDataAddress = address;
        this._storage.put(this._keyNrDataAddress, address);
    },

    get voteDataAddresses() {
        if (!this._voteDataAddresses) {
            this._voteDataAddresses = this._storage.get(this._keyVoteDataAddresses);
        }
        return this._voteDataAddresses;
    },

    set voteDataAddresses(addresses) {
        this._verifyContractAddress(address);
        this._voteDataAddresses = addresses;
        this._storage.put(this._keyVoteDataAddresses, addresses);
    },

    get isFromPledgeDataAddress() {
        return Blockchain.transaction.from === this._getPledgeDataAddress();
    },

    set pledgeDataAddress(address) {
        this._verifyContractAddress(address);
        this._pledgeDataAddress = address;
        this._storage.put(this._keyPledgeDataAddress, address);
    },
}, Base);

Config.instance = null;
