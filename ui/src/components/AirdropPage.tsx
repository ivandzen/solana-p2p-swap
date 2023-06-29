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
    let {connection, wallet, showErrorMessage, supportedTokens} = useApp();
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
                showErrorMessage("Token unsupported");
                return;
            }

            if (!token.keypair?.publicKey) {
                showErrorMessage("You can not mint this token");
                return;
            }

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

                console.log("Mint: " + transaction.toString());

                await wallet?.adapter.sendTransaction(transaction, connection, {signers:[token.keypair]});
            } catch (e: any) {
                showErrorMessage(e.toString());
            }
        }

        impl().then(()=>{});
    };


    return (
        <div className='vertical'>
            <label>
                <p>Select token and then press <b>Drop</b></p>
                <p>to get 100 test tokens</p>
            </label>
            <div className='horizontal'>
                <TokenSelect onTokenSelected={setSelectedToken} />
                <button
                    className='fixed'
                    onClick={onMintClick}
                    disabled={!selectedToken || supportedTokens.size == 0}
                >
                    Drop
                </button>
            </div>
        </div>
    )
}