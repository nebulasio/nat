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

chain_id = 1001
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


def get_nonce(from_account): 
    from_addr = from_account.get_address_obj()
    resp = neb.api.getAccountState(from_addr.string()).text
    resp_json = json.loads(resp)
    nonce = int(resp_json["result"]["nonce"]) 
    return nonce

def wait_new_nonce(nonce):
    print("Waiting onchain...")
    time.sleep(15)
    current_nonce = nonce
    while current_nonce == nonce:
        time.sleep(3)
        nonce = get_nonce(from_account)
    current_nonce = nonce
    return current_nonce

def deploy_all(neb, from_account):
    # multisig
    args = json.dumps([settings.ADMIN_ACCOUNT])
    nonce = get_nonce(from_account)
    current_nonce = nonce
    multisig_addr = deploy_smartcontract(from_account, settings.MUTISIG_JS, args, nonce + 1)
    print("multisig:", multisig_addr)

    nonce = wait_new_nonce(current_nonce)
    current_nonce = nonce
    # NAT
    args = json.dumps([settings.NAT_NAME, settings.NAT_SYMBOL, settings.NAT_DECIMALS, multisig_addr])
    nat_addr = deploy_smartcontract(from_account, settings.NAT_NRC20_JS, args, nonce + 1, multisig_addr)
    print("natjs:", nat_addr)

    nonce = wait_new_nonce(current_nonce)
    current_nonce = nonce

    # distribute
    args = json.dumps([settings.PLEDGE_START_HEIGHT, settings.NR_START_HEIGHT, multisig_addr])
    distribute_addr = deploy_smartcontract(from_account, settings.DISTRIBUTE_JS, args, nonce + 1, multisig_addr)
    print("distribute.js:", distribute_addr)

    nonce = wait_new_nonce(current_nonce)
    current_nonce = nonce

    # pledge proxy
    args = json.dumps([multisig_addr])
    pledge_proxy_addr = deploy_smartcontract(from_account, settings.PLEDGE_PROXY_JS, args, nonce + 1, multisig_addr)
    print("pledge_proxy.js:", pledge_proxy_addr)

    nonce = wait_new_nonce(current_nonce)
    current_nonce = nonce

    # pledge
    args = json.dumps([multisig_addr])
    pledge_addr = deploy_smartcontract(from_account, settings.PLEDGE_JS, args, nonce + 1, multisig_addr)
    print("pledge.js:", pledge_addr)

    nonce = wait_new_nonce(current_nonce)
    current_nonce = nonce

    # Vote
    args = json.dumps([multisig_addr, settings.VOTE_MANAGERS])
    vote_addr = deploy_smartcontract(from_account, settings.VOTE_JS, args, nonce + 1, multisig_addr)
    print("vote.js:", vote_addr)

def deploy_smartcontract(from_account, contract_path, args, nonce, multisig=None):
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
    resp = json.loads(neb.api.sendRawTransaction(tx.to_proto()).text)
    return resp['result']['contract_address']



'''
    natcli mainnet ks.json deployall
'''
if __name__ == "__main__":
    # Confirm chain id
    if len(sys.argv) > 1:
        if sys.argv[1] == "mainnet":
            chain_id = 1        
        if ssy.argv[1] == "mariana":
            chain_id = 1111

    if chain_id == 1:
        neb = Neb("https://mainnet.nebulas.io")
    else:
        neb = Neb("https://testnet.nebulas.io")

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

    deploy_all(neb, from_account)
