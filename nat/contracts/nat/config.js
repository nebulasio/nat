function Config(storage) {
    this._storage = storage;

    this._nrDataAddress = null;
    this._voteDataAddresses = null;
    this._multiSignAddress = null;

    this._keyNrDataAddress = "nr_data_address";
    this._keyVoteDataAddresses = "vote_data_addresses";
    this._keyMultiSignAddress = "multi_sign_address";
}

Config.prototype = {
    _getMultiSignAddress: function () {
        if (!this._multiSignAddress) {
            this._multiSignAddress = this._storage.get(this._keyMultiSignAddress);
        }
        return this._multiSignAddress;
    },

    initialize: function (multiSignAddress, nrDataAddress, voteDataAddresses) {
        this.multiSignAddress = multiSignAddress;
        this.nrDataAddress = nrDataAddress;
        this.voteDataAddresses = voteDataAddresses;
    },

    get isFromMultiSign() {
        return Blockchain.transaction.from === this._getMultiSignAddress();
    },

    set multiSignAddress(address) {
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
        this._voteDataAddresses = addresses;
        this._storage.put(this._keyVoteDataAddresses, addresses);
    }
};
