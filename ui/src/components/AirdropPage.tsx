import React, { FC, useState } from "react";
import { SupportedToken, useApp } from "../AppContext";
import {
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    getAssociatedTokenAddress,
    Mint,
} from "@solana/spl-token";
import { TokenBox } from "./TokenBox";
import { PublicKey, Transaction } from "@solana/web3.js";

export const AirdropPage: FC = () => {
    let {connection, wallet, showErrorMessage, supportedTokens} = useApp();
    const [selectedTokenMint, setSelectedTokenMint] = useState<Mint|undefined>(undefined);

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
                || !selectedTokenMint
                || !wallet.adapter.publicKey
            ) {
                return;
            }

            let token = getToken(selectedTokenMint.address);
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
                    selectedTokenMint.address,
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
                        selectedTokenMint.address
                    ));
                }

                transaction.add(createMintToInstruction(
                    selectedTokenMint.address,
                    clientWallet,
                    token.keypair?.publicKey,
                    100n * BigInt(Math.pow(10, selectedTokenMint.decimals)),
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
                <p>Select token and then press <b>Drop It!</b></p>
                <p>to get 100 test tokens</p>
            </label>
            <div className='horizontal'>
                <TokenBox
                    name={''}
                    onTokenChanged={setSelectedTokenMint}
                    onAmountChanged={(_:any)=>{}}
                    sellSide={false}
                    disableInput={true}
                />
                <button
                    className='fixed'
                    onClick={onMintClick}
                    disabled={!selectedTokenMint || supportedTokens.size == 0}
                >Drop It!</button>
            </div>
        </div>
    )
}