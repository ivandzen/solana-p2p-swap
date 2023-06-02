#!/bin/bash

if [ -z "$SOLANA_URL" ]; then
  echo "SOLANA_URL is not set"
  exit 1
fi

solana config set -u "$SOLANA_URL"

export P2P_SWAP=$(solana address -k p2p-swap-keypair.json)

solana-keygen new --no-bip39-passphrase -o /root/.config/solana/id.json
solana -u $SOLANA_URL airdrop 100

echo "Deploying P2P_SWAP at address $P2P_SWAP..."
if ! solana -u $SOLANA_URL program deploy --upgrade-authority p2p-swap-keypair.json p2p_swap.so >p2p_swap; then
  echo "Failed to deploy p2p-swap"
  exit 1
fi
