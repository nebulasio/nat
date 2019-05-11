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

def deploy_all(neb, from_account):
    multisig_addr = deploy_multisig(from_account)
    print(multisig_addr)


def deploy_nat(from_account, multisig_addr):
    args = [[settings.NAT_NAME, settings.NAT_SYMBOL, settings.NAT_DECIMALS, multisig_addr]]


def deploy_multisig(from_account):
    to_addr = Address.parse_from_string(get_account_addr(from_account))
    nonce = get_nonce(from_account) + 1
    source_code = ""
    with open(settings.MUTISIG_JS, 'r') as fp:
        source_code = fp.read()
    source_type = "js"
    args = '[["%s"]]' % settings.ADMIN_ACCOUNT
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
