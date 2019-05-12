# system
import sys
import json
import time
import getpass

# 3rd party
from nebpysdk.src.account.Account import Account
from nebpysdk.src.core.Address import Address
from nebpysdk.src.core.Transaction import Transaction
from nebpysdk.src.core.TransactionBinaryPayload import TransactionBinaryPayload
from nebpysdk.src.core.TransactionCallPayload import TransactionCallPayload
from nebpysdk.src.core.TransactionDeployPayload import TransactionDeployPayload 
from nebpysdk.src.client.Neb import Neb 

import settings

chain_id = 1111
gas_price = 20000000000
gas_limit = 200000


def get_account(keystore_filepath):
    '''
    {'result': {'balance': '100997303344999906', 'nonce': '88', 'type': 87, 'height': '1757816', 'pending': '7'}}
    '''
    try:
        keystore = None 
        with open(keystore_filepath, 'r') as fp:
            keystore = fp.read()

        if keystore is None:
            print ("Invalid keystore file") 

        password = getpass.getpass('Password(passphrase):')
        from_account = Account.from_key(keystore, bytes(password.encode()))
    except:
        print("Invalid keystore or password, please retry!")
        return None
    return from_account


def get_account_addr(from_account):
    from_addr = from_account.get_address_obj()
    return from_addr.string()


def get_nonce(neb, from_account): 
    from_addr = from_account.get_address_obj()
    resp = neb.api.getAccountState(from_addr.string()).text
    resp_json = json.loads(resp)
    nonce = int(resp_json["result"]["nonce"]) 
    return nonce

def wait_new_nonce(neb, from_account, nonce):
    time.sleep(15)
    current_nonce = nonce
    while current_nonce == nonce:
        time.sleep(3)
        nonce = get_nonce(neb, from_account)
    current_nonce = nonce
    return current_nonce

def deploy_multisig(neb, from_account, nonce):
    fp = open("contract_list.txt", "w")
    wp = open("0.raw_multisig.txt", "w")
    args = json.dumps([[settings.ADMIN_ACCOUNT]])
    multisig_addr = deploy_smartcontract(wp, from_account, settings.MUTISIG_JS, args, nonce + 1)
    fp.write("multiSig=%s\n" % multisig_addr)
    fp.close()
    wp.close()
    print("multisig:", multisig_addr)
    return multisig_addr


def deploy_allothers(neb, from_account, multisig_addr, nonce):
    fp = open("contract_list.txt", "a")

    # NAT
    wp = open("1.raw_nat.txt", "w")
    args = json.dumps([settings.NAT_NAME, settings.NAT_SYMBOL, settings.NAT_DECIMALS, multisig_addr])
    nat_addr = deploy_smartcontract(wp, from_account, settings.NAT_NRC20_JS, args, nonce + 1, multisig_addr)
    print("natjs:", nat_addr)
    fp.write("natNRC20=%s\n" % nat_addr)
    wp.close()

    # distribute
    wp = open("2.raw_distribute.txt", "w")
    args = json.dumps([settings.PLEDGE_START_HEIGHT, settings.NR_START_HEIGHT, multisig_addr])
    distribute_addr = deploy_smartcontract(wp, from_account, settings.DISTRIBUTE_JS, args, nonce + 2, multisig_addr)
    print("distribute.js:", distribute_addr)
    fp.write("distribute=%s\n" % distribute_addr)
    wp.close()

    # pledge proxy
    wp = open("3.raw_pledge_proxy.txt", "w")
    args = json.dumps([multisig_addr])
    pledge_proxy_addr = deploy_smartcontract(wp, from_account, settings.PLEDGE_PROXY_JS, args, nonce + 3, multisig_addr)
    print("pledge_proxy.js:", pledge_proxy_addr)
    fp.write("pledgeProxy=%s\n" % pledge_proxy_addr)
    wp.close()

    # pledge
    wp = open("4.raw_pledge.txt", "w")
    args = json.dumps([multisig_addr])
    pledge_addr = deploy_smartcontract(wp, from_account, settings.PLEDGE_JS, args, nonce + 4, multisig_addr)
    print("pledge.js:", pledge_addr)
    fp.write("pledge=%s\n" % pledge_addr)
    wp.close()

    # Vote
    wp = open("5.raw_vote.txt", "w")
    args = json.dumps([multisig_addr, settings.VOTE_MANAGERS])
    vote_addr = deploy_smartcontract(wp, from_account, settings.VOTE_JS, args, nonce + 5, multisig_addr)
    print("vote.js:", vote_addr)
    fp.write("vote=%s\n" % vote_addr)
    wp.close()

    # NR data
    wp = open("6.raw_nrdata.txt", "w")
    args = json.dumps([multisig_addr])
    vote_addr = deploy_smartcontract(wp, from_account, settings.NR_DATA_JS, args, nonce + 6, multisig_addr)
    print("nr_data.js:", vote_addr)
    fp.write("nrData=%s\n" % vote_addr)
    wp.close()
    fp.close()

def deploy_smartcontract(wp, from_account, contract_path, args, nonce, multisig=None):
    to_addr = Address.parse_from_string(get_account_addr(from_account))
    source_code = ""
    with open(contract_path, 'r') as fp:
        source_code = fp.read()
    source_type = "js"
    payload_type = Transaction.PayloadType("deploy")
    payload = TransactionDeployPayload(source_type, source_code, args).to_bytes()
    tx = Transaction(chain_id, from_account, to_addr, 0, nonce, payload_type, payload, gas_price, gas_limit)
    tx.calculate_hash()
    tx.sign_hash()
    rawTrx = tx.to_proto()
    print("==============")
    print(rawTrx)
    print("==============")
    wp.write(rawTrx)
    # resp = json.loads(neb.api.sendRawTransaction(tx.to_proto()).text)
    # print(resp) 
    # return resp['result']['contract_address']

