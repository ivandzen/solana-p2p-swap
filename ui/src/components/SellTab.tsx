import React, { ChangeEvent, useEffect, useState } from "react";
import {ValueEdit} from "./ValueEdit";
import {
    amountToDecimal, amountToStr,
    CreateOrderProps,
    createOrderTransaction,
    getOrderDescriptionChecked, OrderDescriptionData,
    P2P_SWAP_DEVNET
} from "../p2p-swap";
import {Button} from "./Button";
import {Connection, PublicKey} from "@solana/web3.js";
import {Visibility} from "./Visibility";
import {CheckBox} from "./CheckBox";
import { SupportedTokens, useApp } from "../AppContext";
import {OrderDescription} from "./OrderDescription";
import { TokenBox } from "./TokenBox";
import Decimal from "decimal.js";
import { Mint } from "@solana/spl-token";
import Slider from "@mui/material/Slider";
import { TokenSelect } from "./TokenSelect";
import { AmountInput } from "./AmountInput";
const base58 = require("base58-js");

const SELL_TAB_MODE_CREATE_ORDER: string = "create-order";
const SELL_TAB_MODE_SHOW_ORDER: string = "show-order";

function getTokenLabel(supportedTokens: SupportedTokens, inPubkey: PublicKey|undefined): string {
    if (!inPubkey) {
        return 'UNKNOWN'
    }

    for (let [label, token] of supportedTokens) {
        if (token.pubkey.equals(inPubkey)) {
            return label;
        }
    }

    return 'UNKNOWN';
}

