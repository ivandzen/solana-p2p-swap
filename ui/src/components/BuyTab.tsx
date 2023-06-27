import { Connection, PublicKey } from "@solana/web3.js";
import {OrderDescription} from "./OrderDescription";
import React, { ChangeEvent, FC, InputHTMLAttributes, useEffect, useState } from "react";
import {ValueEdit} from "./ValueEdit";
import {
    amountToDecimal,
    FillOrderProps,
    fillOrderTransaction,
    getOrderDescriptionChecked,
    parseBigInt, parseUnlockKey,
    publicKeyChecker,
    unlockKeyChecker
} from "../p2p-swap";
import {P2P_SWAP_DEVNET} from "../p2p-swap";
import { SupportedTokens, useApp } from "../AppContext";
import {Button} from "./Button";
import {Visibility} from "./Visibility";
import {
    SimplifiedOrderDescription,
    SimplifiedOrderDescriptionData
} from "./SimplifiedOrderDescription";
import Decimal from "decimal.js";

function getTokenName(supportedTokens: SupportedTokens, inPubkey: PublicKey): string {
    for (let [label, pubkey] of supportedTokens) {
        if (pubkey.equals(inPubkey)) {
            return label;
        }
    }

    return inPubkey.toBase58();
}

const BuyTab: FC = () => {
    const {
        orderAddress, setOrderAddress,
        unlockKey, setUnlockKey,
        buyOrderDescription, setBuyOrderDescription,
        setAppMode,
        connection,
        wallet,
        supportedTokens,
        walletTokens
    } = useApp();

    const [errorDescription, setErrorDescription] = useState<string|null>("Please, select order");
    const [buyAmount, setBuyAmount] = useState<string>("0");
    const [buyAmountDec, setBuyAmountDec] = useState<Decimal|null>(null);
    const [sellAmount, setSellAmount] = useState<string>("0");
    const [sellAmountDec, setSellAmountDec] = useState<Decimal|null>(null);
    const [fillOrderProps, setFillOrderProps] = useState<FillOrderProps|null>(null);
    const [simplifiedDescription, setSimplifiedDescription] = useState<SimplifiedOrderDescriptionData|null>(null);
    const [expandDetails, setExpandDetails] = useState<boolean>(false);

    useEffect(() => {
        async function updateOrderDescription(
            connection: Connection,
            orderAddress: PublicKey
        ) {
            setBuyOrderDescription(null);
            setSimplifiedDescription(null);
            setErrorDescription("Loading...");
            try {
                let orderDescription = await getOrderDescriptionChecked(
                    connection,
                    orderAddress,
                    P2P_SWAP_DEVNET
                );

                if (orderDescription.buyToken && orderDescription.sellToken) {
                    let price =
                        amountToDecimal(
                            orderDescription.buyAmount,
                            orderDescription.buyToken.decimals
                        ).div(
                            amountToDecimal(
                                orderDescription.sellAmount,
                                orderDescription.sellToken.decimals
                            )
                        );

                    setSimplifiedDescription(
                        {
                            price: price,
                            orderTokenName: getTokenName(supportedTokens, orderDescription.tokenMint),
                            priceTokenName: getTokenName(supportedTokens, orderDescription.priceMint),
                            minSellAmount:
                                amountToDecimal(
                                    orderDescription.minSellAmount,
                                    orderDescription.sellToken.decimals
                                ),
                            remainsToFill:
                                amountToDecimal(
                                    orderDescription.remainsToFill,
                                    orderDescription.sellToken.decimals
                                ),
                            isPrivate: orderDescription.isPrivate
                        });
                }



                setBuyOrderDescription(orderDescription);
                setErrorDescription(null);
            } catch (e: any) {
                setErrorDescription(e.toString());
            }
        }

        if (orderAddress)
            updateOrderDescription(connection, new PublicKey(orderAddress)).then(() => {});
        else
            setErrorDescription('Please, select order');
    }, [connection, orderAddress]);

    useEffect(() => {
        const sendTransaction = async () => {
            if (
                !buyAmountDec
                || !buyOrderDescription
                || !buyOrderDescription.sellToken
            ) {
                setFillOrderProps(null);
                return;
            }

            let signer = wallet?.adapter.publicKey;
            let unlockKeyParsed = parseUnlockKey(unlockKey);
            let buyAmountParsed = BigInt(buyAmountDec.mul(new Decimal(10).pow(buyOrderDescription?.sellToken?.decimals)).toString());
            if (signer && orderAddress && buyOrderDescription &&
                buyAmountParsed && buyAmountParsed > BigInt(0)) {
                let props: FillOrderProps = {
                    order: buyOrderDescription,
                    orderAddress: orderAddress,
                    programId: P2P_SWAP_DEVNET,
                    sellTokenAmount: buyAmountParsed,
                    signer: signer,
                };

                if (buyOrderDescription.isPrivate && unlockKeyParsed) {
                    props.unlockKey = unlockKeyParsed;
                }

                setFillOrderProps(props);
            } else {
                setFillOrderProps(null);
            }
        };

        sendTransaction().then(()=>{});
    }, [orderAddress, buyAmountDec, unlockKey]);

    const onOrderAddressChange = (value: string|null) => {
        if (value && value.length == 0) {
            setErrorDescription('Please, select order');
            return;
        }

        try {
            setOrderAddress(value ? new PublicKey(value) : null);
        } catch (e) {
            setErrorDescription('Wrong order address');
        }
    }

    const onBuyClicked = async () => {
        if (!fillOrderProps) {
            return;
        }

        let props = fillOrderProps;
        setAppMode("Send-Txn");

        try {
            let txn = await fillOrderTransaction(connection, props);
            await wallet?.adapter.sendTransaction(txn, connection);
        } catch (e) {
            console.log(`Failed to fill order: ${e}`);
        }

        setAppMode("Buy");
    }

    const onBuyAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
        setBuyAmount(event.target.value);
        if (!simplifiedDescription) {
            return;
        }

        try {
            let amountDec = new Decimal(event.target.value);
            if (amountDec.lessThan(simplifiedDescription.minSellAmount)) {
                amountDec = simplifiedDescription.minSellAmount;
            }

            if (amountDec.greaterThan(simplifiedDescription.remainsToFill)) {
                amountDec = simplifiedDescription.remainsToFill;
            }

            setBuyAmount(amountDec.toString());
            setBuyAmountDec(amountDec);
        } catch (e) {
            setBuyAmountDec(null);
        }
    }

    useEffect(() => {
        setErrorDescription(null);
        if (
            !buyOrderDescription
            || !buyOrderDescription.buyToken
            || !simplifiedDescription
            || !buyAmountDec
        ) {
            setSellAmountDec(null);
            return;
        }

        try {
            let walletPriceToken = walletTokens.get(simplifiedDescription.priceTokenName);
            if (!walletPriceToken) {
                setErrorDescription(`You dont have ${simplifiedDescription.priceTokenName} to fill this order`);
                setSellAmountDec(null);
                setSellAmount('0');
                return;
            }

            let sellAmountDec = buyAmountDec.mul(simplifiedDescription?.price);
            let walletAmountDec = amountToDecimal(
                walletPriceToken.tokenAmount,
                buyOrderDescription?.buyToken?.decimals
            );

            if (sellAmountDec.greaterThan(walletAmountDec)) {
                setErrorDescription(`You have not enough ${simplifiedDescription.priceTokenName}`);
                setSellAmountDec(null);
                setSellAmount('0');
                return;
            }

            setSellAmountDec(sellAmountDec);
            setSellAmount(sellAmountDec.toString());
        } catch (e) {
            setSellAmountDec(null);
            setSellAmount('0');
        }
    }, [buyAmountDec]);

    return (
        <div className="vertical">
            <ValueEdit
                name={"Order Address:"}
                onChange={onOrderAddressChange}
                valueChecker={publicKeyChecker}
                value={orderAddress ? orderAddress.toString() : ""}
            />
            <SimplifiedOrderDescription data={simplifiedDescription}/>
            <Button
                name={"View details"}
                onClick={()=>{}}
                checkable={true}
                checked={expandDetails}
                setChecked={setExpandDetails}
            />
            <Visibility isActive={expandDetails}>
                <OrderDescription description={buyOrderDescription}/>
            </Visibility>
            <Visibility isActive={!!errorDescription}>
                <h1>{errorDescription}</h1>
            </Visibility>
            <Visibility isActive={!!buyOrderDescription}>
                <div className="table-like">
                    <div className='horizontal'>
                        <label><b>You want to get :</b></label>
                        <input
                            className={buyAmountDec ? '' : 'invalid'}
                            type='number'
                            value={buyAmount}
                            onChange={onBuyAmountChange}
                        />
                        <label><b>{simplifiedDescription?.orderTokenName}</b></label>
                    </div>
                    <div className='horizontal'>
                        <label><b>You will give :</b></label>
                        <input
                            className={sellAmountDec ? '' : 'invalid'}
                            type='number'
                            value={sellAmount}
                            readOnly={true}
                        />
                        <label><b>{simplifiedDescription?.priceTokenName}</b></label>
                    </div>
                    <Visibility isActive={!!buyOrderDescription && buyOrderDescription.isPrivate}>
                        <ValueEdit
                            name="Unlock signature:"
                            onChange={setUnlockKey}
                            valueChecker={unlockKeyChecker}
                            value={unlockKey ? unlockKey : ""}
                        />
                    </Visibility>
                    <Button
                        name="Buy"
                        onClick={onBuyClicked}
                        disabled={fillOrderProps === null}
                    />
                </div>
            </Visibility>
        </div>
    )
}

export { BuyTab }