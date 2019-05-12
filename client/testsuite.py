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

chain_id = 1111 # Marina
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

def check_balance(neb, target_addr):
    resp = neb.api.getAccountState(target_addr).text
    print (resp)

def get_account_from_privatekey(neb, privatekey):
    account = Account(privatekey)
    account_addr = account.get_address_str()
    resp = neb.api.getAccountState(account_addr).text
    print(account_addr, resp)
    return account, account_addr

def create_new_account_privatekey():
    account = Account.new_account()
    account_addr = account.get_address_str()
    private_key = hex(account.get_private_key_obj().get_key())[2:]
    return private_key, account_addr

def create_new_account_keystore(password):
    account = Account()
    account_addr = account.get_address_str()
    #account.get_public_key()
    keystore = account.to_key(password)
    return keystore, account_addr

def create_n_account(num):
    fp = open("pledge_list.txt", "w")
    account_list = {}
    for i in range(num):
        priv, addr = create_new_account_privatekey()
        fp.write("%s:%s\n" % (addr, priv))
    fp.close()

def send_token(neb, bank_account, account_file):
    fp = open(account_file, "r")
    nonce = get_nonce(neb, bank_account)
    count = 0
    for line in fp.readlines():
        nonce += 1
        count += 1
        to_addr = line.strip().split(":")[0]
        print(count, to_addr, nonce)
        make_transaction(neb, bank_account, to_addr, nonce)
        if count % 100 == 0 :
            time.sleep(60)

def send_nas(neb, bank_account, target_addr):
    nonce = get_nonce(neb, bank_account) + 1
    make_transaction(neb, bank_account, target_addr, nonce)
        
def make_transaction(neb, from_account, to_addr, nonce):
    to_address = to_addr = Address.parse_from_string(to_addr)
    payload_type = Transaction.PayloadType("binary")
    payload = TransactionBinaryPayload("").to_bytes()

    # binary transaction example
    tx = Transaction(chain_id, from_account, to_address, 10000000000000000000, nonce, payload_type, payload, gas_price, gas_limit)
    tx.calculate_hash()
    tx.sign_hash()
    print(neb.api.sendRawTransaction(tx.to_proto()).text)

def make_contract_trx(neb, from_account, contract_addr, amount, func, arg):
    to_addr = Address.parse_from_string(contract_addr)
    nonce = get_nonce(neb, from_account)
    payload = TransactionCallPayload(func, arg).to_bytes()
    payload_type = Transaction.PayloadType("call")
    tx = Transaction(chain_id, from_account, to_addr, amount, nonce + 1, payload_type, payload, gas_price, gas_limit)
    tx.calculate_hash()
    tx.sign_hash()
    result = neb.api.sendRawTransaction(tx.to_proto()).text
    print(result)

def get_accounts(filepath):
    accounts = []
    fp = open(filepath, "r")
    for line in fp.readlines():
        addr, priv = tuple(line.strip().split(":"))
        if len(priv) != 64:
            continue
        print(addr, priv)
        account = Account(priv)
        accounts.append(account)
    fp.close()
    return accounts

def old_pledge(neb, old_pledge_addr):
    accounts = get_accounts("old_pledge.txt") 
    func = "pledge"
    arg = "[]"
    amount = 1000000000000000000 # 1 NAS
    for from_account in accounts:
        make_contract_trx(neb, from_account, old_pledge_addr, amount, func, arg) 

def pledge(neb, pledge_proxy_addr):
    accounts = get_accounts("pledge_list.txt") 
    func = "pledge"
    arg = "[]"
    amount = 6000000000000000000 # 6 NAS
    for from_account in accounts:
        make_contract_trx(neb, from_account, pledge_proxy_addr, amount, func, arg) 


def vote(neb, vote_addr):
    accounts = get_accounts("pledge_list.txt") 
    func = "vote"
    dataSource = "n1i9SMezxDPe5ocBQU73tE61uDySMMRFp4N"
    arg = json.dumps([dataSource, "test_hash", "yes", 1000000000000])
    amount = 0
    for from_account in accounts:
        make_contract_trx(neb, from_account, vote_addr, amount, func, arg) 

'''
    python testsuite.py createaccount 1200 
    python testsuite.py sendtoken
'''
if __name__ == "__main__":
    neb = Neb("http://47.92.203.173:9685")
    # Bank Account
    private_key = "830ccbac2029b880eb07aa9a19c65ce6dad41702d409771eada791d6a6a83a1e"
    bank_account, bank_addr = get_account_from_privatekey(neb, private_key)

    if len(sys.argv) > 1:
        if sys.argv[1] == "createaccount":
            num = int(sys.argv[2])
            create_n_account(num)

        if sys.argv[1] == "sendtoken":
            filepath = sys.argv[2]
            send_token(neb, bank_account, filepath)

        if sys.argv[1] == "sendnas":
            target_addr = "n1H2Yb5Q6ZfKvs61htVSV4b1U2gr2GA9vo6"
            target_addr = sys.argv[2]
            send_nas(neb, bank_account, target_addr)

        if sys.argv[1] == "checkbalance":
            target_addr = sys.argv[2]
            check_balance(neb, target_addr)

        if sys.argv[1] == "oldpledge":
            old_pledge_addr = "n1h6LuEhL6PJGnM2N8UAhkT3TGHfDmmxvsJ"
            old_pledge(neb, old_pledge_addr)

        if sys.argv[1] == "pledge":
            pledge_proxy_addr = "n1sc3u12EVjtJxJNHvtYVtAQiJJwd5URrVm"
            pledge(neb, pledge_proxy_addr)

        if sys.argv[1] == "vote":
            vote_addr = "n1uP9W17d4aAH3YB7obuvSKGPryAhLvAnhh"
            vote(neb, vote_addr)
