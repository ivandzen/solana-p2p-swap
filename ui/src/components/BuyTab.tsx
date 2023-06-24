import { Connection, PublicKey } from "@solana/web3.js";
import {OrderDescription} from "./OrderDescription";
import React, {FC, useEffect, useState} from "react";
import {ValueEdit} from "./ValueEdit";
import {
    FillOrderProps,
    fillOrderTransaction,
    getOrderDescriptionChecked,
    parseBigInt, parseUnlockKey,
    publicKeyChecker,
    unlockKeyChecker
} from "../p2p-swap";
import {P2P_SWAP_DEVNET} from "../p2p-swap";
import {useApp} from "../AppContext";
import {Button} from "./Button";
import {Visibility} from "./Visibility";
import { TokenBox } from "./TokenBox";

const BuyTab: FC = () => {
    const {
        orderAddress, setOrderAddress,
        unlockKey, setUnlockKey,
        buyOrderDescription, setBuyOrderDescription,
        setAppMode,
        connection,
        wallet
    } = useApp();

    const [errorDescription, setErrorDescription] = useState<string|null>("Please, select order");
    const [buyAmount, setBuyAmount] = useState<string>("0");
    const [fillOrderProps, setFillOrderProps] = useState<FillOrderProps|null>(null);

    useEffect(() => {
        async function updateOrderDescription(
            connection: Connection,
            orderAddress: PublicKey
        ) {
            setBuyOrderDescription(null);
            setErrorDescription("Loading...");
            try {
                let orderDescription
                    = await getOrderDescriptionChecked(connection, orderAddress, P2P_SWAP_DEVNET);
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
            let signer = wallet?.adapter.publicKey;
            let unlockKeyParsed = parseUnlockKey(unlockKey);
            let buyAmountParsed = parseBigInt(buyAmount);
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
    }, [orderAddress, buyAmount, unlockKey]);

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

    return (
        <div className="vertical">
            <ValueEdit
                name={"Order Address:"}
                onChange={onOrderAddressChange}
                valueChecker={publicKeyChecker}
                value={orderAddress ? orderAddress.toString() : ""}
            />
            <OrderDescription description={buyOrderDescription}/>
            <Visibility isActive={!!errorDescription}>
                <h1>{errorDescription}</h1>
            </Visibility>
            <Visibility isActive={!!buyOrderDescription}>
                <div className="vertical">
                    <ValueEdit
                        name="Amount:"
                        onChange={setBuyAmount}
                        valueChecker={(value) => {
                            if (!value) {
                                return false;
                            }

                            try {
                                let v = BigInt(value);
                                return v > 0;
                            } catch (e) {return false}
                        }}
                        readonly={false}
                        value={buyAmount.toString()}
                    />
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
            <div className="table-like">
                <div className='horizontal'>
                    <TokenBox
                        name="I want to sell:"
                        mint={buyOrderDescription?.sellToken ? buyOrderDescription.sellToken : null}
                    />
                </div>
                <div className='horizontal'>
                    <TokenBox
                        name="I want to buy:"
                        mint={buyOrderDescription?.sellToken ? buyOrderDescription.sellToken : null}
                    />
                </div>
                <div className='horizontal'>
                    <label><b>Minimum to sell:</b></label>
                    <ValueEdit name='' type='number'/>
                </div>
            </div>
        </div>
    )
}

export { BuyTab }