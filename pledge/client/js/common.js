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

var chainId = 1001;
var explorerLink = "https://explorer.nebulas.io/#/testnet/tx/";
neb.setRequest(new nebulas.HttpRequest("https://testnet.nebulas.io"));

var pledgeContract = "n1mBSJqcvPoiMeLFN9CFxmXsjDNB9bJhm1W";

var fileName = null;
var keystore = null;
var account = null;
var accountState = {};

$(function () {
    $("#btn_get_info").on("click", getInfo);
    $("#btn_generate").on("click", generate);
    $("#btn_send").on("click", send);
    $("#file").on("change", onChangeFile);

    $("#pwd_container").hide();
    $("#information").hide();
    $("#balance_container").hide();
    $("#contract").val(pledgeContract);
});

function getInfo() {
    try {
        var address = $("#from_address").val();
        neb.api.gasPrice()
            .then(function (resp) {
                $("#gas_price1").val(resp.gas_price);
                $("#gas_price2").val(resp.gas_price);
                accountState.gasPrice = resp.gas_price;
                return neb.api.getAccountState(address);
            })
            .then(function (resp) {
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
                alert(e);
            });
    } catch (e) {
        alert(e);
    }
}

function onChangeFile(e) {
    // read address from json file content, not it's file name
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

function _unlockCheck() {
    if (!keystore) {
        alert("please select your wallet");
        return false;
    }
    var pwd = $("#pwd").val();
    if (!pwd || pwd.length === 0) {
        alert("please input password.");
        return false;
    }
    return true;
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
