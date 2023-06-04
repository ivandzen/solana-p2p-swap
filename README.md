# Solana P2P-Swap
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

## Example of usage
### Public order
- **Creation**
This command will create new order swapping token1 <-> token2, lock 1.0 of token1 inside this swap order. Minimal amount
to buy is 0.1 token1
```bash
./p2p-swap-cli -u devnet -p AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx create-order \
9ZKnokZY5zet7guaAv6CBtx7KDRJfYFjfxsnHeME81vM 1000000000 100000000 C8e5NgaTygdrZcpMJGWSsw5ABsvtw4ZJBhb4YBbB5CQq 1000000


New order created: 6dfxGdK649xeCmtNXcvBFYbovyYsCogJLD6SGx27m6Cf
Transaction: 2k95RNwnB8VsDPQJ94iugtShHiMhZyqS4gUMRnRkZwaVcfX6DVDqf5Z5xAUBE13ARXdZLq8nxJR6XYCdtUDbLR94
```
CLI returns account address of new order and resulting transaction.

- **Read order information**
```bash
./p2p-swap-cli -u devnet -p AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx get-order 6dfxGdK649xeCmtNXcvBFYbovyYsCogJLD6SGx27m6Cf

Order 6dfxGdK649xeCmtNXcvBFYbovyYsCogJLD6SGx27m6Cf
Data:
SwapSPLOrder { 
  seller: GAm8jdsCJ8mLJQz36CvbDoUb8ksscC8XDjrJnJs5V6JW, 
  sell_amount: 1000000000, 
  order_wallet: CameizQ3sR13Gbzz1W1CaBcjUCcgW18jWqmThEGBdizQ, 
  price_mint: C8e5NgaTygdrZcpMJGWSsw5ABsvtw4ZJBhb4YBbB5CQq, 
  buy_amount: 1000000, 
  min_sell_amount: 100000000, 
  remains_to_fill: 600000000, 
  is_private: false 
}
```
This command returns full description of the order including:

    1. seller - address of the account created this order (owner of the order tokens)
    2. sell_amount - amount of tokens locked inside order initially (in decimals parts)
    3. order_wallet - address of wallet account where order tokens are locked
    4. price_mint - address of token required to fill this order - price token - token2 in that case
    5. buy_amount - amount of price token required to buy all the order tokens (in decimals parts).
    6. min_sell_amount - minimum amount of order tokens to buy
    7. remains_to_fill - how much of order tokens are still remains in order_wallet
    8. is_private - is this order private?

- **Order Filling**
This command will buy 0.2 of token1 created in previous step and swap it with corresponding amount of token2 from the
wallet of caller (~/.config/solana/id.json). You can also specify different keypair file by passing if in --keypair parameter
```bash
./p2p-swap-cli -u devnet -p AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx buy-order 6dfxGdK649xeCmtNXcvBFYbovyYsCogJLD6SGx27m6Cf 200000000

transaction: 5uSE8mjpqEy5H7CMSoN4pThYA5vvHnYKKCDpbrStwM1QRyevMaLDFcgvpCYC8yoSLefzRXM5WPSLYEtbeESfdsH5
```