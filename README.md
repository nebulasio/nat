### NAT.js
- Milestone:
  * simple contract debug tool -- by April 25th -- ping
  * temporary pledge contract -- by April 26th -- ping
  * client tool design ready   -- by April 26th, Meng 
  * contract migrate test      -- by April 26th - Zhuoer 
  * pledge contract test start  -- April 26th - Liang
  * code review                   -- April 27th -- Qiyuan
  * NR data import contract(import, get NR list from contract) -- by April 27th 
    - research team give us the address list file
  * multisig update the config -- by April 27th
  * vote (gonetbulas, campaign) data contract -- by April 29th 
  * vote logic feature -- by April 30th
  * airdrop logic feature -- by April 30th
  * migrate pledge contract to main nat.js -- by Arpil 30th 
  * code review to qiyuan -- by May 4th
  * contract migration  -- by May 10th
  * tempoarary pledge contract deployment -- May 4th
  * full nat.js testing -- May 5 - 12th
  * migrate tempoarary pledge into new nat.j.s -- May 13th

### Temporary NAS/NAT Pledge Contract
- Smart contract deployment
   * define a cold wallet address (account) as the entity allow to migrate the data and NAS from temporary pledge contract
   * use normal account to deploy the smart conract 

- Migrate the data to new NAT.js (cold env) -- **Need UI design**
  * Only the pre-defined specific addresses(accounts) allow to do the migration
  * New pledge will be closed after migration
  * Migration all the data and the NAS into new NAT.js
  * Input
    - Old NAT.js address
    - New NAT.js address
  * Generate RawTranscation file

- Broadcast contract migration
  * Copy the RawTransaction file into a computer which connect to Internet
  * Use official web wallet to broadcast the RawTranscation file


-  Pledge NAS get NAT (Cold Envrionment) -- **Need UI design**
   * Load keystore & passcode
   * Two input
     - Amount of NAS
     - Pledge period (7 days * n)
   * Save the blockchain height when depsoit
   * Generate RawTransaction and save it into a file

-  Broadcast pledge transaction file
   * Copy the RawTransaction file into a computer connect to Internet
   * Use official web wallet to broadcast the RawTransaction file