def get_config(list_file):
    fp = open(list_file, "r")
    config = {}
    for line in fp.readlines():
        k, v = tuple(line.strip().split("=")) 
        config[k] = v
    fp.close()
    return config

def setconfig(neb, from_account, multisig_addr, nonce):
    config = get_config("contract_list.txt")
    contract_config = {
        "natConfig":{
            "multiSig": config["multiSig"],
            "distribute": config["distribute"],
            "distributeVoteTaxAddr": settings.distributeVoteTaxAddr,
            "distributeManager": settings.distributeManager,
            "pledgeProxy": config["pledgeProxy"],
            "pledgeProxyManager": settings.pledgeProxyManager,
            "pledge": config["pledge"],
            "nrData": config["nrData"],
            "nrDataManager": settings.nrDataManager,
            "natNRC20": config["natNRC20"],
            "vote": [config["vote"]],
        },  
        "contractList": {
            "distribute": config["distribute"],
            "pledge_proxy": config["pledgeProxy"],
            "pledge": config["pledge"],
            "nr_data": config["nrData"],
            "nat_nrc20": config["natNRC20"],
            "vote": [config["vote"]],
        }
    }

    fp = open("config.txt", "w")
    wp = open("7.raw_setconfig.txt", "w")
    fp.write(json.dumps(contract_config, indent=2))
    fp.close()

    to_addr = Address.parse_from_string(multisig_addr)
    func = "setConfig"
    arg = json.dumps([contract_config])
    payload = TransactionCallPayload(func, arg).to_bytes()
    payload_type = Transaction.PayloadType("call")
    tx = Transaction(chain_id, from_account, to_addr, 0, nonce + 1, payload_type, payload, gas_price, gas_limit * 100)
    tx.calculate_hash()
    tx.sign_hash()
    rawTrx = tx.to_proto()
    print("===================")
    print(rawTrx)
    print("===================")
    wp.write(rawTrx)
    wp.close()
    #result = neb.api.sendRawTransaction(tx.to_proto()).text
    #print(result)


def transfer_fund(neb, from_account, new_pledge_proxy_addr, amount, nonce):
    amount = amount * 1000000000000000000
    to_addr = Address.parse_from_string(new_pledge_proxy_addr)
    func = "acceptFund"
    arg = "[]"
    payload = TransactionCallPayload(func, arg).to_bytes()
    payload_type = Transaction.PayloadType("call")
    tx = Transaction(chain_id, from_account, to_addr, amount, nonce + 1, payload_type, payload, gas_price, gas_limit * 10)
    tx.calculate_hash()
    tx.sign_hash()
    rawTrx = tx.to_proto()
    print("===================")
    print(rawTrx)
    print("===================")
    wp = open("8.transfer_fund.txt", "w")
    wp.write(rawTrx)
    wp.close()


def getconfig(neb, from_account, proxy_addr):
    from_addr = from_account.get_address_obj()
    account_addr = from_addr.string()
    nonce = get_nonce(neb, from_account)
    contract = {"function":"getConfig","args":"[]"}
    ret = neb.api.call(account_addr, proxy_addr, "0", nonce + 1, str(gas_limit), str(gas_price), contract).text
    print(json.loads(ret))


if __name__ == "__main__":
    helper = "python natcli.py mainnet ks.json deploymultisig current_nonce \n\
python natcli.py mainnet ks.json deployallothers multisig_addr current_nonce\n\
python natcli.py testnet screte.json setconfig multisig_addr current_nonce \n\
python natcli.py mariana ks/n1xxxx.json transferfund new_pledge_proxy_addr amount current_nonce \n\
python natcli.py testnet screte.json getconfig proxy_addr"

    if len(sys.argv) <= 1:
        print(helper)

    # Confirm chain id
    if len(sys.argv) > 1:
        if sys.argv[1] == "mainnet":
            chain_id = 1        
        if sys.argv[1] == "mariana":
            chain_id = 1111

    if chain_id == 1:
        neb = Neb("https://mainnet.nebulas.io")

    if chain_id == 1001: 
        neb = Neb("https://testnet.nebulas.io")

    if chain_id == 1111:
        neb = Neb("http://47.92.203.173:9685")
    print(chain_id)

    # load keystore
    keystore_filepath = None
    if len(sys.argv) > 2:
        keystore_filepath = sys.argv[2]
    else:
        print ("[ERROR] No keystore file found!")
        sys.exit()

    from_account = None
    if keystore_filepath:
        from_account = get_account(keystore_filepath)

    if from_account is None:
        print("[ERROR] Account is not loaded")
        sys.exit()

    if len(sys.argv) > 3:
        if sys.argv[3] == "deploymultisig":
            nonce = int(sys.argv[4])
            multisig_addr = deploy_multisig(neb, from_account, nonce)

        if sys.argv[3] == "deployallothers":
            multisig_addr = sys.argv[4]
            nonce = int(sys.argv[5])
            deploy_allothers(neb, from_account, multisig_addr, nonce)

    if len(sys.argv) > 4:
        if sys.argv[3] == "setconfig":
            multisig_addr = sys.argv[4]
            nonce = int(sys.argv[5])
            setconfig(neb, from_account, multisig_addr, nonce)
        if sys.argv[3] == "getconfig":
            proxy_addr = sys.argv[4]
            getconfig(neb, from_account, proxy_addr)

        if sys.argv[3] == "transferfund":
            new_pledge_proxy_addr = sys.argv[4]
            amount = int(sys.argv[5])
            nonce = int(sys.argv[6])
            transfer_fund(neb, from_account, new_pledge_proxy_addr, amount, nonce)
