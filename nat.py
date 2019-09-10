# -*- coding:utf-8 -*-
# neb, account, contract 所有信息在__init__中修改，
import sys
from nebpysdk.src.account.Account import Account
from nebpysdk.src.core.Address import Address
from nebpysdk.src.core.Transaction import Transaction
from nebpysdk.src.core.TransactionCallPayload import TransactionCallPayload
from nebpysdk.src.client.Neb import Neb
import json
import threading
import time
import random


class CallTrigger:

    def __init__(self, account_key):
        self.neb = Neb("https://mainnet.nebulas.io")
        self.chain_id = 1
        # account & address
        self.from_account = Account(account_key)
        self.from_addr = self.from_account.get_address_obj()

        # period height
        self.period_height = 40320 

        # block height
        self.height_begin = 3034811 
        self.height_next = self.height_begin + self.period_height

        # time_skip, 300seconds
        self.time_skip = 30

        # times checking the balance，3 times one day
        self.check_times = 3
        # nonce
        self.nonce_last = 0

        # contract address
        self.distribute = "n22HSbECCKosjJrwvxkRmcLCWaDYxm9hQV6"

    def get_nonce(self):

        # get nonce
        # prepare transaction, get nonce first
        while True:
            try:
                resp = self.neb.api.getAccountState(self.from_addr.string()).text
                break
            except:
                continue
        print(resp)
        resp_json = json.loads(resp)
        print(resp_json)
        nonce = int(resp_json['result']['nonce'])
        return nonce

    def get_receipt(self, tx_hash):

        while True:
            try:
                res = self.neb.api.getTransactionReceipt(tx_hash).text
                obj = json.loads(res)
                status = obj["result"]["status"]
            except:
                continue

            if status != 2:
                return res
            else:
                time.sleep(5)
                print("Waiting the transaction to be confirmed.")

    def call_contract(self, func, args, contract_addr, nonce):

        # payload
        payload = TransactionCallPayload(func, args).to_bytes()

        # PayloadType
        payload_type = Transaction.PayloadType("call")

        # gasPrice
        gas_price = 20000000000

        # gasLimit
        gas_limit = 9000000

        # prepare to addr
        to_addr = Address.parse_from_string(contract_addr)
        print("from_addr", self.from_addr.string())
        print("to_addr", contract_addr)

        # nonce
        if nonce < self.nonce_last:
            nonce = self.nonce_last

        self.nonce_last = nonce + 1
        print("nonce", nonce)

        # calls
        tx = Transaction(self.chain_id, self.from_account, to_addr, 0, nonce + 1, payload_type, payload, gas_price,
                        gas_limit)
        tx.calculate_hash()
        tx.sign_hash()

        while True:
           try:
               res = self.neb.api.sendRawTransaction(tx.to_proto()).text
               break
           except:
               continue

        obj = json.loads(res)
        print(res)
        txhash = obj["result"]["txhash"]
        result = self.get_receipt(txhash)
        print(result)
        return result

    def distribute_trigger(self):

        # nonce
        nonce = self.get_nonce()

        # call the trigger
        res = self.call_contract("triggerPledge", "[]", self.distribute, nonce)
        obj = json.loads(res)
        status = obj["result"]["status"]
        execute_result = obj["result"]["execute_result"]

        if status == 1:
            result_json = json.loads(execute_result)
            hasNext = result_json['needTrigger']
            print('hasNext: %s' % hasNext)

            if hasNext:
                self.distribute_trigger()

    def daily_timer(self):
        # time_skip, 300seconds, 288 times a day
        seconds_one_day = 24 * 60 * 60
        times_one_day = int(seconds_one_day / self.time_skip)

        # check the balance
        possibility = self.check_times / times_one_day
        rand = random.random()

        # if rand < possibility:
        #   self.check_balance()

        # block height now
        while True:
            try:
                results = self.neb.api.getNebState().text
                break
            except:
                continue

        obj = json.loads(results)
        height_now = int(obj["result"]["height"])
        print("height now: %d, height next: %d" % (height_now, self.height_next))

        # # Run the trigger
        if height_now > self.height_next:

            self.distribute_trigger()

            # Change the height_next
            self.height_next += self.period_height

        # call next Timer
        print('current threading:{}'.format(threading.activeCount()))
        print('current threading:{}'.format(threading.enumerate()))
        print('current threading:{}'.format(threading.currentThread()))
        sys.stdout.flush()
        timer = threading.Timer(self.time_skip, self.daily_timer)
        timer.start()
        return

    def core(self):
        self.nonce_last = self.get_nonce()

        threading.Timer(1, self.daily_timer).start()


if __name__ == "__main__":
    print("input the account private key:")
    account_key = input()
    caller = CallTrigger(account_key)
    caller.core()
