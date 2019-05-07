### NAT.js
- Milestone:
   * distribute.js -- qiyuan with help of others
   * new pledge.js and pledge'.js -- zhuoer & ping
   * multisig.js -- zhuoer & ping

please see the overall structure here:
![Drag Racing](NAT.js.png)

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
