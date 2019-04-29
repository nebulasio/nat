function DataManager(storage) {
    this._config = new Config(storage);
}

DataManager.prototype = {
    foreach: function (f) {
        let dc = new Blockchain.Contract(this._config.voteDataAddresses);
    }
};
