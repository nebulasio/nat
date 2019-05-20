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

chain_id = 1
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


def vote(neb, from_account, category, option, amount, nonce):
    blacklist = settings.blacklist
    wp = open("vote_sign.txt", "w")
    vote_addr = settings.vote_js
    vote_data_source_addr = settings.test_vote_source_addr
    to_addr = Address.parse_from_string(vote_addr)

    func = "vote"
    arg = json.dumps([vote_data_source_addr, category, option, amount])

    payload = TransactionCallPayload(func, arg).to_bytes()
    payload_type = Transaction.PayloadType("call")
    tx = Transaction(chain_id, from_account, to_addr, 0, nonce + 1, payload_type, payload, gas_price, gas_limit * 10)
    tx.calculate_hash()
    tx.sign_hash()
    rawTrx = tx.to_proto()
    print("===================")
    print(rawTrx)
    print("===================")
    wp.write(rawTrx)
    wp.close()


if __name__ == "__main__":
    helper = "python natcli.py mainnet ks.json deploymultisig current_nonce \n\
python natcli.py mainnet ks.json vote category option amount current_nonce \n\
    "

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

    if len(sys.argv) > 4:
        if sys.argv[3] == "vote":
            category = sys.argv[4]
            option = sys.argv[5] 
            amount = int(sys.argv[6])
            nonce = int(sys.argv[7])
            vote(neb, from_account, category, option, amount, nonce)
