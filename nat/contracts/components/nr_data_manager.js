function NrDataManager(storage) {
    this._storage = storage;
    this._cycleList = new PageList(storage, "cycle_list");
    this._nrDataSource = null;
    this._exchangeDataManager = ExchangeAddressManager.instance;
}

NrDataManager.prototype = {

    get nrDataSource() {
        if (!this._nrDataSource) {
            this._nrDataSource = new Blockchain.Contract(Config.instance.nrDataAddress);
        }
        return this._nrDataSource;
    },

    _cycleKey: function (data) {
        return "c_" + data.sb + "_" + data.eb;
    },

    _getLastPageIndex: function () {
        let indexes = this._cycleList.getPageIndexes();
        if (!indexes || indexes.length === 0) {
            return 0;
        }
        return indexes[indexes.length - 1].i;
    },

    /**
     * {
     *     sb:1,  // startBlock
     *     eb:500, // endBlock
     *     s:0|1, // status 0: 未空投 1:已空投
     *     as:[  // addresses
     *         {
     *             a:"n1xxxx", // address
     *             nr:"18382", // nr value
     *             nat:"100",  // airdrop nat value
     *         }
     *     ]
     * }
     *
     */
    // 同步数据
    // 计算 nat 空投奖励(排除交易所地址)
    sync: function () {
        let r = this.nrDataSource.call("getData", true, {index: this._getLastPageIndex()}, {returnLast: true});
        // TODO:
    },

    // 计算startBlock 到 endBlock之间 有多少个周期， 用于质押奖励计算
    // 如果 startBlock 小于最小周期，或者 endBlock 所在周期还未完成，返回 null
    getCycleCount: function (startBlock, endBlock) {
        let indexes = this._cycleList.getPageIndexes();
        if (!indexes || indexes.length === 0) {
            return null;
        }
        let d = this._cycleList.getPageData(0);
        if (!d || d.length === 0 || d[0].sb > startBlock) {
            return null;
        }
        d = this._cycleList.getPageData(indexes[indexes.length - 1].i);
        if (!d || d.length === 0 || d[d.length - 1].eb < endBlock) {
            return null;
        }

        let r = new BigNumber(0);
        this._cycleList.each(function (c) {
            if (c.eb < startBlock) {
                return true;
            }
            if (c.sb > endBlock) {
                return false;
            }
            let s = startBlock < c.sb ? c.sb : startBlock;
            let e = endBlock > c.eb ? c.eb : endBlock;
            r = r.plus(new BigNumber(e - s + 1).div(new BigNumber(c.eb - c.sb + 1)));
            return true;
        });
        return r;
    },

    getLastCycleData: function () {
        // TODO:
    },

    saveCycleData: function (data) {
        this._storage.put(this._cycleKey(data), data);
    }
};

NrDataManager.instance = null;
