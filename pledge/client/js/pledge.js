$(function () {
    $("#nano_contract").val(pledgeContract);
    $("#btn_nano_generate").on("click", genCode);

    var li = $(".nav li a").get(0);
    li.click();
});

function _generateCheck() {
    var r1 = unlock(),
        r2 = checkNonceAndGas(),
        r3 = _validInput($("#amount")),
        r4 = _validInput($("#num"));
    return r1 && r2 && r3 && r4;
}

function _generateCodeCheck() {
    var r1 = _validInput($("#nano_amount")),
        r2 = _validInput($("#nano_num"));
    return r1 && r2;
}

function genCode() {
    if (!_generateCodeCheck()) {
        return;
    }
    var params = {
        "pageParams": {
            "pay": {
                "currency": "NAS",
                "value": NebUnit.nasToBasic($("#nano_amount").val()),
                "to": pledgeContract,
                "payload": {
                    "function": "pledge",
                    "args": "[" + $("#nano_num").val() + "]",
                    "type": "call"
                }
            }
        },
        "des": "confirmtransfer",
        "category": "jump"
    };
    var str = JSON.stringify(params);
    $("#code").qrcode({
        background: "#ffffff00",//背景颜色
        foreground: "#000000", //前景颜色
        width: 300,
        height: 300,
        text: str
    });
    $("#code_container").show();
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
