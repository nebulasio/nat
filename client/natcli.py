# system
import json
import time

# 3rd party
from nebpysdk.src.account.Account import Account
from nebpysdk.src.core.Address import Address
from nebpysdk.src.core.Transaction import Transaction
from nebpysdk.src.core.TransactionBinaryPayload import TransactionBinaryPayload
from nebpysdk.src.core.TransactionCallPayload import TransactionCallPayload
from nebpysdk.src.core.TransactionDeployPayload import TransactionDeployPayload 
from nebpysdk.src.client.Neb import Neb 

neb = Neb("https://testnet.nebulas.io")
keyJson = '{"version":4,"id":"814745d0-9200-42bd-a4df-557b2d7e1d8b","address":"n1H2Yb5Q6ZfKvs61htVSV4b1U2gr2GA9vo6","crypto":{"ciphertext":"fb831107ce71ed9064fca0de8d514d7b2ba0aa03aa4fa6302d09fdfdfad23a18","cipherparams":{"iv":"fb65caf32f4dbb2593e36b02c07b8484"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"dddc4f9b3e2079b5cc65d82d4f9ecf27da6ec86770cb627a19bc76d094bf9472","n":4096,"r":8,"p":1},"mac":"1a66d8e18d10404440d2762c0d59d0ce9e12a4bbdfc03323736a435a0761ee23","machash":"sha3256"}}';
password = 'passphrase'
account_addr = "n1H2Yb5Q6ZfKvs61htVSV4b1U2gr2GA9vo6"
to_addr = "n1QWYSv5MJfvEBA4A8PGVrGdstdXzEkQ8Ju"

# Chain settings
chain_id = 1001
gas_price = 20000000000
gas_limit = 200000


def get_account():
    '''
        {'result': {'balance': '100997303344999906', 'nonce': '88', 'type': 87, 'height': '1757816', 'pending': '7'}}
    '''

    from_account = Account.from_key(keyJson, bytes(password.encode()))
    return from_account


def get_nonce(from_account): 
    from_addr = from_account.get_address_obj()
    resp = neb.api.getAccountState(from_addr.string()).text
    resp_json = json.loads(resp)
    nonce = int(resp_json["result"]["nonce"]) 
    return nonce


def send_transaction(from_account, to_addr, value):
    # PayloadType
    payload_type = Transaction.PayloadType("binary")
    # payload
    payload = TransactionBinaryPayload("").to_bytes()
    nonce = get_nonce(from_account) + 1

    # binary transaction example
    tx = Transaction(chain_id, from_account, to_addr, 0, nonce + 1, payload_type, payload, gas_price, gas_limit)
    tx.calculate_hash()
    tx.sign_hash()
    print(neb.api.sendRawTransaction(tx.to_proto()).text)


def call_contract(from_account, contract_addr):
    nonce = get_nonce(from_account) + 1
    contract = {"function":"getCosigners","args":"[]"}
    estimate_gas = neb.api.estimateGas(account_addr, contract_addr, "0", nonce, str(gas_limit), str(gas_price), contract).text
    print("estimate gas:", estimate_gas)
    ret = neb.api.call(account_addr, contract_addr, "0", nonce, str(gas_limit), str(gas_price), contract).text
    print(json.loads(ret))
 

def make_contract_trx(from_account, contract_addr):
    to_addr = Address.parse_from_string(contract_addr)
    nonce = get_nonce(from_account)
    func = "getCosigners"
    arg = ''
    payload = TransactionCallPayload(func, arg).to_bytes()
    payload_type = Transaction.PayloadType("call")
    tx = Transaction(chain_id, from_account, to_addr, 0, nonce + 1, payload_type, payload, gas_price, gas_limit)
    tx.calculate_hash()
    tx.sign_hash()
    result = neb.api.sendRawTransaction(tx.to_proto()).text
    print(result)

def deploy_contract(from_account, contract_filepath):
    nonce = get_nonce(from_account)
    source_code = ""
    with open(contract_filepath, 'r') as fp:
        source_code = fp.read()
    source_type = "js" # "ts"
    args = '[["n1H2Yb5Q6ZfKvs61htVSV4b1U2gr2GA9vo6", "n1QWYSv5MJfvEBA4A8PGVrGdstdXzEkQ8Ju"]]'
    contract = {
        "source": source_code,
        "sourceType": source_type, # "ts"
        "args": args,
    }
    
    '''
    # Send test
    estimate_gas = neb.api.estimateGas(account_addr, account_addr, "0", nonce, str(gas_limit), str(gas_price), contract).text
    ret = neb.api.call(account_addr, account_addr, "0", nonce, str(gas_limit), str(gas_price), contract).text
    print(json.loads(ret))
    '''

    payload_type = Transaction.PayloadType("deploy")
    payload = TransactionDeployPayload(source_type, source_code, args).to_bytes()
    nonce = get_nonce(from_account) + 1
    to_addr = Address.parse_from_string(account_addr)

    # Deploy Contract
    tx = Transaction(chain_id, from_account, to_addr, 0, nonce, payload_type, payload, gas_price, gas_limit)
    tx.calculate_hash()
    tx.sign_hash()
    print(neb.api.sendRawTransaction(tx.to_proto()).text)


if __name__ == "__main__":
    # Get account status 
    from_account = get_account()

    '''
    # Send a normal transaction
    amount = 0
    to_addr = Address.parse_from_string("n1QWYSv5MJfvEBA4A8PGVrGdstdXzEkQ8Ju")
    send_transaction(from_account, to_addr, amount)

    # Call smart contract 
    contract_addr = "n1zBkFAYg1bfSYcH67tEWjQBskphMUqBX6H"
    make_contract_trx(from_account, contract_addr)
    '''

    contract_addr = "n1zBkFAYg1bfSYcH67tEWjQBskphMUqBX6H" 
    contract_addr = "n1prgFsbucU74KXdV6LdFLo1XM9co5ozadx"
    call_contract(from_account, contract_addr)

    '''
    # Deploy smart contract
    contract_filepath = "../contracts/multisig.js" 
    deploy_contract(from_account, contract_filepath)
    '''
