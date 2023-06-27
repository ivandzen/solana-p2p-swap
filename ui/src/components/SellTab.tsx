import React, { ChangeEvent, useEffect, useState } from "react";
import {ValueEdit} from "./ValueEdit";
import {
    amountToDecimal,
    CreateOrderProps,
    createOrderTransaction,
    getOrderDescriptionChecked, OrderDescriptionData,
    P2P_SWAP_DEVNET,
    WalletToken
} from "../p2p-swap";
import {Button} from "./Button";
import {Connection, PublicKey} from "@solana/web3.js";
import {Visibility} from "./Visibility";
import {CheckBox} from "./CheckBox";
import {useApp} from "../AppContext";
import {OrderDescription} from "./OrderDescription";
import { TokenBox } from "./TokenBox";
import Decimal from "decimal.js";
const base58 = require("base58-js");

const SELL_TAB_MODE_CREATE_ORDER: string = "create-order";
const SELL_TAB_MODE_SHOW_ORDER: string = "show-order";

function SellTab() {
    let {
        domain,
        setAppMode,
        connection,
        wallet, signMessage,
        showErrorMessage,
    } = useApp();

    const [sellOrderDescription, setSellOrderDescription] = useState<OrderDescriptionData|null>(null);
    const [sellToken, onSellTokenChange] = useState<WalletToken|undefined>(undefined);
    const [sellAmount, onSellAmountChange] = useState<bigint|undefined>(0n);
    const [sellMinimum, setSellMinimum] = useState<string|undefined>("0");
    const [sellMinimBigint, setSellMinimumBigint] = useState<bigint|null>(null);
    const [buyToken, onBuyTokenChange] = useState<WalletToken|undefined>(undefined);
    const [buyAmount, onBuyAmountChange] = useState<bigint|undefined>(0n);
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
            if (!signer || !buyToken || !sellToken || !sellMinimBigint) {
                setCreateOrderProps(undefined);
                return;
            }

            let sellAmountParsed = sellAmount? sellAmount : 0n;
            let buyAmountParsed = buyAmount ? buyAmount : 0n;

            if (sellAmountParsed <= 0n
                || buyAmountParsed <= 0n
                || sellMinimBigint <= 0n) {
                setCreateOrderProps(undefined);
                return;
            }

            let props: CreateOrderProps = {
                programId: P2P_SWAP_DEVNET,
                sellAmount: sellAmountParsed,
                buyAmount: buyAmountParsed,
                minSellAmount: sellMinimBigint,
                creationSlot: BigInt(0), // will be overriden later
                signer: signer,
                sellToken: sellToken.mint,
                buyToken: buyToken.mint,
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

    useEffect(() => {
        if (!sellToken || !sellAmount || !sellMinimum) {
            setSellMinimumBigint(null);
            return;
        }

        try {
            let value =  new Decimal(sellMinimum)
                .mul(new Decimal(10)
                         .pow(new Decimal(sellToken?.decimals)));

            let valueBigint = BigInt(value.toString());
            if (valueBigint < 1) {
                setSellMinimumBigint(1n);
                setSellMinimum(amountToDecimal(1n, sellToken.decimals).toString());
                return;
            }

            if (valueBigint > sellAmount) {
                setSellMinimumBigint(sellAmount);
                setSellMinimum(amountToDecimal(sellAmount, sellToken.decimals).toString());
                return;
            }

            setSellMinimumBigint(valueBigint);
        } catch (e) {
            setSellMinimumBigint(null);
        }
    }, [sellToken, sellAmount, sellMinimum]);

    return (
        <div>
            <Visibility isActive={sellTabMode === SELL_TAB_MODE_CREATE_ORDER}>
                <div className="vertical">
                    <div className='table-like'>
                        <TokenBox
                            name={'Sell'}
                            onTokenChanged={onSellTokenChange}
                            onAmountChanged={onSellAmountChange}
                            limitWalletAmount={true}
                        />
                        <TokenBox
                            name={'Buy'}
                            onTokenChanged={onBuyTokenChange}
                            onAmountChanged={onBuyAmountChange}
                        />
                        <div className='horizontal'>
                            <label>
                                <b>Sell minimum :</b>
                            </label>
                            <input
                                type='number'
                                value={sellMinimum}
                                onChange={(event) => { setSellMinimum(event.target.value) }}
                            />
                        </div>
                    </div>
                    <CheckBox name={"Is Private "} setChecked={setIsPrivate}/>
                    <Visibility isActive={isPrivate}>
                        <div className="vertical">
                            <div className="label-attention">
                                <b>
                                    <p>Besides regular transaction approval,</p>
                                    <p>You will be prompted to sign message</p>
                                    <p>containing order account address</p>
                                    <p>encoded in binary form to generate </p>
                                    <p>order unlock key.</p>
                                    <p>NOTE: Order filling will be available</p>
                                    <p>only with this signature!</p>
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
                        onClick={async () => {
                            setSellTabMode(SELL_TAB_MODE_CREATE_ORDER);
                        }}
                    />
                </div>
            </Visibility>
        </div>
    )
}

export { SellTab }