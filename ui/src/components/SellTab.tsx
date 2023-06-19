import React, {useEffect, useState} from "react";
import {ValueEdit} from "./ValueEdit";
import {
    CreateOrderProps,
    createOrderTransaction,
    getOrderDescriptionChecked,
    P2P_SWAP_DEVNET,
    publicKeyChecker
} from "../p2p-swap";
import {Button} from "./Button";
import {Connection, PublicKey} from "@solana/web3.js";
import {Visibility} from "./Visibility";
import {CheckBox} from "./CheckBox";
import {useApp} from "../AppContext";
import {OrderDescription} from "./OrderDescription";
const base58 = require("base58-js");

const SELL_TAB_MODE_CREATE_ORDER: string = "create-order";
const SELL_TAB_MODE_SHOW_ORDER: string = "show-order";

function SellTab() {
    let {
        sellOrderDescription,
        setSellOrderDescription,
        domain,
        setAppMode,
        connection,
        wallet, signMessage,
    } = useApp();

    const [sellToken, onSellTokenChange] = useState<string|undefined>(undefined);
    const [sellAmount, onSellAmountChange] = useState<string|undefined>("0");
    const [sellMinimum, onSellMinimumChange] = useState<string|undefined>("0");
    const [buyToken, onBuyTokenChange] = useState<string|undefined>(undefined);
    const [buyAmount, onBuyAmountChange] = useState<string|undefined>("0");
    const [createOrderProps, setCreateOrderProps] = useState<CreateOrderProps|undefined>(undefined);
    const [isPrivate, setIsPrivate] = useState(false);
    const [sellTabMode, setSellTabMode] = useState<string>(SELL_TAB_MODE_CREATE_ORDER);
    const [newOrderAddress, setNewOrderAddress] = useState<PublicKey|null>(null);
    const [newUnlockKey, setNewUnlockKey] = useState<string|null>(null);
    const [errorDescription, setErrorDescription] = useState<string|null>(null);
    const [expandDetails, setExpandDetails] = useState<boolean>(false);
    const [orderURL, setOrderURL] = useState<string|null>(null);

    useEffect(() => {
        try {
            let signer = wallet?.adapter.publicKey;
            if (!signer || !buyToken || !sellToken) {
                setCreateOrderProps(undefined);
                return;
            }

            let sellAmountParsed = BigInt(sellAmount? sellAmount : 0);
            let buyAmountParsed = BigInt(buyAmount ? buyAmount : 0);
            let sellMinimumParsed = BigInt(sellMinimum ? sellMinimum: 0);

            if (sellAmountParsed <= BigInt(0)
                || buyAmountParsed <= BigInt(0)
                || sellMinimumParsed <= BigInt(0)) {
                setCreateOrderProps(undefined);
                return;
            }

            let props: CreateOrderProps = {
                programId: P2P_SWAP_DEVNET,
                sellAmount: sellAmountParsed,
                buyAmount: buyAmountParsed,
                minSellAmount: sellMinimumParsed,
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

        setAppMode("Send-Txn");

        try {
            await wallet?.adapter.sendTransaction(transaction, connection);
            setNewOrderAddress(orderAccount);

            if (isPrivate) {
                setAppMode("Sign-Pubkey");
                let unlockKey = await signMessage?.(orderAccount.toBytes());
                if (unlockKey) {
                    setNewUnlockKey(base58.binary_to_base58(unlockKey));
                }
            }

            setSellTabMode(SELL_TAB_MODE_SHOW_ORDER);
        } catch (e) {
            console.log(`Failed to create order: ${e}`);
        }

        setAppMode("Sell");
    }

    let onViewDetailsClick = async () => {
        async function updateOrderDescription(
            connection: Connection,
            orderAddress: PublicKey
        ) {
            setSellOrderDescription(null);
            setErrorDescription("Loading...");
            try {
                let orderDescription
                    = await getOrderDescriptionChecked(connection, orderAddress, P2P_SWAP_DEVNET);
                setSellOrderDescription(orderDescription);
                setErrorDescription(null);
            } catch (e: any) {
                setErrorDescription(e.toString());
            }
        }

        if (newOrderAddress)
            updateOrderDescription(connection, new PublicKey(newOrderAddress)).then(() => {});
        else
            setErrorDescription('Wrong order address');
    };

    const onCreateNewClicked = async () => {
        setSellTabMode(SELL_TAB_MODE_CREATE_ORDER);
    }

    useEffect(()=>{
        if (newOrderAddress) {
            let url = `${domain}/?mode=Buy&order_address=${newOrderAddress.toString()}`;
            if (newUnlockKey) {
                url += `&unlock_key=${newUnlockKey}`;
            }
            setOrderURL(url);
        } else {
            setOrderURL(null);
        }
    }, [newOrderAddress, newUnlockKey]);

    const bigintChecker = (value: string|undefined):boolean => {
        if (!value) {
            return false;
        }

        try {
            let v = BigInt(value);
            return (v > BigInt(0));
        } catch (e) {}

        return false;
    }

    return (
        <div>
            <Visibility isActive={sellTabMode === SELL_TAB_MODE_CREATE_ORDER}>
                <div className="vertical">
                    <div className="table-like">
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
                    </div>
                    <CheckBox name={"Is Private "} setChecked={setIsPrivate}/>
                    <Visibility isActive={isPrivate}>
                        <div className="vertical">
                            <div className="label-attention">
                                <b>
                                    <p>Besides regular transaction approval, </p>
                                    <p>You will be prompted to sign message containing order account address</p>
                                    <p>encoded in binary form to generate order unlock key.</p>
                                    <p>NOTE: Order filling will be available only with this signature!</p>
                                </b>
                            </div>
                        </div>
                    </Visibility>
                    <Button
                        name={"Sell"}
                        onClick={onSellClicked}
                        disabled={!createOrderProps}
                    />
                </div>
            </Visibility>
            <Visibility isActive={sellTabMode === SELL_TAB_MODE_SHOW_ORDER}>
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
                                onClick={onViewDetailsClick}
                                checkable={true}
                                checked={expandDetails}
                                setChecked={setExpandDetails}
                            />
                            <Visibility isActive={expandDetails}>
                                <OrderDescription description={sellOrderDescription}/>
                                <Visibility isActive={!!errorDescription}>
                                    <h1>{errorDescription}</h1>
                                </Visibility>
                            </Visibility>
                        </div>
                    </Visibility>
                    <Visibility isActive={!!(isPrivate && newUnlockKey)} >
                        <div className="vertical">
                            <ValueEdit
                                name={"Unlock Key:"}
                                value={newUnlockKey ? newUnlockKey : undefined}
                                readonly={true}
                            />
                            <div className="label-attention">
                                <b>
                                <p>It is only possible to fill the order with this unlock key!</p>
                                <p>Save it and provide to selected buyers</p>
                                </b>
                            </div>
                        </div>
                    </Visibility>
                    <ValueEdit name={"Order URL:"} readonly={true} value={orderURL ? orderURL : undefined}/>
                    <Button
                        name={"Create another order"}
                        onClick={onCreateNewClicked}
                    />
                </div>
            </Visibility>
        </div>
    )
}

export { SellTab }