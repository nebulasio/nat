function Vote(storage) {
    this._storage = storage;
    this._config = Config.instance;
    this._token = Token.instance;

    this.YES = 1;
    this.NO = 2;
    this.OTHER = 3;
}

Vote.prototype = {

    _verifyDataSource: function (dataSource) {
        let dataSources = this._config.voteDataAddresses;
        if (dataSources.indexOf(dataSource) < 0) {
            // TODO: error msg
            throw ("");
        }
    },

    _getData: function (dataSource, hash) {
        this._verifyDataSource(dataSource);
        let c = new Blockchain.Contract(dataSource);
        let d = c.call("getData", hash);
        if (!d) {
            // TODO: error msg
            throw ("");
        }
    },

    _verifyVote: function (value, weight) {
        if ([this.YES, this.NO, this.OTHER].indexOf(parseInt(value)) < 0) {
            // TODO: error msg
            throw ("");
        }
        if (this._token.balanceOf(Blockcbain.transaction.from).lt(weight)) {
            // TODO: error msg
            throw ("");
        }
    },

    _key: function (dataSource, hash) {
        return dataSource + "_" + hash;
    },

    _keyAddresses: function (dataSource, hash) {
        return dataSource + "_" + hash + "_as";
    },

    _keyWithAddress: function (dataSource, hash, address) {
        return dataSource + "_" + hash + "_" + address;
    },

    _contains: function (dataSource, hash) {
        return this._storage.get(this._key(dataSource, hash)) != null;
    },

    _result: function (dataSource, hash) {
        return this._storage.get(this._key(dataSource, hash));
    },

    _vote: function (dataSource, hash, value, weight) {
        let a = Blockchain.transaction.from;
        // TODO: 是否只允许投一次
        if (this.getVoteResultByAddress(dataSource, hash, a)) {
            throw ("");
        }
        let r = this._result(dataSource, hash);
        if (!r) {
            r = {y: "0", n: "0", o: "0"};
        }
        let w = new BigNumber(weight).div(new BigNumber(10).pow(this._token.decimals));
        switch (value) {
            case this.YES:
                r.y = new BigNumber(r.y).plus(w).toString(10);
                break;
            case this.NO:
                r.n = new BigNumber(r.n).plus(w).toString(10);
                break;
            case this.OTHER:
                r.o = new BigNumber(r.o).plus(w).toString(10);
                break;
        }
        this._storage.put(this._key(dataSource, hash), r);
        this._storage.put(
            this._keyWithAddress(dataSource, hash, a),
            {
                v: value,
                w: w.toString(10)
            });
        this._token.destroy(Blockchain.transaction.from, weight);
        // TODO: 理事会 1%
    },

    vote: function (dataSource, hash, value, weight) {
        weight = new BigNumber(weight);
        this._verifyData(dataSource, hash);
        this._verifyVoteValue(value, weight);
        if (!this._contains(dataSource, hash)) {
            let list = new PageList(this._storage, dataSource);
            list.add(hash);
        }
        this._vote(dataSource, hash, value, weight);
    },

    getHashIndexes: function (dataSource) {
        this._verifyDataSource(dataSource);
        return new PageList(this._storage, dataSource).getPageIndexes();
    },

    getHashes: function (dataSource, index) {
        this._verifyDataSource(dataSource);
        return new PageList(this._storage, dataSource).getPageData(index);
    },

    getVoteResult: function (dataSource, hash) {
        let r = this._result(dataSource, hash);
        if (r) {
            try {
                r.data = new Blockchain.Contract(dataSource).call("getData", hash);
            } catch (e) {
            }
        }
        return r;
    },

    getVoteResultByAddress: function (dataSource, hash, address) {
        return this._storage.get(this._keyWithAddress(dataSource, hash, address));
    },

    getVoteAddressIndexes: function (dataSource, hash) {
        return new PageList(this._storage, this._keyAddresses(dataSource, hash, address)).getPageIndexes();
    },

    getVoteAddresses: function (dataSource, hash, index) {
        return new PageList(this._storage, this._keyAddresses(dataSource, hash, address)).getPageData(index);
    },
};
