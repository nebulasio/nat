function _generateCheck() {
    if (!unlock()) {
        return false;
    }
    var natContract = $("#nat_contract").val();
    if (!NebAccount.isValidAddress(natContract)) {
        alert("Please enter the correct contract address");
        return false;
    }
    return true;
}

function generate() {
    if (!_generateCheck()) {
        return;
    }
    var nonce, gasLimit, gasPrice, natContract, tx;
    natContract = $("#nat_contract").val();
    nonce = $("#nonce2").val();
    gasLimit = $("#gas_limit").val();
    gasPrice = $("#gas_price2").val();

    var contract = {
        "source": "",
        "sourceType": "js",
        "function": "stopAndExportDataToNat",
        "args": "[\"" + natContract + "\"]",
        "binary": "",
        "type": "call"
    };

    try {
        tx = new NebTransaction(parseInt(chainId), account, pledgeContract, "0", parseInt(nonce), gasPrice, gasLimit, contract);
        tx.signTransaction();
        $("#output").val(tx.toProtoString());
    } catch (e) {
        alert(e);
    }
}

function send() {
    neb.api.sendRawTransaction($("#output").val()).then(function (resp) {
        if (resp.error) {
            $("#result").text(resp.error);
        } else {
            $("#result").text("Explorer link:");
        }
        var link = explorerLink + resp.txhash;
        $("#hash").attr("href", link);
        $("#hash").text(link);
        $("#hash").show();
        // return neb.api.getTransactionReceipt(resp.txhash);
    }).catch(function (o) {
        alert(o);
    });
}
