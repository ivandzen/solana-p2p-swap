import { Connection, PublicKey } from "@solana/web3.js";
import React, { ChangeEvent, FC, useEffect, useState } from "react";
import {ValueEdit} from "./ValueEdit";
import {
    amountToDecimal,
    FillOrderProps,
    fillOrderTransaction,
    getOrderDescriptionChecked,
    parseUnlockKey,
    publicKeyChecker,
    unlockKeyChecker
} from "../p2p-swap";
import {P2P_SWAP_DEVNET} from "../p2p-swap";
import { getTokenName, useApp } from "../AppContext";
import {Button} from "./Button";
import {Visibility} from "./Visibility";
import {
    SimplifiedOrderDescription,
    SimplifiedOrderDescriptionData
} from "./SimplifiedOrderDescription";
import Decimal from "decimal.js";


const BuyTab: FC = () => {
    const {
        orderAddress, setOrderAddress,
        unlockKey, setUnlockKey,
        buyOrderDescription, setBuyOrderDescription,
        connection,
        wallet,
        supportedTokens,
        walletTokens,
        showInfoMessage,
        showErrorMessage,
        domain
    } = useApp();

    const [errorDescription, setErrorDescription] = useState<string|null>("Please, select order");
    const [buyAmount, setBuyAmount] = useState<string>("0");
    const [buyAmountDec, setBuyAmountDec] = useState<Decimal|null>(null);
    const [sellAmount, setSellAmount] = useState<string>("0");
    const [sellAmountDec, setSellAmountDec] = useState<Decimal|null>(null);
    const [fillOrderProps, setFillOrderProps] = useState<FillOrderProps|null>(null);
    const [simplifiedDescription, setSimplifiedDescription] = useState<SimplifiedOrderDescriptionData|null>(null);

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

                    let orderTokenName = getTokenName(supportedTokens, orderDescription.tokenMint);
                    let priceTokenName = getTokenName(supportedTokens, orderDescription.priceMint);
                    if (orderTokenName && priceTokenName) {
                        setSimplifiedDescription(
                            {
                                price: price,
                                orderTokenName: orderTokenName,
                                priceTokenName: priceTokenName,
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
        showInfoMessage("Sending transaction...", false);

        try {
            if (
                !simplifiedDescription
                || !buyOrderDescription
                || !buyOrderDescription.buyToken
                || !sellAmountDec
            ) {
                return;
            }

            let walletPriceToken = walletTokens.get(buyOrderDescription.priceMint.toString());
            if (!walletPriceToken) {
                throw `You dont have ${simplifiedDescription.priceTokenName} to fill this order`;
            }

            let walletAmountDec = amountToDecimal(
                walletPriceToken.tokenAmount,
                buyOrderDescription?.buyToken?.decimals
            );

            if (sellAmountDec.greaterThan(walletAmountDec)) {
                throw `You have not enough ${simplifiedDescription.priceTokenName}`;
            }

            let txn = await fillOrderTransaction(connection, props);
            await wallet?.adapter.sendTransaction(txn, connection);
        } catch (e: any) {
            showErrorMessage(e.toString(), true);
            return;
        }

        showInfoMessage('Transaction sent', true);
    }

    const onBuyAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
        setBuyAmount(event.target.value);

    }

    useEffect(() => {
        setErrorDescription(null);

        if (!simplifiedDescription) {
            setBuyAmountDec(null);
            setSellAmountDec(null);
            setSellAmount('0');
            return;
        }

        try {
            let buyAmountDec = new Decimal(buyAmount);
            if (buyAmountDec.lessThan(simplifiedDescription.minSellAmount)) {
                buyAmountDec = simplifiedDescription.minSellAmount;
                setBuyAmount(buyAmountDec.toString());
            }

            if (buyAmountDec.greaterThan(simplifiedDescription.remainsToFill)) {
                buyAmountDec = simplifiedDescription.remainsToFill;
                setBuyAmount(buyAmountDec.toString());
            }

            setBuyAmountDec(buyAmountDec);
            let sellAmountDec = buyAmountDec.mul(simplifiedDescription?.price);
            setSellAmountDec(sellAmountDec);
            setSellAmount(sellAmountDec.toString());
        } catch (e: any) {
            setBuyAmountDec(null);
            setSellAmountDec(null);
            setSellAmount('0');
        }
    }, [buyAmount]);

    const copyOrderURL = () => {
        if (!buyOrderDescription) {
            return;
        }

        navigator.clipboard.writeText(`${domain}/?mode=Buy&order_address=${orderAddress?.toBase58()}`)
            .then(()=>{});
    };

    return (
        <div className="vertical">
            <ValueEdit
                name={"Order"}
                onChange={onOrderAddressChange}
                valueChecker={publicKeyChecker}
                value={orderAddress ? orderAddress.toString() : ""}
                copybutton={true}
            />
            <Visibility isActive={!!errorDescription}>
                <h1>{errorDescription}</h1>
            </Visibility>
            <Visibility isActive={!errorDescription && !!buyOrderDescription}>
                <div className="table-like">
                    <button
                        className='tabbutton-active'
                        onClick={copyOrderURL}
                        disabled={!buyOrderDescription}
                    >
                        Copy order URL
                    </button>
                    <SimplifiedOrderDescription data={simplifiedDescription}/>
                    <input
                        className={buyAmountDec ? '' : 'invalid'}
                        type='number'
                        value={buyAmount}
                        onChange={onBuyAmountChange}
                    />
                    <label className='active-label'><h3>You have to pay {sellAmount} {simplifiedDescription?.priceTokenName}</h3></label>
                    <Visibility isActive={!!buyOrderDescription && buyOrderDescription.isPrivate}>
                        <ValueEdit
                            name="Unlock key"
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