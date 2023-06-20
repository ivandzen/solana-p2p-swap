# Solana P2P-Swap
## Requirements
1. Install latest version of rust: [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install)
2. Install solana CLI: [https://docs.solana.com/ru/cli/install-solana-cli-tools](https://docs.solana.com/ru/cli/install-solana-cli-tools)
3. Install SPL-Token Program: [https://spl.solana.com/token](https://spl.solana.com/token)

## Compilation
1. cd to the directory of the project
### BPF program
Run
```bash
cargo build-sbf --arch bpf
```
Resulting artifacts will be placed in **solana-p2p-swap/target/deploy**

### Command-Line Interface
```bash
cargo build --release
```
Resulting artifacts will be placed in **solana-p2p-swap/target/release**

## Test tokens on devnet
**tokens** directory contains token keypairs for 2 test tokens created on solana's devnet: **token1_keypair.json**, 
**token2_keypair.json** and token mint authority keypair in file **token_mint_authority.json**
Corresponding token addresses are:
- **Token1:** 9ZKnokZY5zet7guaAv6CBtx7KDRJfYFjfxsnHeME81vM (9 decimals)
- **Token2:** C8e5NgaTygdrZcpMJGWSsw5ABsvtw4ZJBhb4YBbB5CQq (6 decimals)

**mint_tokens.sh** script will mint both tokens to your default account defined by **~/.config/solana/id.json** keypair
file. Mint amount is 1000 for each token.

## Devnet deployment
p2p-swap smart-contract is deployed onto solana devnet at address AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx. Feel 
free to use or deploy your own version for testing

## Public order example
NOTE: Supposing, you have previously built CLI unitily (see **Compilation** section)
cd to **solana-p2p-swap/target/release**
### 1. Creation
This command will create new **public order** swapping token1 <-> token2, lock 1.0 of token1 inside this swap order. Minimal amount
to buy is 0.1 token1
```bash
./p2p-swap-cli -u devnet -p AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx create-order \
9ZKnokZY5zet7guaAv6CBtx7KDRJfYFjfxsnHeME81vM 1000000000 100000000 C8e5NgaTygdrZcpMJGWSsw5ABsvtw4ZJBhb4YBbB5CQq 1000000


New order created: 6dfxGdK649xeCmtNXcvBFYbovyYsCogJLD6SGx27m6Cf
Transaction: 2k95RNwnB8VsDPQJ94iugtShHiMhZyqS4gUMRnRkZwaVcfX6DVDqf5Z5xAUBE13ARXdZLq8nxJR6XYCdtUDbLR94
```
CLI returns account address of new order and resulting transaction.

### 2. Read order information
```bash
./p2p-swap-cli -u devnet -p AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx get-order GdrUiik1NkKbJeDguvUPFVyPYeCDCfkhCEb5CSxrLmxu


Order GdrUiik1NkKbJeDguvUPFVyPYeCDCfkhCEb5CSxrLmxu
SwapSPLOrder {
    creation_slot: 224134504,
    seller: GAm8jdsCJ8mLJQz36CvbDoUb8ksscC8XDjrJnJs5V6JW,
    sell_amount: 1000000000,
    order_wallet: CameizQ3sR13Gbzz1W1CaBcjUCcgW18jWqmThEGBdizQ,
    token_mint: 9ZKnokZY5zet7guaAv6CBtx7KDRJfYFjfxsnHeME81vM,
    price_mint: C8e5NgaTygdrZcpMJGWSsw5ABsvtw4ZJBhb4YBbB5CQq,
    buy_amount: 1000000,
    min_sell_amount: 100000000,
    remains_to_fill: 1000000000,
    is_private: true,
}

```
This command returns full description of the order including:

    1. seller - address of the account created this order (owner of the order tokens)
    2. sell_amount - amount of tokens locked inside order initially (in decimals parts)
    3. order_wallet - address of wallet account where order tokens are locked
    4. token_mint - address of the token locked inside this order - token to be sold
    4. price_mint - address of token required to fill this order - price token - token2 in that case
    5. buy_amount - amount of price token required to buy all the order tokens (in decimals parts).
    6. min_sell_amount - minimum amount of order tokens to buy
    7. remains_to_fill - how much of order tokens are still remains in order_wallet
    8. is_private - is this order private?

### 3. Order Filling
This command will buy 0.2 of token1 created in previous step and swap it with corresponding amount of token2 from the
wallet of caller (~/.config/solana/id.json). You can also specify different keypair file by passing if in --keypair parameter
```bash
./p2p-swap-cli -u devnet -p AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx buy-order 6dfxGdK649xeCmtNXcvBFYbovyYsCogJLD6SGx27m6Cf 200000000

transaction: 5uSE8mjpqEy5H7CMSoN4pThYA5vvHnYKKCDpbrStwM1QRyevMaLDFcgvpCYC8yoSLefzRXM5WPSLYEtbeESfdsH5
```

## Private order example
NOTE: Supposing, you have previously built CLI unitily (see **Compilation** section)
cd to **solana-p2p-swap/target/release**
### 1. Creation
  This command will create new **private order** swapping token1 <-> token2, lock 1.0 of token1 inside this swap order. Minimal amount
  to buy is 0.1 token1
```bash
./p2p-swap-cli -u devnet -p AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx create-order \
9ZKnokZY5zet7guaAv6CBtx7KDRJfYFjfxsnHeME81vM 1000000000 100000000 C8e5NgaTygdrZcpMJGWSsw5ABsvtw4ZJBhb4YBbB5CQq 1000000 \
--is-private true


New order created: G7SrtmckBJPhpkzGuedsyJyqMRLakYCvrix4hDLM5EFC
Transaction: 3MzGEa6TepiY2QvbTkk7NBdjjByBkPYLRDsQYWEcmfAeBpYTqMLn8YSLWbsWMhYJUv8G5tZ5d1vQXyKSHRvtpE7v
Order is private. Unlock signature: "3du66wakH9CbJBusDeNNRiPJRU71SrqemzrBn2KXc1V8NcXgKSJM5m2H6XrqhjwGDeWdXehxxdRFYqGk1onao7L8"

```
Output of this command is almost the same as with public orders except that CLI prints unlock signature at the end of execution.
This unlock signature created from order account address by signing it with seller's private key. Therefore, p2p-swap contract
can check this signature later by calculating seller's address from it and comparing it with actual seller address. Also,
swap contract compares signed message (order public key) with actual order address, so it is only possible to unlock
private order with the signature provided by seller exactly to this order.

### 2. Order Filling
  This command will buy 0.2 of token1 created in previous step and swap it with corresponding amount of token2 from the
  wallet of caller (~/.config/solana/id.json). You can also specify different keypair file by passing if in --keypair parameter
```bash
./p2p-swap-cli -u devnet -p AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx \
buy-order G7SrtmckBJPhpkzGuedsyJyqMRLakYCvrix4hDLM5EFC 200000000 \
--unlock-signature 3du66wakH9CbJBusDeNNRiPJRU71SrqemzrBn2KXc1V8NcXgKSJM5m2H6XrqhjwGDeWdXehxxdRFYqGk1onao7L8

transaction: 5neAqCK8WQtNtUQ3ovvBLHPLUedAmHiRhtXL7rAMwDrpdqv3GwBnGa2HfYP43tfizf2fmhwcFFgBsPiNNZu9yVyi
```

## Order revocation example
Existing order can be revoked:
- By order owner (seller)-  in any time and in any amount. In that case, tokens locked inside order will be returned to
order owner same as lamports stored in order account.
- By any user - only if remaining amount of tokens locked inside order is lower than minimal buy amount. In that case,
tokens locked inside order will be returned to order owner (seller) and lamport stored inside order account will be
returned to caller.

Order revocation is performed using **RevokeOrder** instruction. Instruction data must  contain additional 8 
bytes treating as amount of tokens to revoke from order (u64 lower ending formatted) . This additional data completely 
ignored in case if revoke instruction is invoked by a user not owning this order. In case, if revoke instruction is 
called by order owner, revoke amount can be set to 0 - in that case order will be revoked fully.

**NOTE:** private orders can be revoked by anyone with same conditions: unlock signature is not required to revoke 
private order.

Example of revocation command:

```bash
./p2p-swap-cli -u devnet -p AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx revoke-order 41YkvBHxmnYfWAkmS8FCVq157yZzbqc3uNYd1Xkawife

Revoke finished. Txn: 22cLx3kWdBUzFnqg4NKi2NWHTCPK2nsbYHm2pXsTEi7RqieoTcnJTPtvPkUkppDzjLKS4a7pPpc6LphsigH6XvUo
```