function _generateCheck() {
    var r1 = unlock(),
        r2 = checkNonceAndGas(),
        r3 = _validInput($("#nat_contract"));
    return r1 && r2 && r3;
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
        didGenerate();
    } catch (e) {
        alert(e);
    }
}
