function _generateCheck() {
    var r = unlock(),
        r1 = checkNonceAndGas();
    r = r && r1;
    var amount = $("#amount").val();
    var num = $("#num").val();

    var a = amount.split(".");
    var amountValid = a.length === 1 || a[1].length <= 18;
    amountValid = amountValid && /^\d+(\.\d+)?$/.test(amount);
    if (!amountValid) {
        setError($("#amount"), "Invalid value! The minimum unit is wei (1^-18atp) ");
        r = false;
    } else {
        cancelError($("#amount"));
    }
    if (NebUtils.toBigNumber(amount).lt(NebUtils.toBigNumber(1))) {
        setError($("#amount"), "The amount must be greater than 1 NAS");
        r = false;
    } else {
        cancelError($("#amount"));
    }

    if (!/^\d+$/.test(num) || parseInt(num) < 1) {
        setError($("#num"), "Please enter the correct pledge cycle");
        r = false;
    } else {
        cancelError($("#num"));
    }
    return r;
}

function generate() {
    if (!_generateCheck()) {
        return;
    }
    var fromaddress, amount, nonce, gaslimit, gasprice, num, tx;
    fromaddress = $(".icon-address.from input").val();
    amount = $("#amount").val();
    nonce = $("#nonce2").val();
    gaslimit = $("#gas_limit").val();
    gasprice = $("#gas_price2").val();
    num = $("#num").val();

    var contract = {
        "source": "",
        "sourceType": "js",
        "function": "pledge",
        "args": "[\"" + num + "\"]",
        "binary": "",
        "type": "call"
    };

    try {
        tx = new NebTransaction(parseInt(chainId), account, pledgeContract, NebUnit.nasToBasic(amount), parseInt(nonce), gasprice, gaslimit, contract);
        tx.signTransaction();
        $("#output").val(tx.toProtoString());
        didGenerate();
    } catch (e) {
        alert(e);
    }
}
