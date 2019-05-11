function VoteData() {
}

VoteData.prototype = {

    init: function () {
    },

    getData: function (hash) {
        if (hash === "test_hash") {
            return {
                options: ["yes", "no"],
                content: "test vote data"
            }
        }
        return null;
    }
};

module.exports = VoteData;
