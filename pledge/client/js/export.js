function _generateCheck() {
    var r = unlock(),
        r1 = checkNonceAndGas();
    r = r && r1;
    var natContract = $("#nat_contract").val();
    if (!NebAccount.isValidAddress(natContract)) {
        setError($("#nat_contract"), "please input password.");
        alert("Please enter the correct contract address");
        r = false;
    } else {
        cancelError($("#nat_contract"));
    }
    return r;
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
