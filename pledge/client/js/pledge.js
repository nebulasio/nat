function _generateCheck() {
    if (!unlock()) {
        return false;
    }
    var amount = $("#amount").val();
    var num = $("#num").val();
    var a = amount.split(".");
    var amountValid = a.length === 1 || a[1].length <= 18;
    amountValid = amountValid && /^\d+(.\d+)?$/.test(amount);
    if (!amountValid) {
        alert("Invalid value! The minimum unit is wei (1^-18atp) ");
        return false;
    }
    if (NebUtils.toBigNumber(amount).lt(NebUtils.toBigNumber(1))) {
        alert("The amount must be greater than 1 NAS");
        return false;
    }
    if (!/^\d+$/.test(num) || parseInt(num) < 1) {
        alert("Please enter the correct pledge cycle");
        return false;
    }
    return true;
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