function SellTab() {
    let {
        domain,
        connection,
        wallet, signMessage,
        showInfoMessage,
        showErrorMessage,
        supportedTokens,
    } = useApp();

    const [sellOrderDescription, setSellOrderDescription] = useState<OrderDescriptionData|null>(null);
    const [sellToken, setSellToken] = useState<Mint|undefined>(undefined);
    const [sellAmount, setSellAmount] = useState<bigint>(0n);
    const [sellMinimumStr, setSellMinimumStr] = useState<string>("0");
    const [sellMinimumPercent, setSellMinimumPercent] = useState<number>(0);
    const [sellMinimBigint, setSellMinimumBigint] = useState<bigint>(0n);
    const [buyToken, onBuyTokenChange] = useState<Mint|undefined>(undefined);
    const [buyAmountStr, setBuyAmountStr] = useState('0');
    const [buyAmount, setBuyAmount] = useState<bigint|undefined>(0n);
    const [createOrderProps, setCreateOrderProps] = useState<CreateOrderProps|undefined>(undefined);
    const [isPrivate, setIsPrivate] = useState(false);
    const [sellTabMode, setSellTabMode] = useState<string>(SELL_TAB_MODE_CREATE_ORDER);
    const [newOrderAddress, setNewOrderAddress] = useState<PublicKey|null>(null);
    const [newUnlockKey, setNewUnlockKey] = useState<string|null>(null);
    const [errorDescription, setErrorDescription] = useState<string|null>(null);
    const [expandDetails, setExpandDetails] = useState<boolean>(false);
    const [orderURL, setOrderURL] = useState<string|null>(null);
    const [priceString, setPriceString] = useState<string|null>(null);
    const [flippedPrice, setFlippedPrice] = useState<boolean>(false);

    useEffect(() => {
        try {
            let signer = wallet?.adapter.publicKey;
            if (!signer || !buyToken || !sellToken || !sellMinimBigint) {
                setCreateOrderProps(undefined);
                return;
            }

            if (buyToken.address.equals(sellToken.address)) {
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
                sellToken: sellToken.address,
                buyToken: buyToken.address,
                isPrivate: isPrivate,
            }

            setCreateOrderProps(props);
        } catch (e: any) {
            console.warn(`Failed to create order props: ${e}`);
            setCreateOrderProps(undefined);
        }
    }, [sellToken, sellAmount, sellMinimBigint, buyToken, buyAmount, wallet, isPrivate]);

    let onSellClicked = async () => {
        if (!createOrderProps) {
            return;
        }

        let creationSlot = await connection.getSlot();
        createOrderProps.creationSlot = BigInt(creationSlot);
        let [transaction, orderAccount] =
            await createOrderTransaction(connection, createOrderProps);

        showInfoMessage("Sending transaction...", false);

        try {
            await wallet?.adapter.sendTransaction(transaction, connection);
            setNewOrderAddress(orderAccount);

            if (isPrivate) {
                showInfoMessage("Signing order public key...", false);
                let unlockKey = await signMessage?.(orderAccount.toBytes());
                if (unlockKey) {
                    setNewUnlockKey(base58.binary_to_base58(unlockKey));
                }
            }

            setSellTabMode(SELL_TAB_MODE_SHOW_ORDER);
        } catch (e: any) {
            showErrorMessage(e.toString(), true);
            return;
        }

        showInfoMessage("New order created. Click to see it.", true);
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

    useEffect(()=> {
        if (!!sellToken && !!buyToken && !!sellAmount && !!buyAmount) {
            let sell = new Decimal(sellAmount.toString())
                .div(Math.pow(10, sellToken.decimals));
            let buy = new Decimal(buyAmount.toString())
                .div(Math.pow(10, buyToken.decimals));
            if (!flippedPrice) {
                setPriceString(`Price: 1 ${getTokenLabel(supportedTokens, buyToken?.address)}
                = ${sell.div(buy).toSignificantDigits(sellToken.decimals)} ${getTokenLabel(supportedTokens, sellToken?.address)}`);
            } else {
                setPriceString(`Price: 1 ${getTokenLabel(supportedTokens, sellToken?.address)}
                = ${buy.div(sell).toSignificantDigits(buyToken.decimals)} ${getTokenLabel(supportedTokens, buyToken?.address)}`);
            }
        } else {
            setPriceString('Unable to calculate price');
        }
    }, [supportedTokens, sellToken, buyToken, sellAmount, buyAmount, flippedPrice]);

    const onMinimumInputChange = (minStr: string) => {
        setSellMinimumStr(minStr);

        if (!sellToken || sellAmount === 0n) {
            return;
        }

        try {
            let percent = new Decimal(minStr)
                .div(amountToStr(sellAmount, sellToken.decimals)).mul(100)
                .round();

            setSellMinimumPercent(percent.toNumber());
        } catch (e: any) {
            console.log(`onMinimumInputChange: ${e.toString()}`)
        }
    }

    const updateSellMinimumStr = (percent: number) => {
        if (!sellToken || sellAmount === 0n) {
            setSellMinimumStr('0');
            return;
        }

        try {
            let sellMinimumDec = new Decimal(sellAmount.toString())
                .mul(percent)
                .div(100)
                .round();

            setSellMinimumStr(
                amountToStr(
                    BigInt(sellMinimumDec.toString()),
                    sellToken.decimals
                )
            );
        } catch (e: any) {
            console.log(`updateSellMinimumStr: ${e.toString()}`)
        }
    };

    useEffect(() => {
        setSellMinimumStr('0');
        setSellMinimumPercent(0);
    }, [sellToken]);

    useEffect(() => {
        if (sellAmount === 0n) {
            setSellMinimumBigint(0n);
            return;
        }

        updateSellMinimumStr(sellMinimumPercent);
    }, [sellAmount, sellToken]);

    const onMinimumSliderChange = (event: any, percent: number|number[]) => {
        if (typeof (percent) !== 'number') {
            return;
        }

        setSellMinimumPercent(percent);
        updateSellMinimumStr(percent);
    }

    useEffect(() => {
        if (!buyToken) {
            setBuyAmountStr('0');
            return;
        }

        try {
            let value = new Decimal(buyAmountStr)
                .mul(Math.pow(10, buyToken.decimals));
            if (value.greaterThanOrEqualTo(0)) {
                setBuyAmount(BigInt(value.toString()));
            } else {
                setBuyAmountStr('0');
                setBuyAmount(undefined);
            }

        } catch (e: any) {
            setBuyAmount(undefined);
        }
    }, [buyAmountStr, buyToken]);

    return (
        <div>
            <Visibility isActive={sellTabMode === SELL_TAB_MODE_CREATE_ORDER}>
                <div className="vertical">
                    <label><h3>Sell</h3></label>
                    <div className='table-like'>
                        <TokenBox
                            name=""
                            onTokenChanged={setSellToken}
                            onAmountChanged={setSellAmount}
                        />
                        <div className='horizontal'>
                            <label><h3>Minimum</h3></label>
                            <AmountInput
                                disabled={!sellToken || sellAmount === 0n}
                                decimals={sellToken ? sellToken.decimals : 0}
                                valueStr={sellMinimumStr}
                                setValueStr={onMinimumInputChange}
                                onValueChanged={setSellMinimumBigint}
                                maximum={sellAmount}
                            />
                        </div>
                        <div className='horizontal'>
                            <Slider
                                className='slider'
                                value={sellMinimumPercent}
                                onChange={onMinimumSliderChange}
                                disabled={!sellToken || sellAmount === 0n}
                                max={100}
                            />
                            <label><h3>{sellMinimumPercent}%</h3></label>
                        </div>
                    </div>
                    <label><h3>Buy</h3></label>
                    <div className='table-like'>
                        <div className='horizontal'>
                            <TokenSelect
                                onTokenSelected={(token) => {onBuyTokenChange(token?.mint)}}
                            />
                            <input
                                className={buyToken && buyAmount && buyAmount > 0n ? '' : 'invalid'}
                                value={buyAmountStr}
                                type={"number"}
                                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                    setBuyAmountStr(event.target.value)
                                }}
                            />
                        </div>
                    </div>
                    <label
                        className='active-label'
                        onClick={()=>{setFlippedPrice(!flippedPrice)}}
                    >
                        <h3>{
                            buyToken && sellToken?.address.equals(buyToken?.address)
                                ? "Sell and Price tokens are the same"
                                : priceString
                        }</h3>
                    </label>
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
                                copybutton={true}
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
                                copybutton={true}
                            />
                            <div className="label-attention">
                                <b>
                                <p>It is only possible to fill the order with this unlock key!</p>
                                <p>Save it and provide to selected buyers</p>
                                </b>
                            </div>
                        </div>
                    </Visibility>
                    <ValueEdit
                        name={"Order URL:"}
                        readonly={true}
                        value={orderURL ? orderURL : undefined}
                        copybutton={true}
                    />
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