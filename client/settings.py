## Account
### Admin
ADMIN_ACCOUNT = n1a1D6x3k14YZ5PdCKjPfak2PiMFzXErFkN

### emergency accounts
EMERGENCY_ACCOUNT_A = 'n1Lcnr1qP5AnW1XH7prswLS91Ks1cTe6fr9'
EMERGENCY_ACCOUNT_B = 'n1awBN6NJR9zkNL1c63BAEMVBarnu2PCt4f'

## Smart contract file path
MUTISIG_JS = "../contracts/multisig.js"
DISTRIBUTE_JS = "../contracts/distribute.js"
PLEDGE_PROXY_JS = "../contracts/pledge_proxy.js"
PLEDGE_JS = "../contracts/pledge.js"
NR_DATA_JS = "../constracts/nr_data.js"
NAT_NRC20_JS = "../contracts/nat.js"

## Smart Deploy args 
### multisig.js
MUTISIG_DEPLOY_ARGS = [[ADMIN_ACCOUNT]]
### nat.js
name = "NAT"
symbol = "NAT"
decimals = ""
multisig_addr = ""
NAT_NRC20_DEPLOY_ARGS = [[name, symbol, decimals, multisig_addr]]
DISTRIBUTE_DEPLOY_ARGS = [[]]
PLEDGE_PROXY_DEPLOY_ARGS = []
PLEDGE_DEPLOY_ARGS = []
NR_DATA_DEPLOY_ARGS = []
