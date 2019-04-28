function _generateCheck() {
    var r1 = unlock(),
        r2 = checkNonceAndGas(),
        r3 = _validInput($("#amount")),
        r4 = _validInput($("#num"));
    return r1 && r2 && r3 && r4;
}

function generate() {
    if (!_generateCheck()) {
        return;
    }
    var amount = $("#amount").val(),
        nonce = $("#nonce2").val(),
        gaslimit = $("#gas_limit").val(),
        gasprice = $("#gas_price2").val(),
        num = $("#num").val(),
        contract = {
            "source": "",
            "sourceType": "js",
            "function": "pledge",
            "args": "[\"" + num + "\"]",
            "binary": "",
            "type": "call"
        };

    try {
        var tx = new NebTransaction(parseInt(chainId), account, pledgeContract, NebUnit.nasToBasic(amount), parseInt(nonce), gasprice, gaslimit, contract);
        tx.signTransaction();
        $("#output").val(tx.toProtoString());
        didGenerate();
    } catch (e) {
        alert(e);
    }
}
