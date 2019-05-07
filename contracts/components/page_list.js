function PageList(storage, key) {
    this._storage = storage;
    this._key = key;
    this._pageIndexes = null;
    this._pageSize = 1000;
}

PageList.prototype = {

    _indexesKey: function () {
        return "pis_" + this._key;
    },

    _dataKey: function (index) {
        return "pd_" + this._key + "_" + index;
    },

    _lastIndex: function () {
        let indexes = this.getPageIndexes();
        if (indexes.length > 0) {
            return indexes[indexes.length - 1];
        }
        return null;
    },

    _addIndex: function (index) {
        this.getPageIndexes().push(index);
        this._saveIndexes();
    },

    _saveIndexes: function () {
        this._storage.put(this._indexesKey(), this.getPageIndexes());
    },

    each: function (fn) {
        let indexes = this.getPageIndexes();
        if (indexes) {
            for (let i = 0; i < indexes.length; ++i) {
                let ds = this.getPageData(indexes[i].i);
                if (ds) {
                    for (let j = 0; j < ds.length; ++j) {
                        if (!fn(ds[j])) {
                            return;
                        }
                    }
                }
            }
        }
    },

    del: function (fn) {
        let indexes = this.getPageIndexes();
        if (indexes) {
            for (let i = 0; i < indexes.length; ++i) {
                let ds = this.getPageData(indexes[i].i);
                if (ds) {
                    let r = [];
                    for (let j = 0; j < ds.length; ++j) {
                        if (!fn(ds[j])) {
                            r.push(ds[j]);
                        }
                    }
                    if (r.length !== ds.length) {
                        this._storage.put(this._dataKey(indexes[i].i), r);
                    }
                }
            }
        }
    },

    getPageIndexes: function () {
        if (!this._pageIndexes) {
            this._pageIndexes = this._storage.get(this._indexesKey());
        }
        if (!this._pageIndexes) {
            this._pageIndexes = [];
        }
        return this._pageIndexes;
    },

    getPageData: function (index) {
        let r = this._storage.get(this._dataKey(index));
        if (!r) {
            r = [];
        }
        return r;
    },

    add: function (obj) {
        let index = this._lastIndex();
        let i = 0;
        if (index) {
            i = index.i;
            if (index.l >= this._pageSize) {
                i += 1;
                index = null;
            }
        }
        if (!index) {
            index = {i: i, l: 0};
            this._addIndex(index);
        }
        let d = this.getPageData(index.i);
        d.push(obj);
        index.l += 1;
        this._saveIndexes();
        this._storage.put(this._dataKey(index.i), d);
    },

    addPage: function (page) {
        let i = 0;
        let index = this._lastIndex();
        if (index) {
            i = index.i + 1;
        }
        index = {i: i, l: page.length};
        this._addIndex(index);
        this._storage.put(this._dataKey(index.i), page);
    }
};
