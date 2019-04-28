var nebulas = require("nebulas");
var NebAccount = nebulas.Account;
var NebUtils = nebulas.Utils;
var NebTransaction = nebulas.Transaction;
var NebUnit = nebulas.Unit;
var neb = new Neb();


// TODO:
// var chainId = 1;
// var explorerLink = "https://explorer.nebulas.io/#/tx/";
// neb.setRequest(new nebulas.HttpRequest("https://mainnet.nebulas.io"));
// TODO:
// var pledgeContract = "n1mBSJqcvPoiMeLFN9CFxmXsjDNB9bJhm1W";

var chainId = 1001;
var explorerLink = "https://explorer.nebulas.io/#/testnet/tx/";
neb.setRequest(new nebulas.HttpRequest("https://testnet.nebulas.io"));

var pledgeContract = "n1paHD9dSA73XivhrgXbyAe4uBdpiznZ5ZJ";

var fileName = null;
var keystore = null;
var account = null;
var accountState = {};

function setError(input, msg) {
    input.popover({trigger: 'focus', content: msg});
    input.popover("show");
    input.addClass("input_error");
}

function cancelError(input) {
    input.popover('dispose');
    input.removeClass("input_error");
}

function showAllError() {
    $(".input_error").popover("show");
}

function showWaiting() {
    bootbox.dialog({message: "Waiting...", size: 'large', closeButton: false, buttons: {}});
}

function hideWaiting() {
    bootbox.hideAll();
}

$(function () {
    $("#btn_get_info").on("click", getInfo);
    $("#btn_generate").on("click", generate);
    $("#btn_send").on("click", send);
    $("#btn_save").on("click", save);
    $("#file").on("change", onChangeFile);

    $("#pwd_container").hide();
    $("#information").hide();
    $("#balance_container").hide();
    $("#save_container").hide();
    $("#contract").val(pledgeContract);
});

function _isInt(val) {
    return /^\d+$/.test(val);
}

function _unlockCheck() {
    if (!keystore) {
        setError($("#btn_keystore"), "Please select your wallet");
        return false;
    }
    cancelError($("#btn_keystore"));
    var r = true;
    var pwd = $("#pwd").val();
    if (!pwd || pwd.length === 0) {
        setError($("#pwd"), "Please input password.");
        r = false;
    } else {
        cancelError($("#pwd"));
    }
    return r;
}

function _updateKeystoreText() {
    var s = "";
    if (fileName) {
        s += fileName;
    }
    if (account) {
        s += " (" + account.getAddressString() + ")";
    }
    $("#btn_keystore").text(s);
}

function _checkGetInfo() {
    if (!NebAccount.isValidAddress($("#from_address").val())) {
        setError($("#from_address"), "Please enter the correct neb address");
        return false;
    }
    cancelError($("#from_address"));
    return true;
}

function _checkSend() {
    if ($("#output").val().length === 0) {
        setError($("#output"), "Please enter the raw transaction");
        return false;
    }
    cancelError($("#output"));
    return true;
}

function checkNonceAndGas() {
    var r = true;
    if (!_isInt($("#nonce2").val())) {
        r = false;
        setError($("#nonce2"), "Please enter the correct nonce");
    } else {
        cancelError($("#nonce2"));
    }

    if (!_isInt($("#gas_price2").val())) {
        r = false;
        setError($("#gas_price2"), "Please enter the correct gas price");
    } else {
        cancelError($("#gas_price2"));
    }

    if (!_isInt($("#gas_limit").val())) {
        r = false;
        setError($("#gas_limit"), "Please enter the correct gas limit");
    } else {
        cancelError($("#gas_limit"));
    }
    return r;
}

function getInfo() {
    if (!_checkGetInfo()) {
        return;
    }
    try {
        showWaiting();
        var address = $("#from_address").val();
        neb.api.gasPrice()
            .then(function (resp) {
                $("#gas_price1").val(resp.gas_price);
                $("#gas_price2").val(resp.gas_price);
                accountState.gasPrice = resp.gas_price;
                return neb.api.getAccountState(address);
            })
            .then(function (resp) {
                hideWaiting();
                accountState.balance = resp.balance;
                accountState.nonce = resp.nonce;
                $("#nonce1").val(parseInt(resp.nonce) + 1);
                $("#nonce2").val(parseInt(resp.nonce) + 1);
                var b = NebUtils.toBigNumber(resp.balance).mul(NebUtils.toBigNumber(10).pow(-18));
                $("#balance").val(b.toString(10));
                $("#information").show();
                $("#balance_container").show();
            })
            .catch(function (e) {
                hideWaiting();
                alert(e);
            });
    } catch (e) {
        alert(e);
    }
}

function onChangeFile(e) {
    var file = e.target.files[0],
        fr = new FileReader();

    fr.onload = onload;
    fr.readAsText(file);

    function onload(e) {
        try {
            keystore = JSON.parse(e.target.result);
            fileName = file.name;
            _updateKeystoreText();
            $("#pwd_container").show();
        } catch (ex) {
            alert(ex.message);
        }
    }
}

function unlock() {
    if (!_unlockCheck()) {
        return false;
    }
    try {
        var pwd = $("#pwd").val();
        account = NebAccount.fromAddress(keystore.address);
        account.fromKey(keystore, pwd);
        _updateKeystoreText();
        return true;
    } catch (e) {
        account = null;
        alert(e);
        return false;
    }
}

function didGenerate() {
    $("#send_container").removeClass("col-12").addClass("col-6");
    $("#save_container").show();
}

function send() {
    if (!_checkSend()) {
        return;
    }
    showWaiting();
    neb.api.sendRawTransaction($("#output").val()).then(function (resp) {
        hideWaiting();
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
        hideWaiting();
        alert(o);
    });
}

function save() {
    if (!_checkSend()) {
        return;
    }
    blob = new Blob([$("#output").val()], {type: "application/text; charset=utf-8"});
    saveAs(blob, "raw_transaction.txt");
}
