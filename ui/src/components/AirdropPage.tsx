import React, { FC, useState } from "react";
import { SupportedToken, useApp } from "../AppContext";
import {
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import { SelectedToken, TokenSelect } from "./TokenSelect";

export const AirdropPage: FC = () => {
    let {
        connection, wallet,
        showInfoMessage, showErrorMessage, supportedTokens
    } = useApp();
    const [selectedToken, setSelectedToken] = useState<SelectedToken|null>(null);

    const getToken = (mint: PublicKey): SupportedToken|undefined => {
        for (let [, token] of supportedTokens) {
            if (mint.equals(token.pubkey)) {
                return token;
            }
        }

        return undefined;
    }

    const onMintClick = () => {
        const impl = async () => {
            if (!wallet
                || !selectedToken
                || !wallet.adapter.publicKey
            ) {
                return;
            }

            let token = getToken(selectedToken.mint.address);
            if (!token) {
                showErrorMessage("Token unsupported", true);
                return;
            }

            if (!token.keypair?.publicKey) {
                showErrorMessage("You can not mint this token", true);
                return;
            }

            showInfoMessage("Sending transaction...", false);

            try {
                let clientWallet = await getAssociatedTokenAddress(
                    selectedToken.mint.address,
                    wallet.adapter.publicKey,
                    false
                );

                const { blockhash } = await connection.getLatestBlockhash();
                let transaction = new Transaction(
                    {
                        recentBlockhash: blockhash,
                        feePayer: wallet.adapter.publicKey
                    });

                if (!await connection.getAccountInfo(clientWallet)) {
                    // buy token wallet of seller does not exist
                    transaction.add(createAssociatedTokenAccountInstruction(
                        wallet.adapter.publicKey,
                        clientWallet,
                        wallet.adapter.publicKey,
                        selectedToken.mint.address
                    ));
                }

                transaction.add(createMintToInstruction(
                    selectedToken.mint.address,
                    clientWallet,
                    token.keypair?.publicKey,
                    100n * BigInt(Math.pow(10, selectedToken.mint.decimals)),
                    [wallet.adapter.publicKey, token.keypair]
                ));

                await wallet?.adapter.sendTransaction(transaction, connection, {signers:[token.keypair]});
            } catch (e: any) {
                showErrorMessage(e.toString(), true);
                return;
            }

            showInfoMessage("Airdrop finished", true);
        }

        impl().then(()=>{});
    };


    return (
        <div className='table-like'>
            <div className='horizontal'>
                <label>
                    <h3>Drop me 100</h3>
                </label>
                <TokenSelect onTokenSelected={setSelectedToken} />
                <button
                    className='tabbutton-active'
                    onClick={onMintClick}
                    disabled={!selectedToken || supportedTokens.size == 0}
                >
                    pleeeeeease...
                </button>
            </div>
            <label>NOTE: This is test tokens</label>
        </div>
    )
}