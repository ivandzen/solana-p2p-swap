import React, {useEffect, useMemo, useState} from "react";
import {ValueEdit} from "./ValueEdit";
import {bigintChecker, CreateOrderProps, createOrderTransaction, P2P_SWAP_DEVNET, publicKeyChecker} from "../p2p-swap";
import {Button} from "./Button";
import {PublicKey} from "@solana/web3.js";
import {useConnection, useWallet} from "@solana/wallet-adapter-react";
import {Visibility} from "./Visibility";
import {CheckBox} from "./CheckBox";
import { binary_to_base58 } from 'base58-js';
import {useApp} from "../AppContext";

const SELL_TAB_MODE_CREATE_ORDER: string = "create-order";
const SELL_TAB_MODE_SHOW_ORDER: string = "show-order";

interface SellTabState {
    mode: string,
    orderAddress: PublicKey|null,
    trxSignature: string|null,
    unlockKey: string|null,
}

function SellTab() {
    let {wallet, signMessage} = useWallet();
    let {setAppState} = useApp();
    let {connection} = useConnection();
    const [sellToken, onSellTokenChange] = useState<string|undefined>(undefined);
    const [sellAmount, onSellAmountChange] = useState<string|undefined>("0");
    const [sellMinimum, onSellMinimumChange] = useState<string|undefined>("0");
    const [buyToken, onBuyTokenChange] = useState<string|undefined>(undefined);
    const [buyAmount, onBuyAmountChange] = useState<string|undefined>("0");
    const [createOrderProps, setCreateOrderProps] = useState<CreateOrderProps|undefined>(undefined);
    const [isPrivate, setIsPrivate] = useState(false);
    const [sellTabState, setSellTabState] = useState<SellTabState>({
        mode: SELL_TAB_MODE_CREATE_ORDER,
        unlockKey: null,
        trxSignature: null,
        orderAddress: null,
    });

    let [mode, setMode] = useState(SELL_TAB_MODE_CREATE_ORDER);
    let [newOrderAddress, setNewOrderAddress] = useState<PublicKey|null>(null);
    let [unlockKey, setUnlockKey] = useState<string|null>(null);
    useEffect(() => {
        setMode(sellTabState.mode);
        setNewOrderAddress(sellTabState.orderAddress);
        setUnlockKey(sellTabState.unlockKey);
    }, [sellTabState]);

    let isOrderDataReady = (): boolean => {
        return !!(sellToken && buyToken && sellAmount && buyAmount && sellMinimum);
    };

    useEffect(() => {
        try {
            let signer = wallet?.adapter.publicKey;
            if (!signer || !isOrderDataReady()) {
                setCreateOrderProps(undefined);
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
            setCreateOrderProps(undefined);
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

            let newSellTabState: SellTabState = {
                mode: SELL_TAB_MODE_SHOW_ORDER,
                orderAddress: orderAccount,
                trxSignature: signature ? signature : null,
                unlockKey: null,
            };

            if (isPrivate) {
                let unlockKey = await signMessage?.(orderAccount.toBytes());
                if (unlockKey) {
                    newSellTabState.unlockKey = binary_to_base58(unlockKey);
                }
            }

            setSellTabState(newSellTabState);
        } catch (e) {
            console.log(`Failed to create order: ${e}`);
        }
    }

    let onCreateNewClicked = async () => {
        setSellTabState({
            mode: SELL_TAB_MODE_CREATE_ORDER,
            unlockKey: sellTabState?.unlockKey,
            trxSignature: sellTabState?.trxSignature,
            orderAddress: sellTabState?.orderAddress,
        });
    }

    return (
        <div className="vertical">
            <Visibility isActive={mode === SELL_TAB_MODE_CREATE_ORDER}>
                <div className="vertical">
                    <ValueEdit
                        name={"Sell Token:"}
                        value={sellToken}
                        onChange={onSellTokenChange}
                        valueChecker={publicKeyChecker}
                    />
                    <ValueEdit
                        name={"Sell Amount:"}
                        value={sellAmount ? sellAmount.toString() : undefined}
                        onChange={onSellAmountChange}
                        valueChecker={bigintChecker}
                    />
                    <ValueEdit
                        name={"Sell Minimum:"}
                        value={sellMinimum ? sellMinimum.toString() : undefined}
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
                        value={buyAmount ? buyAmount.toString() : undefined}
                        onChange={onBuyAmountChange}
                        valueChecker={bigintChecker}
                    />
                    <CheckBox name={"Is Private "} setChecked={setIsPrivate}/>
                    <Visibility isActive={isPrivate}>
                        <label className="label-attention">
                            <p>Besides regular transaction approval, </p>
                            <p>You will be prompted to sign message containing order account address</p>
                            <p>encoded in binary form to generate order unlock key.</p>
                            <p>NOTE: Order filling will be available only with this signature!</p>
                        </label>
                    </Visibility>
                    <Button
                        name={"Sell"}
                        className={isOrderDataReady() ? "tabbutton-active" : "tabbutton"}
                        onClick={onSellClicked}
                    />
                </div>
            </Visibility>
            <Visibility isActive={mode === SELL_TAB_MODE_SHOW_ORDER}>
                <div className="vertical">
                    <Visibility isActive={!!(newOrderAddress)}>
                        <div className="vertical">
                            <ValueEdit
                                name={"Order Address:"}
                                value={newOrderAddress?.toString()}
                                readonly={true}
                            />

                            <Button
                                name={"View details"}
                                className="tabbutton-active"
                                onClick={()=> {
                                    setAppState({
                                        appMode: "Buy",
                                        orderAddress: newOrderAddress,
                                        unlockKey: unlockKey,
                                    });
                                }}
                            />
                        </div>
                    </Visibility>
                    <Visibility isActive={!!(isPrivate && unlockKey)} >
                        <div className="vertical">
                            <ValueEdit
                                name={"Unlock Key:"}
                                value={unlockKey ? unlockKey : undefined}
                                readonly={true}
                            />

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