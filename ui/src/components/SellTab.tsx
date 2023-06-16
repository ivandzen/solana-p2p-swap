import React, {useEffect, useState} from "react";
import {ValueEdit} from "./ValueEdit";
import {bigintChecker, CreateOrderProps, createOrderTransaction, P2P_SWAP_DEVNET, publicKeyChecker} from "../p2p-swap";
import {Button} from "./Button";
import {Connection, PublicKey, SendTransactionError} from "@solana/web3.js";
import {WalletConnectWalletAdapter} from "@solana/wallet-adapter-wallets";
import {useConnection, useWallet} from "@solana/wallet-adapter-react";
import {Visibility} from "./Visibility";
import {CheckBox} from "./CheckBox";
import { binary_to_base58 } from 'base58-js';

function SellTab() {
    let {wallet, signMessage} = useWallet();
    let {connection} = useConnection();
    const [sellToken, onSellTokenChange] = useState<string|null>(null);
    const [sellAmount, onSellAmountChange] = useState<string|null>("0");
    const [sellMinimum, onSellMinimumChange] = useState<string|null>("0");
    const [buyToken, onBuyTokenChange] = useState<string|null>(null);
    const [buyAmount, onBuyAmountChange] = useState<string|null>("0");
    const [createOrderProps, setCreateOrderProps] = useState<CreateOrderProps|null>(null);
    const [isPrivate, setIsPrivate] = useState(false);
    const [newOrderAddress, setNewOrderAddress] = useState<PublicKey|null>(null);
    const [trxSignature, setTrxSignature] = useState<string|undefined>(undefined);
    const [unlockKey, setUnlockKey] = useState<string|null>(null);

    let isOrderDataReady = (): boolean => {
        return !(!sellToken || !buyToken || !sellAmount || !buyAmount || !sellMinimum);
    };

    useEffect(() => {
        try {
            let signer = wallet?.adapter.publicKey;
            if (!signer || !isOrderDataReady()) {
                setCreateOrderProps(null);
                return;
            }

            let props: CreateOrderProps = {
                programId: P2P_SWAP_DEVNET,
                sellAmount: BigInt(sellAmount? sellAmount : 0),
                buyAmount: BigInt(buyAmount? buyAmount:0),
                minSellAmount: BigInt(sellMinimum? sellMinimum:0),
                creationSlot: BigInt(0), // will be overriden later
                signer: signer,
                sellToken: new PublicKey(sellToken),
                buyToken: new PublicKey(buyToken),
                isPrivate: isPrivate,
            }

            setCreateOrderProps(props);
        } catch (e: any) {
            console.warn(`Failed to create order props: ${e}`);
            setCreateOrderProps(null);
        }
    }, [sellToken, sellAmount, sellMinimum, buyToken, buyAmount, wallet, isPrivate]);

    let onSellClicked = async () => {
        if (!createOrderProps) {
            return;
        }

        let creationSlot = await connection.getSlot();
        createOrderProps.creationSlot = BigInt(creationSlot);
        let [transaction, orderAccount] =
            await createOrderTransaction(connection, createOrderProps);

        try {
            let signature = await wallet?.adapter.sendTransaction(transaction, connection);

            if (isPrivate) {
                let signature = await signMessage?.(orderAccount.toBytes());
                if (signature) {
                    setUnlockKey(binary_to_base58(signature));
                }
            }

            setTrxSignature(signature);
            setNewOrderAddress(orderAccount);
            setMode("showtrx");
        } catch (e) {
            console.log(`Failed to create order: ${e}`);
        }
    }

    let onCreateNewClicked = async () => {
        setMode("filltrx");
    }

    const [mode, setMode] = useState("filltrx");

    return (
        <div className="vertical">
            <Visibility isActive={mode === "filltrx"}>
                <div className="vertical">
                    <ValueEdit
                        name={"Sell Token:"}
                        value={sellToken}
                        onChange={onSellTokenChange}
                        valueChecker={publicKeyChecker}
                    />
                    <ValueEdit
                        name={"Sell Amount:"}
                        value={sellAmount ? sellAmount.toString() : null}
                        onChange={onSellAmountChange}
                        valueChecker={bigintChecker}
                    />
                    <ValueEdit
                        name={"Sell Minimum:"}
                        value={sellMinimum ? sellMinimum.toString() : null}
                        onChange={onSellMinimumChange}
                        valueChecker={bigintChecker}
                    />
                    <ValueEdit
                        name={"Buy Token:"}
                        value={buyToken}
                        onChange={onBuyTokenChange}
                        valueChecker={publicKeyChecker}
                    />
                    <ValueEdit
                        name={"Buy Amount:"}
                        value={buyAmount ? buyAmount.toString() : null}
                        onChange={onBuyAmountChange}
                        valueChecker={bigintChecker}
                    />
                    <CheckBox name={"Is Private "} setChecked={setIsPrivate}/>
                    <Visibility isActive={isPrivate}>
                        <label className="label">
                            <p>You will be prompted to sign </p>
                            <p>order account address </p>
                            <p>encoded in binary form</p>
                            <p>to generate order unlock key </p>
                        </label>
                    </Visibility>
                    <Button
                        name={"Sell"}
                        className={isOrderDataReady() ? "tabbutton-active" : "tabbutton"}
                        onClick={onSellClicked}
                    />
                </div>
            </Visibility>
            <Visibility isActive={mode === "showtrx"}>
                <div className="vertical">
                    <Visibility isActive={!!(newOrderAddress)}>
                        <div className="horizontal">
                            <label className="label">
                                <b>Order Address:</b>
                            </label>
                            <label className="label">
                                <b>{newOrderAddress?.toString()}</b>
                            </label>
                            <Button
                                name={"View details"}
                                className="tabbutton-active"
                                onClick={()=>{}}
                            />
                        </div>
                    </Visibility>
                    <Visibility isActive={!!(isPrivate && unlockKey)} >
                        <div className="vertical">
                            <label className="label">
                                <b>Unlock Key:</b>
                            </label>
                            <label className="label">
                                <b>{unlockKey}</b>
                            </label>
                            <label className="label-attention">
                                <p>It is only possible to fill the order with this unlock key!</p>
                                <p>Save it and provide to selected buyers</p>
                            </label>
                        </div>
                    </Visibility>
                    <Button
                        name={"Create new order"}
                        className={"tabbutton-active"}
                        onClick={onCreateNewClicked}
                    />
                </div>
            </Visibility>
        </div>
    )
}

export { SellTab }