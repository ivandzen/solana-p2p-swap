#!/bin/bash

spl-token -u devnet create-account $(solana address -k token1_keypair.json)
spl-token -u devnet mint --mint-authority token_mint_authority.json $(solana address -k token1_keypair.json) 1000

spl-token -u devnet create-account $(solana address -k token2_keypair.json)
spl-token -u devnet mint --mint-authority token_mint_authority.json $(solana address -k token2_keypair.json) 1000