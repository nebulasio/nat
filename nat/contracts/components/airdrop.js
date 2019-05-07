function Airdrop() {
    this._nrDataManager = NrDataManager.instance;
    this._token = Token.instance;
}

Airdrop.prototype = Object.assign({

    _airdop: function (info) {
        if (info.nat === "0") {
            return;
        }
        this._token.airdrop(info.a, new BigNumber(info.nat));
    },

    airdrop: function () {
        let data = this._nrDataManager.getLastCycleData();
        if (data.s === 1) {
            return;
        }
        for (let i = 0; i < data.as.length; ++i) {
            this._airdop(data.as[i]);
        }
        data.s = 1;
        this._nrDataManager.saveCycleData(data);
    },
}, Base);

Airdrop.instance = null;
